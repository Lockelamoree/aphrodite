import "server-only";

import type { ImageInput } from "@/lib/youcam/types";

/** Convert a data URL or https URL (as sent from the client) into an ImageInput. */
export function imageInputFromString(s: string): ImageInput {
  if (s.startsWith("data:")) {
    const comma = s.indexOf(",");
    const meta = s.slice(5, comma); // e.g. "image/jpeg;base64"
    const b64 = s.slice(comma + 1);
    const contentType = meta.split(";")[0] || "image/jpeg";
    return { kind: "bytes", data: Buffer.from(b64, "base64"), contentType };
  }
  return { kind: "url", url: s };
}
