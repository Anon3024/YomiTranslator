import { createServerFn } from "@tanstack/react-start";
import {
  REJECTED_TRANSLATION,
  type OcrResult,
  type TranslateResult,
  type TranslatorId,
} from "./types";

type FnResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; declined?: boolean };

const BLOCKED_HOST =
  /^(localhost|metadata\.google\.internal|metadata|.*\.(local|internal|localhost))$/i;
const PRIVATE_V4 =
  /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

function assertSafeImageUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That does not look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https image links are allowed.");
  }
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    const ip = host.slice(1, -1);
    if (
      ip === "::1" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe80")
    ) {
      throw new Error("That address cannot be fetched.");
    }
  }
  if (BLOCKED_HOST.test(host) || PRIVATE_V4.test(host)) {
    throw new Error("That address cannot be fetched.");
  }
  return url;
}

async function fetchFollow(url: URL, hops = 0): Promise<Response> {
  if (hops > 3) throw new Error("Too many redirects.");
  assertSafeImageUrl(url.toString());
  const res = await fetch(url.toString(), {
    redirect: "manual",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) throw new Error("Redirect was missing a location.");
    return fetchFollow(new URL(loc, url), hops + 1);
  }
  return res;
}

function sniffImageMime(buf: Uint8Array, hinted: string) {
  if (hinted.startsWith("image/") && hinted !== "image/svg+xml") return hinted;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return "image/gif";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  return null;
}

function readUserApiKey(raw: unknown): string {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) {
    throw new Error("Add your xAI API key first.");
  }
  if (key.length < 16 || key.length > 256 || /\s/.test(key)) {
    throw new Error("That API key looks invalid.");
  }
  return key;
}

function readDeeplKey(raw: unknown): string {
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) {
    throw new Error("Add a DeepL API key first.");
  }
  if (key.length < 16 || key.length > 80 || /\s/.test(key)) {
    throw new Error("That DeepL key looks invalid.");
  }
  return key;
}

function deeplEndpoints(key: string): string[] {
  const free = "https://api-free.deepl.com/v2/translate";
  const pro = "https://api.deepl.com/v2/translate";
  return key.toLowerCase().endsWith(":fx") ? [free, pro] : [pro, free];
}

type DeeplResponse = {
  translations?: Array<{ text?: string }>;
  message?: string;
};

async function deeplTranslate(
  apiKey: string,
  texts: string[],
): Promise<FnResult<string[]>> {
  const endpoints = deeplEndpoints(apiKey);
  let lastError = "DeepL translation failed.";

  for (const url of endpoints) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: texts,
          source_lang: "JA",
          target_lang: "EN-US",
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      lastError = "Could not reach DeepL. Try again.";
      continue;
    }

    let body: DeeplResponse | null = null;
    try {
      body = (await res.json()) as DeeplResponse;
    } catch {
      body = null;
    }

    if (res.status === 403) {
      lastError = "That DeepL key was rejected. Check it under API keys.";
      continue;
    }
    if (res.status === 456) {
      return {
        ok: false,
        error: "DeepL quota is used up for this billing period.",
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        error: "DeepL is rate-limiting. Wait a moment and try again.",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: body?.message
          ? `DeepL: ${body.message}`
          : `DeepL error (${res.status}).`,
      };
    }

    const translations = Array.isArray(body?.translations)
      ? body.translations.map((row) => String(row?.text ?? "").trim())
      : [];
    if (translations.length !== texts.length || translations.some((t) => !t)) {
      return { ok: false, error: "DeepL returned an empty translation." };
    }
    return { ok: true, data: translations };
  }

  return { ok: false, error: lastError };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence?.[1] ?? trimmed;
  return JSON.parse(raw);
}

type GrokChatResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }>;
  error?: { message?: string };
};

async function grokChat(args: {
  apiKey: string;
  messages: unknown[];
  max_tokens: number;
  temperature?: number;
}): Promise<FnResult<string>> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      messages: args.messages,
      temperature: args.temperature ?? 0,
      max_tokens: args.max_tokens,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });

  let body: GrokChatResponse | null = null;
  try {
    body = (await res.json()) as GrokChatResponse;
  } catch {
    body = null;
  }

  if (res.status === 400 || res.status === 422) {
    const msg = body?.error?.message ?? "";
    if (/content|moderat|refus|policy|safety/i.test(msg)) {
      return {
        ok: false,
        declined: true,
        error:
          "The model declined this image. Try selecting just the text region.",
      };
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      error:
        res.status === 401 || res.status === 403
          ? "That API key was rejected. Check it under API key."
          : `Transcription service error (${res.status}).`,
    };
  }

  const choice = body?.choices?.[0];
  if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) {
    return {
      ok: false,
      declined: true,
      error:
        "The model declined this image. Try selecting just the text region.",
    };
  }

  const content = choice?.message?.content?.trim();
  if (!content) {
    return { ok: false, error: "No transcription came back. Try again." };
  }
  return { ok: true, data: content };
}

