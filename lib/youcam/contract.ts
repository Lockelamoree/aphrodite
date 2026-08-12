import "server-only";

/**
 * The YouCam REST contract, pinned to what the live API actually answered.
 *
 * Every value below was transcribed from a committed receipt under
 * `hackathon/receipts/` — the provider's own envelopes from the units-on session
 * of 2026-08-10, including the three tasks that failed. Nothing here is a guess
 * at a schema and nothing here is produced by calling the API: serving this costs
 * ZERO units, which is the only reason it can sit on a route a judge may hit
 * twice.
 *
 * That distinction is the whole design of `/api/dev/verify`. The route used to be
 * a live harness that 404'd in production, so the kill gate cited as its
 * judging-time evidence an endpoint that answered nothing. Splitting it in two —
 * a free replay of the pinned contract, and an explicitly metered live run —
 * makes the evidence reachable without making a page refresh cost money.
 *
 * If a future run contradicts a line here, change the line and say which receipt
 * overruled it. A pinned contract that drifts from the receipts is worse than no
 * pin at all.
 */

export type ContractStep = {
  feature: string;
  /** What this step is for, in product terms. */
  purpose: string;
  fileEndpoint: string;
  taskEndpoint: string;
  /** Keys of the flat `runTask` body, as sent. */
  requestBodyKeys: string[];
  outcome: "success" | "provider_error";
  /** The receipt directory this row was transcribed from. */
  receipt: string;
  /** A real provider task id from that receipt, cross-checkable in the account record. */
  taskId: string;
  durationMs: number;
  /** Verbatim shape of the terminal poll envelope. */
  terminalEnvelope: Record<string, unknown>;
  /** sha256/bytes of the image YouCam returned, when it returned one. */
  render?: { sha256: string; bytes: number; contentType: string };
  /** Why it failed, when it failed, and what that says about the product. */
  note?: string;
};

export const CONTRACT_CAPTURED_AT = "2026-08-10T12:34:40.873Z";
export const CONTRACT_API_BASE = "https://yce-api-01.perfectcorp.com";
export const CONTRACT_GIT_REVISION = "bc1ef29";

/**
 * The four-step call sequence `lib/youcam/client.ts` implements. Confirmed end to
 * end against the live API on 2026-08-10, on both the succeeding and the failing
 * steps — a failure that comes back as a `task_status: "error"` envelope rather
 * than a transport error is itself proof the contract is right.
 */
export const CONTRACT_SEQUENCE = [
  "POST <fileEndpoint> → presigned PUT url + headers, then PUT the bytes with the provider's headers merged in",
  "POST <taskEndpoint> with a FLAT body (not nested under `request`), carrying src_file_id",
  "GET <taskEndpoint>?task_id=… on an interval until task_status leaves `running`",
  "read results from the terminal envelope; a signed S3 url expires in 7200 s, so download and hash immediately",
] as const;

