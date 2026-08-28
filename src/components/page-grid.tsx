import { useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tile = { id: string; src: string };

export function PageGrid({
  pages,
  pageIndex,
  onSelect,
  onMove,
}: {
  pages: Tile[];
  pageIndex: number;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  return (
    <div className="grid h-full grid-cols-2 content-start gap-3 overflow-y-auto p-3 sm:grid-cols-3 md:grid-cols-4">
      {pages.map((page, i) => {
        const active = i === pageIndex;
        const hovering = over === i && from !== null && from !== i;
        return (
          <article
            key={page.id}
            draggable
            onDragStart={(e) => {
              setFrom(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragEnd={() => {
              setFrom(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const origin =
                from ?? Number(e.dataTransfer.getData("text/plain"));
              if (Number.isInteger(origin)) onMove(origin, i);
              setFrom(null);
              setOver(null);
            }}
            className={cn(
              "group relative cursor-grab overflow-hidden rounded-xl bg-bg shadow-[var(--shadow-border)]",
              active ? "ring-2 ring-accent" : "",
              hovering ? "ring-2 ring-fg" : "",
              from === i ? "opacity-60" : "",
            )}
          >
            <button
              type="button"
              className="block w-full"
              onClick={() => onSelect(i)}
            >
              <img
                src={page.src}
                alt={`Page ${i + 1}`}
                draggable={false}
                className="aspect-[3/4] w-full object-cover"
              />
            </button>
            <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-surface/95 px-2 py-0.5 text-xs font-medium tabular-nums">
              {i + 1}
            </div>
            <div className="absolute right-1 top-1 hidden rounded-md bg-surface/95 p-0.5 text-muted group-hover:block">
              <GripVertical className="size-4" />
            </div>
            <div className="flex items-center justify-between gap-1 px-1 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move page ${i + 1} earlier`}
                disabled={i === 0}
                onClick={() => onMove(i, i - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="text-[11px] text-muted">Drag</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Move page ${i + 1} later`}
                disabled={i === pages.length - 1}
                onClick={() => onMove(i, i + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
