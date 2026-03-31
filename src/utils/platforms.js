export const PLATFORMS = [
  { id: "ig", label: "Instagram", short: "IG", color: "#E1306C", url: (u) => `https://instagram.com/${u}` },
  { id: "fb", label: "Facebook", short: "FB", color: "#1877F2", url: (u) => `https://facebook.com/${u}` },
  { id: "tiktok", label: "TikTok", short: "TT", color: "#00f2ea", url: (u) => `https://tiktok.com/@${u}` },
  { id: "reddit", label: "Reddit", short: "R", color: "#FF4500", url: (u) => `https://reddit.com/u/${u}` },
  { id: "x", label: "X", short: "X", color: "#9aa0a6", url: (u) => `https://x.com/${u}` },
  { id: "onlyfans", label: "OnlyFans", short: "OF", color: "#00AFF0", url: (u) => `https://onlyfans.com/${u}` },
];

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

/** Strip leading @ from a username for use in URLs */
export function cleanHandle(username) {
  return username.replace(/^@/, "");
}
