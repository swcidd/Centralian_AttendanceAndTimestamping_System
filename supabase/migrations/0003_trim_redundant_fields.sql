-- Drops columns that exist on the live database but are unused by any code
-- path. IF EXISTS: 0001 was edited after these columns were already live, so
-- a fresh database never creates them.
ALTER TABLE Students DROP COLUMN IF EXISTS Course_Program;
ALTER TABLE Students DROP COLUMN IF EXISTS Year_Level;

-- Superseded by Courses.Absent_After_Minutes (computed in finalize_absences()).
ALTER TABLE Active_Sessions DROP COLUMN IF EXISTS Expires_At;
