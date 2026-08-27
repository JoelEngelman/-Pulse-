import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light" | "aurora" | "ocean" | "sunset" | "sakura" | "forest" | "midnight" | "nebula";

export type ThemeOption = { id: Theme; name: string; description: string; image: string };

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "dark", name: "Classic Dark", description: "Pulse's original dark look", image: "" },
  { id: "light", name: "Classic Light", description: "Clean and bright", image: "" },
  { id: "aurora", name: "Aurora", description: "Northern lights glass", image: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=1600&q=85" },
  { id: "ocean", name: "Ocean", description: "Deep blue water", image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=85" },
  { id: "sunset", name: "Sunset", description: "Warm evening skies", image: "https://images.unsplash.com/photo-1472120435266-53107fd0d44a?auto=format&fit=crop&w=1600&q=85" },
  { id: "sakura", name: "Sakura", description: "Soft cherry blossoms", image: "https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1600&q=85" },
  { id: "forest", name: "Forest", description: "Misty green nature", image: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=85" },
  { id: "midnight", name: "Midnight", description: "Quiet mountain night", image: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=85" },
  { id: "nebula", name: "Nebula", description: "Deep space", image: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1600&q=85" },
];

type ThemeContextType = { theme: Theme; setTheme: (theme: Theme) => void; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const STORAGE_KEY = "pulse-theme";

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && THEME_OPTIONS.some((option) => option.id === stored)) return stored;
  } catch {}
  return "midnight";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light", "theme-aurora", "theme-ocean", "theme-sunset", "theme-sakura", "theme-forest", "theme-midnight", "theme-nebula");
    if (theme === "dark" || theme === "light") root.classList.add(theme);
    else root.classList.add(`theme-${theme}`, "dark");
    root.dataset.pulseTheme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);
  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((t) => t === "dark" ? "light" : "dark");
  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
