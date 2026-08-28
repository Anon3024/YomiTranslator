const KEY = "yomi.xai-api-key";

export function loadApiKey(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return String(localStorage.getItem(KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function saveApiKey(value: string) {
  if (typeof localStorage === "undefined") return;
  const key = value.trim();
  try {
    if (key) localStorage.setItem(KEY, key);
    else localStorage.removeItem(KEY);
  } catch {
    // private mode
  }
}

export function clearApiKey() {
  saveApiKey("");
}

export function maskApiKey(value: string) {
  const key = value.trim();
  if (key.length < 8) return key ? "saved" : "";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function looksLikeApiKey(value: string) {
  const key = value.trim();
  return key.length >= 16 && key.length <= 256 && !/\s/.test(key);
}
