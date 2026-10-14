-- A course is visible only to the instructor who created it. The previous
-- SELECT policy (USING true) let every authenticated instructor see every
-- course, so Marco could open Sherwin's SE 2143. Restrict SELECT to the
-- creator, matching the existing insert/update/delete policies.

DROP POLICY IF EXISTS courses_select_auth ON public.courses;

CREATE POLICY courses_select_own ON public.courses
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());
