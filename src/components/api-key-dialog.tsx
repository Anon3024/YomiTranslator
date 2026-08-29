import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TranslatorToggle } from "@/components/translator-toggle";
import {
  looksLikeApiKey,
  looksLikeDeeplKey,
  maskApiKey,
} from "@/lib/api-key";
import type { TranslatorId } from "@/lib/types";

function KeyForm({
  saved,
  placeholder,
  looksValid,
  onSave,
  onClear,
  saveLabel,
}: {
  saved: string;
  placeholder: string;
  looksValid: (value: string) => boolean;
  onSave: (key: string) => void;
  onClear: () => void;
  saveLabel: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!looksValid(draft)) {
          toast.error("That does not look like an API key.");
          return;
        }
        onSave(draft.trim());
        setDraft("");
        toast(saveLabel);
      }}
    >
      {saved ? (
        <p className="text-sm text-muted">
          Saved key:{" "}
          <span className="font-mono text-fg">{maskApiKey(saved)}</span>
        </p>
      ) : (
        <p className="text-sm text-muted">No key saved yet.</p>
      )}
      <Input
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={saved ? "Replace key" : placeholder}
        className="font-mono"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!looksValid(draft)}>
          Save key
        </Button>
        {saved ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onClear();
              setDraft("");
              toast("API key removed");
            }}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function ApiKeyDialog({
  apiKey,
  onSave,
  onClear,
  deeplKey,
  onSaveDeepl,
  onClearDeepl,
  translator,
  onTranslator,
}: {
  apiKey: string;
  onSave: (key: string) => void;
  onClear: () => void;
  deeplKey: string;
  onSaveDeepl: (key: string) => void;
  onClearDeepl: () => void;
  translator: TranslatorId;
  onTranslator: (next: TranslatorId) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={apiKey || deeplKey ? "Change API keys" : "Add API keys"}
        >
          <KeyRound />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>API keys</DialogTitle>
        <DialogDescription>
          Keys stay in this browser. Transcribe always uses xAI. Translate can
          use Grok or DeepL.
        </DialogDescription>
        <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">xAI</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Required for transcription, Grok translation, and word
                alternatives. Paste a key from the xAI console.
              </p>
            </div>
            <KeyForm
              saved={apiKey}
              placeholder="xai-…"
              looksValid={looksLikeApiKey}
              onSave={(key) => {
                onSave(key);
                setOpen(false);
              }}
              onClear={onClear}
              saveLabel="xAI key saved on this device"
            />
          </section>

          <Separator />

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">DeepL</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Optional. Used only for translation. Free keys usually end in
                :fx. Get one from the DeepL API account page.
              </p>
            </div>
            <KeyForm
              saved={deeplKey}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
              looksValid={looksLikeDeeplKey}
              onSave={onSaveDeepl}
              onClear={onClearDeepl}
              saveLabel="DeepL key saved on this device"
            />
          </section>

          {deeplKey ? (
            <>
              <Separator />
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium">Translate with</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    Applies to Translate and Translate page. Word alternatives
                    still use Grok.
                  </p>
                </div>
                <TranslatorToggle
                  value={translator}
                  onChange={onTranslator}
                  grokReady={Boolean(apiKey)}
                  deeplReady={Boolean(deeplKey)}
                />
              </section>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeyGate({
  onSave,
}: {
  onSave: (key: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-6">
      <h2 className="font-display text-xl tracking-tight">Add your API key</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Transcription and Grok translation call xAI with <em>your</em> key.
        Nothing is billed until you save one. After that you can add an
        optional DeepL key from the key menu.
      </p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!looksLikeApiKey(draft)) {
            toast.error("That does not look like an API key.");
            return;
          }
          onSave(draft.trim());
          toast("API key saved on this device");
        }}
      >
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="xai-…"
          className="font-mono"
        />
        <Button type="submit" disabled={!looksLikeApiKey(draft)}>
          Save key
        </Button>
      </form>
    </section>
  );
}
