import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

/* debounce hook */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* image compression */
function compressImage(file, maxWidth = 1600, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") { resolve(file); return; }
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w <= maxWidth) { resolve(file); return; }
      h = Math.round(h * (maxWidth / w));
      w = maxWidth;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        resolve(blob && blob.size < file.size ? new File([blob], file.name, { type: "image/webp" }) : file);
      }, "image/webp", quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

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

/* ── Lazy iframe loader ── */
function LazyEmbed({ children, style }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={style}>
      {visible ? children : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "120px", color: "rgba(255,255,255,0.15)", fontSize: "13px" }}>
          Loading…
        </div>
      )}
    </div>
  );
}

/* ── Toast notification ── */
function Toast({ message, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div style={{
      position: "fixed", bottom: "96px", left: "50%", transform: "translateX(-50%)", zIndex: 300,
      background: "rgba(28,25,22,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px",
      padding: "12px 20px", display: "flex", alignItems: "center", gap: "14px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.5)", backdropFilter: "blur(12px)",
    }}>
      <span style={{ fontSize: "14px", color: "#ece4da" }}>{message}</span>
      {onUndo && (
        <button onClick={onUndo} style={{
          background: "none", border: "1px solid rgba(194,120,92,0.4)", borderRadius: "8px",
          color: "#c2785c", fontSize: "13px", padding: "4px 12px", cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>Undo</button>
      )}
    </div>
  );
}

/* ── Image lightbox ── */
function Lightbox({ src, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.9)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      cursor: "zoom-out",
    }}>
      <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "8px" }} />
    </div>
  );
}

