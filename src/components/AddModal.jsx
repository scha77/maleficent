import { useState, useRef, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "../firebase.js";
import { extractEmbed } from "../utils/helpers.js";
import { compressImage } from "../utils/compressImage.js";
import { checkRateLimit } from "../utils/rateLimit.js";
import CategoryPicker from "./CategoryPicker.jsx";
import styles from "../styles/AddModal.module.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(month, year) {
  if (!month || !year) return 31;
  return new Date(year, month, 0).getDate();
}

function buildSourceDate(y, m, d) {
  if (!y || !m || !d) return "";
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseSourceDate(dateStr) {
  if (!dateStr) return { y: "", m: "", d: "" };
  const [y, m, d] = dateStr.split("-");
  return { y, m: String(Number(m)), d: String(Number(d)) };
}

export default function AddModal({ onClose, existingUrls }) {
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
  const modalRef = useRef();

  const isDuplicate =
    mode === "embed" && url.trim() && existingUrls.includes(url.trim());

  // Focus trap & Escape to close
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    modalRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("File must be under 10 MB");
      return;
    }
    setError("");
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(f);
  };

  const handleSave = async () => {
    if (mode === "embed" && !url.trim()) {
      setError("Paste a link");
      return;
    }
    if (mode === "image" && !imageFile) {
      setError("Upload an image");
      return;
    }

    if (!checkRateLimit()) {
      setError("You're adding too fast. Please wait a moment.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      let imageUrl = null;

      if (mode === "image" && imageFile) {
        const compressed = await compressImage(imageFile);
        const fileName = `evidence/${Date.now()}_${compressed.name}`;
        const sRef = storageRef(storage, fileName);
        await uploadBytes(sRef, compressed);
        imageUrl = await getDownloadURL(sRef);
      }

      const embed = mode === "embed" ? extractEmbed(url.trim()) : null;

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
    <div
      onClick={onClose}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Add evidence"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={styles.modal}
        ref={modalRef}
        tabIndex={-1}
      >
        <h2 className={styles.title}>Add Evidence</h2>

        {/* mode toggle */}
        <div className={styles.modeToggle} role="tablist" aria-label="Evidence type">
          {[
            ["embed", "\u{1F517} Embed Link"],
            ["image", "\u{1F5BC} Upload Image"],
          ].map(([m, lbl]) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? styles.modeBtnActive : styles.modeBtn}
            >
              {lbl}
            </button>
          ))}
        </div>

        {mode === "embed" && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="evidence-url">
              Link (Instagram, TikTok, YouTube, X / Twitter)
            </label>
            <input
              id="evidence-url"
              className={styles.input}
              placeholder="https://www.instagram.com/reel/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
            />
            {isDuplicate && (
              <p className={styles.dupeWarning} role="alert">
                &#x26A0; This URL has already been added.
              </p>
            )}
          </div>
        )}

        {mode === "image" && (
          <div className={styles.field}>
            <label className={styles.label}>
              Screenshot or image (max 10 MB, auto-compressed)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className={styles.fileInput}
              aria-label="Choose image file"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className={styles.fileBtn}
            >
              {imageFile ? `\u2713 ${imageFile.name}` : "Tap to choose file"}
            </button>
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Upload preview"
                className={styles.filePreview}
              />
            )}
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label}>Categories (select one or more)</label>
          <CategoryPicker selected={categories} onChange={setCategories} />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Source date (when did this originally happen?)
          </label>
          {(() => {
            const parsed = parseSourceDate(sourceDate);
            const currentYear = new Date().getFullYear();
            const maxDay = daysInMonth(
              Number(parsed.m) || 1,
              Number(parsed.y) || currentYear
            );
            const updateDate = (y, m, d) => {
              const clamped = Math.min(Number(d) || 0, daysInMonth(Number(m) || 1, Number(y) || currentYear));
              setSourceDate(buildSourceDate(y, m, clamped || d));
            };
            return (
              <div className={styles.dateSelects}>
                <select
                  value={parsed.m}
                  onChange={(e) => updateDate(parsed.y, e.target.value, parsed.d)}
                  className={styles.dateSelect}
                  aria-label="Month"
                >
                  <option value="">Month</option>
                  {MONTHS.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select
                  value={parsed.d}
                  onChange={(e) => updateDate(parsed.y, parsed.m, e.target.value)}
                  className={styles.dateSelect}
                  aria-label="Day"
                >
                  <option value="">Day</option>
                  {Array.from({ length: maxDay }, (_, i) => (
                    <option key={i} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
                <select
                  value={parsed.y}
                  onChange={(e) => updateDate(e.target.value, parsed.m, parsed.d)}
                  className={styles.dateSelect}
                  aria-label="Year"
                >
                  <option value="">Year</option>
                  {Array.from({ length: 10 }, (_, i) => {
                    const yr = currentYear - i;
                    return <option key={yr} value={yr}>{yr}</option>;
                  })}
                </select>
              </div>
            );
          })()}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="evidence-caption">
            Caption (optional)
          </label>
          <textarea
            id="evidence-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="Add context, explain what this shows&hellip;"
            className={styles.textarea}
          />
        </div>

        <label className={styles.nsfwLabel}>
          <input
            type="checkbox"
            checked={nsfw}
            onChange={(e) => setNsfw(e.target.checked)}
            className={styles.nsfwCheckbox}
          />
          Mark as NSFW / sensitive content
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button onClick={onClose} className={styles.cancelBtn} disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? "Uploading\u2026" : "Add evidence"}
          </button>
        </div>
      </div>
    </div>
  );
}
