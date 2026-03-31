import { useState, useEffect, useRef, useMemo } from "react";
import { CAT_MAP, getCats } from "../utils/categories.js";
import EvidenceCard from "./EvidenceCard.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import styles from "../styles/TimelineView.module.css";

export default function TimelineView({ items, onDelete }) {
  const [activeYear, setActiveYear] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const timelineRef = useRef();

  const sorted = useMemo(
    () =>
      [...items]
        .filter((i) => i.sourceDate)
        .sort((a, b) =>
          sortAsc
            ? new Date(a.sourceDate) - new Date(b.sourceDate)
            : new Date(b.sourceDate) - new Date(a.sourceDate)
        ),
    [items, sortAsc]
  );
  const noDate = useMemo(() => items.filter((i) => !i.sourceDate), [items]);

  /* scroll-spy */
  useEffect(() => {
    if (!timelineRef.current || sorted.length === 0) return;
    const els = timelineRef.current.querySelectorAll("[data-year]");
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (vis.length > 0) {
          vis.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveYear(vis[0].target.dataset.year);
        }
      },
      { rootMargin: "-140px 0px -50% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sorted.length]);

  /* initialize year */
  useEffect(() => {
    if (sorted.length > 0 && !activeYear)
      setActiveYear(String(new Date(sorted[0].sourceDate).getFullYear()));
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

      {/* sort toggle */}
      {sorted.length > 1 && (
        <div className={styles.sortToggle}>
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className={styles.sortBtn}
            aria-label={sortAsc ? "Sort newest first" : "Sort oldest first"}
          >
            {sortAsc ? "Oldest first \u2191" : "Newest first \u2193"}
          </button>
        </div>
      )}

      {/* sticky year indicator */}
      {activeYear && sorted.length > 0 && (
        <div className={styles.stickyYear} aria-hidden="true">
          <span className={styles.stickyYearText}>{activeYear}</span>
        </div>
      )}

      <div ref={timelineRef} className={styles.timeline}>
        {sorted.length > 0 && <div className={styles.timelineLine} />}
        {sorted.map((item, i) => {
          const cat = CAT_MAP[getCats(item)[0]] || CAT_MAP.other;
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
            <div key={item.id} data-year={cur.getFullYear()}>
              {/* year divider */}
              {showYear && (
                <div
                  className={styles.yearDivider}
                  style={{ marginTop: i > 0 ? "40px" : "8px" }}
                >
                  <span className={styles.yearLabel}>
                    {cur.getFullYear()}
                  </span>
                  <div className={styles.dividerLine} />
                </div>
              )}
              {/* gap indicator */}
              {gapLabel && !showYear && (
                <div className={styles.gapIndicator}>
                  &middot;&middot;&middot; {gapLabel} &middot;&middot;&middot;
                </div>
              )}
              {/* month header */}
              {showMonth && !showYear && (
                <div
                  className={styles.monthHeaderStandard}
                  style={{ marginTop: i > 0 ? "28px" : 0 }}
                >
                  {cur.toLocaleDateString("en-US", { month: "long" })}
                  <span className={styles.monthCount}>
                    {monthCounts[monthKey]} item
                    {monthCounts[monthKey] > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {/* month header after year divider */}
              {showYear && (
                <div className={styles.monthHeaderAfterYear}>
                  {cur.toLocaleDateString("en-US", { month: "long" })}
                  <span className={styles.monthCount}>
                    {monthCounts[monthKey]} item
                    {monthCounts[monthKey] > 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {/* card with emoji dot */}
              <div className={styles.cardWrapper}>
                <div
                  className={styles.timelineDot}
                  style={{
                    background: `${cat.color}22`,
                    border: `1.5px solid ${cat.color}44`,
                  }}
                  aria-hidden="true"
                >
                  {cat.icon}
                </div>
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
}
