import { describe, it, expect } from "vitest";
import { CATEGORIES, CAT_MAP, getCats } from "../utils/categories.js";

describe("CATEGORIES", () => {
  it("has 6 categories", () => {
    expect(CATEGORIES).toHaveLength(6);
  });

  it("each category has required fields", () => {
    CATEGORIES.forEach((c) => {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("icon");
      expect(c).toHaveProperty("color");
    });
  });
});

describe("CAT_MAP", () => {
  it("maps category IDs to category objects", () => {
    expect(CAT_MAP.lies.label).toBe("Lies & Deception");
    expect(CAT_MAP.money.color).toBe("#6a8e6f");
  });
});

describe("getCats", () => {
  it("returns categories array if present", () => {
    expect(getCats({ categories: ["lies", "money"] })).toEqual([
      "lies",
      "money",
    ]);
  });

  it("wraps single category in array", () => {
    expect(getCats({ category: "manipulation" })).toEqual(["manipulation"]);
  });

  it("defaults to other", () => {
    expect(getCats({})).toEqual(["other"]);
  });
});
