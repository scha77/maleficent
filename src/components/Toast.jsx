import { useEffect } from "react";
import styles from "../styles/Toast.module.css";

export default function Toast({ message, onUndo, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.message}>{message}</span>
      {onUndo && (
        <button onClick={onUndo} className={styles.undoBtn} aria-label="Undo delete">
          Undo
        </button>
      )}
    </div>
  );
}
