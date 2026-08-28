# Yomi

#### (Shamelessly Vibe Coded with Grok)

Transcribe Japanese from photos, then edit or translate line by line.

Yomi is a local-first page reader for signs, menus, screenshots, and manga panels. You add images, draw a region around the text you care about, get a transcription, and optionally an English translation you can rewrite.

It does **not** ship an API key. You paste your own [xAI](https://docs.x.ai) key once; it stays in this browser.

## Features

- Add pages by drop, paste, file picker, or image URL
- Crop a region so OCR sees only the balloon, sign, or line you selected
- Multi-page session with left/right navigation
- Re-order pages in a grid (drag or arrows). Regions are off in that view
- Lines vs SFX/detail: dialogue stays a Line; signs, tattoos, and sound effects can be marked SFX
- Translate one line or queue a whole page. Calls run one after another
- Click a word in the English for alternatives, or type a custom phrasing
- Phrase dictionary stored in this browser (term → replacement, not the whole line)
- Export a Markdown file of every page (original + translation, lines and SFX)
- Download the images as `yomi-pages.zip` (`1.png`, `2.png`, … in current order)
- Light and dark theme

## Your API key

1. Create an API key in your xAI account.
2. In Yomi, open the key icon (or the **Add your API key** card) and paste it.
3. Save. Later visits on this device reuse it until you remove it.

The key is stored only in this browser. It is sent only with transcribe, translate, and alternative-word requests. Removing it forgets it on this device.

Transcription and translation will not run without a key.

## How to use

1. Drop, paste, or choose a photo. Add more pages if you have a sequence.
2. **Region** is the default tool. Drag a box over one balloon or line, then **Transcribe**. Repeat for the next region.
3. Edit the Japanese if the reading is off.
4. **Translate** one line, or **Translate page** for every empty line. Further clicks while one is running add them to the queue.
5. Click an English word for alternatives, or type your own name/term. Only that phrase is saved to the dictionary.
6. Mark background text and sound effects as **SFX** so they export in a separate section.
7. **Export** writes `yomi.md`. **Download images** writes a zip of the pages as PNG.

### Shortcuts and tools

| Action | How |
| --- | --- |
| Zoom | Scroll over the photo (that does not scroll the page) |
| Pan | Pan tool, Shift-drag, or middle-mouse drag |
| Next / previous page | Arrow buttons, or left/right keys (not while typing) |
| Re-order pages | Toolbar button → grid. Drag or use a tile’s arrows. **Done** returns to the current page |
| Paste | Ctrl+V / Cmd+V, or the Paste button |

## Run it yourself

```bash
npm install
npm run dev
```

Open the URL the command prints. The app is meant to run on your machine. You still supply your own xAI key in the UI.

### Windows (native, no WSL)

Requires Node 22 installed for Windows (use the official installer or
[nvm-windows](https://github.com/coreybutler/nvm-windows)). Then:

```bat
npm install
npm run dev
```

or double-click `startup.cmd` (PowerShell users: `startup.ps1`). Open
`http://localhost:8080` in your browser.

```bash
npm run build
npm run preview
```

builds a production bundle.

### Package a standalone executable (pkg)

Build a self-contained binary that runs on machines without Node installed. It
starts the server on port 8080 and opens your browser.

```bash
npm run package
```

This runs `build:standalone` (a `node-server` Nitro build) and then `pkg .` to
produce, in `dist/`:

- `app-builder-workspace-win.exe`
- `app-builder-workspace-macos`
- `app-builder-workspace-linux`

To build a single target instead, use `npx pkg . --targets <triple>` (for
example `node22-win-x64`). The launcher honours `PORT` (default 8080) and skips
opening the browser when `YOMI_NO_BROWSER=1`.

## Privacy and use

- Images stay in this session. They are not uploaded to a Yomi server for storage.
- The dictionary and API key live in this browser only.
- Use only material you have a right to read.
- Do not upload sexual content involving anyone under 18, including drawings, or intimate images of real people.

## Export shape

Markdown export looks like:

```markdown
## Page 1
### Original
#### Lines
Line 1: …
#### Detail/SFX
Detail 1: …
### Translation
#### Lines
Line 1: …
#### Detail/SFX
Detail 1: …
```

Image zip files are named `1.png`, `2.png`, … matching page order after any re-order.
