export const COLOR_THEME = {
  LIGHT: "light",
  DARK: "dark",
} as const;

export type ColorTheme = (typeof COLOR_THEME)[keyof typeof COLOR_THEME];

export const THEME_STORAGE_KEY = "mira-theme";
export const THEME_CHANGE_EVENT = "mira-theme-change";

export function isColorTheme(value: string | null): value is ColorTheme {
  return value === COLOR_THEME.LIGHT || value === COLOR_THEME.DARK;
}

export const THEME_BOOT_SCRIPT = `
function applyStoredTheme() {
  var stored = null;
  try {
    stored = window.localStorage.getItem("${THEME_STORAGE_KEY}");
  } catch (error) {
    stored = null;
  }
  var theme = stored === "${COLOR_THEME.LIGHT}" || stored === "${COLOR_THEME.DARK}"
    ? stored
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "${COLOR_THEME.DARK}" : "${COLOR_THEME.LIGHT}");
  document.documentElement.dataset.theme = theme;
}
applyStoredTheme();
`;
