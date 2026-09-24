ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in time,
  ADD COLUMN IF NOT EXISTS check_out time,
  ADD COLUMN IF NOT EXISTS late_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_late_minutes_check CHECK (late_minutes >= 0);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS work_start time NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS work_end time NOT NULL DEFAULT '16:00',
  ADD COLUMN IF NOT EXISTS grace_minutes integer NOT NULL DEFAULT 15;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_grace_minutes_check CHECK (grace_minutes >= 0 AND grace_minutes <= 240);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (date);