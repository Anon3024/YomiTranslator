import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { looksLikeApiKey, maskApiKey } from "@/lib/api-key";

export function ApiKeyDialog({
  apiKey,
  onSave,
  onClear,
}: {
  apiKey: string;
  onSave: (key: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={apiKey ? "Change API key" : "Add API key"}
        >
          <KeyRound />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>xAI API key</DialogTitle>
        <DialogDescription>
          Yomi does not ship with a key. Paste yours from the xAI console. It
          stays in this browser and is sent only with transcribe and translate
          requests.
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!looksLikeApiKey(draft)) {
              toast.error("That does not look like an API key.");
              return;
            }
            onSave(draft.trim());
            setDraft("");
            setOpen(false);
            toast("API key saved on this device");
          }}
        >
          {apiKey ? (
            <p className="text-sm text-muted">
              Saved key:{" "}
              <span className="font-mono text-fg">{maskApiKey(apiKey)}</span>
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
            placeholder={apiKey ? "Replace key" : "xai-…"}
            className="font-mono"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!looksLikeApiKey(draft)}>
              Save key
            </Button>
            {apiKey ? (
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
        Transcription and translation call xAI with <em>your</em> key. Nothing
        is billed until you save one. It is stored only in this browser.
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