const TRANSCRIBE_PROMPT = `You are a Japanese OCR transcriber. Read the image and extract Japanese text exactly as written.

Rules:
- Transcribe characters exactly. Do not translate.
- Do not correct spelling, old kanji, slang, or typos.
- Do not invent unreadable characters. If a character is unreadable, skip it and mention that in notes.
- Preserve line breaks and block order.
- Vertical text (tategaki): transcribe in reading order (columns right-to-left, top-to-bottom within a column).
- Furigana / ruby: put in the furigana field of that block, never inline in text.
- If there is no Japanese text, set has_japanese to false and explain in notes.

Return a JSON object with:
{
  "full_text": string,
  "reading_order": "ltr-horizontal" | "rtl-columns" | "mixed" | "unknown",
  "has_japanese": boolean,
  "blocks": [{ "text": string, "orientation": "horizontal" | "vertical" | "unknown", "furigana": string | null }],
  "notes": string
}`;

function sanitizeGlossary(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const out: { from: string; to: string }[] = [];
  const seen = new Set<string>();
  for (const item of raw as { from?: unknown; to?: unknown }[]) {
    const from = String(item?.from ?? "").trim().slice(0, 80);
    const to = String(item?.to ?? "").trim().slice(0, 80);
    const key = from.toLowerCase();
    if (from.length < 1 || !to || seen.has(key)) continue;
    seen.add(key);
    out.push({ from, to });
    if (out.length >= 40) break;
  }
  return out;
}

function glossaryPrompt(terms: { from: string; to: string }[]) {
  if (terms.length === 0) return "";
  return `

Preferred translations of Japanese (or already-English) terms — use the given English for that term, not the whole sentence:
${terms.map((t) => `- "${t.from}" → "${t.to}"`).join("\n")}`;
}

function contextPrompt(context: string) {
  const text = context.trim();
  if (!text) return "";
  return `

Situation / delivery — honor this in the English even when that means slurred, muffled, whispered, or otherwise non-literal speech instead of a tidy rendering:
${text}`;
}

export const fetchRemoteImage = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as { url?: string };
    if (!data?.url || typeof data.url !== "string") {
      throw new Error("Missing URL");
    }
    if (data.url.length > 2000) throw new Error("URL is too long.");
    return { url: data.url.trim() };
  })
  .handler(async ({ data }): Promise<FnResult<{ dataUrl: string }>> => {
    try {
      const res = await fetchFollow(assertSafeImageUrl(data.url));
      if (!res.ok) {
        return { ok: false, error: `Could not load that image (${res.status}).` };
      }
      const hinted = (res.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > 8_000_000) {
        return { ok: false, error: "That image is larger than 8 MB." };
      }
      if (buf.byteLength < 32) {
        return { ok: false, error: "That file is empty." };
      }
      const mime = sniffImageMime(buf, hinted);
      if (!mime) return { ok: false, error: "That link is not an image." };
      let binary = "";
      const chunk = 32768;
      for (let i = 0; i < buf.length; i += chunk) {
        binary += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      return {
        ok: true,
        data: { dataUrl: `data:${mime};base64,${btoa(binary)}` },
      };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Could not load that image.",
      };
    }
  });

