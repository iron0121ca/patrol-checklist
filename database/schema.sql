-- ===============================================================
-- Patrol Checklist System · Supabase Database Schema
-- Building: The Regency, 701 7995 Westminster
-- ===============================================================
-- Usage: Run this in Supabase Dashboard -> SQL Editor

-- ===============================================================
-- 1. PROFILES TABLE (extends auth.users)
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'caretaker'
        CHECK (role IN ('admin', 'caretaker')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===============================================================
-- 2. PATROLS TABLE (each daily patrol submission)
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.patrols (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    patrol_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift TEXT NOT NULL DEFAULT 'Day Shift'
        CHECK (shift IN ('Day Shift', 'Afternoon Shift', 'Night Shift')),
    status TEXT NOT NULL DEFAULT 'Draft'
        CHECK (status IN ('Draft', 'Submitted')),

    -- Main data stored as JSONB for flexibility
    -- Structure:
    -- {
    --   "entries": [
    --     {
    --       "date": "2026-10-06",
    --       "time_start": "08:00",
    --       "time_end": "09:00",
    --       "areas": ["Garbage Area", "Parkade-P1"],
    --       "observation": "All clear",
    --       "action_taken": "N/A",
    --       "signature": "John Doe"
    --     }
    --   ],
    --   "summary": {
    --     "unusual": "None",
    --     "unauthorized": "None",
    --     "hazards": "Light out in P2"
    --   }
    -- }
    patrol_data JSONB,
    caretaker_signature TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One patrol per user per day
    UNIQUE(user_id, patrol_date)
);

-- ===============================================================
-- 3. CHECKLIST ITEMS (predefined patrol checkpoints)
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.checklist_items (
    id BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    item_name TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===============================================================
-- 4. PATROL RESULTS (individual item check results)
-- ===============================================================
CREATE TABLE IF NOT EXISTS public.patrol_results (
    id BIGSERIAL PRIMARY KEY,
    patrol_id BIGINT NOT NULL REFERENCES public.patrols(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES public.checklist_items(id),
    result TEXT NOT NULL CHECK (result IN ('Pass', 'Fail', 'N/A')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(patrol_id, item_id)
);

-- ===============================================================
-- INDEXES
-- ===============================================================
CREATE INDEX IF NOT EXISTS idx_patrols_user_date ON public.patrols(user_id, patrol_date DESC);
CREATE INDEX IF NOT EXISTS idx_patrols_date ON public.patrols(patrol_date DESC);
CREATE INDEX IF NOT EXISTS idx_patrol_results_patrol ON public.patrol_results(patrol_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_order ON public.checklist_items(display_order);

-- ===============================================================
-- ROW LEVEL SECURITY (RLS)
-- ===============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_results ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES =====
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ===== CHECKLIST ITEMS =====
DROP POLICY IF EXISTS items_select ON public.checklist_items;
CREATE POLICY items_select ON public.checklist_items
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS items_insert ON public.checklist_items;
CREATE POLICY items_insert ON public.checklist_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS items_update ON public.checklist_items;
CREATE POLICY items_update ON public.checklist_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS items_delete ON public.checklist_items;
CREATE POLICY items_delete ON public.checklist_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ===== PATROLS =====
DROP POLICY IF EXISTS patrols_select ON public.patrols;
CREATE POLICY patrols_select ON public.patrols
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS patrols_insert ON public.patrols;
CREATE POLICY patrols_insert ON public.patrols
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS patrols_update ON public.patrols;
CREATE POLICY patrols_update ON public.patrols
    FOR UPDATE USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS patrols_delete ON public.patrols;
CREATE POLICY patrols_delete ON public.patrols
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ===== PATROL RESULTS =====
DROP POLICY IF EXISTS results_select ON public.patrol_results;
CREATE POLICY results_select ON public.patrol_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.patrols p
            WHERE p.id = patrol_id
            AND (
                p.user_id = auth.uid()
                OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
            )
        )
    );

DROP POLICY IF EXISTS results_insert ON public.patrol_results;
CREATE POLICY results_insert ON public.patrol_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.patrols p
            WHERE p.id = patrol_id AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS results_update ON public.patrol_results;
CREATE POLICY results_update ON public.patrol_results
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.patrols p
            WHERE p.id = patrol_id AND p.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS results_delete ON public.patrol_results;
CREATE POLICY results_delete ON public.patrol_results
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.patrols p
            WHERE p.id = patrol_id
            AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

-- ===============================================================
-- TRIGGERS & FUNCTIONS
-- ===============================================================

-- Auto-create profile on user signup
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
        COALESCE(
            NEW.raw_user_meta_data->>'role',
            'caretaker'
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER patrols_updated_at
    BEFORE UPDATE ON public.patrols
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===============================================================
-- SEED DATA: Default patrol checkpoints
-- ===============================================================
INSERT INTO public.checklist_items (category, item_name, display_order)
SELECT * FROM (VALUES
    -- Patrol Areas (matching paper form)
    ('Patrol Areas', 'Garbage Area', 1),
    ('Patrol Areas', 'Parkade-P1', 2),
    ('Patrol Areas', 'Parkade-P2', 3),
    ('Patrol Areas', 'Parkade-P3', 4),
    ('Patrol Areas', 'Parkade-P4', 5),
    ('Patrol Areas', 'Parkade-P5', 6),
    ('Patrol Areas', 'Parkade-P6', 7),
    ('Patrol Areas', 'Other', 8),

    -- Fire Safety
    ('Fire Safety', 'Fire Extinguishers', 9),
    ('Fire Safety', 'Fire Hose Cabinets', 10),
    ('Fire Safety', 'Emergency Exits', 11),
    ('Fire Safety', 'Sprinkler System', 12),
    ('Fire Safety', 'Fire Alarm Panel', 13),

    -- Lighting & Electrical
    ('Lighting & Electrical', 'Common Area Lighting', 14),
    ('Lighting & Electrical', 'Emergency Lights', 15),
    ('Lighting & Electrical', 'Parkade Lighting', 16),

    -- Security
    ('Security', 'CCTV Cameras', 17),
    ('Security', 'Access Control', 18),
    ('Security', 'Intercom System', 19),

    -- Building Facilities
    ('Building Facilities', 'Elevators', 20),
    ('Building Facilities', 'Garbage Room', 21),
    ('Building Facilities', 'Water Pumps', 22),
    ('Building Facilities', 'Rooftop', 23),
    ('Building Facilities', 'HVAC System', 24),

    -- Extended Patrol
    ('Extended Patrol', 'Building Perimeter', 25),
    ('Extended Patrol', 'Common Corridors', 26),
    ('Extended Patrol', 'Restrooms', 27),
    ('Extended Patrol', 'Storage Rooms', 28)
) AS v(cat, name, ord)
WHERE NOT EXISTS (
    SELECT 1 FROM public.checklist_items
    WHERE display_order = v.ord
)
ORDER BY v.ord;

-- ===============================================================
-- VIEW: Patrol summary for reporting
-- ===============================================================
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
WHERE
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR p.user_id = auth.uid()
ORDER BY p.patrol_date DESC, p.created_at DESC;

GRANT SELECT ON public.patrol_summary TO authenticated;