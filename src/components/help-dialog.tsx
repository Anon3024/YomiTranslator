import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="How to use Yomi">
          <CircleHelp />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>How to use Yomi</DialogTitle>
        <DialogDescription>
          Transcribe Japanese from a photo, then edit or translate line by line.
        </DialogDescription>
        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-fg">
          <section className="space-y-1">
            <h3 className="font-medium">Projects</h3>
            <p className="text-muted">
              The folder icon opens the current project. Name it, then Save to
              download a zip folder of the pages, translations, and this
              project’s dictionary. Load opens a saved zip. New starts a blank
              project. API keys are kept; the dictionary is not shared between
              projects.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Add pages</h3>
            <p className="text-muted">
              Drop files, paste with Ctrl+V / Cmd+V, choose an image, or load a
              URL. Add several pages, then move with the arrows or the left and
              right keys.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Re-order pages</h3>
            <p className="text-muted">
              Re-order pages switches the photo to a grid. Drag a page, or use
              its arrows. Regions cannot be drawn in this view. Done returns to
              the current page.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Download images</h3>
            <p className="text-muted">
              Saves every page as a zip: 1.png, 2.png, and so on, in the
              current order.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Read a region</h3>
            <p className="text-muted">
              Region is the default tool. Drag a box over one balloon or line,
              then Transcribe. Repeat for the next region — each one becomes
              its own line. A crop of that box sits next to the Japanese so
              you can correct the reading without scrolling back to the photo.
              Click the crop to enlarge it. Pan with the Pan tool, Shift-drag,
              or the middle mouse button. Scroll over the photo to zoom; that
              does not scroll the page.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Lines and SFX</h3>
            <p className="text-muted">
              Dialogue stays a Line. Signs, tattoos, background text, and sound
              effects can be marked SFX so they export in a separate section.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Translate</h3>
            <p className="text-muted">
              Translate one line, or Translate page for every empty line.
              Clicking Translate on more lines while one is running adds them
              to a queue — they run one after another. If a DeepL key is
              saved, choose Grok or DeepL with the Translate with control.
              The English box is always editable. A line with Context set is
              sent to Grok so the English can follow that situation. Grok also
              reads nearby lines in Japanese and English when guessing a
              person.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Context</h3>
            <p className="text-muted">
              Each line has an optional Context field for situation or
              delivery — for example "speaking with a mouth full". Translate
              and word alternatives honor it, so the English can sound
              muffled, whispered, or otherwise non-literal instead of a tidy
              rendering of the Japanese. DeepL cannot use freeform context;
              those lines use Grok.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Custom wording</h3>
            <p className="text-muted">
              Click a word in the English line for other readings of the
              original Japanese. Suggestions also read this line and nearby
              lines in both Japanese and English, so a vague or omitted person
              can be I, you, he, she, or they without a character list. Pronoun
              chips appear immediately. A pronoun-only swap stays on this line;
              a Japanese term (奴, お前, a name) is saved to the project
              dictionary. Suggest again after changing Context.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">Dictionary</h3>
            <p className="text-muted">
              Japanese → English pairs belong to the current project. New
              project starts empty; Load restores that zip’s dictionary. Add
              names or terms by hand. Export writes every page as Markdown.
            </p>
          </section>
          <section className="space-y-1">
            <h3 className="font-medium">About the AI</h3>
            <p className="text-muted">
              Paste your own xAI API key for transcription and Grok
              translation. Optionally add a DeepL key and switch Translate
              between Grok and DeepL. Keys stay in this browser. Removing a
              key forgets it on this device.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
