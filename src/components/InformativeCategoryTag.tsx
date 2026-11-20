import { isInformativeCategory } from "@/lib/criteria";

/** The note on an informative category: it has a rating, but it never counts in the overall rating or the verdict. */
export const INFORMATIVE_CATEGORY_NOTE = "Informative: it does not count in the overall rating or the verdict.";

/** An "Informative" tag next to a category that never counts; nothing for any other category. */
export default function InformativeCategoryTag({ category }: { category: string }) {
  if (!isInformativeCategory(category)) return null;
  return (
    <span
      title={INFORMATIVE_CATEGORY_NOTE}
      className="px-2 py-0.5 rounded-full border border-blue-300 text-blue-700 bg-blue-50 text-xs font-semibold"
    >
      Informative
      <span className="sr-only">: it does not count in the overall rating or the verdict</span>
    </span>
  );
}
