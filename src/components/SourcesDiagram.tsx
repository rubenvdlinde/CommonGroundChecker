"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { DiagramSourceId, SourcesDiagramData } from "@/lib/sourcesDiagram";

interface LinkPath {
  source: DiagramSourceId;
  group: string;
  d: string;
  width: number;
}

const sourceColor = (id: DiagramSourceId) => `var(--src-${id})`;

function Dots({ sources }: { sources: DiagramSourceId[] }) {
  return (
    <span className="inline-flex gap-[3px]" aria-hidden="true">
      {sources.map((source) => (
        <i key={source} className="inline-block h-[9px] w-[9px] rounded-full" style={{ background: sourceColor(source) }} />
      ))}
    </span>
  );
}

/**
 * The sources of the checklist on the left, what the checker measures on the right, grouped per tool.
 * A line is thicker as more measures follow from that source. Selecting a source shows only its measures.
 * Below the lg breakpoint the lines go and every measure keeps its source dots.
 */
export default function SourcesDiagram({ data }: { data: SourcesDiagramData }) {
  const [selected, setSelected] = useState<DiagramSourceId | null>(null);
  const [paths, setPaths] = useState<LinkPath[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const board = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef(new Map<DiagramSourceId, HTMLElement>());
  const groupRefs = useRef(new Map<string, HTMLElement>());

  const draw = useCallback(() => {
    const root = board.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const next: LinkPath[] = [];
    data.sources.forEach((source, sourceIndex) => {
      const sourceBox = sourceRefs.current.get(source.id)?.getBoundingClientRect();
      if (!sourceBox) return;
      data.groups.forEach((group, groupIndex) => {
        const count = group.measures.filter((measure) => measure.sources.includes(source.id)).length;
        const groupBox = groupRefs.current.get(group.id)?.getBoundingClientRect();
        if (!count || !groupBox) return;
        const x1 = sourceBox.right - box.left;
        const y1 = sourceBox.top - box.top + 16 + (sourceBox.height - 32) * (groupIndex / Math.max(1, data.groups.length - 1));
        const x2 = groupBox.left - box.left;
        const y2 = groupBox.top - box.top + 18 + sourceIndex * 5;
        const mid = (x1 + x2) / 2;
        next.push({
          source: source.id,
          group: group.id,
          d: `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`,
          width: 1 + count * 0.9,
        });
      });
    });
    setSize({ width: box.width, height: box.height });
    setPaths(next);
  }, [data]);

  useLayoutEffect(() => {
    draw();
    const root = board.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(root);
    return () => observer.disconnect();
  }, [draw]);

  const selectedSource = data.sources.find((source) => source.id === selected);
  const hits = (sources: DiagramSourceId[]) => selected !== null && sources.includes(selected);

  return (
    <div className="sources-diagram space-y-4 rounded-xl p-3 sm:p-4" data-selected={selected ?? undefined}>
      <p aria-live="polite" className="text-sm sd-muted">
        {selectedSource
          ? `Showing the ${selectedSource.count} measures that follow from ${selectedSource.name}. Select it again to show all.`
          : "Select a source to show only the measures that follow from it."}
      </p>
      <div ref={board} className="relative grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-x-28">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block"
          viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
        >
          {paths.map((path) => (
            <path
              key={`${path.source}>${path.group}`}
              data-link={`${path.source}>${path.group}`}
              d={path.d}
              fill="none"
              stroke={sourceColor(path.source)}
              strokeWidth={path.width}
              strokeLinecap="round"
              className="transition-opacity motion-reduce:transition-none"
              opacity={selected === null ? 0.55 : selected === path.source ? 0.85 : 0.06}
            />
          ))}
        </svg>
        <ul aria-label="Sources" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
          {data.sources.map((source) => {
            const on = selected === source.id;
            return (
              <li key={source.id}>
                <button
                  type="button"
                  ref={(element) => {
                    if (element) sourceRefs.current.set(source.id, element);
                  }}
                  data-source={source.id}
                  aria-pressed={on}
                  onClick={() => setSelected(on ? null : source.id)}
                  className="sd-panel w-full rounded-md border-l-4 p-3 text-left transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    borderLeftColor: sourceColor(source.id),
                    outlineColor: sourceColor(source.id),
                    opacity: selected === null || on ? 1 : 0.45,
                  }}
                >
                  <span className="block text-base font-semibold" style={{ color: sourceColor(source.id) }}>
                    {source.name}
                  </span>
                  <span className="mt-1 block text-sm sd-muted">{source.text}</span>
                  {source.items && (
                    <span className="mt-2 block space-y-0.5 text-sm sd-muted">
                      {source.items.map((item) => (
                        <span key={item} className="block">
                          {item}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="mt-2 block font-mono text-xs sd-fg">{source.count} measures</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="grid grid-cols-1 gap-3">
          {data.groups.map((group) => {
            const groupHit = group.measures.some((measure) => hits(measure.sources));
            return (
              <section
                key={group.id}
                ref={(element) => {
                  if (element) groupRefs.current.set(group.id, element);
                }}
                data-group={group.id}
                aria-label={group.name}
                className="sd-panel rounded-md p-3 transition-opacity"
                style={{ opacity: selected === null || groupHit ? 1 : 0.3 }}
              >
                <h4 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold sd-fg">
                  {group.name} <span className="font-mono text-xs font-normal sd-muted">{group.tool}</span>
                </h4>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {group.measures.map((measure) => {
                    const dimmed = selected !== null && !hits(measure.sources);
                    const label = (
                      <>
                        <Dots sources={measure.sources} />
                        {measure.name}
                      </>
                    );
                    return (
                      <li
                        key={measure.id}
                        data-measure={measure.id}
                        data-sources={measure.sources.join(" ")}
                        className={`sd-chip inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-sm ${measure.informative ? "border-dashed sd-muted" : "sd-fg"}`}
                        style={{ opacity: dimmed ? 0.3 : 1 }}
                      >
                        {measure.href ? (
                          <Link href={measure.href} className="inline-flex items-center gap-1.5 hover:underline">
                            {label}
                          </Link>
                        ) : (
                          label
                        )}
                        <span className="sr-only">
                          {`, from ${measure.sources.map((id) => data.sources.find((source) => source.id === id)!.name).join(", ")}`}
                          {measure.informative ? ", informative" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-2 text-sm sd-muted">
        {data.sources.map((source) => (
          <li key={source.id} className="inline-flex items-center gap-1.5">
            <Dots sources={[source.id]} />
            {source.name}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="sd-chip inline-block h-3 w-5 rounded border-dashed" aria-hidden="true" />
          Informative, never counted
        </li>
      </ul>
    </div>
  );
}
