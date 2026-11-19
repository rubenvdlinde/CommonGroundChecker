import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AddComponentPanel from "@/components/AddComponentPanel";
import { IS_STATIC_SITE } from "@/lib/dataSource/mode";

export const metadata: Metadata = {
  title: "Add your component | Common Ground Component Checker",
};

/** The static site explains how to add a component; the server checks one with the form on About. */
export default function AddComponentPage() {
  if (!IS_STATIC_SITE) redirect("/about#check");
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <AddComponentPanel />
    </div>
  );
}