export const CONTRACT_STEPS: ContractStep[] = [
  {
    feature: "apparel_vto_cloth_v3",
    purpose: "Renders the chosen garment onto the shopper's own photo — the Apparel VTO half of the fused chain.",
    fileEndpoint: "/s2s/v2.0/file/cloth-v3",
    taskEndpoint: "/s2s/v2.0/task/cloth-v3",
    requestBodyKeys: ["src_file_id", "ref_file_url", "garment_category"],
    outcome: "success",
    receipt: "hackathon/receipts/000-misaimed-attempt/receipt.json",
    taskId: "PKOBHBjk0IwCRBfgENvbK4ZI5obDtW3OF0T6tbZzM_891zBg43XgCFLRjtP-VrDKMb77jREaFmG12MANpeiPByGjdvefRaBmK3yt0KViQEw",
    durationMs: 14681,
    terminalEnvelope: {
      status: 200,
      data: { error: null, results: { url: "<signed s3 url, expires in 7200s>" }, task_status: "success" },
    },
    render: {
      sha256: "27c9d899f431ddf6b6ab33a63c1199380612bb904aa9d68bb15fa58d19efb52a",
      bytes: 222607,
      contentType: "image/jpeg",
    },
    note: "Six `running` polls before the url appeared. Note the url appears one poll BEFORE task_status flips to success — polling on the url instead of the status would read a half-written result.",
  },
  {
    feature: "skin_tone_analysis",
    purpose: "Reads undertone and hair colour from the face, which is what selects a garment — the Skin AI half of the chain.",
    fileEndpoint: "/s2s/v2.0/file/skin-tone-analysis",
    taskEndpoint: "/s2s/v2.0/task/skin-tone-analysis",
    requestBodyKeys: ["src_file_id"],
    outcome: "success",
    receipt: "hackathon/receipts/000-misaimed-attempt/receipt.json",
    taskId: "qGwGFMp-jM-vnUBaBwC8erQrTIRz4vRBIyxp5Zcf3PZsA0OStjNk8uXl47CaZ7Cl_IHPGmj3SYYLk5OiV4VCtxFIc4D1HKjGxs7nz4_FIgg",
    durationMs: 7005,
    terminalEnvelope: {
      status: 200,
      data: {
        error: null,
        results: {
          color: {
            eye_color: "#000000",
            lip_color: "#986861",
            eyebrow_color: "#3e3834",
            skin_color: "#b7947d",
            hair_color: "#B56637",
            hair_color_name: "Auburn",
          },
          face_quality: { has_face: true, area: "good", frontal: "good", lighting: "good", faceangle: "good" },
        },
        task_status: "success",
      },
    },
    note: "Real measurements on public/samples/full-body.jpg. These are the numbers behind the warm sample's colour read.",
  },
  {
    feature: "photo_lighting",
    purpose: "Relights the shopper's photo for the look board.",
    fileEndpoint: "/s2s/v2.0/file/lighting",
    taskEndpoint: "/s2s/v2.0/task/lighting",
    requestBodyKeys: ["src_file_id"],
    outcome: "success",
    receipt: "hackathon/receipts/001/receipt.json",
    taskId: "3SHfgaOGeODI8g5LuulyMdScaYemA_B2QRWoax6q_pTPZzCKSksAW7afR0FExhcM2m1CGpLRP9Zbg8yVrCWNCjMNs2dYJoUCiZpB8_vrlNU",
    durationMs: 3581,
    terminalEnvelope: {
      status: 200,
      data: { error: null, results: { url: "<signed s3 url, expires in 7200s>" }, task_status: "success" },
    },
    render: {
      sha256: "44cd13b02b268259eec0b9a1918d8fcfa68333ab1a0aac0c88c01b033c7b0181",
      bytes: 126542,
      contentType: "image/jpeg",
    },
    note: "The returned bytes are committed at hackathon/receipts/001/photo_lighting.render.jpg and re-hashed after download, so this row is checkable offline.",
  },
  {
    feature: "skin_analysis",
    purpose: "Scores ten skin concerns and returns per-concern masks — the input to the skincare countdown.",
    fileEndpoint: "/s2s/v2.1/file/skin-analysis",
    taskEndpoint: "/s2s/v2.1/task/skin-analysis",
    requestBodyKeys: ["src_file_id", "dst_actions", "format", "miniserver_args"],
    outcome: "provider_error",
    receipt: "hackathon/receipts/001/receipt.json",
    taskId: "c7T3vNWgHHYWcLggioP64zfd0hdmoNT1O6zb356KzpFHOKctZv74OGxvIFr4TgWdZ1Dw5stRx3QX_3QtFuxIQ_pW0L5pGgwoOlVxfElKXLk",
    durationMs: 4915,
    terminalEnvelope: {
      status: 200,
      data: {
        error: "error_src_face_too_small",
        error_message: "The face area in the uploaded image is too small",
        results: null,
        task_status: "error",
      },
    },
    note: "Kept deliberately. This is the live rejection of public/samples/selfie.jpg — the app's own flagship sample — and it is the reason the fused chain has never completed in a single live run. Fixtures hide it entirely. See hackathon/COMPLIANCE.md for the five-image screening that followed.",
  },
];

/** Distinct API endpoints exercised against the live provider, success or error. */
export function contractEndpointsExercised(): string[] {
  return [...new Set(CONTRACT_STEPS.map((s) => s.taskEndpoint))];
}
