/** Compact relative time, e.g. "just now", "2 min ago", "3 hours ago". */
export function relativeTime(
  input: string | number | Date | null | undefined,
): string {
  if (!input) return "never";
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString();
}
