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
  const [state, setState] = useState<{ a: CompareSide | null; b: CompareSide | null; message: string | null; loading: boolean }>({
    a: null,
    b: null,
    message: null,
    loading: false,
  });

  useEffect(() => {
    if (!keyA || !keyB) {
      setState({ a: null, b: null, message: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, message: null }));
    (async () => {
      const index = await readJson<IndexFile>("index.json");
      const find = (key: ComponentKey) =>
        index?.repositories.find((entry) => entry.owner === key.owner && entry.name === key.repo) ?? null;
      const entryA = find(keyA);
      const entryB = find(keyB);
      const missing = [entryA ? null : textA, entryB ? null : textB].filter(Boolean);
      if (missing.length > 0) {
        if (!cancelled) {
          setState({ a: null, b: null, loading: false, message: `Not on the component list: ${missing.join(" and ")}.` });
        }
        return;
      }
      const [latestA, latestB] = await Promise.all([
        readJson<LatestFile>(`${entryA!.path}/latest.json`),
        readJson<LatestFile>(`${entryB!.path}/latest.json`),
      ]);
      if (!cancelled) {
        setState({ a: sideOf(entryA!, latestA, props), b: sideOf(entryB!, latestB, props), message: null, loading: false });
      }
    })().catch(() => {
      if (!cancelled) setState({ a: null, b: null, loading: false, message: "The data of this site could not be read." });
    });
    return () => {
      cancelled = true;
    };
    // The keys are compared as text, so a new search params object for the same pair does not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textA, textB]);

  return (
    <ComparePageView
      options={props.options}
      selectedA={textA}
      selectedB={textB}
      a={state.a}
      b={state.b}
      functionalityNames={props.functionalityNames}
      message={keyA && keyB && textA === textB ? "Choose two different components." : state.message}
      loading={state.loading}
    />
  );
}
