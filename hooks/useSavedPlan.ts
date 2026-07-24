"use client";

import { useCallback, useSyncExternalStore } from "react";

import type {
  GarmentPreference,
  LookBoard,
  SkinGoal,
  StyleTrack,
} from "@/lib/concierge/types";
import type { ColorProfile, SkinAnalysis } from "@/lib/youcam/types";

const STORAGE_KEY = "aphrodite_saved_runway_v1";
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedPlan: SavedPlan | null = null;

export interface SavedPlan {
  id: string;
  savedAt: string;
  occasion: string;
  board: LookBoard;
  skin: SkinAnalysis;
  color?: ColorProfile;
  skinGoal: SkinGoal;
  track: StyleTrack;
  garmentPreference: GarmentPreference;
}

export interface SavePlanInput {
  occasion: string;
  board: LookBoard;
  skin: SkinAnalysis;
  color?: ColorProfile;
  skinGoal: SkinGoal;
  track: StyleTrack;
  garmentPreference: GarmentPreference;
}

function clientSnapshot(): SavedPlan | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedPlan;
  cachedRaw = raw;
  if (!raw) return (cachedPlan = null);
  try {
    return (cachedPlan = JSON.parse(raw) as SavedPlan);
  } catch {
    return (cachedPlan = null);
  }
}

function serverSnapshot(): null {
  return null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function emit(): void {
  cachedRaw = undefined;
  for (const listener of listeners) listener();
}

export function useSavedPlan() {
  const plan = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);

  const save = useCallback((input: SavePlanInput) => {
    const saved: SavedPlan = {
      ...input,
      id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()),
      savedAt: new Date().toISOString(),
      skin: { concerns: input.skin.concerns.map((concern) => ({ ...concern, maskUrl: undefined })) },
      color: input.color
        ? { ...input.color, raw: undefined, detected: input.color.detected ? { ...input.color.detected } : undefined }
        : undefined,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    emit();
    return saved;
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    emit();
  }, []);

  return { plan, save, clear };
}
