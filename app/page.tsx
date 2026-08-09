import { Concierge } from "@/components/Concierge";

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
// eventually lie. The same applies to agenticAvailable: baked at build time it
// would advertise the agentic engine on a host with no key, or hide it on a host
// that has one.
export const dynamic = "force-dynamic";

// Server component: derive whether the agentic engine is actually runnable from
// the presence of a real LLM key, so the client toggle can never drift from the
// deployed config (no separate NEXT_PUBLIC flag to keep in sync). Same for demo
// mode — the announcement bar must state it before the first run, not after.
export default function Home() {
  const agenticAvailable = Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(),
  );
  const demoMode = /^(1|true)$/i.test(process.env.YOUCAM_FIXTURES ?? "");
  return <Concierge agenticAvailable={agenticAvailable} demoMode={demoMode} />;
}
