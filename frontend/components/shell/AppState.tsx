"use client";
// App-wide state: backend info, plant list, selected plant and theme. Per-viewer choices are
// remembered in localStorage (wrapped in try/catch; the app works without it).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Info, Plant } from "@/lib/types";

type Theme = "dark" | "light";

interface AppState {
  info: Info | null;
  plants: Plant[];
  plantId: string;
  plant: Plant | null;
  setPlantId: (id: string) => void;
  period: string;
  theme: Theme;
  toggleTheme: () => void;
  backendError: string | null;
}

const Ctx = createContext<AppState | null>(null);

const load = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [plantId, setPlantIdState] = useState("TR-ANA-01");
  const [theme, setTheme] = useState<Theme>("dark");
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    const p = load("vx.plant"); if (p) setPlantIdState(p);
    const t = load("vx.theme"); if (t === "light" || t === "dark") setTheme(t);
    Promise.all([api.info(), api.plants()])
      .then(([i, ps]) => { setInfo(i); setPlants(ps); })
      .catch(() => setBackendError("Cannot reach the VERDANT-X backend. Start it with `make api`."));
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const setPlantId = useCallback((id: string) => { setPlantIdState(id); save("vx.plant", id); }, []);
  const toggleTheme = useCallback(() => setTheme((t) => {
    const n = t === "dark" ? "light" : "dark"; save("vx.theme", n); return n;
  }), []);

  return (
    <Ctx.Provider value={{
      info, plants, plantId, plant: plants.find((p) => p.id === plantId) ?? null, setPlantId,
      period: info?.live_period ?? "2026-12", theme, toggleTheme, backendError,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppStateProvider");
  return v;
}
