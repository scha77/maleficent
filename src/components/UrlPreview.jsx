import styles from "../styles/UrlPreview.module.css";

export default function UrlPreview({ url }) {
  const domain = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  })();
  const isTwitter = domain.includes("x.com") || domain.includes("twitter.com");

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={styles.link}
      aria-label={`Open link to ${domain}`}
    >
      <div className={isTwitter ? styles.iconTwitter : styles.icon}>
        {isTwitter ? "\u{1D54F}" : "\u{1F517}"}
      </div>
      <div className={styles.content}>
        <div className={styles.domain}>
          {isTwitter ? "View on X / Twitter" : domain}
        </div>
        <div className={styles.url}>{url}</div>
      </div>
      <span className={styles.arrow} aria-hidden="true">&rarr;</span>
    </a>
  );
}