export const transcribeImage = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as { imageDataUrl?: string; apiKey?: string };
    if (!data?.imageDataUrl || typeof data.imageDataUrl !== "string") {
      throw new Error("Missing image");
    }
    if (data.imageDataUrl.length > 3_500_000) {
      throw new Error(
        "Image is too large. Select a smaller region or use a smaller file.",
      );
    }
    if (!data.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Invalid image data");
    }
    return {
      imageDataUrl: data.imageDataUrl,
      apiKey: readUserApiKey(data.apiKey),
    };
  })
  .handler(async ({ data }): Promise<FnResult<OcrResult>> => {
    const grok = await grokChat({
      apiKey: data.apiKey,
      max_tokens: 1800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: data.imageDataUrl, detail: "high" },
            },
            { type: "text", text: TRANSCRIBE_PROMPT },
          ],
        },
      ],
    });
    if (!grok.ok) return grok;
    try {
      const parsed = extractJson(grok.data) as {
        full_text?: unknown;
        reading_order?: OcrResult["reading_order"];
        has_japanese?: unknown;
        blocks?: {
          text?: unknown;
          orientation?: unknown;
          furigana?: unknown;
        }[];
        notes?: unknown;
      };
      const full = String(parsed.full_text ?? "").trim();
      const blocks: OcrResult["blocks"] = Array.isArray(parsed.blocks)
        ? parsed.blocks
            .map((b) => ({
              text: String(b?.text ?? "").trim(),
              orientation:
                b?.orientation === "vertical"
                  ? ("vertical" as const)
                  : b?.orientation === "horizontal"
                    ? ("horizontal" as const)
                    : ("unknown" as const),
              furigana: b?.furigana ? String(b.furigana) : null,
            }))
            .filter((b) => b.text.length > 0)
        : [];
      return {
        ok: true,
        data: {
          full_text: full,
          reading_order: parsed.reading_order,
          has_japanese: Boolean(parsed.has_japanese ?? full.length > 0),
          blocks,
          notes: parsed.notes ? String(parsed.notes) : undefined,
        },
      };
    } catch {
      return {
        ok: true,
        data: { full_text: grok.data, has_japanese: true, blocks: [] },
      };
    }
  });

export const translateText = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as {
      text?: string;
      glossary?: unknown;
      apiKey?: string;
      deeplKey?: string;
      provider?: string;
      context?: string;
    };
    if (!data?.text || typeof data.text !== "string") {
      throw new Error("Missing text");
    }
    const text = data.text.trim();
    if (!text) throw new Error("Nothing to translate.");
    if (text.length > 8000) throw new Error("Text is too long to translate.");
    const context = String(data.context ?? "").trim().slice(0, 400);
    const wantsDeepl = data.provider === "deepl" && !context;
    const provider: TranslatorId = wantsDeepl ? "deepl" : "grok";
    if (provider === "deepl") {
      return {
        text,
        glossary: sanitizeGlossary(data.glossary),
        provider,
        apiKey: "",
        deeplKey: readDeeplKey(data.deeplKey),
        context: "",
      };
    }
    if (data.provider === "deepl" && context && !String(data.apiKey ?? "").trim()) {
      throw new Error(
        "Context needs an xAI key. DeepL cannot use situation notes.",
      );
    }
    return {
      text,
      glossary: sanitizeGlossary(data.glossary),
      provider,
      apiKey: readUserApiKey(data.apiKey),
      deeplKey: "",
      context,
    };
  })
  .handler(async ({ data }): Promise<FnResult<TranslateResult>> => {
    if (data.provider === "deepl") {
      const out = await deeplTranslate(data.deeplKey, [data.text]);
      if (!out.ok) return out;
      return { ok: true, data: { translation: out.data[0] } };
    }
    const grok = await grokChat({
      apiKey: data.apiKey,
      max_tokens: 1600,
      messages: [
        {
          role: "user",
          content: `Translate the following Japanese into natural English. Keep names, onomatopoeia, and register. If a line is ambiguous, give the most likely reading and a brief note. Do not add content that is not in the source.${glossaryPrompt(data.glossary)}${contextPrompt(data.context)}

Return JSON: { "translation": string, "notes": string }

Japanese:
${data.text}`,
        },
      ],
    });
    if (!grok.ok) {
      if (grok.declined) {
        return { ok: true, data: { translation: REJECTED_TRANSLATION } };
      }
      return grok;
    }
    try {
      const parsed = extractJson(grok.data) as {
        translation?: unknown;
        notes?: unknown;
      };
      return {
        ok: true,
        data: {
          translation: String(parsed.translation ?? grok.data).trim(),
          notes: parsed.notes ? String(parsed.notes) : undefined,
        },
      };
    } catch {
      return { ok: true, data: { translation: grok.data } };
    }
  });

