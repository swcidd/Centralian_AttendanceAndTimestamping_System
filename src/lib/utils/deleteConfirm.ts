// Pure copy builders for the deletion confirmations on the Courses
// page. Kept free of I/O so the exact destructive wording — including
// the attendance count that will be dropped first — is unit-tested.

function attendancePhrase(count: number): string {
  return `${count} attendance record${count === 1 ? "" : "s"}`;
}

export function courseDeleteConfirm(
  courseName: string,
  attendanceCount: number
): string {
  if (attendanceCount === 0) {
    return `Delete course "${courseName}"? This can't be undone.`;
  }
  return (
    `Delete course "${courseName}" and drop its ` +
    `${attendancePhrase(attendanceCount)} first? Its stubcodes, rosters, ` +
    `sessions, and attendance history all go with it. This can't be undone.`
  );
}

export function stubDeleteConfirm(
  stubCode: string,
  attendanceCount: number
): string {
  if (attendanceCount === 0) {
    return `Delete stubcode "${stubCode}"? This can't be undone.`;
  }
  return (
    `Delete stubcode "${stubCode}" and drop its ` +
    `${attendancePhrase(attendanceCount)} first? Its roster, sessions, ` +
    `and attendance history all go with it. This can't be undone.`
  );
}
