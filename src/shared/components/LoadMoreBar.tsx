import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@ui/button";
import { Loader2 } from "lucide-react";

interface LoadMoreBarProps {
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  countLabel: string;
}

export function LoadMoreBar({
  total: _total,
  hasMore,
  isLoading,
  onLoadMore,
  countLabel,
}: LoadMoreBarProps) {
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load the next page as the bar scrolls into view. The button below stays as
  // the keyboard and screen-reader path — this only removes a click for people
  // who are already scrolling. Observing against the viewport works even though
  // the layout scrolls an inner container: the element still intersects.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div className="flex flex-col gap-3 border-t border-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div ref={sentinelRef} aria-hidden="true" />
      <span className="text-xs text-gray-500 sm:text-sm">{countLabel}</span>
      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={onLoadMore}
          className="sm:self-end"
        >
          {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {t("common.loadMore")}
        </Button>
      )}
    </div>
  );
}
