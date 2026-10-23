-- Apply this migration to existing projects before deploying the updated frontend.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_results ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND is_active
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid()) AND role = 'admin' AND is_active
    );
$$;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
    FOR UPDATE USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS items_insert ON public.checklist_items;
CREATE POLICY items_insert ON public.checklist_items
    FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS items_select ON public.checklist_items;
CREATE POLICY items_select ON public.checklist_items
    FOR SELECT USING (auth.role() = 'authenticated' AND public.is_active_user());

DROP POLICY IF EXISTS items_update ON public.checklist_items;
CREATE POLICY items_update ON public.checklist_items
    FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS items_delete ON public.checklist_items;
CREATE POLICY items_delete ON public.checklist_items
    FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS patrols_select ON public.patrols;
CREATE POLICY patrols_select ON public.patrols
    FOR SELECT USING ((user_id = auth.uid() AND public.is_active_user()) OR public.is_admin());

DROP POLICY IF EXISTS patrols_insert ON public.patrols;
CREATE POLICY patrols_insert ON public.patrols
    FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_active_user());

DROP POLICY IF EXISTS patrols_update ON public.patrols;
CREATE POLICY patrols_update ON public.patrols
    FOR UPDATE USING ((user_id = auth.uid() AND public.is_active_user()) OR public.is_admin());

DROP POLICY IF EXISTS patrols_delete ON public.patrols;
CREATE POLICY patrols_delete ON public.patrols
    FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS results_select ON public.patrol_results;
CREATE POLICY results_select ON public.patrol_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patrols p
            WHERE p.id = patrol_id
            AND ((p.user_id = auth.uid() AND public.is_active_user()) OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS results_update ON public.patrol_results;
CREATE POLICY results_update ON public.patrol_results
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.patrols p
            WHERE p.id = patrol_id
            AND ((p.user_id = auth.uid() AND public.is_active_user()) OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS results_delete ON public.patrol_results;
CREATE POLICY results_delete ON public.patrol_results
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.patrols p
            WHERE p.id = patrol_id AND public.is_admin()
        )
    );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            split_part(NEW.email, '@', 1)
        ),
        'caretaker'
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE VIEW public.patrol_summary AS
SELECT
    p.id AS patrol_id,
    p.patrol_date,
    p.status,
    pr.display_name AS caretaker_name,
    pr.role AS caretaker_role,
    p.created_at AS submitted_at,
    p.patrol_data->>'summary' AS daily_summary,
    jsonb_array_length(p.patrol_data->'entries') AS entry_count
FROM public.patrols p
JOIN public.profiles pr ON p.user_id = pr.id
WHERE public.is_admin() OR (p.user_id = auth.uid() AND public.is_active_user())
ORDER BY p.patrol_date DESC, p.created_at DESC;
