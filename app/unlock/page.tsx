import Link from "next/link";

import { AphroditeMark } from "@/components/Companion";
import { gateEnabled } from "@/lib/auth/gate";
import { read as readLedger } from "@/lib/live/ledger";

export const dynamic = "force-dynamic";

/**
 * Judge mode.
 *
 * Note what this page is NOT: a wall in front of the product. Anyone can use
 * Aphrodite end to end without ever seeing this — a judge who must type a code
 * before seeing anything is a judge who closes the tab. The code unlocks only the
 * two paths that cost money: real YouCam renders and the LLM-driven engine.
 *
 * A plain form post, no client JavaScript. The production CSP allows
 * `form-action 'self'` and nothing inline, so this works under the real headers
 * rather than only on a dev server.
 */
export default function Unlock({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  return <UnlockBody searchParams={searchParams} />;
}

async function UnlockBody({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const failed = params.error === "1";
  const enabled = gateEnabled();
  const ledger = readLedger();

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-16">
      <div className="mb-8 flex items-center gap-2">
        <AphroditeMark size={26} />
        <span className="font-serif text-2xl tracking-tight text-primary">Aphrodite</span>
        <span className="text-sm text-muted">judge mode</span>
      </div>

      <h1 className="font-serif text-3xl text-ink">Unlock the live run</h1>

      {!enabled ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <p className="text-sm text-ink">
            No access gate is configured on this host, so nothing needs unlocking — whatever
            this instance is set to do, it already does for everyone.
          </p>
          <p className="mt-3 text-sm text-muted">
            The gate switches itself on only when both <code>APHRODITE_LIVE_CODES</code> and{" "}
            <code>APHRODITE_AUTH_SECRET</code> are set, which is what keeps local development
            and the test suite ungated without a special case.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-muted">
            Aphrodite is fully usable without a code — you just get captured sample renders
            instead of live ones, at zero API cost. A code turns on the two paths that spend
            money: real YouCam renders, and the AI-driven engine.
          </p>

          <div className="mt-5 rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <p className="text-sm text-ink">
              <span className="font-medium">{ledger.remaining}</span> of{" "}
              <span className="font-medium">{ledger.budget}</span> live runs left on this
              instance.
            </p>
            <p className="mt-1 text-xs text-muted">
              The YouCam free tier is finite and one full run costs four to five API tasks, so
              live runs are metered as well as gated. When the budget is gone the app keeps
              working and says on screen that it switched to captured samples — it does not
              quietly pass one off as the other.
            </p>
          </div>

          <form method="POST" action="/api/unlock" className="mt-6">
            <label htmlFor="code" className="block text-sm font-medium text-ink">
              Access code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              autoComplete="off"
              required
              placeholder="JUDGE-…"
              aria-describedby={failed ? "code-error" : undefined}
              aria-invalid={failed || undefined}
              className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink transition focus:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {failed && (
              <p id="code-error" className="mt-2 text-sm text-rose" role="alert">
                That code isn&apos;t valid. Check for a stray space, or ask for a fresh one.
              </p>
            )}
            <button
              type="submit"
              className="mt-5 rounded-full bg-primary px-7 py-3 text-base font-medium text-white shadow-sm transition hover:bg-[#8c3556] focus-visible:ring-2 focus-visible:ring-primary"
            >
              Unlock
            </button>
          </form>
        </>
      )}

      <p className="mt-10 text-sm">
        <Link href="/" className="text-primary hover:underline">
          ← Back to Aphrodite
        </Link>
      </p>
    </main>
  );
}
