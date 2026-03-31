import { describe, it, expect } from "vitest";
import { fmt, extractEmbed } from "../utils/helpers.js";

describe("fmt", () => {
  it("returns empty string for falsy input", () => {
    expect(fmt(null)).toBe("");
    expect(fmt(undefined)).toBe("");
    expect(fmt("")).toBe("");
  });

  it("formats a date string", () => {
    const result = fmt("2024-03-15T12:00:00");
    expect(result).toContain("Mar");
    expect(result).toContain("15");
    expect(result).toContain("2024");
  });

  it("formats a Firestore-like timestamp object", () => {
    const ts = { toDate: () => new Date(2024, 5, 1) };
    const result = fmt(ts);
    expect(result).toContain("Jun");
    expect(result).toContain("2024");
  });
});

describe("extractEmbed", () => {
  it("returns null for falsy input", () => {
    expect(extractEmbed(null)).toBeNull();
    expect(extractEmbed("")).toBeNull();
  });

  it("extracts Instagram post embed", () => {
    const result = extractEmbed("https://www.instagram.com/p/ABC123/");
    expect(result).toEqual({
      platform: "instagram",
      id: "ABC123",
      embedUrl: "https://www.instagram.com/p/ABC123/embed",
    });
  });

  it("extracts Instagram reel embed", () => {
    const result = extractEmbed("https://www.instagram.com/reel/XYZ789/");
    expect(result).toEqual({
      platform: "instagram",
      id: "XYZ789",
      embedUrl: "https://www.instagram.com/p/XYZ789/embed",
    });
  });

  it("extracts TikTok embed", () => {
    const result = extractEmbed(
      "https://www.tiktok.com/@user/video/1234567890"
    );
    expect(result).toEqual({
      platform: "tiktok",
      id: "1234567890",
      embedUrl: "https://www.tiktok.com/embed/v2/1234567890",
    });
  });

  it("extracts YouTube embed from full URL", () => {
    const result = extractEmbed(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
    expect(result).toEqual({
      platform: "youtube",
      id: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("extracts YouTube embed from short URL", () => {
    const result = extractEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toEqual({
      platform: "youtube",
      id: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    });
  });

  it("detects Twitter/X links", () => {
    const result = extractEmbed(
      "https://x.com/user/status/123456"
    );
    expect(result.platform).toBe("twitter");
    expect(result.embedUrl).toBeNull();
    expect(result.raw).toBe("https://x.com/user/status/123456");
  });

  it("returns null for unknown URLs", () => {
    const result = extractEmbed("https://example.com/page");
    expect(result).toBeNull();
  });
});
