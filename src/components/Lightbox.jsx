import { useEffect, useCallback } from "react";
import styles from "../styles/Lightbox.module.css";

export default function Lightbox({ src, alt, onClose }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <img src={src} alt={alt || "Full size preview"} className={styles.image} />
    </div>
  );
}
