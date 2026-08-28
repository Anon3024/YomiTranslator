import { useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Languages,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { entriesOf, tokenizeEnglish } from "@/lib/pages";
import { customsFor, type GlossaryRecord } from "@/lib/glossary";
import type { EntryKind, LineEntry, Page } from "@/lib/types";
import { cn } from "@/lib/utils";

type AltState = {
  entryId: string;
  start: number;
  end: number;
  word: string;
  options: string[] | null;
};

type Props = {
  page: Page | null;
  pageNumber: number;
  pageCount: number;
  transcribing: boolean;
  translating: boolean;
  translatingId: string | null;
  queueIds: string[];
  error: string | null;
  onEntryChange: (id: string, patch: Partial<LineEntry>) => void;
  onKind: (id: string, kind: EntryKind) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAddBlank: () => void;
  onTranslateEntry: (id: string) => void;
  onTranslatePage: () => void;
  onAlternatives: (
    id: string,
    start: number,
    end: number,
    word: string,
  ) => Promise<string[]>;
  onExport: () => void;
  glossary: GlossaryRecord[];
  onRemember: (input: { from: string; to: string }) => void;
  onForget: (id: string) => void;
};

export function TranscriptPanel({
  page,
  pageNumber,
  pageCount,
  transcribing,
  translating,
  translatingId,
  queueIds,
  error,
  onEntryChange,
  onKind,
  onMove,
  onRemove,
  onAddBlank,
  onTranslateEntry,
  onTranslatePage,
  onAlternatives,
  onExport,
  glossary,
  onRemember,
  onForget,
}: Props) {
  const [alt, setAlt] = useState<AltState | null>(null);
  const [lookup, setLookup] = useState("");

  const lines = page ? entriesOf(page, "line") : [];
  const details = page ? entriesOf(page, "detail") : [];
  const allJp = page
    ? page.entries
        .map((e) => e.japanese)
        .filter(Boolean)
        .join("\n")
    : "";
  const canExport = Boolean(page && page.entries.length > 0);
  const canTranslate = lines.concat(details).some((e) => e.japanese.trim());

  const requestAlts = async (
    id: string,
    start: number,
    end: number,
    word: string,
  ) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    setAlt({ entryId: id, start, end, word: trimmed, options: null });
    try {
      const options = await onAlternatives(id, start, end, trimmed);
      const remembered = customsFor(trimmed, glossary);
      const merged = [
        ...remembered.filter((c) => c.toLowerCase() !== trimmed.toLowerCase()),
        ...options.filter(
          (c) =>
            c.toLowerCase() !== trimmed.toLowerCase() &&
            !remembered.some((r) => r.toLowerCase() === c.toLowerCase()),
        ),
      ];
      setAlt((cur) =>
        cur && cur.entryId === id && cur.start === start
          ? { ...cur, options: merged }
          : cur,
      );
    } catch {
      setAlt((cur) =>
        cur && cur.entryId === id ? { ...cur, options: [] } : cur,
      );
    }
  };

  const applyAlt = (entry: LineEntry, option: string) => {
    if (!alt || alt.entryId !== entry.id) return;
    const next =
      entry.english.slice(0, alt.start) + option + entry.english.slice(alt.end);
    onEntryChange(entry.id, { english: next });
    onRemember({
      from: alt.word,
      to: option,
    });
    setAlt(null);
  };

  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">
            {page ? `Page ${pageNumber}` : "Transcript"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Draw a region and transcribe to add a line. Mark SFX separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!page}
            onClick={onAddBlank}
          >
            <Plus />
            Blank line
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canTranslate || transcribing}
            onClick={onTranslatePage}
          >
            {translating && !translatingId ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Languages />
            )}
            Translate page
          </Button>
          {queueIds.length > 0 ? (
            <Badge>{queueIds.length} queued</Badge>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canExport}
            onClick={onExport}
          >
            <Download />
            Export
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {!page ? (
        <p className="text-sm text-muted">
          Add an image to start collecting lines.
        </p>
      ) : (
        <>
          <EntrySection
            title="Lines"
            empty="No lines yet. Transcribe a region — it lands here."
            items={lines}
            kind="line"
            alt={alt}
            translatingId={translatingId}
            queueIds={queueIds}
            onLookup={setLookup}
            onChange={onEntryChange}
            onKind={onKind}
            onMove={onMove}
            onRemove={onRemove}
            onTranslate={onTranslateEntry}
            onRequestAlts={requestAlts}
            onApplyAlt={applyAlt}
            onClearAlt={() => setAlt(null)}
          />

          <div className="h-px bg-border" />

          <EntrySection
            title="Detail / SFX"
            empty="Signs, tattoos, background text, sound effects. Mark a line as SFX to move it here."
            items={details}
            kind="detail"
            alt={alt}
            translatingId={translatingId}
            queueIds={queueIds}
            onLookup={setLookup}
            onChange={onEntryChange}
            onKind={onKind}
            onMove={onMove}
            onRemove={onRemove}
            onTranslate={onTranslateEntry}
            onRequestAlts={requestAlts}
            onApplyAlt={applyAlt}
            onClearAlt={() => setAlt(null)}
          />

          <DictionarySection
            records={glossary}
            onRemember={onRemember}
            onForget={onForget}
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!lookup}
          asChild={Boolean(lookup)}
        >
          {lookup ? (
            <a
              href={`https://jisho.org/search/${encodeURIComponent(lookup)}`}
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen />
              Jisho
            </a>
          ) : (
            <>
              <BookOpen />
              Jisho
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!lookup}
          asChild={Boolean(lookup)}
        >
          {lookup ? (
            <a
              href={`https://ichi.moe/cl/qr/?q=${encodeURIComponent(lookup)}`}
              target="_blank"
              rel="noreferrer"
            >
              <BookOpen />
              ichi.moe
            </a>
          ) : (
            <>
              <BookOpen />
              ichi.moe
            </>
          )}
        </Button>
        {allJp ? (
          <>
            <Button type="button" variant="outline" size="sm" asChild>
              <a
                href={`https://www.deepl.com/translator#ja/en/${encodeURIComponent(allJp)}`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink />
                DeepL
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a
                href={`https://translate.google.com/?sl=ja&tl=en&text=${encodeURIComponent(allJp)}&op=translate`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink />
                Google
              </a>
            </Button>
          </>
        ) : null}
        {canExport ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              const text = (page?.entries ?? [])
                .map((e) => e.japanese)
                .filter(Boolean)
                .join("\n");
              try {
                await navigator.clipboard.writeText(text);
                toast("Copied Japanese");
              } catch {
                toast("Could not copy");
              }
            }}
          >
            <Copy />
            Copy JP
          </Button>
        ) : null}
      </div>
      {pageCount > 1 ? (
        <p className="text-xs text-subtle">
          {pageCount} pages in this session. Export writes all of them.
        </p>
      ) : null}
    </section>
  );
}

