import type { TranslatorId } from "./types";

const KEY = "yomi.xai-api-key";
const DEEPL_KEY = "yomi.deepl-api-key";
const TRANSLATOR_KEY = "yomi.translator";

function readStorage(name: string): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return String(localStorage.getItem(name) ?? "").trim();
  } catch {
    return "";
  }
}

function writeStorage(name: string, value: string) {
  if (typeof localStorage === "undefined") return;
  const key = value.trim();
  try {
    if (key) localStorage.setItem(name, key);
    else localStorage.removeItem(name);
  } catch {
    // private mode
  }
}

export function loadApiKey(): string {
  return readStorage(KEY);
}

export function saveApiKey(value: string) {
  writeStorage(KEY, value);
}

export function clearApiKey() {
  saveApiKey("");
}

export function loadDeeplKey(): string {
  return readStorage(DEEPL_KEY);
}

export function saveDeeplKey(value: string) {
  writeStorage(DEEPL_KEY, value);
  if (!value.trim()) {
    const current = loadTranslator();
    if (current === "deepl") saveTranslator("grok");
  }
}

export function loadTranslator(): TranslatorId {
  const raw = readStorage(TRANSLATOR_KEY);
  const deepl = loadDeeplKey();
  if (raw === "deepl" && deepl) return "deepl";
  if (!loadApiKey() && deepl) return "deepl";
  return "grok";
}

export function saveTranslator(value: TranslatorId) {
  if (value === "deepl" && !loadDeeplKey()) {
    writeStorage(TRANSLATOR_KEY, "grok");
    return;
  }
  writeStorage(TRANSLATOR_KEY, value);
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

export function looksLikeDeeplKey(value: string) {
  const key = value.trim();
  return key.length >= 16 && key.length <= 80 && !/\s/.test(key);
}
