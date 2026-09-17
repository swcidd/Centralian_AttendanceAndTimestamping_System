import { describe, it, expect } from "vitest";
import { Ok, Err, type Result } from "./result";

describe("Ok", () => {
  it("builds a success Result tagged ok: true", () => {
    const result = Ok("value");
    expect(result.ok).toBe(true);
    expect(result).toEqual({ ok: true, value: "value" });
  });

  it("round-trips the carried value untouched", () => {
    const payload = { id: 42, tags: ["a", "b"] };
    const result = Ok(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(payload);
    }
  });

  it("narrows to the success branch for type-safe access", () => {
    const result: Result<number, string> = Ok(7);
    // `result.value` only type-checks inside the ok: true branch —
    // tsc -b proves the narrowing in this test.
    if (result.ok) {
      expect(result.value).toBe(7);
    }
  });
});

describe("Err", () => {
  it("builds a failure Result tagged ok: false", () => {
    const result = Err("boom");
    expect(result.ok).toBe(false);
    expect(result).toEqual({ ok: false, error: "boom" });
  });

  it("round-trips the carried error untouched", () => {
    const error = { reason: "UNKNOWN_UID", nfcUid: "A1B2" };
    const result = Err(error);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(error);
    }
  });

  it("narrows to the failure branch for type-safe access", () => {
    const result: Result<number, string> = Err("boom");
    if (!result.ok) {
      expect(result.error).toBe("boom");
    }
  });
});

describe("Result union", () => {
  it("discriminates on .ok for both branches", () => {
    const successes: Result<number, string>[] = [Ok(1), Ok(2)];
    const failures: Result<number, string>[] = [Err("a"), Err("b")];

    for (const result of successes) {
      expect(result.ok).toBe(true);
    }
    for (const result of failures) {
      expect(result.ok).toBe(false);
    }
  });
});