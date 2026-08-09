#!/usr/bin/env bash
# Deploy Aphrodite to the VPS.
#
#   ssh blastradius
#   cd /tmp && bash /opt/aphrodite-deploy/deploy.sh [<git-ref>]
#
# Invariants, in the order they matter:
#
#   1. Fresh clone into an IMMUTABLE release dir. Never build in place — a failed
#      build must not be able to damage what is currently serving.
#   2. flock, so two concurrent deploys cannot interleave.
#   3. The env file is written by key, never overwritten wholesale: operator-added
#      keys (the YouCam key, the judge codes) survive a deploy.
#   4. The symlink flip happens ONLY after the new release answers /healthz with
#      the expected revision. FAIL CLOSED: a failed gate leaves production running
#      the old release, untouched.
#   5. Rollback is flipping the symlink to a previous release and restarting.
#
# Run from an accessible CWD such as /tmp. The health gate runs as the
# unprivileged aphrodite user, which cannot traverse /root; inheriting a CWD under
# /root makes it fail for a reason that has nothing to do with the release.
set -euo pipefail

REF="${1:-main}"
REPO="https://github.com/Lockelamoree/aphrodite.git"
APP=aphrodite
USER_NAME=aphrodite
RELEASES=/opt/aphrodite-releases
LINK=/opt/aphrodite
ENV_FILE=/etc/aphrodite.env
PORT="$(grep -m1 '^PORT=' "$ENV_FILE" | cut -d= -f2- || echo 3100)"
KEEP=5

exec 9>/var/lock/aphrodite-deploy.lock
flock -n 9 || { echo "another deploy holds the lock; aborting"; exit 1; }

say() { printf '\n=== %s\n' "$*"; }

say "1/7 clone $REF"
TS="$(date -u +%Y%m%d%H%M%S)"
TMP="$(mktemp -d /tmp/aphrodite-build-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
git clone --quiet --depth 1 --branch "$REF" "$REPO" "$TMP/src"
SHA="$(git -C "$TMP/src" rev-parse --short HEAD)"
TARGET="$RELEASES/${SHA}-${TS}"
echo "  $REF -> $SHA  ->  $TARGET"

say "2/7 install + build (in the temp dir, not in the live tree)"
cd "$TMP/src"
npm ci --no-audit --no-fund --loglevel=error
# The build inlines NEXT_PUBLIC_* and needs no secrets: every server-side key is
# read at request time from the env file.
npm run build

say "3/7 publish as an immutable release"
mkdir -p "$TARGET"
cp -a "$TMP/src/." "$TARGET/"
chown -R root:root "$TARGET"
chmod -R a-w "$TARGET"
find "$TARGET" -type d -exec chmod a+rx {} +

say "4/7 record the revision (so /healthz can prove what is serving)"
python3 - "$ENV_FILE" "$SHA" <<'PY'
import re, sys
path, sha = sys.argv[1], sys.argv[2]
with open(path) as fh:
    text = fh.read()
# Update BY KEY. Rewriting the whole file would silently drop the YouCam key and
# the judge codes an operator set by hand between deploys.
if re.search(r'^APHRODITE_REVISION=', text, re.M):
    text = re.sub(r'^APHRODITE_REVISION=.*$', f'APHRODITE_REVISION={sha}', text, flags=re.M)
else:
    text = text.rstrip('\n') + f'\nAPHRODITE_REVISION={sha}\n'
with open(path, 'w') as fh:
    fh.write(text)
print(f'  APHRODITE_REVISION={sha}')
PY

say "5/7 health gate on the NEW release, before anything is switched"
CAND_PORT=$((PORT + 1))
set +e
runuser -u "$USER_NAME" -- env $(grep -vE '^\s*#|^\s*$' "$ENV_FILE" | xargs) PORT="$CAND_PORT" \
  /usr/bin/node "$TARGET/node_modules/.bin/next" start --port "$CAND_PORT" >"$TMP/candidate.log" 2>&1 &
CAND_PID=$!
GATE_OK=0
for _ in $(seq 1 40); do
  sleep 1
  BODY="$(curl -fsS --max-time 3 "http://127.0.0.1:$CAND_PORT/healthz" 2>/dev/null)" || continue
  echo "  $BODY"
  # Two assertions, both required: the process is the code we just built, and the
  # flagship model path is not in the silently-degraded middle state.
  echo "$BODY" | grep -q "\"revision\":\"$SHA\"" || { echo "  revision mismatch"; break; }
  if echo "$BODY" | grep -q '"agentic_engine":"key_present_unverified"'; then
    echo "  REFUSING: an LLM key is configured but unverified — the agentic engine"
    echo "  would look available and do nothing. Fix the key or the model id, or"
    echo "  set APHRODITE_ALLOW_DEGRADED_DEPLOY=1 deliberately."
    [ "${APHRODITE_ALLOW_DEGRADED_DEPLOY:-0}" = "1" ] && GATE_OK=1
    break
  fi
  GATE_OK=1
  break
done
kill "$CAND_PID" 2>/dev/null; wait "$CAND_PID" 2>/dev/null
set -e
if [ "$GATE_OK" != "1" ]; then
  echo
  echo "HEALTH GATE FAILED — production was NOT touched and is still serving the"
  echo "previous release. Candidate log:"
  tail -25 "$TMP/candidate.log" || true
  exit 1
fi
echo "  gate passed"

say "6/7 atomic symlink flip + restart"
ln -sfn "$TARGET" "$LINK.new"
mv -Tf "$LINK.new" "$LINK"
install -m 0644 "$TARGET/deploy/aphrodite.service" /etc/systemd/system/aphrodite.service
systemctl daemon-reload
systemctl enable --quiet aphrodite.service
systemctl restart aphrodite.service

# Caddy vhost, idempotent between markers.
if ! grep -q 'APHRODITE VHOST BEGIN' /etc/caddy/Caddyfile; then
  cat "$TARGET/deploy/Caddyfile.aphrodite" >> /etc/caddy/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
  systemctl reload caddy
  echo "  Caddy vhost appended + reloaded"
else
  echo "  Caddy vhost already present"
fi

say "7/7 verify what is actually serving"
for _ in $(seq 1 20); do
  sleep 1
  OUT="$(curl -fsS --max-time 4 "http://127.0.0.1:$PORT/healthz" 2>/dev/null)" && { echo "  local:  $OUT"; break; }
done
curl -fsS --max-time 10 "https://aphrodite.max-gutowski.de/healthz" 2>/dev/null | sed 's/^/  public: /' \
  || echo "  public: not answering yet (TLS may still be issuing — check: journalctl -u caddy -n 30)"

say "prune old releases (keeping $KEEP)"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  chmod -R u+w "$old"; rm -rf "$old"; echo "  removed $(basename "$old")"
done

echo
echo "Done. Serving $SHA."
echo "Rollback:  ln -sfn <previous release> /opt/aphrodite && systemctl restart aphrodite"
