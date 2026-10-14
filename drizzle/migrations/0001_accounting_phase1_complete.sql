-- Accounting Phase 1 (complete, idempotent). Safe on an empty project and on re-run.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  name_en text,
  account_type text NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_side text NOT NULL CHECK (normal_side IN ('debit','credit')),
  parent_id uuid REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  is_parent boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT ALL ON public.chart_of_accounts TO service_role;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coa admin all" ON public.chart_of_accounts;
CREATE POLICY "coa admin all" ON public.chart_of_accounts FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.cash_and_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('cash','bank')),
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  bank_account_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_and_banks TO authenticated;
GRANT ALL ON public.cash_and_banks TO service_role;
ALTER TABLE public.cash_and_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash admin all" ON public.cash_and_banks;
CREATE POLICY "cash admin all" ON public.cash_and_banks FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc admin all" ON public.cost_centers;
CREATE POLICY "cc admin all" ON public.cost_centers FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE SEQUENCE IF NOT EXISTS public.journal_entry_number_seq;
GRANT USAGE ON SEQUENCE public.journal_entry_number_seq TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE DEFAULT ('JE-' || lpad(nextval('public.journal_entry_number_seq')::text, 6, '0')),
  entry_date date NOT NULL DEFAULT current_date,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','payroll','payment_voucher','reversal')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  reverses_entry_id uuid UNIQUE REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  posted_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "je admin all" ON public.journal_entries;
