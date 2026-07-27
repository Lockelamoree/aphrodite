import { Concierge } from "@/components/Concierge";

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
