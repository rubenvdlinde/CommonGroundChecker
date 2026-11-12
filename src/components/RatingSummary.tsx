import EndorsementChip from "@/components/EndorsementChip";
import RatingBadge from "@/components/RatingBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { RATING_SUMMARY_ID } from "@/lib/issues";
import type { Endorsement } from "@/lib/types";

interface RatingSummaryProps {
  rating: number | null;
  endorsement?: Endorsement | null;
  score: number;
}

/** The head of a component's rating: overall stars, whether it passes and why not, and the compliance score. */
export default function RatingSummary({ rating, endorsement, score }: RatingSummaryProps) {
  return (
    <>
      <div id={RATING_SUMMARY_ID} tabIndex={-1} className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall rating</span>
        <RatingBadge rating={rating} size="large" />
        {endorsement && <EndorsementChip endorsement={endorsement} showReasons />}
      </div>
      <ScoreBadge score={score} />
    </>
  );
}