CREATE POLICY "je admin all" ON public.journal_entries FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  debit numeric(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo text,
  rule_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jel_one_side CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS journal_entry_lines_entry_idx ON public.journal_entry_lines (journal_entry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO authenticated;
GRANT ALL ON public.journal_entry_lines TO service_role;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jel admin all" ON public.journal_entry_lines;
CREATE POLICY "jel admin all" ON public.journal_entry_lines FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE SEQUENCE IF NOT EXISTS public.payment_voucher_number_seq;
GRANT USAGE ON SEQUENCE public.payment_voucher_number_seq TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS public.payment_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number text NOT NULL UNIQUE DEFAULT ('PV-' || lpad(nextval('public.payment_voucher_number_seq')::text, 6, '0')),
  voucher_date date NOT NULL DEFAULT current_date,
  branch_id uuid REFERENCES public.branches(id) ON DELETE RESTRICT,
  cash_bank_id uuid NOT NULL REFERENCES public.cash_and_banks(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payroll_month date,
  source_journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  journal_entry_id uuid UNIQUE REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  description text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_vouchers TO authenticated;
GRANT ALL ON public.payment_vouchers TO service_role;
ALTER TABLE public.payment_vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pv admin all" ON public.payment_vouchers;
CREATE POLICY "pv admin all" ON public.payment_vouchers FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.payroll_journal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_month date NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  journal_entry_id uuid NOT NULL UNIQUE REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  is_reversed boolean NOT NULL DEFAULT false,
  reversed_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pjl_month_first_day CHECK (payroll_month = date_trunc('month', payroll_month)::date)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_payroll_branch_month ON public.payroll_journal_links (payroll_month, branch_id) WHERE (is_reversed = false);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_journal_links TO authenticated;
GRANT ALL ON public.payroll_journal_links TO service_role;
ALTER TABLE public.payroll_journal_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pjl admin all" ON public.payroll_journal_links;
CREATE POLICY "pjl admin all" ON public.payroll_journal_links FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TABLE IF NOT EXISTS public.payroll_accounting_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  entry_side text NOT NULL CHECK (entry_side IN ('debit','credit')),
  account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_accounting_rules TO authenticated;
GRANT ALL ON public.payroll_accounting_rules TO service_role;
ALTER TABLE public.payroll_accounting_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "par admin all" ON public.payroll_accounting_rules;
CREATE POLICY "par admin all" ON public.payroll_accounting_rules FOR ALL TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE OR REPLACE FUNCTION private.jel_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _status text; _is_parent boolean;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT status INTO _status FROM public.journal_entries WHERE id = OLD.journal_entry_id;
    IF _status = 'posted' THEN RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry'; END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT status INTO _status FROM public.journal_entries WHERE id = NEW.journal_entry_id;
    IF _status = 'posted' THEN RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry'; END IF;
    SELECT is_parent INTO _is_parent FROM public.chart_of_accounts WHERE id = NEW.account_id;
    IF _is_parent THEN RAISE EXCEPTION 'parent_account_not_postable'; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_jel_guard ON public.journal_entry_lines;
CREATE TRIGGER trg_jel_guard BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION private.jel_guard();

CREATE OR REPLACE FUNCTION private.je_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _d numeric; _c numeric; _n int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'posted' THEN
    RAISE EXCEPTION 'posted_entry_immutable: use a reversing entry';
  END IF;
  IF NEW.status = 'posted' THEN
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0), count(*) INTO _d, _c, _n
    FROM public.journal_entry_lines WHERE journal_entry_id = NEW.id;
    IF _n < 2 OR _d = 0 OR _d <> _c THEN
      RAISE EXCEPTION 'unbalanced_entry: debit % credit % lines %', _d, _c, _n;
    END IF;
    IF EXISTS (SELECT 1 FROM public.journal_entry_lines l JOIN public.chart_of_accounts a ON a.id = l.account_id
               WHERE l.journal_entry_id = NEW.id AND a.is_parent) THEN
      RAISE EXCEPTION 'parent_account_not_postable';
    END IF;
    NEW.posted_at := now();
    NEW.posted_by := auth.uid();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_je_guard ON public.journal_entries;
CREATE TRIGGER trg_je_guard BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION private.je_guard();

CREATE OR REPLACE FUNCTION private.coa_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_parent AND EXISTS (SELECT 1 FROM public.journal_entry_lines WHERE account_id = NEW.id) THEN
    RAISE EXCEPTION 'account_has_lines_cannot_be_parent';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_coa_guard ON public.chart_of_accounts;
CREATE TRIGGER trg_coa_guard BEFORE UPDATE ON public.chart_of_accounts
FOR EACH ROW EXECUTE FUNCTION private.coa_guard();

CREATE OR REPLACE FUNCTION private.pjl_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'payroll_link_not_deletable'; END IF;
  IF NEW.payroll_month IS DISTINCT FROM OLD.payroll_month OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
     OR NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id OR (OLD.is_reversed AND NOT NEW.is_reversed) THEN
    RAISE EXCEPTION 'payroll_link_immutable';
  END IF;
  IF NEW.is_reversed AND NOT OLD.is_reversed THEN
    IF NOT EXISTS (SELECT 1 FROM public.journal_entries WHERE reverses_entry_id = OLD.journal_entry_id AND status = 'posted') THEN
      RAISE EXCEPTION 'reversal_entry_required';
    END IF;
    NEW.reversed_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_pjl_guard ON public.payroll_journal_links;
CREATE TRIGGER trg_pjl_guard BEFORE UPDATE OR DELETE ON public.payroll_journal_links
FOR EACH ROW EXECUTE FUNCTION private.pjl_guard();

CREATE OR REPLACE FUNCTION private.is_period_locked(_month date, _employee_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payroll_journal_links l
    JOIN public.employees e ON e.id = _employee_id
    WHERE l.payroll_month = date_trunc('month', _month)::date
      AND l.branch_id = e.branch_id
      AND l.is_reversed = false
  );
$$;

CREATE OR REPLACE FUNCTION private.check_payroll_period_lock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_TABLE_NAME = 'payroll' THEN
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'status') = (to_jsonb(OLD) - 'status') THEN
      RETURN NEW;
    END IF;
    IF TG_OP IN ('UPDATE','DELETE') AND private.is_period_locked(OLD.month, OLD.employee_id) THEN
      RAISE EXCEPTION 'period_locked: payroll %', OLD.month;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.month, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: payroll %', NEW.month;
    END IF;
  ELSIF TG_TABLE_NAME = 'payroll_adjustments' THEN
    IF TG_OP IN ('UPDATE','DELETE') AND private.is_period_locked(OLD.month, OLD.employee_id) THEN
      RAISE EXCEPTION 'period_locked: adjustments %', OLD.month;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.month, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: adjustments %', NEW.month;
    END IF;
  ELSIF TG_TABLE_NAME = 'attendance' THEN
    IF TG_OP IN ('UPDATE','DELETE') AND private.is_period_locked(OLD.date, OLD.employee_id) THEN
      RAISE EXCEPTION 'period_locked: attendance %', OLD.date;
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.date, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: attendance %', NEW.date;
    END IF;
  ELSIF TG_TABLE_NAME = 'employee_loans' THEN
    IF TG_OP = 'UPDATE'
       AND (to_jsonb(NEW) - 'paid_amount' - 'status' - 'updated_at') = (to_jsonb(OLD) - 'paid_amount' - 'status' - 'updated_at') THEN
      RETURN NEW;
    END IF;
    IF TG_OP IN ('UPDATE','DELETE') AND EXISTS (
      SELECT 1 FROM public.payroll_journal_links l JOIN public.employees e ON e.id = OLD.employee_id
      WHERE l.branch_id = e.branch_id AND l.is_reversed = false AND l.payroll_month >= date_trunc('month', OLD.start_month)::date) THEN
      RAISE EXCEPTION 'period_locked: loan terms';
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND private.is_period_locked(NEW.start_month, NEW.employee_id) THEN
      RAISE EXCEPTION 'period_locked: loan start month %', NEW.start_month;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_aa_lock_payroll ON public.payroll;
CREATE TRIGGER trg_aa_lock_payroll BEFORE INSERT OR UPDATE OR DELETE ON public.payroll
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();
DROP TRIGGER IF EXISTS trg_aa_lock_adjustments ON public.payroll_adjustments;
CREATE TRIGGER trg_aa_lock_adjustments BEFORE INSERT OR UPDATE OR DELETE ON public.payroll_adjustments
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();
DROP TRIGGER IF EXISTS trg_aa_lock_attendance ON public.attendance;
CREATE TRIGGER trg_aa_lock_attendance BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();
DROP TRIGGER IF EXISTS trg_aa_lock_loans ON public.employee_loans;
CREATE TRIGGER trg_aa_lock_loans BEFORE INSERT OR UPDATE OR DELETE ON public.employee_loans
FOR EACH ROW EXECUTE FUNCTION private.check_payroll_period_lock();

INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, normal_side, is_parent) VALUES
 ('1','الأصول','Assets','asset','debit',true),
 ('2','الالتزامات','Liabilities','liability','credit',true),
 ('3','حقوق الملكية','Equity','equity','credit',true),
 ('4','الإيرادات','Revenue','revenue','credit',true),
 ('5','المصروفات','Expenses','expense','debit',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, normal_side, is_parent, parent_id)
