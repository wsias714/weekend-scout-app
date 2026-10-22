import test from "node:test";
import assert from "node:assert/strict";
import { hint, parse, sky, brief } from "./weather.ts";

test("parse maps a daily block to dated days and skips null days", () => {
  const f = parse({ daily: { time: ["2026-10-24", "2026-10-25"], weather_code: [0, 61], temperature_2m_max: [75.6, null as unknown as number],
    temperature_2m_min: [58.2, 55], precipitation_probability_max: [5, 70] } });
  assert.deepEqual(f, { "2026-10-24": { code: 0, hi: 76, lo: 58, rain: 5 } });
});

test("parse tolerates garbage", () => {
  assert.deepEqual(parse({}), {});
});

test("hint prefers rain, then heat, then cold", () => {
  assert.match(hint({ code: 61, hi: 95, lo: 70, rain: 60 }), /Rain likely/);
  assert.match(hint({ code: 0, hi: 95, lo: 70, rain: 0 }), /Hot/);
  assert.match(hint({ code: 3, hi: 50, lo: 40, rain: 0 }), /layers/);
  assert.equal(hint({ code: 0, hi: 72, lo: 58, rain: 0 }), "");
});

test("sky and brief render", () => {
  assert.equal(sky(95).label, "Thunderstorms");
  assert.equal(brief({ code: 0, hi: 72, lo: 58, rain: 40 }), "☀️ 72°/58° · 40% rain");
});
