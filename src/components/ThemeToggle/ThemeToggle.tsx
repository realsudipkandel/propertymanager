"use client";

import { useSyncExternalStore } from "react";

import {
  COLOR_THEME,
  isColorTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ColorTheme,
} from "@/domain/theme";

function themeButtonClass(selected: boolean): string {
  const base = "rounded-lg px-3 py-1.5 transition duration-300";
  if (selected) {
    return `${base} bg-blue-500 text-white`;
  }
  return `${base} text-muted hover:text-ink`;
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return function unsubscribeFromTheme(): void {
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function readTheme(): ColorTheme {
  const current = document.documentElement.dataset.theme ?? null;
  if (isColorTheme(current)) {
    return current;
  }
  return COLOR_THEME.DARK;
}

function readServerTheme(): ColorTheme {
  return COLOR_THEME.DARK;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, readServerTheme);

  function selectTheme(nextTheme: ColorTheme): void {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  function selectBright(): void {
    selectTheme(COLOR_THEME.LIGHT);
  }

  function selectDark(): void {
    selectTheme(COLOR_THEME.DARK);
  }

  return (
    <div className="flex shrink-0 rounded-xl border border-line p-1 text-sm" role="group" aria-label="Colour theme">
      <button
        type="button"
        className={themeButtonClass(theme === COLOR_THEME.LIGHT)}
        aria-pressed={theme === COLOR_THEME.LIGHT}
        data-testid="theme-bright"
        onClick={selectBright}
      >
        Bright
      </button>
      <button
        type="button"
        className={themeButtonClass(theme === COLOR_THEME.DARK)}
        aria-pressed={theme === COLOR_THEME.DARK}
        data-testid="theme-dark"
        onClick={selectDark}
      >
        Dark
      </button>
    </div>
  );
}
