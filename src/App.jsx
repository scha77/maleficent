import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { CATEGORIES, CAT_MAP, getCats } from "./utils/categories.js";
import { PLATFORM_MAP, cleanHandle } from "./utils/platforms.js";
import TimelineView from "./components/TimelineView.jsx";
import AddModal from "./components/AddModal.jsx";
import Toast from "./components/Toast.jsx";
import styles from "./styles/App.module.css";

const PAGE_SIZE = 50;

const YEAR_RANGE = Array.from({ length: 2026 - 2019 + 1 }, (_, i) => String(2019 + i));

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [fbError, setFbError] = useState(false);
  const [toast, setToast] = useState(null);
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [activeYear, setActiveYear] = useState("");
  const [showUsernames, setShowUsernames] = useState(false);
  const undoRef = useRef(null);
  const sentinelRef = useRef(null);
  const timelineRef = useRef(null);

  /* real-time Firestore listener with pagination */
  useEffect(() => {
    let unsubscribe;
    try {
      const q = query(
        collection(db, "evidence"),
        orderBy("createdAt", "desc"),
        limit(pageLimit)
      );
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setItems(docs);
          setHasMore(snapshot.docs.length === pageLimit);
          setLoading(false);
        },
        (err) => {
          console.error("Firestore error:", err);
          setFbError(true);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Firebase init error:", err);
      setFbError(true);
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, [pageLimit]);

  /* infinite scroll sentinel */
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPageLimit((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  /* toast-based delete with undo */
  const handleDelete = useCallback(
    async (id) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      const { id: _id, ...data } = item;
      undoRef.current = { id, data };

      try {
        await deleteDoc(doc(db, "evidence", id));
        setToast({
          message: "Evidence removed",
          onUndo: async () => {
            try {
              await addDoc(collection(db, "evidence"), {
                ...undoRef.current.data,
                createdAt: serverTimestamp(),
              });
            } catch (err) {
              console.error("Undo error:", err);
            }
            setToast(null);
          },
        });
      } catch (err) {
        console.error("Delete error:", err);
      }
    },
    [items]
  );

  /* search + filter */
  const existingUrls = useMemo(
    () => items.filter((i) => i.url).map((i) => i.url),
    [items]
  );

  const existingUsernames = useMemo(
    () =>
      items
        .filter((i) => i.usernames)
        .map((i) => i.usernames.toLowerCase()),
    [items]
  );

  const usernameItems = useMemo(
    () => items.filter((i) => i.type === "username"),
    [items]
  );

  const filtered = useMemo(
    () =>
      items.filter((i) => {
        if (i.type === "username") return false;
        const cats = getCats(i);
        if (filterCat !== "all" && !cats.includes(filterCat)) return false;
        return true;
      }),
    [items, filterCat]
  );

  const yearSet = useMemo(() => {
    const s = new Set();
    filtered.forEach((i) => {
      if (i.sourceDate) s.add(String(new Date(i.sourceDate).getFullYear()));
    });
    return s;
  }, [filtered]);

  const evidenceItems = useMemo(
    () => items.filter((i) => i.type !== "username"),
    [items]
  );

  const catCounts = useMemo(() => {
    const counts = {};
    evidenceItems.forEach((i) =>
      getCats(i).forEach((c) => {
        counts[c] = (counts[c] || 0) + 1;
      })
    );
    return counts;
  }, [evidenceItems]);

  if (loading)
    return (
      <div className={styles.loadingPage}>
        <div style={{ textAlign: "center" }}>
          <div className={styles.loadingDot}>&#x25C9;</div>
          <p className={styles.loadingText}>Loading evidence&hellip;</p>
        </div>
      </div>
    );

  if (fbError)
    return (
      <div className={styles.errorPage}>
        <div className={styles.errorInner}>
          <div className={styles.errorIcon}>&#x1F527;</div>
          <h2 className={styles.errorTitle}>Firebase not connected</h2>
          <p className={styles.errorText}>
            Open{" "}
            <code className={styles.errorCode}>src/firebase.js</code> and
            replace the placeholder config with your Firebase project
            credentials. See the comments in that file for step-by-step
            instructions.
          </p>
        </div>
      </div>
    );

  return (
    <div className={styles.page}>
      {/* header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Reasons we're concerned</h1>
      </header>

      {/* toolbar */}
      <div className={styles.toolbar} role="toolbar" aria-label="Evidence filters">
        <div className={styles.toolbarInner}>
          {/* category filter chips */}
          <div className={styles.filterRow} role="group" aria-label="Category filters">
            <button
              onClick={() => setFilterCat("all")}
              className={`${styles.filterChip} ${filterCat === "all" ? styles.filterChipActive : ""}`}
              aria-pressed={filterCat === "all"}
            >
              All ({evidenceItems.length})
            </button>
            {CATEGORIES.map((c) => {
              const count = catCounts[c.id] || 0;
              if (count === 0) return null;
              const active = filterCat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setFilterCat(active ? "all" : c.id)}
                  className={styles.filterChip}
                  style={
                    active
                      ? {
                          background: `${c.color}25`,
                          color: c.color,
                          borderColor: `${c.color}44`,
                        }
                      : undefined
                  }
                  aria-pressed={active}
                >
                  {c.icon} {c.label} ({count})
                </button>
              );
            })}
            <button
              onClick={() => setShowAdd(true)}
              className={styles.addBtn}
              aria-label="Add new evidence"
            >
              + Add
            </button>
          </div>

          {/* year nav */}
          <div className={styles.yearRow} role="group" aria-label="Year navigation">
            {YEAR_RANGE.map((y) => {
              const hasItems = yearSet.has(y);
              const isActive = activeYear === y;
              return (
                <button
                  key={y}
                  onClick={() => {
                    if (hasItems) timelineRef.current?.scrollToYear(y);
                  }}
                  className={`${styles.yearChip} ${isActive ? styles.yearChipActive : ""} ${!hasItems ? styles.yearChipEmpty : ""}`}
                  aria-pressed={isActive}
                  aria-disabled={!hasItems}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* username toggle */}
      {usernameItems.length > 0 && (
        <div className={styles.usernameBar}>
          <button
            className={styles.usernameToggle}
            onClick={() => setShowUsernames((v) => !v)}
            aria-expanded={showUsernames}
          >
            <span className={styles.usernameToggleLabel}>
              Known accounts ({usernameItems.length})
            </span>
            <span className={`${styles.usernameArrow} ${showUsernames ? styles.usernameArrowOpen : ""}`}>
              &#x25BE;
            </span>
          </button>
          {showUsernames && (
            <div className={styles.usernameList}>
              {usernameItems.map((u) => {
                const handle = cleanHandle(u.usernames);
                const plats = u.platforms || [];
                return (
                  <div key={u.id} className={styles.usernameRow}>
                    <span className={styles.usernameHandle}>{u.usernames}</span>
                    <span className={styles.platformBadges}>
                      {plats.map((pid) => {
                        const p = PLATFORM_MAP[pid];
                        if (!p) return null;
                        return (
                          <a
                            key={pid}
                            href={p.url(handle)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.platformBadge}
                            style={{ color: p.color, borderColor: `${p.color}44` }}
                            title={`${u.usernames} on ${p.label}`}
                          >
                            {p.short}
                          </a>
                        );
                      })}
                    </span>
                    <button
                      className={styles.usernameRemove}
                      onClick={() => handleDelete(u.id)}
                      aria-label={`Remove ${u.usernames}`}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* content */}
      {evidenceItems.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>&#x1F4CE;</div>
          <p className={styles.emptyTitle}>No evidence yet.</p>
          <p className={styles.emptyHint}>
            Tap{" "}
            <strong style={{ color: "var(--accent)" }}>+ Add</strong> to
            start building the case.
          </p>
        </div>
      ) : (
        <TimelineView
          ref={timelineRef}
          items={filtered}
          onDelete={handleDelete}
          onActiveYearChange={setActiveYear}
        />
      )}

      {/* infinite scroll sentinel */}
      {hasMore && <div ref={sentinelRef} className={styles.sentinel} />}

      {/* toast */}
      {toast && (
        <Toast
          message={toast.message}
          onUndo={toast.onUndo}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* mobile FAB */}
      <button
        onClick={() => setShowAdd(true)}
        className={styles.fab}
        aria-label="Add evidence"
      >
        +
      </button>

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          existingUrls={existingUrls}
          existingUsernames={existingUsernames}
        />
      )}
    </div>
  );
}
