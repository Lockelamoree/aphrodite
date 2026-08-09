import { cookies } from "next/headers";

import { Concierge } from "@/components/Concierge";
import { LIVE_COOKIE_NAME, gateEnabled, liveAllowed } from "@/lib/auth/gate";
import { env } from "@/lib/env";

// Read the environment PER REQUEST, not once at build time.
//
// Without this the route is statically prerendered, so both flags below freeze to
// whatever the build environment happened to hold — and the build has no reason to
// carry runtime secrets. The first deploy proved the cost: the live site served
// captured fixture renders with the "Demo mode · sample renders" banner ABSENT,
// because YOUCAM_FIXTURES was unset while building. Verified against the deployed
// HTML: 0 occurrences of "Demo mode" live, 1 on the dev server.
//
// A page whose honesty labelling depends on build-time env is a page that will
// eventually lie.
export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const unlocked = liveAllowed(cookieStore.get(LIVE_COOKIE_NAME)?.value);

  // What THIS visitor will actually get — not what the host default happens to be.
  //
  // Turning YOUCAM_FIXTURES off to make live runs available to judges broke this
  // once already: the host default said live, so the banner disappeared, while an
  // unauthenticated visitor still received captured samples through the gate. The
  // page claimed one thing and the run delivered another. Whether the renders are
  // captured depends on the host default AND on whether this request is unlocked.
  const demoMode = env.youcamFixtures || (gateEnabled() && !unlocked);

  // Same reasoning for the engine: a key on the host does not mean this visitor
  // may use it, so the toggle must reflect the gate rather than mere key presence.
  const hasKey = Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  );
  const agenticAvailable = hasKey && unlocked;

  return <Concierge agenticAvailable={agenticAvailable} demoMode={demoMode} />;
}
