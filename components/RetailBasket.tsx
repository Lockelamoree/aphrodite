"use client";

import { Check, ExternalLink, ShoppingBag, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";

import type { ShoppingItem } from "@/lib/concierge/types";

function keyFor(item: ShoppingItem, index: number): string {
  return item.id ?? `${item.category}-${index}`;
}

function recordRetailEvent(name: string, detail: Record<string, unknown>): void {
  try {
    const key = "aphrodite_retail_events_v1";
    const current = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    localStorage.setItem(
      key,
      JSON.stringify([...current.slice(-49), { name, detail, at: new Date().toISOString() }]),
    );
  } catch {
    // Analytics must never block the shopping flow.
  }
}

export function RetailBasket({ items }: { items: ShoppingItem[] }) {
  const products = useMemo(
    () => items.map((item, index) => ({ item, key: keyFor(item, index) })).filter(({ item }) => typeof item.price === "number"),
    [items],
  );
  const fullTotal = products.reduce((sum, { item }) => sum + (item.price ?? 0), 0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(products.map((p) => p.key)));
  const [sizes, setSizes] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.flatMap(({ item, key }) => item.sizes?.[0] ? [[key, item.sizes[0]]] : [])),
  );
  const [budget, setBudget] = useState(fullTotal);
  const [handoffReady, setHandoffReady] = useState(false);

  const chosen = products.filter((product) => selected.has(product.key));
  const total = chosen.reduce((sum, { item }) => sum + (item.price ?? 0), 0);
  const overBudget = Math.max(0, total - budget);

  function toggle(key: string) {
    setHandoffReady(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function fitBudget() {
    const priority = [...products].sort((a, b) => {
      const rank = (item: ShoppingItem) => item.kind === "apparel" ? 0 : item.kind === "beauty" ? 1 : 2;
      return rank(a.item) - rank(b.item) || (a.item.price ?? 0) - (b.item.price ?? 0);
    });
    let running = 0;
    const next = new Set<string>();
    for (const product of priority) {
      const price = product.item.price ?? 0;
      if (running + price <= budget || next.size === 0) {
        next.add(product.key);
        running += price;
      }
    }
    setSelected(next);
    // If the one mandatory item alone exceeds the slider budget, lift the budget
    // to cover it — "fit to budget" must never strand checkout in an
    // over-budget, permanently-disabled state.
    if (running > budget) setBudget(running);
    setHandoffReady(false);
    recordRetailEvent("basket_fit_to_budget", { budget, total: running, items: next.size });
  }

  function prepareHandoff() {
    setHandoffReady(true);
    recordRetailEvent("checkout_started", {
      total,
      items: chosen.map(({ key }) => ({ id: key, size: sizes[key] })),
    });
  }

  if (products.length === 0) return null;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-serif text-xl text-ink">Build your basket</h3>
          <p className="text-xs text-muted">Demo inventory · ready for a retailer catalog handoff</p>
        </div>
        <p className="text-sm text-muted">
          {chosen.length} of {products.length} selected · <span className="font-medium text-ink">${total}</span>
        </p>
      </div>

      <div className="mb-4 border-y border-line py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <label htmlFor="basket-budget" className="font-medium text-ink">Budget</label>
          <span className="text-muted">${budget}</span>
        </div>
        <input
          id="basket-budget"
          type="range"
          min={Math.min(50, fullTotal)}
          max={Math.max(50, fullTotal)}
          step={10}
          value={budget}
          onChange={(event) => {
            setBudget(Number(event.target.value));
            setHandoffReady(false);
          }}
          className="mt-2 w-full accent-primary"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className={`text-xs ${overBudget ? "font-medium text-rose" : "text-muted"}`}>
            {overBudget ? `$${overBudget} over budget` : `$${budget - total} left in budget`}
          </p>
          <button
            type="button"
            onClick={fitBudget}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary"
          >
            <WandSparkles size={14} aria-hidden />
            Fit basket to budget
          </button>
        </div>
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {products.map(({ item, key }) => {
          const on = selected.has(key);
          return (
            <li key={key} className="flex min-w-0 flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-pressed={on}
                aria-label={`${on ? "Remove" : "Add"} ${item.category}`}
                title={`${on ? "Remove" : "Add"} ${item.category}`}
                className={`flex h-6 w-6 shrink-0 items-center justify-center border transition focus-visible:ring-2 focus-visible:ring-primary ${
                  on ? "border-primary bg-primary text-white" : "border-line bg-paper text-transparent"
                }`}
              >
                <Check size={14} aria-hidden />
              </button>
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="h-14 w-14 shrink-0 object-cover" />
              )}
              <div className="min-w-0 flex-1 basis-[180px]">
                <p className="text-sm font-medium text-ink">{item.category}</p>
                <p className="line-clamp-2 text-xs text-muted">{item.why}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {item.retailer} · <span className="text-ink">${item.price}</span>
                  {item.inStock === false && <span className="ml-2 text-rose">Out of stock</span>}
                </p>
              </div>
              {item.sizes?.length ? (
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  Size
                  <select
                    value={sizes[key]}
                    onChange={(event) => setSizes((current) => ({ ...current, [key]: event.target.value }))}
                    className="border border-line bg-surface px-2 py-1.5 text-ink outline-none focus:border-primary"
                  >
                    {item.sizes.map((size) => <option key={size}>{size}</option>)}
                  </select>
                </label>
              ) : null}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View source for ${item.category}`}
                  title={`View source for ${item.category}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-muted transition hover:text-primary focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ExternalLink size={16} aria-hidden />
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {/* Below sm the summary + CTA stick to the viewport bottom while the item
          list scrolls past (the dominant mobile checkout pattern — price always
          in view); from sm up it sits statically in flow as before. */}
      <div className="sticky bottom-0 z-10 -mx-6 border-t border-line bg-surface/95 px-6 pb-3 pt-3 backdrop-blur-sm sm:static sm:z-auto sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-1 sm:backdrop-blur-none">
        <button
          type="button"
          onClick={prepareHandoff}
          disabled={chosen.length === 0 || overBudget > 0}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-medium text-white transition enabled:hover:bg-[#8c3556] focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
        >
          <ShoppingBag size={17} aria-hidden />
          Prepare retailer checkout · ${total}
        </button>
        {overBudget > 0 && (
          <p className="mt-2 text-xs text-rose">
            ${overBudget} over budget — remove an item or raise the budget to check out.
          </p>
        )}
        {handoffReady && (
          <p role="status" className="mt-3 border-l-2 border-leaf pl-3 text-sm text-ink">
            Basket handoff ready: {chosen.length} items, selected sizes, and a ${total} total are packaged for checkout.
          </p>
        )}
      </div>
    </div>
  );
}
