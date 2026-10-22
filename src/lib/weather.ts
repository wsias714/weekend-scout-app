/** Daily forecast from Open-Meteo (free, no key, CORS-enabled). Pacific dates, Fahrenheit, home = Lake Forest. */
export interface Day { code: number; hi: number; lo: number; rain: number }
export type Forecast = Record<string, Day>; // "YYYY-MM-DD" -> day

const URL = "https://api.open-meteo.com/v1/forecast?latitude=33.6469&longitude=-117.6892"
  + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
  + "&temperature_unit=fahrenheit&timezone=America%2FLos_Angeles&forecast_days=16";
const KEY = "ws-weather";
const FRESH_MS = 3 * 3600e3;

interface Raw {
  daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[] };
}

export function parse(raw: Raw): Forecast {
  const d = raw.daily;
  const out: Forecast = {};
  if (!d?.time) return out;
  d.time.forEach((t, i) => {
    if (d.temperature_2m_max?.[i] == null) return;
    out[t] = { code: d.weather_code[i], hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]), rain: d.precipitation_probability_max?.[i] ?? 0 };
  });
  return out;
}

/** WMO weather code -> icon + words. */
export function sky(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "Sunny" };
  if (code <= 2) return { icon: "🌤️", label: "Mostly sunny" };
  if (code === 3) return { icon: "☁️", label: "Cloudy" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Fog" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", label: "Drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "🌧️", label: "Rain" };
  if (code >= 71 && code <= 77) return { icon: "🌨️", label: "Snow" };
  if (code >= 95) return { icon: "⛈️", label: "Thunderstorms" };
  return { icon: "☁️", label: "Cloudy" };
}

/** Plain planning hint, or "" when the day is unremarkable. */
export function hint(d: Day): string {
  if (d.rain >= 50) return "Rain likely: pick indoor";
  if (d.rain >= 30) return "Chance of rain";
  if (d.hi >= 90) return "Hot: go early, bring water";
  if (d.hi <= 55) return "Chilly: bring layers";
  return "";
}

export const brief = (d: Day) => `${sky(d.code).icon} ${d.hi}°/${d.lo}°${d.rain >= 30 ? ` · ${d.rain}% rain` : ""}`;

export function cached(): { at: number; data: Forecast } | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.at === "number" && v.data ? v : null;
  } catch {
    return null;
  }
}

/** Last good forecast immediately, refreshed from the network when older than a few hours. Never throws. */
export async function load(fetcher: typeof fetch = fetch, now = Date.now()): Promise<Forecast> {
  const c = cached();
  if (c && now - c.at < FRESH_MS) return c.data;
  try {
    const res = await fetcher(URL);
    if (!res.ok) throw new Error(String(res.status));
    const data = parse((await res.json()) as Raw);
    if (Object.keys(data).length) {
      try { localStorage.setItem(KEY, JSON.stringify({ at: now, data })); } catch { /* private mode */ }
      return data;
    }
  } catch {
    /* offline or blocked: fall through to the last good copy */
  }
  return c?.data ?? {};
}
