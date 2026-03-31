import { useState } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase.js";
import { CAT_MAP, getCats } from "../utils/categories.js";
import { fmt } from "../utils/helpers.js";
import CategoryPicker from "./CategoryPicker.jsx";
import LazyEmbed from "./LazyEmbed.jsx";
import NsfwGate from "./NsfwGate.jsx";
import Lightbox from "./Lightbox.jsx";
import UrlPreview from "./UrlPreview.jsx";
import styles from "../styles/EvidenceCard.module.css";

export default function EvidenceCard({ item, onDelete }) {
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

  const startEdit = () => {
    setEditCats(cats);
    setEditing(true);
  };
  const saveEdit = async () => {
    try {
      await updateDoc(doc(db, "evidence", item.id), {
        categories: editCats,
        category: editCats[0],
      });
      setEditing(false);
    } catch (err) {
      console.error("Update error:", err);
    }
  };
  const startCaptionEdit = () => {
    setEditCaption(item.caption || "");
    setEditingCaption(true);
  };
  const saveCaptionEdit = async () => {
    try {
      await updateDoc(doc(db, "evidence", item.id), {
        caption: editCaption.trim(),
      });
      setEditingCaption(false);
    } catch (err) {
      console.error("Update error:", err);
    }
  };
  const startDateEdit = () => {
    setEditDate(item.sourceDate || "");
    setEditingDate(true);
  };
  const saveDateEdit = async () => {
    try {
      await updateDoc(doc(db, "evidence", item.id), {
        sourceDate: editDate || null,
      });
      setEditingDate(false);
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  return (
    <div className={styles.card}>
      {gated && <NsfwGate onReveal={() => setRevealed(true)} />}
      <div className={gated ? styles.innerBlurred : styles.inner}>
        {/* header */}
        <div className={styles.header}>
          <div className={styles.badges}>
            {cats.map((id) => {
              const c = CAT_MAP[id] || CAT_MAP.other;
              return (
                <span
                  key={id}
                  title={c.label}
                  className={styles.badge}
                  style={{
                    background: `${c.color}18`,
                    border: `1px solid ${c.color}33`,
                  }}
                >
                  {c.icon}
                </span>
              );
            })}
            <button
              onClick={startEdit}
              className={styles.editCatBtn}
              title="Edit categories"
              aria-label="Edit categories"
            >
              &#x270E;
            </button>
          </div>
          <div className={styles.headerRight}>
            {editingDate ? (
              <div className={styles.dateEditRow}>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={styles.dateInput}
                  aria-label="Source date"
                />
                <button
                  onClick={saveDateEdit}
                  className={styles.confirmBtn}
                  aria-label="Save date"
                >
                  &#x2713;
                </button>
                <button
                  onClick={() => setEditingDate(false)}
                  className={styles.cancelBtnSmall}
                  aria-label="Cancel date edit"
                >
                  &#x2715;
                </button>
              </div>
            ) : (
              <span
                onClick={startDateEdit}
                className={styles.dateLabel}
                title="Edit date"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && startDateEdit()}
                aria-label={item.sourceDate ? `Date: ${fmt(item.sourceDate)}, click to edit` : "Add date"}
              >
                {item.sourceDate ? (
                  fmt(item.sourceDate)
                ) : (
                  <span className={styles.datePlaceholder}>+ date</span>
                )}
              </span>
            )}
            <button
              onClick={() => onDelete(item.id)}
              className={styles.deleteBtn}
              title="Delete"
              aria-label="Delete evidence"
            >
              &#x2715;
            </button>
          </div>
        </div>

        {editing && (
          <div className={styles.editPanel}>
            <CategoryPicker selected={editCats} onChange={setEditCats} />
            <div className={styles.editActions}>
              <button onClick={() => setEditing(false)} className={styles.btn}>
                Cancel
              </button>
              <button onClick={saveEdit} className={styles.btnAccent}>
                Save
              </button>
            </div>
          </div>
        )}

        {/* embed */}
        {item.type === "embed" && item.embedUrl && (
          item.embedPlatform === "tiktok" ? (
            <LazyEmbed className={styles.embedTiktok}>
              <iframe
                src={item.embedUrl}
                className={styles.iframeFill}
                scrolling="no"
                allowFullScreen
                allow="encrypted-media"
                title="TikTok embed"
              />
            </LazyEmbed>
          ) : (
            <LazyEmbed className={styles.embedStandard}>
              <iframe
                src={item.embedUrl}
                className={styles.iframeAbsolute}
                allowFullScreen
                allow="encrypted-media"
                title="Embedded content"
              />
            </LazyEmbed>
          )
        )}
        {item.type === "embed" && !item.embedUrl && item.url && (
          <UrlPreview url={item.url} />
        )}

        {/* image */}
        {item.type === "image" && item.imageUrl && (
          <div
            className={styles.imageWrap}
            onClick={() => setLightboxSrc(item.imageUrl)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setLightboxSrc(item.imageUrl)}
            aria-label="View full size image"
          >
            <img
              src={item.imageUrl}
              alt={item.caption || "Evidence image"}
              className={styles.image}
              loading="lazy"
            />
          </div>
        )}
        {lightboxSrc && (
          <Lightbox
            src={lightboxSrc}
            alt={item.caption || "Evidence image"}
            onClose={() => setLightboxSrc(null)}
          />
        )}

        {/* caption */}
        {editingCaption ? (
          <div className={styles.captionEdit}>
            <textarea
              value={editCaption}
              onChange={(e) => setEditCaption(e.target.value)}
              rows={3}
              className={styles.textarea}
              aria-label="Edit caption"
            />
            <div className={styles.captionActions}>
              <button
                onClick={() => setEditingCaption(false)}
                className={styles.btn}
              >
                Cancel
              </button>
              <button onClick={saveCaptionEdit} className={styles.btnAccent}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <p
            onClick={startCaptionEdit}
            className={styles.caption}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && startCaptionEdit()}
            aria-label={item.caption ? "Edit caption" : "Add a caption"}
          >
            {item.caption || (
              <span className={styles.captionPlaceholder}>
                Add a caption&hellip;
              </span>
            )}
          </p>
        )}

        {/* footer */}
        <div className={styles.footer}>
          <span>Added {item.createdAt ? fmt(item.createdAt) : "just now"}</span>
          <div className={styles.footerRight}>
            {item.usernames && (
              <span className={styles.usernames}>{item.usernames}</span>
            )}
            {item.nsfw && <span className={styles.nsfwLabel}>NSFW</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
