import { useEffect, useRef, useMemo, useImperativeHandle, forwardRef } from "react";
import { CAT_MAP, getCats } from "../utils/categories.js";
import EvidenceCard from "./EvidenceCard.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import styles from "../styles/TimelineView.module.css";

const TimelineView = forwardRef(function TimelineView(
  { items, onDelete, onActiveYearChange },
  ref
) {
  const timelineRef = useRef();

  const sorted = useMemo(
    () =>
      [...items]
        .filter((i) => i.sourceDate)
        .sort((a, b) => new Date(a.sourceDate) - new Date(b.sourceDate)),
    [items]
  );
  const noDate = useMemo(() => items.filter((i) => !i.sourceDate), [items]);

  /* expose scrollToYear to parent */
  useImperativeHandle(ref, () => ({
    scrollToYear(year) {
      if (!timelineRef.current) return;
      const el = timelineRef.current.querySelector(
        `[data-year-section="${year}"]`
      );
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top, behavior: "smooth" });
      }
    },
  }));

  /* scroll-spy: report active year to parent */
  useEffect(() => {
    if (!timelineRef.current || sorted.length === 0) return;
    const els = timelineRef.current.querySelectorAll("[data-year]");
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (vis.length > 0) {
          vis.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top
          );
          onActiveYearChange?.(vis[0].target.dataset.year);
        }
      },
      { rootMargin: "-140px 0px -50% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sorted.length, onActiveYearChange]);

  /* initialize year */
  useEffect(() => {
    if (sorted.length > 0)
      onActiveYearChange?.(
        String(new Date(sorted[0].sourceDate).getFullYear())
      );
  }, [sorted.length]);

  /* count items per month/year */
  const monthCounts = useMemo(() => {
    const counts = {};
    sorted.forEach((item) => {
      const d = new Date(item.sourceDate);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [sorted]);

  return (
    <div className={styles.wrapper}>
      {items.length === 0 && (
        <p className={styles.emptyText}>No results match your filter.</p>
      )}
      {items.length > 0 && sorted.length === 0 && (
        <p className={styles.emptyText}>
          No evidence with source dates yet. Add dates when submitting to see
          them here.
        </p>
      )}

      <div ref={timelineRef} className={styles.timeline}>
        {sorted.map((item, i) => {
          const cur = new Date(item.sourceDate);
          const prevDate =
            i > 0 ? new Date(sorted[i - 1].sourceDate) : null;
          const showYear =
            !prevDate || cur.getFullYear() !== prevDate.getFullYear();
          const showMonth =
            !prevDate ||
            cur.getMonth() !== prevDate.getMonth() ||
            cur.getFullYear() !== prevDate.getFullYear();
          const monthKey = `${cur.getFullYear()}-${cur.getMonth()}`;

          let gapLabel = null;
          if (prevDate) {
            const diff = Math.abs(cur - prevDate);
            const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
            if (diffDays > 60) {
              const months = Math.round(diffDays / 30);
              gapLabel =
                months >= 12
                  ? `${Math.round(months / 12)} yr gap`
                  : `${months} mo gap`;
            }
          }

          return (
            <div
              key={item.id}
              data-year={cur.getFullYear()}
              {...(showYear
                ? { "data-year-section": cur.getFullYear() }
                : {})}
            >
              {/* gap indicator */}
              {gapLabel && !showYear && (
                <div className={styles.gapIndicator}>
                  &middot;&middot;&middot; {gapLabel} &middot;&middot;&middot;
                </div>
              )}
              {/* month header */}
              {showMonth && (
                <div
                  className={styles.monthHeader}
                  style={{ marginTop: i > 0 ? (showYear ? "40px" : "28px") : "8px" }}
                >
                  {cur.toLocaleDateString("en-US", { month: "long" })}
                  {showYear && ` ${cur.getFullYear()}`}
                  <span className={styles.monthCount}>
                    {monthCounts[monthKey]} item
                    {monthCounts[monthKey] > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div className={styles.cardWrapper}>
                <ErrorBoundary>
                  <EvidenceCard item={item} onDelete={onDelete} />
                </ErrorBoundary>
              </div>
            </div>
          );
        })}
      </div>

      {noDate.length > 0 && (
        <>
          <div className={styles.undatedSection}>
            <span className={styles.undatedLabel}>Undated</span>
            <span className={styles.undatedCount}>{noDate.length}</span>
            <div className={styles.dividerLine} />
          </div>
          <div className={styles.undatedGrid}>
            {noDate.map((item) => (
              <ErrorBoundary key={item.id}>
                <EvidenceCard item={item} onDelete={onDelete} />
              </ErrorBoundary>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

export default TimelineView;
