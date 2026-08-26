# Registration / Calibration Mode — Implementation Handoff

## Overview

Add a **registration/calibration mode** where the teacher can populate a course's student masterlist by having students tap their NFC cards. Each MIFARE Classic 1K card has student data (school_id, first_name, last_name) physically written to it. When the system is in registration mode, tapping a card reads both the UID and the stored JSON data, then creates the Student + Enrollment records automatically.

## Current State

The database schema already defines all the necessary tables and statuses, but **none of the application code implements them**:

| Schema piece | Status |
|---|---|
| `Pending_Registrations` table (PENDING/BOUND) | ✅ Exists |
| `Active_Sessions.Status = 'REGISTRATION'` | ✅ Defined |
| `Device_Commands.Command_Type = 'START_REGISTRATION'` | ✅ Defined |
| `claim_next_device_command()` RPC | ✅ Generic, works |
| `ingest-tap` REGISTRATION branch | ❌ Not implemented |
| Frontend registration UI | ❌ Not implemented |
| Firmware `START_REGISTRATION` handler | ❌ Explicitly drops it |

## Card Data Format

**Correction (caught in review before any real card was encoded — see below):** an earlier version of this spec claimed sector 1's blocks 4–7 as 64 bytes of usable data. That's wrong on two independent counts: block 7 is sector 1's **trailer** (Key A + access bits + Key B), not data — true of every MIFARE Classic sector, not specific to this card — so a single sector only has 3 real data blocks (48 bytes); and even the original 64-byte budget was already too small, since the example payload below runs 79 bytes with ordinary JSON encoding. The spec below (sectors 1+2's data blocks, 96 bytes) is the corrected version — this is what firmware's `nfcReadData()` (`firmware/src/nfc.cpp`) actually implements.

MIFARE Classic 1K cards store student data across **sector 1's data blocks (4, 5, 6) and sector 2's data blocks (8, 9, 10)** — 96 bytes total — authenticated with default key `0xFFFFFFFFFFFF`. Block 7 and block 11, each sector's trailer, are never written or read as data.

The data is a JSON object, null-padded to 96 bytes:

```json
{"school_id":"25-1809-52","first_name":"Sherwin Sid","last_name":"Sañol"}
```

**Encoding rules:**
- JSON stored raw (no base64), null-padded to fill the 96-byte payload
- Block 4 = bytes 0–15, block 5 = bytes 16–31, block 6 = bytes 32–47, block 8 = bytes 48–63, block 9 = bytes 64–79, block 10 = bytes 80–95
- Blocks 7 and 11 (sector trailers) are skipped entirely — never written, never read as data
- Both sectors' trailers (access bits) must allow read/write with Key A = `0xFFFFFFFFFFFF`
- Card must be blank (factory default keys) or pre-encoded with this layout

## Card Encoding (External Tool)

A separate Python script using `nfcpy` writes student data to blank MIFARE Classic 1K cards. This is decoupled from the main system — run on a desktop with an ACR122U or similar reader.

### Reference Script: `tools/encode_card.py`

