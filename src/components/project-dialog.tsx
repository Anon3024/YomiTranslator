import { useRef, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEFAULT_PROJECT_NAME } from "@/lib/project";

export function ProjectDialog({
  name,
  onName,
  busy,
  hasWork,
  onNew,
  onSave,
  onLoad,
}: {
  name: string;
  onName: (value: string) => void;
  busy: boolean;
  hasWork: boolean;
  onNew: () => void;
  onSave: () => void | Promise<void>;
  onLoad: (file: File) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"new" | "load" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = () => fileRef.current?.click();

  const requestNew = () => {
    if (hasWork) {
      setPending("new");
      return;
    }
    onNew();
    setOpen(false);
  };

  const requestLoad = () => {
    if (hasWork) {
      setPending("load");
      return;
    }
    pickFile();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPending(null);
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Project: ${name}`}
        >
          <FolderOpen />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Project</DialogTitle>
        <DialogDescription>
          A project is a fresh Yomi session: pages, translations, and this
          project’s dictionary. API keys stay in the browser. Save downloads a
          zip folder you can load later.
        </DialogDescription>
        <div className="mt-4 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Name</span>
            <Input
              value={name}
              maxLength={80}
              onChange={(e) => onName(e.target.value)}
              placeholder={DEFAULT_PROJECT_NAME}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          {pending ? (
            <div className="space-y-3 rounded-lg bg-bg-warm p-4">
              <p className="text-sm leading-relaxed text-fg">
                This clears the current pages and dictionary. API keys are kept.
                Unsaved work will be lost.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const action = pending;
                    setPending(null);
                    if (action === "new") {
                      onNew();
                      setOpen(false);
                    } else {
                      pickFile();
                    }
                  }}
                >
                  Continue
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPending(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={requestNew}
              >
                New
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={requestLoad}
              >
                Load
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void onSave()}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".zip,.yomi,application/zip"
          aria-label="Load project zip"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            void onLoad(file);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
