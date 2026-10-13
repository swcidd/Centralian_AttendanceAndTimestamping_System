-- Realtime only broadcasts postgres_changes for tables in the publication.
-- TrackingPage subscribes to Enrollments, which 0001 never added.
ALTER PUBLICATION supabase_realtime ADD TABLE public.Enrollments;
