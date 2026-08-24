# SoftDev3 Lab 1 — Initial Project Plan (NFCPass)

*Functional Programming Sprint Project — Pre-Sprint 1 Planning*

## Part A — Group Information & Roles

| Group No. | Group 3 | |
| --- | --- | --- |
| **Role** | **Member(s)** | **Assigned Task / Notes** |
| Project Manager / Team Lead | Sanol (Lead), Azarraga, Palmes | Coordinates sprint timelines, manages hardware/software feature scope, and handles project defenses |
| Lead Developer / Backend Dev | Azarraga (Lead), Colomer, Castillo | Programs micro-controller firmware, handles UART/SPI communication, and writes immutable log reducers |
| Frontend Developer | Pendioday (Lead), Palmes, Colomer | Builds the live operator dashboard, handles Serial/WebSocket data streams, and displays analytics |
| UI / UX Designer | Palmes (Lead), Pendioday, Sanol | Prototypes physical enclosure layouts, terminal screen interfaces, and visual LED status mappings |
| QA / Tester | Colomer (Lead), Pendioday, Castillo | Creates unit tests for data stream parsers and checks state integrity |
| Documentation Lead | Castillo (Lead), Sanol, Azarraga | Documents hardware pinout maps, software API contracts, wiring schemas, and user operation guides |

## Part B — Project Overview

| | |
| --- | --- |
| **Project Title** | NFCPass: Micro-Controller Powered Near-Field Attendance Verification Terminal |
| **Problem Statement** | Traditional university attendance logging methods rely on manual paper sign-ins, verbal roll calls, or easily bypassed QR codes that are slow and prone to proxy signing ("buddy punching"). Mobile-app based scanners can be intrusive, drain device batteries, and cause bottlenecks at the classroom door. |
| **Target Users** | University professors, laboratory instructors, department heads, registrars, and students. |
| **Short System Description** | NFCPass is an embedded hardware tracking system featuring a dedicated micro-controller terminal equipped with an NFC module. Students tap their physical student ID cards on the door-mounted terminal, which instantly registers presence, computes timestamps, and relays records to a central dashboard. The system utilizes pure functional architecture to map raw hardware telemetry streams into unalterable attendance records. |
| **Main Objectives** | Replace manual/mobile workflows with a low-cost, dedicated physical hardware terminal for instant entry validation. Enforce immutable attendance logging at the firmware and database layers to prevent manual historical log tampering. Provide a real-time web interface for instructors to monitor live room capacities, late distributions, and student records. |

## Part C — Features & Tech Stack

| # | Core Feature | Notes (FP concept it may use) |
| --- | --- | --- |
| 1 | Hardware Interrupt Scanner Pipeline | **Immutability:** Physical RFID/NFC tag tap interrupts generate permanent, append-only sensor log entries that can never be modified. |
| 2 | Serial Telemetry Stream Parser | **Functional Error Handling:** Processing incoming payload sequences returns a strict `Result` type containing either `Success(ValidPayload)` or `Failure(InvalidPayload)`. |
| 3 | Class Session State Reducer | **Pure Functions:** Computing the state of a current classroom roster relies on a `reducer(currentRosterState, incomingTapEvent)` that outputs a deterministic new state without global variables. |
| 4 | Metrics Filter Matrix | **Higher-Order Functions:** Filters central data structures by passing modular condition predicates into filter blocks (e.g. `.filter()`). |
| 5 | Single-Step Event Pipe | **Function Composition:** Directly routes the parsed UID payload sequentially through validation checks and forwards it straight to the network logging function in a single, predictable execution pipeline. |

| | |
| --- | --- |
| **Programming Language(s)** | C++ (Firmware), TypeScript (Web Application & Backend Dashboard) |
| **Framework(s) / Library(ies)** | Arduino Framework / ESP-IDF (Adafruit PN532 library), React (Frontend Analytics Dashboard) |
| **Database** | Supabase / PostgreSQL (authorization tokens, master student registers, persistent state logs) |
| **Other Tools / Platforms** | GitHub for version control, PlatformIO for embedded development, Figma for interface modeling |

## Part D — Project Scope

| In Scope | Out of Scope |
| --- | --- |
| Embedded firmware module handling raw NFC tag reading and serial messaging. Append-only transactional storage and validation engine. Web-based instructor management dashboard and live log viewing views. | Local terminal queue memory / offline storage. Data encryption protocols and multi-stage hardware pipelines. Hardware checksum & frame error simulations. Automated physical door latch/solenoid lock strike hardware integration. Direct database integration into official university registrar enterprise servers. Automatic grade-weighting calculation frameworks. |

## FP Concept Mapping

| System Feature | FP Concept | Description |
| --- | --- | --- |
| NFC Attendance Verification | Pure Function | Validating a scanned UID against the registered student database always produces the same output for the same input and does not modify external state. |
| Attendance Tracking | Higher-Order Functions | The tracking page processes attendance records using `filter()`, `map()`, and `sort()` to search, filter by status, and organize records. |
| Automatic Attendance Logging | Immutability | Every successful NFC scan creates a new attendance record instead of modifying existing ones — append-only, tamper-resistant. |
| Attendance Processing Pipeline | Function Composition | Processing is split into small reusable functions (UID validation, duplicate check, timestamp generation, record creation, storage, dashboard update) composed into a single pipeline. |
| Student Search | First-Class Functions | Search/filter logic passes predicate functions as arguments to reusable search methods. |
| Login Authentication | Functional Error Handling | Login validation returns structured success/failure results instead of throwing exceptions. |
| Attendance Dashboard | Declarative Programming | The React dashboard describes how data should render based on state; it re-renders automatically when attendance data changes. |

## Discrepancies vs. Technical Handoff

The technical handoff (`docs/handoff.md`) was written after this worksheet and supersedes it on the following points:

| Worksheet | Handoff (current) |
| --- | --- |
| MFRC522 *or* PN532 | PN532, I2C mode settled |
| "Serial telemetry stream" / UART | HTTPS POST direct to a Supabase Edge Function |
| Encryption listed **out of scope** (Part D) | HMAC-SHA256 request signing is core to the security model |

The encryption discrepancy is worth flagging to the instructor before final submission — either reframe it as exceeding the original scope, or update Part D of this worksheet.
