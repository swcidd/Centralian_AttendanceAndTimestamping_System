import { describe, it, expect } from "vitest";
import { validateUid } from "./validation";
import type { Student } from "../types/types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
  }
  return value;
}

type RegisteredStudent = Student & { nfcUid: string };

const register: RegisteredStudent[] = [
  { id: "25-1809-52", name: "Sherwin Sid Sañol", nfcUid: "7BA62E7E" },
  { id: "25-1809-53", name: "Jane Doe", nfcUid: "04A1B2C3" },
];

describe("validateUid", () => {
  it("returns Ok with the student for a known UID", () => {
    const result = validateUid("7BA62E7E", register);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(register[0]);
    }
  });

  it("returns Err with reason UNKNOWN_UID and the uid for an unknown UID", () => {
    const result = validateUid("DEADBEEF", register);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ reason: "UNKNOWN_UID", nfcUid: "DEADBEEF" });
    }
  });

  it("is case-sensitive against the registered UIDs", () => {
    // Cards store uppercase UIDs; a lowercase tap must not match.
    const result = validateUid("7ba62e7e", register);
    expect(result.ok).toBe(false);
  });

  it("returns Err for an empty UID instead of throwing", () => {
    const result = validateUid("", register);
    expect(result.ok).toBe(false);
  });

  it("does not mutate the students register", () => {
    const frozen = deepFreeze([...register]);
    expect(() => validateUid("7BA62E7E", frozen)).not.toThrow();
    expect(frozen).toEqual(register);
  });
});