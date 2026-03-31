import styles from "../styles/NsfwGate.module.css";

export default function NsfwGate({ onReveal }) {
  return (
    <div className={styles.overlay} role="alert">
      <span className={styles.icon} aria-hidden="true">&#x26A0;&#xFE0F;</span>
      <p className={styles.text}>This content has been marked sensitive.</p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onReveal();
        }}
        className={styles.revealBtn}
        aria-label="Reveal sensitive content"
      >
        Show content
      </button>
    </div>
  );
}