```python
#!/usr/bin/env python3
"""Encode student data onto a MIFARE Classic 1K card (sectors 1+2's data blocks).

Usage:
    python encode_card.py --school-id 25-1809-52 \
        --first-name "Sherwin Sid" --last-name "Sañol"

Requires: pip install nfcpy
Reader: ACR122U or PN532-based USB reader
"""
import nfc
import json
import sys
import argparse
from binascii import hexlify

DEFAULT_KEY = b"\xff\xff\xff\xff\xff\xff"
# Block 7 (sector 1) and block 11 (sector 2) are each sector's TRAILER
# (Key A + access bits + Key B) on MIFARE Classic — never data, on any
# sector. Writing raw payload bytes into a trailer can corrupt the
# access bits and permanently lock the sector, so this list is
# deliberately just the 6 real data blocks across two sectors, grouped
# by which sector each needs authenticating against.
SECTOR_DATA_BLOCKS = {1: [4, 5, 6], 2: [8, 9, 10]}

def encode(card, data: dict):
    # Build 96-byte payload: JSON + null padding
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
    if len(payload) > 96:
        raise ValueError(f"Payload too large: {len(payload)} bytes (max 96)")
    payload = payload.ljust(96, b"\x00")

    # NOTE: this authenticate()/write_block() call shape is carried
    # over from the original single-sector version of this script,
    # which was never actually run against a real card before this
    # bug was caught in review — verify the exact nfcpy API against
    # real hardware before trusting it, same as any first real run.
    block_index = 0
    for sector, blocks in SECTOR_DATA_BLOCKS.items():
        if not card.authenticate(sector, key=DEFAULT_KEY, key_type=nfc.clf.Mifare.KEY_A):
            raise RuntimeError(
                f"Authentication failed on sector {sector} — is the card blank (factory keys)?"
            )
        for block_num in blocks:
            chunk = payload[block_index * 16 : (block_index + 1) * 16]
            card.write_block(block_num, chunk)
            print(f"  Block {block_num}: {chunk}")
            block_index += 1

    print(f"\nEncoded {len(data)} fields ({len(payload.rstrip(b'\\x00'))} bytes JSON)")

def on_connect(tag):
    if tag.type != "MifareClassic":
        print(f"Error: expected MifareClassic, got {tag.type}")
        return False

    uid = hexlify(tag.identifier).decode().upper()
    print(f"Card UID: {uid}")
    print(f"Card type: {tag.product} ({tag._size} bytes)")

    encode(tag, vars(args))
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Encode student data onto MIFARE Classic 1K")
    parser.add_argument("--school-id", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    args = parser.parse_args()

    print("Place card on reader...")
    with nfc.ContactlessFrontend("usb") as clf:
        clf.connect(rdwr={"on-connect": on_connect})
```

### Bulk Encoding

For a class roster, loop over a JSON array:

```json
[
  {"school_id": "25-1809-52", "first_name": "Sherwin Sid", "last_name": "Sañol"},
  {"school_id": "25-1809-53", "first_name": "Jane", "last_name": "Doe"}
]
```

```bash
# One card at a time — script prompts "Place card on reader..." for each
for student in $(jq -c '.[]' roster.json); do
    python tools/encode_card.py \
        --school-id "$(echo $student | jq -r '.school_id')" \
        --first-name "$(echo $student | jq -r '.first_name')" \
        --last-name "$(echo $student | jq -r '.last_name')"
done
```

---

## Implementation Tasks

### Task 1: Firmware — Card Data Reader

**File:** `firmware/src/nfc.cpp`, `firmware/src/nfc.h`

Add a struct and function to read the full card data (not just UID):

```cpp
// nfc.h
struct CardData {
    String uid;
    String schoolId;
    String firstName;
    String lastName;
    bool valid;  // false if data blocks unreadable or JSON malformed
};

CardData nfcReadData();
```

**`nfcReadData()` implementation — done, see `firmware/src/nfc.cpp`:**

The steps below are what's actually implemented; two corrections from how this task was originally written: the real Adafruit_PN532 API is `mifareclassic_ReadDataBlock(blockNumber, data)` (no `mifareclassic_ReadData`, no length out-param — a block is always a fixed 16 bytes), and the block list is `{4, 5, 6, 8, 9, 10}` across sectors 1+2, not `{4, 5, 6, 7}` — see the Card Data Format correction above for why.

1. Call `nfc.readPassiveTargetID()` to get UID (same as current `nfcReadUid()`)
2. For each of the 6 data blocks, authenticate with `nfc.mifareclassic_AuthenticateBlock(uid, uidLength, block, MIFARE_CMD_AUTH_A, defaultKey)`
   - Default key: `0xFF 0xFF 0xFF 0xFF 0xFF 0xFF`
3. Read each block with `nfc.mifareclassic_ReadDataBlock(block, buffer + offset)`
4. Concatenate the 6 × 16 = 96 bytes into a single buffer
5. Trim null padding
6. Parse as JSON with ArduinoJson: `JsonDocument doc; deserializeJson(doc, payload);`
7. Extract `school_id`, `first_name`, `last_name`
8. Return `CardData{uid, schoolId, firstName, lastName, valid=true}`

**Keep existing `nfcReadUid()`** — it's still used in attendance mode (lighter, no auth needed).

**Error handling:**
- If auth fails → return `valid=false` (card not encoded or wrong key)
- If read fails → return `valid=false`
- If JSON parse fails → return `valid=false`
- Print errors to Serial for debugging