/* ── URL preview card ── */
function UrlPreview({ url }) {
  const domain = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url; } })();
  const isTwitter = domain.includes("x.com") || domain.includes("twitter.com");
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{
      display: "flex", alignItems: "center", gap: "12px", padding: "14px",
      background: "rgba(255,255,255,0.03)", borderRadius: "10px", marginBottom: "12px",
      textDecoration: "none", border: "1px solid rgba(255,255,255,0.05)", transition: "border-color .2s",
    }}>
      <div style={{
        width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
        background: isTwitter ? "rgba(29,155,240,0.15)" : "rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
      }}>{isTwitter ? "𝕏" : "🔗"}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: "13px", color: "#ece4da", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {isTwitter ? "View on X / Twitter" : domain}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "2px" }}>
          {url}
        </div>
      </div>
      <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "14px", flexShrink: 0 }}>→</span>
    </a>
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
  const [editingDate, setEditingDate] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState(null);
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
  const startDateEdit = () => { setEditDate(item.sourceDate || ""); setEditingDate(true); };
  const saveDateEdit = async () => {
    try {
      await updateDoc(doc(db, "evidence", item.id), { sourceDate: editDate || null });
      setEditingDate(false);
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
            {editingDate ? (
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  style={{ ...S.input, width: "auto", padding: "4px 8px", fontSize: "11px", colorScheme: "dark" }} />
                <button onClick={saveDateEdit} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#c2785c", padding: "2px" }}>✓</button>
                <button onClick={() => setEditingDate(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "rgba(255,255,255,0.3)", padding: "2px" }}>✕</button>
              </div>
            ) : (
              <span onClick={startDateEdit} style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", cursor: "pointer" }} title="Edit date">
                {item.sourceDate ? fmt(item.sourceDate) : <span style={{ fontStyle: "italic", opacity: 0.5 }}>+ date</span>}
              </span>
            )}
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
            <LazyEmbed style={{
              borderRadius: "10px", overflow: "hidden", marginBottom: "4px", background: "#000",
              marginLeft: "-14px", marginRight: "-14px", height: "750px",
            }}>
              <iframe src={item.embedUrl} style={{ width: "100%", height: "100%", border: "none" }}
                scrolling="no" allowFullScreen allow="encrypted-media" />
            </LazyEmbed>
          ) : (
            <LazyEmbed style={{
              borderRadius: "10px", overflow: "hidden", marginBottom: "4px", background: "#000",
              position: "relative", paddingBottom: "56.25%", height: 0,
              marginLeft: "-14px", marginRight: "-14px",
            }}>
              <iframe src={item.embedUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allowFullScreen allow="encrypted-media" />
            </LazyEmbed>
          )
        )}
        {item.type === "embed" && !item.embedUrl && item.url && (
          <UrlPreview url={item.url} />
        )}

        {/* image */}
        {item.type === "image" && item.imageUrl && (
          <div style={{ borderRadius: "10px", overflow: "hidden", marginBottom: "12px", cursor: "zoom-in" }}
            onClick={() => setLightboxSrc(item.imageUrl)}>
            <img src={item.imageUrl} alt="" style={{ width: "100%", display: "block", borderRadius: "10px" }} loading="lazy" />
          </div>
        )}
        {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

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
function AddModal({ onClose, existingUrls }) {
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

  const isDuplicate = mode === "embed" && url.trim() && existingUrls.includes(url.trim());

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

      // Upload image to Firebase Storage (with compression)
      if (mode === "image" && imageFile) {
        const compressed = await compressImage(imageFile);
        const fileName = `evidence/${Date.now()}_${compressed.name}`;
        const sRef = storageRef(storage, fileName);
        await uploadBytes(sRef, compressed);
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
            {isDuplicate && (
              <p style={{ color: "#b08d57", fontSize: "12px", marginTop: "6px" }}>⚠ This URL has already been added.</p>
            )}
          </div>
        )}

        {mode === "image" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={S.label}>Screenshot or image (max 10 MB, auto-compressed)</label>
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
  const [sortAsc, setSortAsc] = useState(true);
  const timelineRef = useRef();

  const sorted = useMemo(() =>
    [...items].filter((i) => i.sourceDate).sort((a, b) =>
      sortAsc ? new Date(a.sourceDate) - new Date(b.sourceDate) : new Date(b.sourceDate) - new Date(a.sourceDate)
    ), [items, sortAsc]);
  const noDate = useMemo(() => items.filter((i) => !i.sourceDate), [items]);

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

  /* count items per month/year for headers */
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

      {/* sort toggle */}
      {sorted.length > 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button onClick={() => setSortAsc(!sortAsc)}
            style={{
              background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
              color: "rgba(255,255,255,0.35)", fontSize: "11px", padding: "5px 10px", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}>
            {sortAsc ? "Oldest first ↑" : "Newest first ↓"}
          </button>
        </div>
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
          const monthKey = `${cur.getFullYear()}-${cur.getMonth()}`;

          /* gap indicator: show "X months" if >60 days between events */
          let gapLabel = null;
          if (prevDate) {
            const diff = Math.abs(cur - prevDate);
            const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
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
                  display: "flex", alignItems: "center", gap: "8px",
                  fontSize: "12px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: ".1em",
                  marginBottom: "14px", marginTop: i > 0 ? "28px" : 0, marginLeft: "-36px", paddingLeft: "36px",
                }}>
                  {cur.toLocaleDateString("en-US", { month: "long" })}
                  <span style={{ fontSize: "10px", opacity: 0.5 }}>{monthCounts[monthKey]} item{monthCounts[monthKey] > 1 ? "s" : ""}</span>
                </div>
              )}
              {/* month header after year divider */}
              {showYear && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  fontSize: "12px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: ".1em",
                  marginBottom: "14px", marginLeft: "0",
                }}>
                  {cur.toLocaleDateString("en-US", { month: "long" })}
                  <span style={{ fontSize: "10px", opacity: 0.5 }}>{monthCounts[monthKey]} item{monthCounts[monthKey] > 1 ? "s" : ""}</span>
                </div>
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
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.15)" }}>{noDate.length}</span>
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [fbError, setFbError] = useState(false);
  const [toast, setToast] = useState(null);
  const undoRef = useRef(null);

  const debouncedSearch = useDebounce(search, 250);

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

  /* toast-based delete with undo */
  const handleDelete = useCallback(async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Store full item data for undo
    const { id: _id, ...data } = item;
    undoRef.current = { id, data };

    try {
      await deleteDoc(doc(db, "evidence", id));
      setToast({
        message: "Evidence removed",
        onUndo: async () => {
          try {
            await addDoc(collection(db, "evidence"), { ...undoRef.current.data, createdAt: serverTimestamp() });
          } catch (err) { console.error("Undo error:", err); }
          setToast(null);
        },
      });
    } catch (err) {
      console.error("Delete error:", err);
    }
  }, [items]);

  /* search + filter (debounced + memoized) */
  const existingUrls = useMemo(() => items.filter((i) => i.url).map((i) => i.url), [items]);

  const filtered = useMemo(() => items.filter((i) => {
    const cats = getCats(i);
    if (filterCat !== "all" && !cats.includes(filterCat)) return false;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      return (i.caption || "").toLowerCase().includes(q)
        || (i.url || "").toLowerCase().includes(q)
        || cats.some((id) => (CAT_MAP[id]?.label || "").toLowerCase().includes(q));
    }
    return true;
  }), [items, filterCat, debouncedSearch]);

  const catCounts = useMemo(() => {
    const counts = {};
    items.forEach((i) => getCats(i).forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
    return counts;
  }, [items]);

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
          {/* collapsible search */}
          {searchOpen ? (
            <div style={{ position: "relative", marginBottom: "10px" }}>
              <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", opacity: 0.3 }}>🔍</span>
              <input
                autoFocus
                style={{ ...S.input, paddingLeft: "38px", paddingRight: "36px" }}
                placeholder="Search evidence…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => { if (!search) setSearchOpen(false); }}
              />
              <button onClick={() => { setSearch(""); setSearchOpen(false); }}
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "16px", padding: "4px" }}>
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
              <button onClick={() => setSearchOpen(true)}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", color: "rgba(255,255,255,0.3)", fontSize: "13px", padding: "5px 10px", cursor: "pointer" }}>
                🔍 Search
              </button>
            </div>
          )}
          {/* category filter chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setFilterCat("all")}
              style={{
                fontSize: "12px", padding: "5px 10px", borderRadius: "20px", cursor: "pointer", transition: "all .2s",
                background: filterCat === "all" ? "rgba(194,120,92,0.2)" : "rgba(255,255,255,0.05)",
                color: filterCat === "all" ? "#c2785c" : "rgba(255,255,255,0.4)",
                border: `1px solid ${filterCat === "all" ? "rgba(194,120,92,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}>All ({items.length})</button>
            {CATEGORIES.map((c) => {
              const count = catCounts[c.id] || 0;
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

      {/* toast */}
      {toast && <Toast message={toast.message} onUndo={toast.onUndo} onDismiss={() => setToast(null)} />}

      {/* mobile FAB */}
      <button onClick={() => setShowAdd(true)} style={{
        position: "fixed", bottom: "24px", right: "24px", zIndex: 80,
        width: "56px", height: "56px", borderRadius: "50%", fontSize: "24px",
        background: "rgba(194,120,92,0.9)", color: "#fff", border: "none",
        cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>+</button>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} existingUrls={existingUrls} />}
    </div>
  );
}
