import test from "node:test";
import assert from "node:assert/strict";
import { describeError, isAuthError } from "./dbxerr.ts";

test("a 401 or a refused refresh is an auth error; a network failure is not", () => {
  assert.equal(isAuthError({ status: 401, error: { error_summary: "expired_access_token/" } }), true);
  assert.equal(isAuthError(new Error("Response failed with a 401 code")), true);
  assert.equal(isAuthError({ status: 400, error: { error: "invalid_grant" } }), true);
  assert.equal(isAuthError(new TypeError("Failed to fetch")), false);
  assert.equal(isAuthError({ status: 409, error: { error_summary: "path/not_found/" } }), false);
});

test("describeError is short and readable", () => {
  assert.match(describeError({ status: 429, error: { error_summary: "too_many_requests/" } }), /HTTP 429: too_many_requests/);
});