SELECT v.code, v.name_ar, v.name_en, v.t, v.s, v.p, (SELECT id FROM public.chart_of_accounts WHERE code = v.parent)
FROM (VALUES
 ('11','الأصول المتداولة','Current assets','asset','debit',true,'1'),
 ('21','الالتزامات المتداولة','Current liabilities','liability','credit',true,'2'),
 ('31','رأس المال','Capital','equity','credit',false,'3'),
 ('32','الأرباح المحتجزة','Retained earnings','equity','credit',false,'3'),
 ('41','إيرادات أخرى','Other revenue','revenue','credit',true,'4'),
 ('51','مصروفات الرواتب والأجور','Payroll expenses','expense','debit',true,'5')
) AS v(code,name_ar,name_en,t,s,p,parent)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.chart_of_accounts (code, name_ar, name_en, account_type, normal_side, is_parent, parent_id)
SELECT v.code, v.name_ar, v.name_en, v.t, v.s, false, (SELECT id FROM public.chart_of_accounts WHERE code = v.parent)
FROM (VALUES
 ('1101','الصندوق','Cash on hand','asset','debit','11'),
 ('1102','البنك','Bank','asset','debit','11'),
 ('1103','سلف الموظفين','Employee advances','asset','debit','11'),
 ('2101','الرواتب المستحقة','Accrued salaries','liability','credit','21'),
 ('4101','إيرادات جزاءات الموظفين','Employee penalties income','revenue','credit','41'),
 ('5101','الرواتب الأساسية','Basic salaries','expense','debit','51'),
 ('5102','بدل السكن','Housing allowance','expense','debit','51'),
 ('5103','بدل النقل','Transport allowance','expense','debit','51'),
 ('5104','العمل الإضافي','Overtime','expense','debit','51'),
 ('5105','المكافآت','Bonuses','expense','debit','51'),
 ('5106','إضافات أخرى على الرواتب','Other payroll additions','expense','debit','51'),
 ('5109','خصومات الغياب (مقابل مصروف الرواتب)','Absence deductions (contra payroll expense)','expense','credit','51')
) AS v(code,name_ar,name_en,t,s,parent)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.payroll_accounting_rules (rule_key, entry_side, account_id, description)
SELECT v.k, v.s, (SELECT id FROM public.chart_of_accounts WHERE code = v.code), v.d
FROM (VALUES
 ('base_salary','debit','5101','الراتب الأساسي'),
 ('housing_allowance','debit','5102','بدل السكن'),
 ('transport_allowance','debit','5103','بدل النقل'),
 ('overtime','debit','5104','العمل الإضافي'),
 ('bonuses','debit','5105','المكافآت'),
 ('other_additions','debit','5106','تسويات الإضافة'),
 ('absence_deduction','credit','5109','خصم الغياب يخفض مصروف الرواتب'),
 ('loan_deduction','credit','1103','قسط السلفة يخفض سلف الموظفين'),
 ('penalty_deduction','credit','4101','الجزاءات والخصومات الأخرى'),
 ('net_payable','credit','2101','صافي الرواتب المستحقة')
) AS v(k,s,code,d)
ON CONFLICT (rule_key) DO NOTHING;

-- ---------- Phase 1 closing ----------
ALTER TABLE public.employees ALTER COLUMN branch_id SET NOT NULL;

CREATE OR REPLACE FUNCTION private.employee_branch_lock_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.branch_id IS DISTINCT FROM OLD.branch_id AND (
       EXISTS (SELECT 1 FROM public.payroll p WHERE p.employee_id = OLD.id AND private.is_period_locked(p.month, OLD.id))
    OR EXISTS (SELECT 1 FROM public.attendance a WHERE a.employee_id = OLD.id AND private.is_period_locked(a.date, OLD.id))
  ) THEN
    RAISE EXCEPTION 'period_locked: employee branch';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_aa_employee_branch_lock ON public.employees;
CREATE TRIGGER trg_aa_employee_branch_lock BEFORE UPDATE OF branch_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION private.employee_branch_lock_guard();

REVOKE EXECUTE ON FUNCTION private.check_payroll_period_lock(), private.coa_guard(),
  private.je_guard(), private.jel_guard(), private.pjl_guard(), private.employee_branch_lock_guard()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.is_period_locked(date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_period_locked(date, uuid) TO authenticated;