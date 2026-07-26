import type { GarmentPreference, StyleTrack } from "@/lib/concierge/types";
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
  /** Shopper-facing silhouette group. */
  wardrobe: Exclude<GarmentPreference, "surprise">;
  /**
   * Tailoring cut / presentation. The masculine-presenting "grooming" track is
   * styled only into "masculine" (or "neutral") cuts — never "feminine" — so a
   * women's-cut piece (e.g. the ivory pantsuit) is never handed to someone who
   * self-selected grooming. Independent of `wardrobe`: two "suits" can differ in
   * cut (the menswear slate suit vs. the women's pantsuit).
   */
  cut: "feminine" | "masculine" | "neutral";
  /** Reference image for the VTO render (public, front-facing). */
  imageUrl: string;
  /** Retail-loop fields. */
  price: number;
  retailer: string;
  url: string;
  sizes: string[];
  inStock: boolean;
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
    wardrobe: "dresses",
    cut: "feminine",
    imageUrl: U("1595777457583-95e059d581b8"),
    price: 189,
    retailer: "The Aphrodite Edit",
    url: shopUrl("scarlet red a-line evening gown"),
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
  },
  {
    id: "sky-wrap-maxi",
    name: "Sky Wrap Maxi Dress",
    category: "dress",
    formality: "smart",
    occasions: ["date", "brunch", "party"],
    flatters: "cool",
    colorHex: "#A9C1D9",
    wardrobe: "dresses",
    cut: "feminine",
    imageUrl: U("1539008835657-9e8e9680c956"),
    price: 124,
    retailer: "The Aphrodite Edit",
    url: shopUrl("light blue wrap maxi dress"),
    sizes: ["XS", "S", "M", "L"],
    inStock: true,
  },
  {
    id: "slate-suit",
    name: "Slate Blue Three-Piece Suit",
    category: "full",
    formality: "formal",
    occasions: ["interview", "work", "wedding", "gala"],
    flatters: "cool",
    colorHex: "#46587C",
    wardrobe: "suits",
    cut: "masculine",
    imageUrl: U("1594938298603-c8148c4dae35"),
    price: 245,
    retailer: "The Aphrodite Edit",
    url: shopUrl("slate blue three piece suit"),
    sizes: ["36", "38", "40", "42", "44"],
    inStock: true,
  },
  {
    id: "crisp-white-tee",
    name: "Crisp White Tee",
    category: "top",
    formality: "casual",
    occasions: ["brunch", "date", "work"],
    flatters: "neutral",
    colorHex: "#F2F2F0",
    wardrobe: "separates",
    cut: "neutral",
    imageUrl: U("1521572163474-6864f9cf17ab"),
    price: 42,
    retailer: "The Aphrodite Edit",
    url: shopUrl("crisp white cotton crew t-shirt"),
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    inStock: true,
  },
  // --- expanded catalog: gives every occasion a cool/warm/neutral option and
  // enough variety that reroll changes the look. Reference images are clean,
  // front-facing demo shots; live-VTO render quality on these is UNVERIFIED
  // (fixtures make the demo safe — confirm on a units-on pass before going live).
  {
    id: "emerald-gown",
    name: "Emerald Silk Gown",
    category: "dress",
    formality: "formal",
    occasions: ["wedding", "gala", "party"],
    flatters: "cool",
    colorHex: "#1F6F5C",
    wardrobe: "dresses",
    cut: "feminine",
    imageUrl: U("1566174053879-31528523f8ae"),
    price: 198,
    retailer: "The Aphrodite Edit",
    url: shopUrl("emerald green silk evening gown"),
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
  },
  {
    id: "champagne-slip",
    name: "Champagne Slip Gown",
    category: "dress",
    formality: "formal",
    occasions: ["wedding", "gala", "party", "date"],
    flatters: "neutral",
    colorHex: "#E7D3B3",
    wardrobe: "dresses",
    cut: "feminine",
    imageUrl: U("1572804013309-59a88b7e92f1"),
    price: 176,
    retailer: "The Aphrodite Edit",
    url: shopUrl("champagne satin slip gown"),
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
  },
  {
    id: "tailored-sheath",
    name: "Tailored Sheath Dress",
    category: "dress",
    formality: "smart",
    occasions: ["interview", "work", "gala", "party"],
    flatters: "neutral",
    colorHex: "#2E3A46",
    wardrobe: "dresses",
    cut: "feminine",
    imageUrl: U("1583496661160-fb5886a0aaaa"),
    price: 132,
    retailer: "The Aphrodite Edit",
    url: shopUrl("tailored sheath dress work"),
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
  },
  {
    id: "ivory-pantsuit",
    name: "Ivory Tailored Pantsuit",
    category: "full",
    formality: "formal",
    occasions: ["interview", "work", "wedding", "gala"],
    flatters: "neutral",
    colorHex: "#EDE7DA",
    wardrobe: "suits",
    cut: "feminine",
    imageUrl: U("1594633312681-425c7b97ccd1"),
    price: 228,
    retailer: "The Aphrodite Edit",
    url: shopUrl("ivory tailored pantsuit"),
    sizes: ["0", "2", "4", "6", "8", "10", "12"],
    inStock: true,
  },
  {
    id: "blush-blazer-set",
    name: "Blush Blazer & Trouser Set",
    category: "full",
    formality: "smart",
    occasions: ["interview", "work", "date", "party"],
    flatters: "warm",
    colorHex: "#D9A6A0",
    wardrobe: "separates",
    cut: "feminine",
    imageUrl: U("1591369822096-ffd140ec948f"),
    price: 164,
    retailer: "The Aphrodite Edit",
    url: shopUrl("blush blazer and trouser set"),
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
  },
  {
    id: "camel-knit-set",
    name: "Camel Knit Top & Skirt",
    category: "top",
    formality: "smart",
    occasions: ["date", "brunch", "work", "party"],
    flatters: "warm",
    colorHex: "#C19A6B",
    wardrobe: "separates",
    cut: "feminine",
    imageUrl: U("1515372039744-b8f02a3ae446"),
    price: 118,
    retailer: "The Aphrodite Edit",
    url: shopUrl("camel knit top and midi skirt set"),
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
  },
  // The COOL, feminine-cut option for a job interview. Without it, the only
  // cool-flattering interview piece was `slate-suit` (a masculine men's three-
  // piece), so a cool-undertone woman on the "Surprise me" default was scored
  // into it — the same mis-gender the wedding/gala pools already avoid via
  // `emerald-gown`. Mirrors `blush-blazer-set` (its warm twin) but formality
  // "formal" so it wins interview's formality target and clears the men's suit;
  // sized XS–XL as a true separates set. Appended last so existing tie-break
  // order is untouched. Image eyeball-verified as a clean navy blazer+trouser
  // shot; live VTO runs through the "separates" -> apparel-top.jpg fixture.
  {
    id: "navy-blazer-set",
    name: "Navy Blazer & Trouser Set",
    category: "full",
    formality: "formal",
    occasions: ["interview", "work"],
    flatters: "cool",
    colorHex: "#293A5C",
    wardrobe: "separates",
    cut: "feminine",
    imageUrl: U("1762793193633-c26f3d34e710"),
    price: 192,
    retailer: "The Aphrodite Edit",
    url: shopUrl("navy blazer and trouser suit set women"),
    sizes: ["XS", "S", "M", "L", "XL"],
    inStock: true,
  },
];

