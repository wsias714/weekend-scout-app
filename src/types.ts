export interface ScoutEvent {
  id: string;
  title: string;
  start: string; // local PT ISO, "YYYY-MM-DDTHH:MM" or a bare date
  end?: string | null;
  all_day?: number;
  venue: string;
  city: string;
  cost: string;
  age_fit: string;
  registration: string;
  category: string;
  homeschool_subjects: string[];
  homeschool_hook: string;
  physical_activity: string;
  score: number;
  source_url: string;
  link?: string;
  link_kind?: "event" | "site" | "";
  audience: "family" | "date_night";
  why: string;
  summary?: string;
  drive_min?: number | null;
}

export interface EvergreenItem {
  id: string; name: string; city: string; kind: string; member: boolean; note: string; url: string;
  upcoming?: { title: string; start: string; link: string }[];
}

export type SectionKey =
  | "did_you_go" | "this_weekend" | "next_2_weeks" | "weeks_3_4"
  | "homeschool_day_trips" | "date_night" | "plan_ahead" | "evergreen" | "sources";

export interface Feed {
  generated: string;
  today: string;
  sections: Record<Exclude<SectionKey, "evergreen" | "sources">, ScoutEvent[]> & { evergreen?: EvergreenItem[] };
  sources?: SourceInfo[];
  suggestions?: Suggestion[];
  decisions: Record<string, { decision: Decision; homeschool: boolean; attended: string | null }>;
}

export type Decision = "go" | "maybe" | "pass" | "bookmarked";

/** One thing the phone tells the laptop. Files under inbox/ are write-once. */
export type InboxItem =
  | { type: "decision"; event_id: string; decision: Decision; homeschool: boolean; at: string }
  | { type: "source"; url: string; note: string; at: string }
  | { type: "attended"; event_id: string; value: "yes" | "no"; at: string };

export interface SourceInfo {
  key: string; label: string; kind: "feed" | "page" | "mail"; enabled: boolean; stage: number;
  events: number; url: string; note: string; user: boolean;
}
export interface Suggestion { id: number; url: string; note: string; at: string; status: string; result: string }
