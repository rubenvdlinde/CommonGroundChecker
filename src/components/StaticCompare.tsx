"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ComparePageView, { type CompareOption } from "@/components/ComparePageView";
import { componentKeyText, parseComponentKey, type ComponentKey } from "@/lib/compare";
import { compareSideFrom, type CompareProvider, type CompareSide } from "@/lib/compareSide";
import type { ListedFunctionalities } from "@/lib/functionalities/load";
import type { IndexEntry, IndexFile, LatestFile } from "@/lib/staticSite/records";

interface StaticCompareProps {
  options: CompareOption[];
  functionalityNames: Record<string, string>;
  /** From config/repositories.yml at build time, by owner/repo */
  listed: Record<string, ListedFunctionalities>;
  providers: Record<string, CompareProvider[]>;
}

const DATA_ROOT = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data`;

async function readJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${DATA_ROOT}/${path}`);
  return response.ok ? ((await response.json()) as T) : null;
}

function sideOf(entry: IndexEntry, latest: LatestFile | null, props: StaticCompareProps): CompareSide {
  const key = `${entry.owner}/${entry.name}`;
  return compareSideFrom({
    owner: entry.owner,
    repo: entry.name,
    displayName: entry.displayName,
    repoUrl: entry.repoUrl,
    analysis: latest?.analysis ?? null,
    functionalities: props.listed[key]?.functionalities ?? entry.functionalities ?? [],
    functionalitiesDraft: props.listed[key]?.functionalitiesDraft ?? entry.functionalitiesDraft ?? false,
    providers: props.providers[key] ?? [],
  });
}

/**
 * The compare page of the static site. The two components come from the URL;
 * their data is read in the browser from index.json and each latest.json.
 */
export default function StaticCompare(props: StaticCompareProps) {
  const params = useSearchParams();
  const keyA = parseComponentKey(params.get("a"));
  const keyB = parseComponentKey(params.get("b"));
  const textA = keyA ? componentKeyText(keyA) : null;
  const textB = keyB ? componentKeyText(keyB) : null;
  const pair = keyA && keyB ? `${textA} ${textB}` : null;
  const [state, setState] = useState<{ pair: string | null; a: CompareSide | null; b: CompareSide | null; message: string | null }>({
    pair: null,
    a: null,
    b: null,
    message: null,
  });

  useEffect(() => {
    if (!keyA || !keyB || !pair || textA === textB) return;
    let cancelled = false;
    const done = (next: Omit<typeof state, "pair">) => {
      if (!cancelled) setState({ pair, ...next });
    };
    (async () => {
      const index = await readJson<IndexFile>("index.json");
      const find = (key: ComponentKey) =>
        index?.repositories.find((entry) => entry.owner === key.owner && entry.name === key.repo) ?? null;
      const entryA = find(keyA);
      const entryB = find(keyB);
      const missing = [entryA ? null : textA, entryB ? null : textB].filter(Boolean);
      if (!entryA || !entryB) {
        done({ a: null, b: null, message: `Not on the component list: ${missing.join(" and ")}.` });
        return;
      }
      const [latestA, latestB] = await Promise.all([
        readJson<LatestFile>(`${entryA.path}/latest.json`),
        readJson<LatestFile>(`${entryB.path}/latest.json`),
      ]);
      done({ a: sideOf(entryA, latestA, props), b: sideOf(entryB, latestB, props), message: null });
    })().catch(() => done({ a: null, b: null, message: "The data of this site could not be read." }));
    return () => {
      cancelled = true;
    };
    // The pair is compared as text, so a new search params object for the same pair does not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair]);

  const current = pair !== null && state.pair === pair ? state : null;

  return (
    <ComparePageView
      options={props.options}
      selectedA={textA}
      selectedB={textB}
      a={current?.a ?? null}
      b={current?.b ?? null}
      functionalityNames={props.functionalityNames}
      message={pair && textA === textB ? "Choose two different components." : (current?.message ?? null)}
      loading={pair !== null && textA !== textB && current === null}
    />
  );
}