export function findGarment(id: string): CatalogGarment | undefined {
  return GARMENT_CATALOG.find((g) => g.id === id);
}

export function garmentMatchesPreference(
  garment: CatalogGarment,
  preference: GarmentPreference = "surprise",
): boolean {
  return preference === "surprise" || garment.wardrobe === preference;
}

/**
 * Whether a garment is appropriate for a styling track. The "grooming" track is
 * masculine-presenting, so it excludes feminine-cut pieces (e.g. the women's
 * ivory pantsuit) and keeps only masculine/neutral cuts; the default "style"
 * track accepts anything. Shared by the deterministic selector and the agentic
 * try-on guard so both engines refuse to style grooming into a women's cut.
 */
export function garmentSuitsTrack(
  garment: CatalogGarment,
  track: StyleTrack = "style",
): boolean {
  return track !== "grooming" || garment.cut !== "feminine";
}

/** Compact catalog view for the model's prompt/tool description. */
export function catalogForPrompt(): string {
  return GARMENT_CATALOG.map(
    (g) =>
      `- ${g.id}: ${g.name} (${g.wardrobe}, ${g.cut}-cut, ${g.category}, ${g.formality}, flatters ${g.flatters} undertones, occasions: ${g.occasions.join("/")})`,
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
  "perfecting concealer": { name: "Perfecting Concealer", price: 26, imageUrl: T("1487412720507-e7ab37603c6f") },
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
const NECKLACE = acc("Pearl Pendant Necklace", 48, "1515562141207-7a88fb7ce338", "A classic finishing touch.");
const HEELS = acc("Pointed Heels", 120, "1543163521-1bf539c55dd2", "Elongate the line of the outfit.");
const BAG = acc("Structured Top-Handle Bag", 145, "1584917865442-de89df76afd3", "A polished carry for the day.");
const MAKEUP = acc("Occasion Makeup Edit", 54, "1596462502278-27bfdc403348", "A polished palette to finish the look.");
// Gender-neutral tailoring accessories for a suit look (never earrings/heels).
const LOAFERS = acc("Leather Loafers", 120, "1449505278894-297fdb3edbc1", "Polished, gender-neutral leather to finish a tailored look.");
// Grooming track (no makeup / jewelry): a grooming kit + a sharp watch.
const GROOMING_KIT = acc("Beard & Skin Grooming Kit", 48, "1556228578-8c89e6adf883", "Trim, tidy, and freshen up for the day.");
const WATCH = acc("Classic Leather Watch", 145, "1524592094714-0f0654e20314", "A sharp, understated finishing touch.");

/**
 * Accessories that "complete the look" — each a priced SKU that grows the
 * shoppable basket beyond the single garment. Keyed on the garment's WARDROBE
 * type (not its VTO category), so a suit — worn by anyone — gets gender-neutral
 * tailoring + makeup rather than earrings/heels, and a dress gets jewellery.
 * The grooming track (self-selected) swaps everything for a grooming kit + watch.
 */
export function completeTheLook(
  garment: CatalogGarment,
  track: StyleTrack = "style",
): AccessorySku[] {
  if (track === "grooming") return [GROOMING_KIT, WATCH];
  switch (garment.wardrobe) {
    case "suits":
      return [WATCH, LOAFERS, MAKEUP];
    case "separates":
      return garment.formality === "casual" ? [BAG] : [BAG, MAKEUP];
    case "dresses":
    default:
      if (garment.formality === "formal") return [EARRINGS, HEELS, MAKEUP];
      if (garment.formality === "smart") return [NECKLACE, MAKEUP];
      return [MAKEUP];
  }
}
