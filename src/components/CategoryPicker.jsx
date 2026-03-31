import { CATEGORIES } from "../utils/categories.js";
import styles from "../styles/CategoryPicker.module.css";

export default function CategoryPicker({ selected, onChange }) {
  const toggle = (id) => {
    if (selected.includes(id)) {
      if (selected.length > 1) onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className={styles.wrapper} role="group" aria-label="Category selection">
      {CATEGORIES.map((c) => {
        const active = selected.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => toggle(c.id)}
            type="button"
            aria-pressed={active}
            className={styles.chip}
            style={{
              background: active ? `${c.color}25` : undefined,
              color: active ? c.color : undefined,
              borderColor: active ? `${c.color}44` : undefined,
            }}
          >
            {c.icon} {c.label}
          </button>
        );
      })}
    </div>
  );
}
