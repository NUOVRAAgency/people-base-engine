ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS leave_type_other text;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_type_other_required CHECK (
  (leave_type <> 'other' AND leave_type_other IS NULL)
  OR (leave_type = 'other' AND length(btrim(coalesce(leave_type_other,''))) BETWEEN 1 AND 60)
);