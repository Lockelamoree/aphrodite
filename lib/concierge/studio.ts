import "server-only";

import { imageInputFromString } from "@/lib/concierge/image";
import type { ConciergeEvent, StudioKind, StudioRequest } from "@/lib/concierge/types";
import { tryOnHairColor } from "@/lib/youcam/hairColor";
import { tryOnHairstyle } from "@/lib/youcam/hairstyle";
import { applyMakeup } from "@/lib/youcam/makeup";
import { analyzeSkin } from "@/lib/youcam/skin";
import type { RenderedImage } from "@/lib/youcam/types";

/**
 * Studio experiences — the "what's next with Aphrodite" try-ons. Each runs ONE
 * YouCam feature on the user's existing selfie and emits the same ConciergeEvent
 * stream a full run does (tool_start → narration → image/skin), so the client
 * reuses its SSE parsing. Rule-based and self-contained; no LLM needed.
 */

const LABEL: Record<StudioKind, string> = {
  hair_color: "YouCam AI Hair Color",
  hairstyle: "YouCam AI Hairstyle Generator",
  makeup: "YouCam AI Makeup Try-On",
  skin_recheck: "YouCam AI Skin Analysis",
};

const OPENER: Record<StudioKind, string> = {
  hair_color: "Let's play with color. Rendering a new shade on you with YouCam ✨",
  hairstyle: "Trying a fresh cut on you — YouCam is styling it now.",
  makeup: "A soft occasion look, in your palette — painting it on with YouCam.",
  skin_recheck: "Let's re-read your skin so you can see how it's tracking. ✨",
};

const CLOSER: Record<Exclude<StudioKind, "skin_recheck">, string> = {
  hair_color: "Here's the new color rendered on you — drag to compare with your own shade.",
  hairstyle: "Here's the new style on you — drag to compare with your current hair.",
  makeup: "Here's the look on you — drag to compare with your bare face.",
};

/** Pick a preset that flatters the detected undertone (warm/cool/neutral). */
export function hairPresetFor(undertone?: string): string {
  const u = undertone?.toLowerCase() ?? "";
  if (u.includes("warm")) return "Copper Red";
  if (u.includes("cool")) return "Ash Gray";
  return "Chocolate Brown";
}

export async function* runStudio(req: StudioRequest): AsyncGenerator<ConciergeEvent> {
  const person = imageInputFromString(req.personImage);
  const kind = req.kind;
  yield { type: "tool_start", name: `studio_${kind}`, label: LABEL[kind] };
  yield* say(OPENER[kind]);

  try {
    if (kind === "skin_recheck") {
      const skin = await analyzeSkin(person);
      yield { type: "skin", analysis: skin };
      if (skin.overlayUrl) yield { type: "image", slot: "studio", url: skin.overlayUrl };
      yield* say("Here's your fresh read. Follow your plan and re-check in a week to watch it move.");
      return;
    }

    const img: RenderedImage =
      kind === "hair_color"
        ? await tryOnHairColor(person, hairPresetFor(req.undertone))
        : kind === "hairstyle"
          ? await tryOnHairstyle(person)
          : await applyMakeup(person, req.undertone);

    if (img.url) {
      yield { type: "image", slot: "studio", url: img.url };
      yield* say(CLOSER[kind]);
    } else {
      // Honest degrade: fixtures/demo has no captured render for this photo.
      yield* say(
        "I can render this on a live YouCam connection — connect YouCam (or use the sample selfie in demo) to try it on your own photo.",
      );
    }
  } catch {
    yield* say("That render didn't come through this time — let's try again in a moment.");
  }
}

async function* say(text: string): AsyncGenerator<ConciergeEvent> {
  yield { type: "narration", text: `${text}\n\n` };
  await sleep(140);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