### Task 2: Firmware — Registration Mode State

**File:** `firmware/src/main.cpp`

Add a global `bool registrationMode = false;` in the anonymous namespace.

Modify `loop()`:

```cpp
void loop() {
  pollDeviceCommandsIfDue();  // may toggle registrationMode

  if (registrationMode) {
    // Registration mode: read full card data + POST with student_info
    CardData card = nfcReadData();
    if (card.uid.length() == 0) return;
    if (!card.valid) {
      Serial.println("Card read failed or data invalid");
      ledIndicateInvalidUid();
      return;
    }

    // Debounce (same logic as attendance mode)
    unsigned long now = millis();
    if (card.uid == lastUid && (now - lastTapMillis) < TAP_DEBOUNCE_MS) return;
    lastUid = card.uid;
    lastTapMillis = now;

    unsigned long timestamp = timeSyncNowUtc();
    String deviceMac = WiFi.macAddress();
    String signature = signPayload(deviceMac, timestamp, card.uid);

    int statusCode = postTapEvent(deviceMac, timestamp, card.uid, signature,
                                   card.schoolId, card.firstName, card.lastName);
    Serial.printf("Register %s (%s %s) -> HTTP %d\n",
                  card.uid.c_str(), card.firstName.c_str(), card.lastName.c_str(),
                  statusCode);
    ledIndicateResult(statusCode);
  } else {
    // Attendance mode: existing logic (unchanged)
    String rawUid = nfcReadUid();
    // ... existing code ...
  }
}
```

### Task 3: Firmware — Command Handler

**File:** `firmware/src/commands.cpp`

Replace the catch-all else branch:

```cpp
if (command.commandType == "START_ATTENDANCE") {
    registrationMode = false;
    ledIndicateSessionStart();
} else if (command.commandType == "START_REGISTRATION") {
    registrationMode = true;
    ledIndicateRegistration();
} else if (command.commandType == "END_SESSION") {
    registrationMode = false;
    ledIndicateSessionEnd();
} else {
    Serial.printf("Unknown command: %s\n", command.commandType.c_str());
}
```

**Note:** `registrationMode` needs to be accessible from `commands.cpp`. Either:
- Make it a global extern (declared in `commands.h`, defined in `main.cpp`)
- Or pass a `bool*` pointer to `pollDeviceCommandsIfDue()`

Recommended: extern global, consistent with the existing pattern of `lastUid` / `lastTapMillis` in main.cpp.

### Task 4: Firmware — LED Registration Indicator

**File:** `firmware/src/led.cpp`, `firmware/src/led.h`

```cpp
// led.h
void ledIndicateRegistration();

// led.cpp
void ledIndicateRegistration() {
    // 3 cyan blinks to distinguish from attendance (green) and session start (blue)
    blink(3, pixel.Color(0, 255, 255));
}
```

### Task 5: Firmware — Extended POST Payload

**File:** `firmware/src/net.cpp`, `firmware/src/net.h`

**Update `net.h`:**
```cpp
int postTapEvent(const String &deviceMac, unsigned long timestamp,
                 const String &nfcUid, const String &signature,
                 const String &schoolId = "", const String &firstName = "",
                 const String &lastName = "");
```

**Update `net.cpp`:**
```cpp
int postTapEvent(const String &deviceMac, unsigned long timestamp,
                 const String &nfcUid, const String &signature,
                 const String &schoolId, const String &firstName,
                 const String &lastName) {
  JsonDocument doc;
  doc["device_mac"] = deviceMac;
  doc["nfc_uid"] = nfcUid;
  doc["timestamp"] = timestamp;
  doc["signature"] = signature;

  // Only include student_info in registration mode (non-empty strings)
  if (schoolId.length() > 0) {
    doc["student_info"]["school_id"] = schoolId;
    doc["student_info"]["first_name"] = firstName;
    doc["student_info"]["last_name"] = lastName;
  }

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  http.begin(API_ENDPOINT_URL);
  http.addHeader("Content-Type", "application/json");
  int statusCode = http.POST(body);
  http.end();
  return statusCode;
}
```

**Also update `net_dry.cpp`** with the same signature (stub implementation).

### Task 6: Edge Function — REGISTRATION Branch

