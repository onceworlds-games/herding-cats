// The room options and the join itself come from public/join.js, a tiny script that runs as the page loads (before the
// big game script is parsed), so a reloaded page gets its seat back at once.

export const JOIN = window.__hcJOIN ?? null;

const q = new URLSearchParams(location.search);
const skip = q.has('poster') || (q.has('autoplay') && !/onceworlds\.com$/.test(location.hostname));

/** The join, started once (here only if the early script didn't). */
export function joining() {
  if (!window.__hcJoin) {
    const ow = window.onceworlds;
    window.__hcJoin = !skip && ow?.rooms && JOIN
      ? Promise.resolve().then(() => ow.rooms.join(JOIN)).catch(() => null)
      : Promise.resolve(null);
  }
  return window.__hcJoin;
}
