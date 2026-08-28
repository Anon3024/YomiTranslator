export type Theme = "light" | "dark";

const KEY = "yomi.theme";

export function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "light";
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // private mode
  }
}

export const THEME_BOOT =
  '(function(){try{if(localStorage.getItem("yomi.theme")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}})()';
