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
  audience: "family" | "date_night";
  why: string;
}

export type SectionKey =
  | "did_you_go" | "this_weekend" | "next_2_weeks" | "weeks_3_4"
  | "homeschool_day_trips" | "date_night" | "plan_ahead";

export interface Feed {
  generated: string;
  today: string;
  sections: Record<SectionKey, ScoutEvent[]>;
  decisions: Record<string, { decision: Decision; homeschool: boolean; attended: string | null }>;
}

export type Decision = "go" | "maybe" | "pass" | "bookmarked";

/** One thing the phone tells the laptop. Files under inbox/ are write-once. */
export type InboxItem =
  | { type: "decision"; event_id: string; decision: Decision; homeschool: boolean; at: string }
  | { type: "attended"; event_id: string; value: "yes" | "no"; at: string };