**File:** `supabase/functions/ingest-tap/index.ts`

Update the `TapPayload` interface:

```typescript
interface TapPayload {
  device_mac: string;
  nfc_uid: string;
  timestamp: number;
  signature: string;
  student_info?: {
    school_id: string;
    first_name: string;
    last_name: string;
  };
}
```

After HMAC verification, branch on session status:

```typescript
// Query for ANY active session (not just ACTIVE_ATTENDANCE)
const { data: session } = await supabase
  .from("active_sessions")
  .select("session_id, stub_code, started_at, status")
  .eq("device_mac", payload.device_mac)
  .in("status", ["ACTIVE_ATTENDANCE", "REGISTRATION"])
  .maybeSingle();

if (!session) {
  return 409 "no active session for this device";
}

// === REGISTRATION BRANCH ===
if (session.status === "REGISTRATION") {
  if (!payload.student_info) {
    return new Response(
      JSON.stringify({ error: "registration mode requires student_info in payload" }),
      { status: 400 }
    );
  }

  // 1. Check if student already exists by NFC_UID
  const { data: existingStudent } = await supabase
    .from("students")
    .select("student_id")
    .eq("nfc_uid", payload.nfc_uid)
    .maybeSingle();

  let studentId: string;

  if (existingStudent) {
    // Student already registered (re-tap) — just ensure enrollment
    studentId = existingStudent.student_id;
  } else {
    // 2. Create new student
    const { data: newStudent, error: insertError } = await supabase
      .from("students")
      .insert({
        school_id: payload.student_info.school_id,
        first_name: payload.student_info.first_name,
        last_name: payload.student_info.last_name,
        nfc_uid: payload.nfc_uid,
      })
      .select("student_id")
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
    }
    studentId = newStudent.student_id;
  }

  // 3. Enroll in course (idempotent — ON CONFLICT DO NOTHING)
  await supabase.from("enrollments").upsert(
    { stub_code: session.stub_code, student_id: studentId },
    { onConflict: "stub_code,student_id", ignoreDuplicates: true }
  );

  return new Response(
    JSON.stringify({
      status: "registered",
      student: {
        student_id: studentId,
        school_id: payload.student_info.school_id,
        first_name: payload.student_info.first_name,
        last_name: payload.student_info.last_name,
      },
    }),
    { status: 201 }
  );
}

// === ATTENDANCE BRANCH (existing logic, unchanged) ===
// ... rest of current code ...
```

**Deploy after changes:**
```bash
supabase functions deploy ingest-tap --project-ref tbmkhwfzstkakbuurinw
```

### Task 7: Frontend — Session Mode API

**File:** `src/services/sessionsApi.ts`

Update `queueDeviceCommand` type union:

```typescript
async function queueDeviceCommand(
  deviceMac: string,
  stubCode: string,
  commandType: "START_ATTENDANCE" | "END_SESSION" | "START_REGISTRATION"
): Promise<void> { ... }
```

Update `startSession` to accept a mode parameter:

```typescript
export async function startSession(
  stubCode: string,
  deviceMac: string,
  mode: "ACTIVE_ATTENDANCE" | "REGISTRATION" = "ACTIVE_ATTENDANCE"
): Promise<void> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const { error } = await supabase.from("active_sessions").insert({
    stub_code: stubCode,
    device_mac: deviceMac,
    status: mode,
    created_by: userData.user?.id,
  });
  if (error) throw error;

  const commandType = mode === "REGISTRATION" ? "START_REGISTRATION" : "START_ATTENDANCE";
  await queueDeviceCommand(deviceMac, stubCode, commandType);
}
```

Update `getActiveSession` to also find REGISTRATION sessions (or add a separate `getRegistrationSession` function):

```typescript
export async function getActiveSession(
  stubCode: string
): Promise<ActiveSession & { status: string } | null> {
  const { data, error } = await supabase
    .from("active_sessions")
    .select("session_id, stub_code, device_mac, status")
    .eq("stub_code", stubCode)
    .in("status", ["ACTIVE_ATTENDANCE", "REGISTRATION"])
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    sessionId: data.session_id,
    stubCode: data.stub_code,
    deviceMac: data.device_mac,
    status: data.status,
  };
}
```

### Task 8: Frontend — Tracking UI

