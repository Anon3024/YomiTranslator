import type { TranslatorId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TranslatorToggle({
  value,
  onChange,
  grokReady,
  deeplReady,
  size = "md",
}: {
  value: TranslatorId;
  onChange: (next: TranslatorId) => void;
  grokReady: boolean;
  deeplReady: boolean;
  size?: "sm" | "md";
}) {
  if (!deeplReady) return null;

  const options: { id: TranslatorId; label: string; ready: boolean }[] = [
    { id: "grok", label: "Grok", ready: grokReady },
    { id: "deepl", label: "DeepL", ready: deeplReady },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Translation engine"
      className={cn(
        "inline-flex rounded-lg bg-surface-inset p-1",
        size === "sm" ? "h-11" : "h-12",
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!opt.ready}
            onClick={() => onChange(opt.id)}
            className={cn(
              "min-w-20 rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out",
              size === "sm" ? "h-9" : "h-10",
              selected
                ? "bg-surface text-fg shadow-[var(--shadow-border)]"
                : "text-muted hover:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
