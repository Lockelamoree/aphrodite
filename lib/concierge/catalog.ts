import type { StyleTrack } from "@/lib/concierge/types";
import type { ApparelCategory } from "@/lib/youcam/apparel";

/**
 * Curated demo catalogs.
 *
 * Garment `imageUrl`s are clean, front-facing reference shots (garment fully
 * visible, arms at sides, uncluttered background) that YouCam AI-Cloth renders
 * onto the user. The scarlet gown and slate suit are verified to render cleanly
 * via /api/dev/verify?garment=<id>&steps=apparel; keep new refs to the same
 * "front-facing, garment-forward" bar or the try-on quality drops.
 *
 * Skincare SKUs give the "shop the look" list concrete, priced, cross-category
 * products so the retail basket (skincare + fashion) is legible on screen.
 */
export type Formality = "casual" | "smart" | "formal";

export interface CatalogGarment {
  id: string;
  name: string;
  category: ApparelCategory;
  formality: Formality;
  /** Occasions this piece suits. */
  occasions: string[];
  /** Undertone this color flatters: "warm" | "cool" | "neutral". */
  flatters: "warm" | "cool" | "neutral";
  /** Dominant color as hex, for palette matching. */
  colorHex: string;
  /** Reference image for the VTO render (public, front-facing). */
  imageUrl: string;
  /** Retail-loop fields. */
  price: number;
  retailer: string;
  url: string;
}

/** Full-size VTO reference URL. */
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=85&fm=jpg`;
/** Thumbnail URL for shop-the-look product cards. */
const T = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&q=80&fm=jpg`;

