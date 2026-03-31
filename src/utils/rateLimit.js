const timestamps = [];
const MAX_ACTIONS = 5;
const WINDOW_MS = 60_000;

export function checkRateLimit() {
  const now = Date.now();
  while (timestamps.length > 0 && now - timestamps[0] > WINDOW_MS) {
    timestamps.shift();
  }
  if (timestamps.length >= MAX_ACTIONS) {
    return false;
  }
  timestamps.push(now);
  return true;
}
