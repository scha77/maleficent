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
import { PLATFORMS } from "../utils/platforms.js";
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

export default function AddModal({ onClose, existingUrls, existingUsernames }) {
  const [mode, setMode] = useState("embed");
  const [url, setUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [categories, setCategories] = useState(["lies"]);
  const [nsfw, setNsfw] = useState(false);
  const [dateY, setDateY] = useState("");
  const [dateM, setDateM] = useState("");
  const [dateD, setDateD] = useState("");
  const [username, setUsername] = useState("@");
  const [platforms, setPlatforms] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const modalRef = useRef();

  const isDuplicate =
    mode === "embed" && url.trim() && existingUrls.includes(url.trim());

  const isUsernameDuplicate =
    mode === "username" &&
    username.trim().length > 1 &&
    existingUsernames.includes(username.trim().toLowerCase());

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
    if (mode === "username" && username.trim().length <= 1) {
      setError("Enter a username");
      return;
    }
    if (mode === "username" && platforms.length === 0) {
      setError("Select at least one platform");
      return;
    }
    if (mode === "username" && isUsernameDuplicate) {
      setError("This username has already been added.");
      return;
    }

    if (!checkRateLimit()) {
      setError("You're adding too fast. Please wait a moment.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (mode === "username") {
        await addDoc(collection(db, "evidence"), {
          type: "username",
          usernames: username.trim(),
          platforms,
          categories: ["other"],
          category: "other",
          nsfw: false,
          caption: "",
          sourceDate: null,
          createdAt: serverTimestamp(),
        });
        onClose();
        setSaving(false);
        return;
      }

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
        sourceDate: buildSourceDate(dateY, dateM, dateD) || null,
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
            ["username", "\u{1F464} Add Username"],
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

        {mode === "username" && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="evidence-username">
                Username
              </label>
              <input
                id="evidence-username"
                autoFocus
                value={username}
                onChange={(e) => {
                  const val = e.target.value;
                  setUsername(val.startsWith("@") ? val : "@" + val);
                  setError("");
                }}
                placeholder="@username"
                className={styles.input}
              />
              {isUsernameDuplicate && (
                <p className={styles.dupeWarningRed} role="alert">
                  This username has already been added.
                </p>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Platforms</label>
              <div className={styles.platformPicker}>
                {PLATFORMS.map((p) => {
                  const active = platforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPlatforms((prev) =>
                          active ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        );
                        setError("");
                      }}
                      className={styles.platformChip}
                      style={
                        active
                          ? { background: `${p.color}20`, color: p.color, borderColor: `${p.color}44` }
                          : undefined
                      }
                      aria-pressed={active}
                    >
                      {p.short}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {mode !== "username" && (
          <>
            <div className={styles.field}>
              <label className={styles.label}>Categories (select one or more)</label>
              <CategoryPicker selected={categories} onChange={setCategories} />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>
                Source date (when did this originally happen?)
              </label>
              {(() => {
                const currentYear = new Date().getFullYear();
                const maxDay = daysInMonth(
                  Number(dateM) || 1,
                  Number(dateY) || currentYear
                );
                return (
                  <div className={styles.dateSelects}>
                    <select
                      value={dateM}
                      onChange={(e) => {
                        setDateM(e.target.value);
                        const max = daysInMonth(Number(e.target.value) || 1, Number(dateY) || currentYear);
                        if (Number(dateD) > max) setDateD(String(max));
                      }}
                      className={styles.dateSelect}
                      aria-label="Month"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((name, i) => (
                        <option key={i} value={i + 1}>{name}</option>
                      ))}
                    </select>
                    <select
                      value={dateD}
                      onChange={(e) => setDateD(e.target.value)}
                      className={styles.dateSelect}
                      aria-label="Day"
                    >
                      <option value="">Day</option>
                      {Array.from({ length: maxDay }, (_, i) => (
                        <option key={i} value={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                    <select
                      value={dateY}
                      onChange={(e) => {
                        setDateY(e.target.value);
                        const max = daysInMonth(Number(dateM) || 1, Number(e.target.value) || currentYear);
                        if (Number(dateD) > max) setDateD(String(max));
                      }}
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
          </>
        )}

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
            {saving ? "Saving\u2026" : mode === "username" ? "Add username" : "Add evidence"}
          </button>
        </div>
      </div>
    </div>
  );
}
