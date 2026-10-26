-- Apply this migration to existing projects to allow a separate patrol per shift.

ALTER TABLE public.patrols
    DROP CONSTRAINT IF EXISTS patrols_user_id_patrol_date_key,
    DROP CONSTRAINT IF EXISTS patrols_shift_check;

ALTER TABLE public.patrols
    ADD CONSTRAINT patrols_shift_check
        CHECK (shift IN ('Morning', 'Afternoon', 'Day Shift', 'Afternoon Shift', 'Night Shift')),
    ADD CONSTRAINT patrols_user_id_patrol_date_shift_key
        UNIQUE (user_id, patrol_date, shift);
