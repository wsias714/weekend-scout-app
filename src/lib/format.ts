const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat Oct 17 · 2:00 PM" from a local ISO string (no timezone math: the feed is already Pacific). */
export function when(start: string): string {
  const d = new Date(start.length <= 10 ? `${start}T00:00` : start);
  if (Number.isNaN(d.getTime())) return start;
  const day = `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (start.length <= 10) return day;
  const h = d.getHours(), m = d.getMinutes();
  const t = `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
  return `${day} · ${t}`;
}

export const isWeekend = (start: string) => {
  const d = new Date(start.length <= 10 ? `${start}T00:00` : start).getDay();
  return d === 0 || d === 6;
};
