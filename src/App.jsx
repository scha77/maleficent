import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef, uploadBytes, getDownloadURL,
} from "firebase/storage";
import { db, storage } from "./firebase.js";

/* ── categories ── */
const CATEGORIES = [
  { id: "lies", label: "Lies & Deception", icon: "🎭", color: "#c2785c" },
  { id: "manipulation", label: "Manipulation", icon: "🕸️", color: "#8b6f8e" },
  { id: "money", label: "Money & Finances", icon: "💸", color: "#6a8e6f" },
  { id: "character", label: "Character & Behavior", icon: "🚩", color: "#b08d57" },
  { id: "relationships", label: "Relationships & Trust", icon: "💔", color: "#7a8fa6" },
  { id: "other", label: "Other", icon: "📌", color: "#888" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

/* ── helpers ── */
const fmt = (d) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const extractEmbed = (url) => {
  if (!url) return null;
  try {
    if (url.includes("instagram.com")) {
      const m = url.match(/instagram\.com\/(?:p|reel|reels)\/([^/?#]+)/);
      if (m) return { platform: "instagram", id: m[1], embedUrl: `https://www.instagram.com/p/${m[1]}/embed` };
    }
    if (url.includes("tiktok.com")) {
      const m = url.match(/video\/(\d+)/);
      if (m) return { platform: "tiktok", id: m[1], embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}` };
    }
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      let vid = null;
      if (url.includes("youtu.be/")) vid = url.split("youtu.be/")[1]?.split(/[?#]/)[0];
      else { const u = new URL(url); vid = u.searchParams.get("v"); }
      if (vid) return { platform: "youtube", id: vid, embedUrl: `https://www.youtube.com/embed/${vid}` };
    }
    if (url.includes("twitter.com") || url.includes("x.com")) {
      return { platform: "twitter", id: url, embedUrl: null, raw: url };
    }
  } catch {}
  return null;
};

/* ── shared styles ── */
const S = {
  page: { minHeight: "100vh", background: "#141210", color: "#ece4da", fontFamily: "'DM Sans', sans-serif" },
  glass: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px" },
  btn: (bg = "rgba(255,255,255,0.08)", fg = "#ece4da") => ({
    fontFamily: "'DM Sans', sans-serif", fontSize: "14px", padding: "10px 22px",
    borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
    background: bg, color: fg, transition: "all .2s",
  }),
  input: {
    width: "100%", padding: "12px 14px", borderRadius: "10px", fontSize: "14px",
    border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
    color: "#ece4da", fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box",
  },
  label: {
    fontSize: "12px", textTransform: "uppercase", letterSpacing: ".08em",
    color: "rgba(255,255,255,0.4)", marginBottom: "6px", display: "block",
  },
};

/* ── helpers: categories ── */
const getCats = (item) => item.categories || [item.category || "other"];

function CategoryPicker({ selected, onChange }) {
  const toggle = (id) => {
    if (selected.includes(id)) {
      if (selected.length > 1) onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {CATEGORIES.map((c) => {
        const active = selected.includes(c.id);
        return (
          <button key={c.id} onClick={() => toggle(c.id)} type="button" style={{
            fontSize: "11px", padding: "5px 10px", borderRadius: "20px", cursor: "pointer", transition: "all .2s",
            background: active ? `${c.color}25` : "rgba(255,255,255,0.05)",
            color: active ? c.color : "rgba(255,255,255,0.35)",
            border: `1px solid ${active ? `${c.color}44` : "rgba(255,255,255,0.08)"}`,
          }}>{c.icon} {c.label}</button>
        );
      })}
    </div>
  );
}

/* ── NSFW gate ── */
function NsfwGate({ onReveal }) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 5, borderRadius: "14px",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "rgba(20,18,16,0.88)", backdropFilter: "blur(18px)",
    }}>
      <span style={{ fontSize: "32px", marginBottom: "10px" }}>⚠️</span>
      <p style={{ fontSize: "14px", color: "#d4a0a0", marginBottom: "16px", textAlign: "center", padding: "0 20px" }}>
        This content has been marked sensitive.
      </p>
      <button onClick={(e) => { e.stopPropagation(); onReveal(); }}
        style={{ ...S.btn("rgba(168,92,92,0.25)", "#e8c4c4"), fontSize: "13px", padding: "8px 20px" }}>
        Show content
      </button>
    </div>
  );
}

/* ── Evidence Card ── */
function EvidenceCard({ item, onDelete }) {
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCats, setEditCats] = useState([]);
  const [editingCaption, setEditingCaption] = useState(false);
  const [editCaption, setEditCaption] = useState("");
  const cats = getCats(item);
  const gated = item.nsfw && !revealed;

  const startEdit = () => { setEditCats(cats); setEditing(true); };
  const saveEdit = async () => {
    try {
      await updateDoc(doc(db, "evidence", item.id), { categories: editCats, category: editCats[0] });
      setEditing(false);
    } catch (err) { console.error("Update error:", err); }
  };
  const startCaptionEdit = () => { setEditCaption(item.caption || ""); setEditingCaption(true); };
  const saveCaptionEdit = async () => {
    try {
      await updateDoc(doc(db, "evidence", item.id), { caption: editCaption.trim() });
      setEditingCaption(false);
    } catch (err) { console.error("Update error:", err); }
  };

  return (
    <div style={{ ...S.glass, padding: 0, overflow: "hidden", position: "relative" }}>
      {gated && <NsfwGate onReveal={() => setRevealed(true)} />}
      <div style={{ padding: "14px 14px 10px", filter: gated ? "blur(12px)" : "none", transition: "filter .3s" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", flex: 1, alignItems: "center" }}>
            {cats.map((id) => {
              const c = CAT_MAP[id] || CAT_MAP.other;
              return (
                <span key={id} title={c.label} style={{
                  fontSize: "13px", padding: "3px 6px", borderRadius: "20px",
                  background: `${c.color}18`, border: `1px solid ${c.color}33`,
                  lineHeight: 1,
                }}>{c.icon}</span>
              );
            })}
            <button onClick={startEdit}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", opacity: 0.3, padding: "4px 6px", color: "#ece4da" }}
              title="Edit categories">✎</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            {item.sourceDate && <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{fmt(item.sourceDate)}</span>}
            <button onClick={() => onDelete(item.id)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", opacity: 0.25, padding: "4px", color: "#ece4da" }}
              title="Delete">✕</button>
          </div>
        </div>
        {editing && (
          <div style={{ marginBottom: "12px", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "10px" }}>
            <CategoryPicker selected={editCats} onChange={setEditCats} />
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <button onClick={() => setEditing(false)} style={{ ...S.btn(), fontSize: "12px", padding: "6px 14px" }}>Cancel</button>
              <button onClick={saveEdit} style={{ ...S.btn("rgba(194,120,92,0.25)", "#c2785c"), fontSize: "12px", padding: "6px 14px", borderColor: "rgba(194,120,92,0.3)" }}>Save</button>
            </div>
          </div>
        )}

        {/* embed */}
        {item.type === "embed" && item.embedUrl && (
          item.embedPlatform === "tiktok" ? (
            <div style={{
              borderRadius: "10px", overflow: "hidden", marginBottom: "4px", background: "#000",
              marginLeft: "-14px", marginRight: "-14px", height: "750px",
            }}>
              <iframe src={item.embedUrl} style={{ width: "100%", height: "100%", border: "none" }}
                scrolling="no" allowFullScreen allow="encrypted-media" loading="lazy" />
            </div>
          ) : (
            <div style={{
              borderRadius: "10px", overflow: "hidden", marginBottom: "4px", background: "#000",
              position: "relative", paddingBottom: "56.25%", height: 0,
              marginLeft: "-14px", marginRight: "-14px",
            }}>
              <iframe src={item.embedUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allowFullScreen allow="encrypted-media" loading="lazy" />
            </div>
          )
        )}
        {item.type === "embed" && !item.embedUrl && item.url && (
          <div style={{ padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", marginBottom: "12px", textAlign: "center" }}>
            <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "#7a8fa6", fontSize: "14px", wordBreak: "break-all" }}>
              🔗 {item.url}
            </a>
          </div>
        )}

        {/* image */}
        {item.type === "image" && item.imageUrl && (
          <div style={{ borderRadius: "10px", overflow: "hidden", marginBottom: "12px" }}>
            <img src={item.imageUrl} alt="" style={{ width: "100%", display: "block", borderRadius: "10px" }} loading="lazy" />
          </div>
        )}

        {/* caption */}
        {editingCaption ? (
          <div style={{ marginBottom: "4px" }}>
            <textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} rows={3}
              style={{ ...S.input, resize: "vertical", lineHeight: 1.5, fontSize: "14px" }} />
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button onClick={() => setEditingCaption(false)} style={{ ...S.btn(), fontSize: "12px", padding: "6px 14px" }}>Cancel</button>
              <button onClick={saveCaptionEdit} style={{ ...S.btn("rgba(194,120,92,0.25)", "#c2785c"), fontSize: "12px", padding: "6px 14px", borderColor: "rgba(194,120,92,0.3)" }}>Save</button>
            </div>
          </div>
        ) : (
          <p onClick={startCaptionEdit}
            style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", cursor: "pointer" }}>
            {item.caption || <span style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>Add a caption…</span>}
          </p>
        )}

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
          <span>Added {item.createdAt ? fmt(item.createdAt) : "just now"}</span>
          {item.nsfw && <span style={{ color: "#a85c5c" }}>NSFW</span>}
        </div>
      </div>
    </div>
  );
}

/* ── Add Evidence Modal ── */
function AddModal({ onClose, onSave }) {
  const [mode, setMode] = useState("embed");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [categories, setCategories] = useState(["lies"]);
  const [nsfw, setNsfw] = useState(false);
  const [sourceDate, setSourceDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError("File must be under 10 MB"); return; }
    setError("");
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (mode === "embed" && !url.trim()) { setError("Paste a link"); return; }
    if (mode === "image" && !imageFile) { setError("Upload an image"); return; }

    setSaving(true);
    setError("");

    try {
      let imageUrl = null;

      // Upload image to Firebase Storage
      if (mode === "image" && imageFile) {
        const fileName = `evidence/${Date.now()}_${imageFile.name}`;
        const sRef = storageRef(storage, fileName);
        await uploadBytes(sRef, imageFile);
        imageUrl = await getDownloadURL(sRef);
      }

      // Parse embed info
      const embed = mode === "embed" ? extractEmbed(url.trim()) : null;

      // Save to Firestore
      const docData = {
        type: mode,
        categories,
        category: categories[0],
        nsfw,
        caption: caption.trim(),
        sourceDate: sourceDate || null,
        createdAt: serverTimestamp(),
      };

      if (mode === "embed") {
        docData.url = url.trim();
        docData.embedUrl = embed?.embedUrl || null;
        docData.embedPlatform = embed?.platform || null;
        docData.embedRaw = embed?.raw || null;
      } else {
        docData.imageUrl = imageUrl;
        docData.imageName = imageFile.name;
      }

      await addDoc(collection(db, "evidence"), docData);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to save. Check your Firebase config.");
    }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)", padding: "16px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        ...S.glass, width: "100%", maxWidth: "520px", padding: "28px 24px",
        maxHeight: "90vh", overflowY: "auto", background: "rgba(28,25,22,0.97)", border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 400, fontSize: "22px", margin: "0 0 24px" }}>
          Add Evidence
        </h2>

        {/* mode toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {[["embed", "🔗 Embed Link"], ["image", "🖼 Upload Image"]].map(([m, lbl]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              style={{
                ...S.btn(mode === m ? "rgba(194,120,92,0.2)" : "rgba(255,255,255,0.05)", mode === m ? "#c2785c" : "rgba(255,255,255,0.4)"),
                flex: 1, fontSize: "13px", padding: "10px 0", borderColor: mode === m ? "rgba(194,120,92,0.3)" : "rgba(255,255,255,0.08)",
              }}>{lbl}</button>
          ))}
        </div>

        {mode === "embed" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={S.label}>Link (Instagram, TikTok, YouTube, X / Twitter)</label>
            <input style={S.input} placeholder="https://www.instagram.com/reel/..." value={url} onChange={(e) => { setUrl(e.target.value); setError(""); }} />
          </div>
        )}

        {mode === "image" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={S.label}>Screenshot or image (max 10 MB)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ ...S.btn(), width: "100%", textAlign: "center", padding: "24px 14px" }}>
              {imageFile ? `✓ ${imageFile.name}` : "Tap to choose file"}
            </button>
            {imagePreview && <img src={imagePreview} alt="" style={{ width: "100%", borderRadius: "10px", marginTop: "10px", maxHeight: "200px", objectFit: "contain" }} />}
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={S.label}>Categories (select one or more)</label>
          <CategoryPicker selected={categories} onChange={setCategories} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={S.label}>Source date (when did this originally happen?)</label>
          <input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} style={{ ...S.input, colorScheme: "dark" }} />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={S.label}>Caption (optional)</label>
          <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3}
            placeholder="Add context, explain what this shows…"
            style={{ ...S.input, resize: "vertical", lineHeight: 1.5 }} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "20px", fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
          <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} style={{ accentColor: "#a85c5c", width: "18px", height: "18px" }} />
          Mark as NSFW / sensitive content
        </label>

        {error && <p style={{ color: "#d4a0a0", fontSize: "13px", marginBottom: "14px" }}>{error}</p>}

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} style={{ ...S.btn(), flex: 1 }} disabled={saving}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...S.btn("rgba(194,120,92,0.25)", "#c2785c"), flex: 1, borderColor: "rgba(194,120,92,0.3)", opacity: saving ? 0.5 : 1 }}>
            {saving ? "Uploading…" : "Add evidence"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Timeline View ── */
function TimelineView({ items, onDelete }) {
  const [activeYear, setActiveYear] = useState("");
  const timelineRef = useRef();

  const sorted = [...items].filter((i) => i.sourceDate).sort((a, b) => new Date(a.sourceDate) - new Date(b.sourceDate));
  const noDate = items.filter((i) => !i.sourceDate);

  /* scroll-spy: track which year is at the top of the viewport */
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
      { rootMargin: "-140px 0px -50% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sorted.length]);

  /* initialize year */
  useEffect(() => {
    if (sorted.length > 0 && !activeYear) setActiveYear(String(new Date(sorted[0].sourceDate).getFullYear()));
  }, [sorted.length]);

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "8px 16px 100px", position: "relative" }}>
      {items.length === 0 && (
        <p style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "40px 0", fontSize: "14px" }}>
          No results match your filter.
        </p>
      )}
      {items.length > 0 && sorted.length === 0 && (
        <p style={{ color: "rgba(255,255,255,0.25)", textAlign: "center", padding: "40px 0", fontSize: "14px" }}>
          No evidence with source dates yet. Add dates when submitting to see them here.
        </p>
      )}

      {/* sticky year indicator */}
      {activeYear && sorted.length > 0 && (
        <div style={{ position: "sticky", top: "130px", height: 0, overflow: "visible", zIndex: 10, pointerEvents: "none" }}>
          <span style={{
            position: "absolute", right: "calc(100% + 12px)", top: 0,
            fontFamily: "'Newsreader', Georgia, serif", fontSize: "64px", fontWeight: 300,
            color: "rgba(255,255,255,0.04)", lineHeight: 1, whiteSpace: "nowrap",
            transition: "opacity .3s",
          }}>{activeYear}</span>
        </div>
      )}

      <div ref={timelineRef} style={{ position: "relative", paddingLeft: "36px" }}>
        {sorted.length > 0 && <div style={{ position: "absolute", left: "11px", top: "8px", bottom: "8px", width: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px" }} />}
        {sorted.map((item, i) => {
          const cat = CAT_MAP[getCats(item)[0]] || CAT_MAP.other;
          const cur = new Date(item.sourceDate);
          const prevDate = i > 0 ? new Date(sorted[i - 1].sourceDate) : null;
          const showYear = !prevDate || cur.getFullYear() !== prevDate.getFullYear();
          const showMonth = !prevDate || cur.getMonth() !== prevDate.getMonth() || cur.getFullYear() !== prevDate.getFullYear();

          /* gap indicator: show "X months" if >60 days between events */
          let gapLabel = null;
          if (prevDate) {
            const diffDays = Math.floor((cur - prevDate) / (1000 * 60 * 60 * 24));
            if (diffDays > 60) {
              const months = Math.round(diffDays / 30);
              gapLabel = months >= 12 ? `${Math.round(months / 12)} yr gap` : `${months} mo gap`;
            }
          }

          return (
            <div key={item.id} data-year={cur.getFullYear()}>
              {/* year divider */}
              {showYear && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  marginTop: i > 0 ? "40px" : "8px", marginBottom: "20px", marginLeft: "-36px", paddingLeft: "4px",
                }}>
                  <span style={{
                    fontFamily: "'Newsreader', Georgia, serif", fontSize: "28px", fontWeight: 300,
                    color: "rgba(255,255,255,0.15)",
                  }}>{cur.getFullYear()}</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
                </div>
              )}
              {/* gap indicator */}
              {gapLabel && !showYear && (
                <div style={{
                  textAlign: "center", margin: "16px 0", marginLeft: "-36px",
                  fontSize: "10px", color: "rgba(255,255,255,0.15)", textTransform: "uppercase", letterSpacing: ".12em",
                }}>
                  ···  {gapLabel}  ···
                </div>
              )}
              {/* month header */}
              {showMonth && !showYear && (
                <div style={{
                  fontSize: "12px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: ".1em",
                  marginBottom: "14px", marginTop: i > 0 ? "28px" : 0, marginLeft: "-36px", paddingLeft: "36px",
                }}>{cur.toLocaleDateString("en-US", { month: "long" })}</div>
              )}
              {/* month header after year divider */}
              {showYear && (
                <div style={{
                  fontSize: "12px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: ".1em",
                  marginBottom: "14px", marginLeft: "0",
                }}>{cur.toLocaleDateString("en-US", { month: "long" })}</div>
              )}
              {/* card with emoji dot */}
              <div style={{ position: "relative", marginBottom: "20px" }}>
                <div style={{
                  position: "absolute", left: "-36px", top: "18px", width: "24px", height: "24px",
                  borderRadius: "50%", background: `${cat.color}22`, border: `1.5px solid ${cat.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", zIndex: 2,
                }}>{cat.icon}</div>
                <EvidenceCard item={item} onDelete={onDelete} />
              </div>
            </div>
          );
        })}
      </div>
      {noDate.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "48px 0 16px" }}>
            <span style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: "18px", fontWeight: 300, color: "rgba(255,255,255,0.35)" }}>Undated</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.06)" }} />
          </div>
          <div style={{ display: "grid", gap: "14px" }}>{noDate.map((item) => <EvidenceCard key={item.id} item={item} onDelete={onDelete} />)}</div>
        </>
      )}
    </div>
  );
}

/* ── Main App ── */
export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [fbError, setFbError] = useState(false);

  /* real-time Firestore listener */
  useEffect(() => {
    let unsubscribe;
    try {
      const q = query(collection(db, "evidence"), orderBy("createdAt", "desc"));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setItems(docs);
        setLoading(false);
      }, (err) => {
        console.error("Firestore error:", err);
        setFbError(true);
        setLoading(false);
      });
    } catch (err) {
      console.error("Firebase init error:", err);
      setFbError(true);
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm("Remove this evidence?")) return;
    try {
      await deleteDoc(doc(db, "evidence", id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  /* search + filter */
  const filtered = items.filter((i) => {
    const cats = getCats(i);
    if (filterCat !== "all" && !cats.includes(filterCat)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (i.caption || "").toLowerCase().includes(q)
        || (i.url || "").toLowerCase().includes(q)
        || cats.some((id) => (CAT_MAP[id]?.label || "").toLowerCase().includes(q));
    }
    return true;
  });


  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "24px", marginBottom: "12px", animation: "pulse 1.5s ease infinite" }}>◉</div>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "14px" }}>Loading evidence…</p>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:.3 } 50% { opacity:1 } }`}</style>
    </div>
  );

  if (fbError) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", padding: "24px" }}>
      <div style={{ textAlign: "center", maxWidth: "480px" }}>
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔧</div>
        <h2 style={{ fontFamily: "'Newsreader', Georgia, serif", fontWeight: 400, marginBottom: "16px" }}>Firebase not connected</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", lineHeight: 1.7, fontSize: "14px" }}>
          Open <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: "4px" }}>src/firebase.js</code> and
          replace the placeholder config with your Firebase project credentials. See the comments in that file for step-by-step instructions.
        </p>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* header */}
      <header style={{ textAlign: "center", padding: "48px 20px 20px" }}>
        <h1 style={{
          fontFamily: "'Newsreader', Georgia, serif", fontWeight: 300,
          fontSize: "clamp(26px,5vw,40px)", color: "#ece4da", letterSpacing: "-0.02em",
        }}>
          Reasons we're concerned
        </h1>
      </header>

      {/* toolbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, padding: "12px 16px",
        background: "rgba(20,18,16,0.88)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <div style={{ position: "relative", marginBottom: "10px" }}>
            <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", opacity: 0.3 }}>🔍</span>
            <input style={{ ...S.input, paddingLeft: "38px" }} placeholder="Search evidence…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {/* category filter chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "8px" }}>
            <button onClick={() => setFilterCat("all")}
              style={{
                fontSize: "12px", padding: "5px 10px", borderRadius: "20px", cursor: "pointer", transition: "all .2s",
                background: filterCat === "all" ? "rgba(194,120,92,0.2)" : "rgba(255,255,255,0.05)",
                color: filterCat === "all" ? "#c2785c" : "rgba(255,255,255,0.4)",
                border: `1px solid ${filterCat === "all" ? "rgba(194,120,92,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}>All ({items.length})</button>
            {CATEGORIES.map((c) => {
              const count = items.filter((i) => getCats(i).includes(c.id)).length;
              if (count === 0) return null;
              const active = filterCat === c.id;
              return (
                <button key={c.id} onClick={() => setFilterCat(active ? "all" : c.id)}
                  style={{
                    fontSize: "12px", padding: "5px 10px", borderRadius: "20px", cursor: "pointer", transition: "all .2s",
                    background: active ? `${c.color}25` : "rgba(255,255,255,0.05)",
                    color: active ? c.color : "rgba(255,255,255,0.4)",
                    border: `1px solid ${active ? `${c.color}44` : "rgba(255,255,255,0.08)"}`,
                  }}>{c.icon} {c.label} ({count})</button>
              );
            })}
            <button onClick={() => setShowAdd(true)}
              style={{ ...S.btn("rgba(194,120,92,0.25)", "#c2785c"), fontSize: "12px", padding: "5px 14px", borderColor: "rgba(194,120,92,0.3)", marginLeft: "auto" }}>
              + Add
            </button>
          </div>
        </div>
      </div>

      {/* content */}
      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 20px", animation: "fadeUp .6s ease" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.4 }}>📎</div>
          <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.35)", marginBottom: "8px", lineHeight: 1.6 }}>No evidence yet.</p>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>Tap <strong style={{ color: "#c2785c" }}>+ Add</strong> to start building the case.</p>
        </div>
      ) : (
        <TimelineView items={filtered} onDelete={handleDelete} />
      )}

      {/* mobile FAB */}
      <button onClick={() => setShowAdd(true)} style={{
        position: "fixed", bottom: "24px", right: "24px", zIndex: 80,
        width: "56px", height: "56px", borderRadius: "50%", fontSize: "24px",
        background: "rgba(194,120,92,0.9)", color: "#fff", border: "none",
        cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>+</button>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
