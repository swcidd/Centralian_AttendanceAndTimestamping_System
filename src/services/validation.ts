import { Ok, Err, type Result } from "../lib/utils/result";
import type { Student } from "../types/types";

export interface ValidationError {
  reason: "UNKNOWN_UID";
  nfcUid: string;
}

// Pure: looks up nfcUid against the provided student register and
// returns a Result instead of throwing.
export function validateUid(
  nfcUid: string,
  students: readonly (Student & { nfcUid: string })[]
): Result<Student, ValidationError> {
  const match = students.find((student) => student.nfcUid === nfcUid);
  return match ? Ok(match) : Err({ reason: "UNKNOWN_UID", nfcUid });
}