**File:** `src/components/tracking/TrackingButton.tsx`

Replace the binary toggle with a mode selector:

```tsx
// When no session is active: show dropdown with "Start Scanning" and "Start Registration"
// When session is active: show "Stop" button + current mode label

const TrackingButton = ({ course, onSessionChange }: Props) => {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [mode, setMode] = useState<"scanning" | "registration">("scanning");

  // ... fetch active session on mount ...

  const handleStart = async () => {
    const sessionMode = mode === "registration" ? "REGISTRATION" : "ACTIVE_ATTENDANCE";
    await startSession(course.stub, course.deviceMac, sessionMode);
    // refresh active session...
  };

  return (
    <div className="flex items-center gap-3">
      {!activeSession ? (
        <>
          <select value={mode} onChange={e => setMode(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm">
            <option value="scanning">Start Scanning</option>
            <option value="registration">Start Registration</option>
          </select>
          <button onClick={handleStart} className="bg-orange ...">
            Start
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-gray-500">
            {activeSession.status === "REGISTRATION" ? "Registration Mode" : "Scanning"}
          </span>
          <button onClick={handleStop} className="bg-red-500 ...">
            Stop
          </button>
        </>
      )}
    </div>
  );
};
```

**File:** `src/pages/TrackingPage.tsx`

Add calibration prompt when roster is empty:

```tsx
// After fetching enrolled students for the selected course:
if (enrolledStudents.length === 0 && !activeSession) {
  return (
    <div className="text-center py-12">
      <p className="text-gray-500 mb-4">No students enrolled in this course.</p>
      <p className="text-sm text-gray-400 mb-6">
        Start Registration mode and have students tap their cards to populate the masterlist.
      </p>
      <TrackingButton course={selectedCourse} mode="registration" ... />
    </div>
  );
}
```

Add a real-time student list during registration mode (subscribe to `enrollments` table filtered by `stub_code`):

```tsx
// Use the existing useRealtimeAttendance pattern but for enrollments
useEffect(() => {
  if (activeSession?.status !== "REGISTRATION") return;

  const channel = supabase
    .channel(`enrollments:${course.stub}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "enrollments",
      filter: `stub_code=eq.${course.stub}`,
    }, (payload) => {
      // Fetch the student name from the new enrollment
      // Add to the displayed registration list
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [activeSession, course.stub]);
```

### Task 9: Docs — Card Encoding Guide

**File:** `docs/card-encoding.md`

Document:
1. Card format specification (sectors 1+2's data blocks 4-6/8-10, 96 bytes, JSON, null-padded — see the Card Data Format correction above, and explain *why* blocks 7/11 are skipped so a future editor doesn't reintroduce the trailer bug)
2. Required hardware (ACR122U or PN532 USB reader)
3. Python setup (`pip install nfcpy`)
4. Single-card encoding usage
5. Bulk encoding from a JSON roster file
6. Troubleshooting (auth failures per-sector, card type mismatch, payload-too-large)

---

## Deployment Checklist

After all code changes:

1. **Flash firmware:** `pio run -e esp32-s3-n16r8 -t upload`
2. **Deploy edge function:** `supabase functions deploy ingest-tap --project-ref tbmkhwfzstkakbuurinw`
3. **Test registration flow:**
   - Start Registration from dashboard → device gets `START_REGISTRATION` command → LED pattern
   - Tap an encoded card → should get HTTP 201 with student data
   - Check `students` and `enrollments` tables in Supabase dashboard
   - Student should appear in the Tracking page roster in real-time
4. **Test attendance flow (regression):**
   - Stop Registration → Start Scanning → tap same card → should get HTTP 201 with PRESENT status
   - Verify attendance_logs has the record

## Git Branch Strategy

Create a feature branch: `feat/registration-mode`

Commits (suggested order):
1. `feat(firmware): add MIFARE card data reader (nfcReadData)` — tasks 1, 4
2. `feat(firmware): implement registration mode + START_REGISTRATION command` — tasks 2, 3, 5
3. `feat(backend): add REGISTRATION branch to ingest-tap edge function` — task 6
4. `feat(frontend): add session mode selector and registration UI` — tasks 7, 8
5. `docs: add card encoding guide with nfcpy reference script` — task 9