function EntrySection({
  title,
  empty,
  items,
  kind,
  alt,
  translatingId,
  queueIds,
  onLookup,
  onChange,
  onKind,
  onMove,
  onRemove,
  onTranslate,
  onRequestAlts,
  onApplyAlt,
  onClearAlt,
}: {
  title: string;
  empty: string;
  items: LineEntry[];
  kind: EntryKind;
  alt: AltState | null;
  translatingId: string | null;
  queueIds: string[];
  onLookup: (v: string) => void;
  onChange: (id: string, patch: Partial<LineEntry>) => void;
  onKind: (id: string, kind: EntryKind) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onTranslate: (id: string) => void;
  onRequestAlts: (
    id: string,
    start: number,
    end: number,
    word: string,
  ) => void;
  onApplyAlt: (entry: LineEntry, option: string) => void;
  onClearAlt: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-fg">{title}</h3>
        <Badge>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ol className="space-y-3">
          {items.map((entry, i) => (
            <li key={entry.id}>
              <EntryCard
                n={i + 1}
                kind={kind}
                entry={entry}
                alt={alt?.entryId === entry.id ? alt : null}
                translating={translatingId === entry.id}
                queued={queueIds.includes(entry.id)}
                onLookup={onLookup}
                onChange={onChange}
                onKind={onKind}
                onMove={onMove}
                onRemove={onRemove}
                onTranslate={onTranslate}
                onRequestAlts={onRequestAlts}
                onApplyAlt={onApplyAlt}
                onClearAlt={onClearAlt}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EntryCard({
  n,
  kind,
  entry,
  alt,
  translating,
  queued,
  onLookup,
  onChange,
  onKind,
  onMove,
  onRemove,
  onTranslate,
  onRequestAlts,
  onApplyAlt,
  onClearAlt,
}: {
  n: number;
  kind: EntryKind;
  entry: LineEntry;
  alt: AltState | null;
  translating: boolean;
  queued: boolean;
  onLookup: (v: string) => void;
  onChange: (id: string, patch: Partial<LineEntry>) => void;
  onKind: (id: string, kind: EntryKind) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onRemove: (id: string) => void;
  onTranslate: (id: string) => void;
  onRequestAlts: (
    id: string,
    start: number,
    end: number,
    word: string,
  ) => void;
  onApplyAlt: (entry: LineEntry, option: string) => void;
  onClearAlt: () => void;
}) {
  const jpRef = useRef<HTMLTextAreaElement>(null);
  const enRef = useRef<HTMLTextAreaElement>(null);
  const [custom, setCustom] = useState("");
  const label = kind === "line" ? `Line ${n}` : `Detail ${n}`;
  const tokens = tokenizeEnglish(entry.english);

  const captureJp = () => {
    const el = jpRef.current;
    if (!el) return;
    onLookup(el.value.slice(el.selectionStart, el.selectionEnd).trim());
  };

  const captureEn = () => {
    const el = enRef.current;
    if (!el) return;
    const word = el.value.slice(el.selectionStart, el.selectionEnd).trim();
    if (word && el.selectionStart !== el.selectionEnd) {
      onRequestAlts(entry.id, el.selectionStart, el.selectionEnd, word);
    }
  };

  return (
    <article className="rounded-xl bg-bg-warm p-3 shadow-[var(--shadow-border)]">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <span className="mr-auto text-xs font-medium text-muted">{label}</span>
        <Button
          type="button"
          variant={kind === "line" ? "default" : "ghost"}
          size="sm"
          aria-pressed={kind === "line"}
          onClick={() => onKind(entry.id, "line")}
        >
          Line
        </Button>
        <Button
          type="button"
          variant={kind === "detail" ? "default" : "ghost"}
          size="sm"
          aria-pressed={kind === "detail"}
          onClick={() => onKind(entry.id, "detail")}
        >
          SFX
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move up"
          onClick={() => onMove(entry.id, -1)}
        >
          <ChevronUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Move down"
          onClick={() => onMove(entry.id, 1)}
        >
          <ChevronDown />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Remove"
          onClick={() => onRemove(entry.id)}
        >
          <Trash2 />
        </Button>
      </div>

      <label className="mb-1 block text-xs text-muted">Original</label>
      <Textarea
        ref={jpRef}
        value={entry.japanese}
        lang="ja"
        spellCheck={false}
        placeholder="Japanese"
        className="min-h-16 bg-surface text-base leading-relaxed"
        onChange={(e) => onChange(entry.id, { japanese: e.target.value })}
        onSelect={captureJp}
        onKeyUp={captureJp}
        onMouseUp={captureJp}
      />

      <div className="mt-3 mb-1 flex items-center justify-between gap-2">
        <label className="text-xs text-muted">Translation</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!entry.japanese.trim() || translating}
          onClick={() => onTranslate(entry.id)}
        >
          {translating ? <Loader2 className="animate-spin" /> : <Languages />}
          {translating ? "Translating" : queued ? "Queued" : "Translate"}
        </Button>
      </div>
      <Textarea
        ref={enRef}
        value={entry.english}
        spellCheck
        placeholder="English — editable. Click a word below for alternatives."
        className="min-h-16 bg-surface text-sm leading-relaxed"
        onChange={(e) => {
          onChange(entry.id, { english: e.target.value });
          onClearAlt();
        }}
        onMouseUp={captureEn}
      />

      {entry.english.trim() ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-0 gap-y-1">
          {tokens.map((token, i) =>
            token.isWord ? (
              <button
                key={`${token.start}-${i}`}
                type="button"
                className={cn(
                  "rounded-sm px-0.5 text-sm leading-relaxed text-fg underline-offset-2 hover:bg-surface hover:underline",
                  alt &&
                    alt.entryId === entry.id &&
                    alt.start === token.start &&
                    "bg-surface underline",
                )}
                onClick={() =>
                  onRequestAlts(entry.id, token.start, token.end, token.value)
                }
              >
                {token.value}
              </button>
            ) : (
              <span key={`${token.start}-${i}`} className="text-sm text-muted">
                {token.value}
              </span>
            ),
          )}
        </div>
      ) : null}

      {alt && alt.entryId === entry.id ? (
        <div className="mt-2 rounded-md bg-surface px-2 py-2">
          <p className="text-xs text-muted">
            Replace “{alt.word}”
          </p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const value = custom.trim();
              if (!value) return;
              onApplyAlt(entry, value);
              setCustom("");
            }}
          >
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom name, term, or phrasing"
              className="h-9 bg-bg-warm"
            />
            <Button type="submit" size="sm" disabled={!custom.trim()}>
              Use
            </Button>
          </form>
          {alt.options === null ? (
            <p className="mt-2 text-xs text-subtle">Loading suggestions…</p>
          ) : alt.options.length === 0 ? (
            <p className="mt-2 text-xs text-subtle">
              No suggestions. Type your own above — it is saved to the
              dictionary.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {alt.options.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onApplyAlt(entry, option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

function DictionarySection({
  records,
  onRemember,
  onForget,
}: {
  records: GlossaryRecord[];
  onRemember: (input: { from: string; to: string }) => void;
  onForget: (id: string) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="space-y-3">
      <div className="h-px bg-border" />
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-fg">Dictionary</h3>
        <Badge>{records.length}</Badge>
      </div>
      <p className="text-sm text-muted">
        Phrase pairs stay on this device. Only the replaced term is stored, not
        the whole line.
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!from.trim() || !to.trim()) return;
          onRemember({ from, to });
          setFrom("");
          setTo("");
        }}
      >
        <Input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="Phrase or name"
          className="h-9"
        />
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Use instead"
          className="h-9"
        />
        <Button type="submit" size="sm" disabled={!from.trim() || !to.trim()}>
          Add
        </Button>
      </form>
      {records.length === 0 ? (
        <p className="text-sm text-subtle">
          Empty. Click a word and type a custom replacement to fill it.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((row) => (
            <li
              key={row.id}
              className="flex items-start gap-2 rounded-lg bg-bg-warm px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-fg">{row.from}</p>
                <p className="text-sm text-muted">{row.to}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove from dictionary"
                onClick={() => onForget(row.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

