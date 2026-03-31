export const CATEGORIES = [
  { id: "lies", label: "Lies & Deception", icon: "\u{1F3AD}", color: "#c2785c" },
  { id: "manipulation", label: "Manipulation", icon: "\u{1F578}\uFE0F", color: "#8b6f8e" },
  { id: "money", label: "Money & Finances", icon: "\u{1F4B8}", color: "#6a8e6f" },
  { id: "character", label: "Character & Behavior", icon: "\u{1F6A9}", color: "#b08d57" },
  { id: "relationships", label: "Relationships & Trust", icon: "\u{1F494}", color: "#7a8fa6" },
  { id: "other", label: "Other", icon: "\u{1F4CC}", color: "#888" },
];

export const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const getCats = (item) => item.categories || [item.category || "other"];
