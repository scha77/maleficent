export const fmt = (d) => {
  if (!d) return "";
  const dt =
    typeof d === "string" ? new Date(d) : d.toDate ? d.toDate() : new Date(d);
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const extractEmbed = (url) => {
  if (!url) return null;
  try {
    if (url.includes("instagram.com")) {
      const m = url.match(/instagram\.com\/(?:p|reel|reels)\/([^/?#]+)/);
      if (m)
        return {
          platform: "instagram",
          id: m[1],
          embedUrl: `https://www.instagram.com/p/${m[1]}/embed`,
        };
    }
    if (url.includes("tiktok.com")) {
      const m = url.match(/video\/(\d+)/);
      if (m)
        return {
          platform: "tiktok",
          id: m[1],
          embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`,
        };
    }
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      let vid = null;
      if (url.includes("youtu.be/"))
        vid = url.split("youtu.be/")[1]?.split(/[?#]/)[0];
      else {
        const u = new URL(url);
        vid = u.searchParams.get("v");
      }
      if (vid)
        return {
          platform: "youtube",
          id: vid,
          embedUrl: `https://www.youtube.com/embed/${vid}`,
        };
    }
    if (url.includes("twitter.com") || url.includes("x.com")) {
      return { platform: "twitter", id: url, embedUrl: null, raw: url };
    }
  } catch {
    // invalid URL
  }
  return null;
};
