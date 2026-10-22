import test from "node:test";
import assert from "node:assert/strict";
import { localToday, upcoming, when } from "./format.ts";

test("localToday is the Pacific calendar date whatever the phone's zone", () => {
  assert.equal(localToday(new Date("2026-01-06T06:30:00Z")), "2026-01-05"); // 22:30 PST on the 5th
  assert.equal(localToday(new Date("2026-10-25T06:59:00Z")), "2026-10-24"); // 23:59 PDT on the 24th
});

test("an all-day event with iCal's exclusive end is not shown the day after", () => {
  assert.equal(upcoming({ start: "2026-10-24", end: "2026-10-25" }, "2026-10-25"), false);
  assert.equal(upcoming({ start: "2026-10-31T00:00:00", end: "2026-11-01T00:00:00" }, "2026-11-01"), false);
  assert.equal(upcoming({ start: "2026-10-24", end: "2026-10-26" }, "2026-10-25"), true);
});

test("upcoming keeps today, drops yesterday, keeps a multi-day event still running", () => {
  assert.equal(upcoming({ start: "2026-10-25T10:00" }, "2026-10-25"), true);
  assert.equal(upcoming({ start: "2026-10-24T10:00" }, "2026-10-25"), false);
  assert.equal(upcoming({ start: "2026-10-24T09:00", end: "2026-10-27T10:00" }, "2026-10-26"), true);
  assert.equal(upcoming({ start: "2026-10-24T09:00", end: "2026-10-24T11:00" }, "2026-10-25"), false);
});

test("a bare date is shown as that day, Sunday included", () => {
  assert.equal(when("2026-10-25"), "Sun Oct 25");
});