/** Honest demo "shop" link — a real product search for the item. */
export function shopUrl(query: string): string {
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

export const GARMENT_CATALOG: CatalogGarment[] = [
  {
    id: "scarlet-gown",
    name: "Scarlet A-Line Gown",
    category: "dress",
    formality: "formal",
    occasions: ["wedding", "gala", "party", "date"],
    flatters: "warm",
    colorHex: "#C0392B",
    imageUrl: U("1595777457583-95e059d581b8"),
    price: 189,
    retailer: "The Aphrodite Edit",
    url: shopUrl("scarlet red a-line evening gown"),
  },
  {
    id: "sky-wrap-maxi",
    name: "Sky Wrap Maxi Dress",
    category: "dress",
    formality: "smart",
    occasions: ["date", "brunch", "party"],
    flatters: "cool",
    colorHex: "#A9C1D9",
    imageUrl: U("1539008835657-9e8e9680c956"),
    price: 124,
    retailer: "The Aphrodite Edit",
    url: shopUrl("light blue wrap maxi dress"),
  },
  {
    id: "slate-suit",
    name: "Slate Blue Three-Piece Suit",
    category: "full",
    formality: "formal",
    occasions: ["interview", "work", "wedding", "gala"],
    flatters: "cool",
    colorHex: "#46587C",
    imageUrl: U("1594938298603-c8148c4dae35"),
    price: 245,
    retailer: "The Aphrodite Edit",
    url: shopUrl("slate blue three piece suit"),
  },
  {
    id: "crisp-white-tee",
    name: "Crisp White Tee",
    category: "top",
    formality: "casual",
    occasions: ["brunch", "date", "work"],
    flatters: "neutral",
    colorHex: "#F2F2F0",
    imageUrl: U("1521572163474-6864f9cf17ab"),
    price: 42,
    retailer: "The Aphrodite Edit",
    url: shopUrl("crisp white cotton crew t-shirt"),
  },
];

export function findGarment(id: string): CatalogGarment | undefined {
  return GARMENT_CATALOG.find((g) => g.id === id);
}

/** Compact catalog view for the model's prompt/tool description. */
export function catalogForPrompt(): string {
  return GARMENT_CATALOG.map(
    (g) =>
      `- ${g.id}: ${g.name} (${g.category}, ${g.formality}, flatters ${g.flatters} undertones, occasions: ${g.occasions.join("/")})`,
  ).join("\n");
}

/* ---------------- skincare SKUs (the cross-category retail basket) ---------------- */

export interface SkincareSku {
  name: string;
  price: number;
  imageUrl: string;
}

const DEFAULT_SKINCARE_RETAILER = "The Aphrodite Beauty Edit";

/**
 * Priced skincare SKUs keyed by the product CATEGORY strings used in
 * CONCERN_ADVICE / the countdown / the day-of kit. Lets every "shop the look"
 * row carry a price + image + link instead of collapsing to one garment.
 */
export const SKINCARE_SKUS: Record<string, SkincareSku> = {
  "caffeine eye cream": { name: "Caffeine Eye Cream", price: 28, imageUrl: T("1620916566398-39f1143ab7be") },
  "firming moisturizer": { name: "Peptide Firming Moisturizer", price: 42, imageUrl: T("1608248543803-ba4f8c70ae0b") },
  "hydrating serum": { name: "Hyaluronic Hydrating Serum", price: 34, imageUrl: T("1556228578-8c89e6adf883") },
  "primer + SPF": { name: "Smoothing Primer SPF 30", price: 30, imageUrl: T("1598452963314-b09f397a5c48") },
  "vitamin C serum": { name: "Vitamin C Brightening Serum", price: 38, imageUrl: T("1571781926291-c477ebfd024b") },
  "niacinamide serum": { name: "Niacinamide 10% Serum", price: 24, imageUrl: T("1612817288484-6f916006741a") },
  "BHA exfoliant": { name: "BHA Pore Exfoliant", price: 30, imageUrl: T("1611930022073-b7a4ba5fcccd") },
  "AHA exfoliant": { name: "AHA Smoothing Exfoliant", price: 30, imageUrl: T("1631730359585-38a4935cbec4") },
  "peptide serum": { name: "Peptide Renewal Serum", price: 45, imageUrl: T("1608248543803-ba4f8c70ae0b") },
  "spot treatment": { name: "Blemish Spot Treatment", price: 18, imageUrl: T("1596755389378-c31d21fd1273") },
  "soothing moisturizer": { name: "Cica Soothing Moisturizer", price: 32, imageUrl: T("1556228578-8c89e6adf883") },
  "brightening serum": { name: "Radiance Brightening Serum", price: 38, imageUrl: T("1571781926291-c477ebfd024b") },
  // short-horizon / day-of kit
  "hydrating sheet mask": { name: "Hydrating Sheet Mask (5-pack)", price: 20, imageUrl: T("1596755389378-c31d21fd1273") },
  "hydrating mask": { name: "Overnight Hydrating Mask", price: 26, imageUrl: T("1556228578-8c89e6adf883") },
  "de-puff roller": { name: "Cooling De-Puff Roller", price: 22, imageUrl: T("1631730359585-38a4935cbec4") },
  "camouflage concealer": { name: "Camouflage Concealer", price: 26, imageUrl: T("1596755389378-c31d21fd1273") },
  "matte moisturizer": { name: "Matte Finish Moisturizer", price: 28, imageUrl: T("1608248543803-ba4f8c70ae0b") },
};

export interface PricedProduct {
  category: string;
  price: number;
  retailer: string;
  url: string;
  imageUrl: string;
}

/** A priced skincare SKU for a product category (generic fallback if unknown). */
export function skincareSkuFor(category: string): PricedProduct {
  const sku = SKINCARE_SKUS[category];
  const name = sku?.name ?? titleCaseWords(category);
  return {
    category: name,
    price: sku?.price ?? 30,
    retailer: DEFAULT_SKINCARE_RETAILER,
    url: shopUrl(`${name} skincare`),
    imageUrl: sku?.imageUrl ?? T("1556228578-8c89e6adf883"),
  };
}

function titleCaseWords(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------------- accessories + makeup (complete-the-look basket) ---------------- */

export interface AccessorySku {
  category: string;
  why: string;
  price: number;
  retailer: string;
  url: string;
  imageUrl: string;
}

function acc(name: string, price: number, imageId: string, why: string): AccessorySku {
  return { category: name, why, price, retailer: "The Aphrodite Edit", url: shopUrl(name), imageUrl: T(imageId) };
}

const EARRINGS = acc("Crystal Statement Earrings", 65, "1535632066927-ab7c9ab60908", "Catch the light and frame your face.");
const NECKLACE = acc("Pearl Pendant Necklace", 48, "1515562141207-7a88fb7ce338", "A classic finish that flatters your coloring.");
const HEELS = acc("Pointed Heels", 120, "1543163521-1bf539c55dd2", "Elongate the line of the outfit.");
const BAG = acc("Structured Top-Handle Bag", 145, "1584917865442-de89df76afd3", "A polished carry for the day.");
const MAKEUP = acc("Occasion Makeup Edit", 54, "1596462502278-27bfdc403348", "A curated palette matched to your season.");
// Tailoring accessories for a suit look (no earrings/heels/makeup on a suit).
const OXFORDS = acc("Leather Oxford Shoes", 130, "1449505278894-297fdb3edbc1", "Polished leather to finish a tailored look.");
const POCKET_SQUARE = acc("Silk Pocket Square", 28, "1589363358751-ab05797e5629", "A refined pop of your palette at the chest.");
// Grooming track (no makeup / jewelry): a grooming kit + a sharp watch.
const GROOMING_KIT = acc("Beard & Skin Grooming Kit", 48, "1556228578-8c89e6adf883", "Trim, tidy, and freshen up for the day.");
const WATCH = acc("Classic Leather Watch", 145, "1524592094714-0f0654e20314", "A sharp, understated finishing touch.");

/**
 * Accessories that "complete the look" — each a priced SKU that grows the
 * shoppable basket beyond the single garment. Keyed on the ACTUAL garment
 * category (a suit gets watch/shoes/pocket-square, a dress gets earrings/heels/
 * makeup) so the basket is always internally coherent; the grooming track swaps
 * everything for a grooming kit + watch.
 */
export function completeTheLook(
  formality: Formality,
  track: StyleTrack = "style",
  category?: ApparelCategory,
): AccessorySku[] {
  if (track === "grooming") return [GROOMING_KIT, WATCH];
  // A tailored suit ("full") reads as menswear here — finish it with tailoring
  // accessories, never earrings/heels/makeup.
  if (category === "full") return [WATCH, OXFORDS, POCKET_SQUARE];
  if (formality === "formal") return [EARRINGS, HEELS, MAKEUP];
  if (formality === "smart") return [NECKLACE, MAKEUP];
  return [BAG, MAKEUP];
}