export const translateEntries = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as {
      items?: { id?: string; text?: string }[];
      glossary?: unknown;
      apiKey?: string;
      deeplKey?: string;
      provider?: string;
    };
    if (!Array.isArray(data?.items) || data.items.length === 0) {
      throw new Error("Nothing to translate.");
    }
    if (data.items.length > 40) throw new Error("Too many lines at once.");
    const items = data.items
      .map((item) => ({
        id: String(item.id ?? ""),
        text: String(item.text ?? "").trim(),
      }))
      .filter((item) => item.id && item.text);
    if (items.length === 0) throw new Error("Nothing to translate.");
    const provider: TranslatorId =
      data.provider === "deepl" ? "deepl" : "grok";
    if (provider === "deepl") {
      return {
        items,
        glossary: sanitizeGlossary(data.glossary),
        provider,
        apiKey: "",
        deeplKey: readDeeplKey(data.deeplKey),
      };
    }
    return {
      items,
      glossary: sanitizeGlossary(data.glossary),
      provider,
      apiKey: readUserApiKey(data.apiKey),
      deeplKey: "",
    };
  })
  .handler(
    async ({
      data,
    }): Promise<FnResult<{ items: { id: string; translation: string }[] }>> => {
      if (data.provider === "deepl") {
        const out = await deeplTranslate(
          data.deeplKey,
          data.items.map((item) => item.text),
        );
        if (!out.ok) return out;
        return {
          ok: true,
          data: {
            items: data.items.map((item, i) => ({
              id: item.id,
              translation: out.data[i] ?? "",
            })),
          },
        };
      }
      const grok = await grokChat({
        apiKey: data.apiKey,
        max_tokens: 2500,
        messages: [
          {
            role: "user",
            content: `Translate each Japanese item into natural English. Keep names, onomatopoeia, and register. Do not add content that is not in the source. Return one translation per id.${glossaryPrompt(data.glossary)}

Return JSON: { "items": [{ "id": string, "translation": string }] }

Items:
${JSON.stringify(data.items)}`,
          },
        ],
      });
      if (!grok.ok) {
        if (grok.declined) {
          return {
            ok: true,
            data: {
              items: data.items.map((item) => ({
                id: item.id,
                translation: REJECTED_TRANSLATION,
              })),
            },
          };
        }
        return grok;
      }
      try {
        const parsed = extractJson(grok.data) as {
          items?: { id?: string; translation?: string }[];
        };
        const items = Array.isArray(parsed.items)
          ? parsed.items
              .map((item) => ({
                id: String(item.id ?? ""),
                translation: String(item.translation ?? "").trim(),
              }))
              .filter((item) => item.id)
          : [];
        return { ok: true, data: { items } };
      } catch {
        return { ok: false, error: "Could not parse the translations." };
      }
    },
  );

export const suggestAlternatives = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input as {
      japanese?: string;
      english?: string;
      selected?: string;
      context?: string;
      apiKey?: string;
    };
    const japanese = String(data?.japanese ?? "").trim();
    const english = String(data?.english ?? "").trim();
    const selected = String(data?.selected ?? "").trim();
    const context = String(data?.context ?? "").trim().slice(0, 400);
    if (!selected) throw new Error("Select a word first.");
    if (selected.length > 80) throw new Error("Selection is too long.");
    return {
      japanese,
      english,
      selected,
      context,
      apiKey: readUserApiKey(data.apiKey),
    };
  })
  .handler(
    async ({
      data,
    }): Promise<FnResult<{ alternatives: string[]; source: string }>> => {
      const grok = await grokChat({
        apiKey: data.apiKey,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `You are helping edit an English translation of Japanese. The user selected an English span. Identify the Japanese in the source that this span translates (the original wording, e.g. a kanji or phrase). Then suggest other natural English translations of THAT Japanese — not English synonyms of the selected span. Each alternative must drop into the sentence in place of the selected span. Do not repeat the current span. Do not rewrite the whole sentence.${contextPrompt(data.context)}

Japanese source:
${data.japanese || "(none)"}

Full English translation:
${data.english}

Selected English span:
${data.selected}

Return JSON: { "source": string, "alternatives": string[] }
"source" is the Japanese that the span translates. "alternatives" has 5 to 8 distinct English options for that Japanese.`,
          },
        ],
      });
      if (!grok.ok) return grok;
      try {
        const parsed = extractJson(grok.data) as {
          alternatives?: unknown;
          source?: unknown;
        };
        const source = String(parsed.source ?? "").trim().slice(0, 80);
        const alternatives = Array.isArray(parsed.alternatives)
          ? parsed.alternatives
              .map((item) => String(item).trim())
              .filter(
                (item, i, arr) =>
                  item.length > 0 &&
                  item.toLowerCase() !== data.selected.toLowerCase() &&
                  arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) ===
                    i,
              )
              .slice(0, 8)
          : [];
        return { ok: true, data: { alternatives, source } };
      } catch {
        return { ok: false, error: "Could not load alternatives." };
      }
    },
  );
