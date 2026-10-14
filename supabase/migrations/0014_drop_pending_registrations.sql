-- Pending_Registrations is obsolete: student identity now travels on the
-- card (ingest-tap creates the Student directly from the tap payload). The
-- table held 0 rows with no inbound FKs or code references.
DROP TABLE IF EXISTS Pending_Registrations;
