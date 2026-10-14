-- Accounting Phase 1 tests. Runs entirely inside BEGIN ... ROLLBACK: no data remains.
-- Run in the SQL editor as the database owner (postgres). Output: final SELECT of results.
BEGIN;

CREATE TEMP TABLE t_results (n serial, test text, passed boolean, detail text) ON COMMIT DROP;
GRANT ALL ON t_results TO authenticated;
GRANT ALL ON SEQUENCE t_results_n_seq TO authenticated;

-- ---------- Fixtures ----------
INSERT INTO public.branches (id, name) VALUES ('00000000-0000-0000-0000-0000000000b1', 'TEST-BRANCH');
INSERT INTO public.employees (id, full_name, branch_id) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'TEST EMP', '00000000-0000-0000-0000-0000000000b1');
INSERT INTO public.payroll (id, employee_id, month, base_salary, status) VALUES
  ('00000000-0000-0000-0000-0000000000p1'::text::uuid, '00000000-0000-0000-0000-0000000000e1', '2026-10-01', 3000, 'draft');
INSERT INTO public.employee_loans (id, employee_id, total_amount, monthly_installment, start_month) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 6000, 1000, '2026-10-01');

CREATE TEMP TABLE t_ctx ON COMMIT DROP AS
SELECT
  (SELECT net_salary FROM public.payroll WHERE id = '00000000-0000-0000-0000-0000000000p1'::text::uuid) AS net_before,
  (SELECT id FROM public.chart_of_accounts WHERE code = '5101') AS acc_exp,
  (SELECT id FROM public.chart_of_accounts WHERE code = '2101') AS acc_liab,
  (SELECT id FROM public.chart_of_accounts WHERE code = '51')   AS acc_parent;

-- (أ) unbalanced entry cannot be posted
DO $$
DECLARE c t_ctx%ROWTYPE; _je uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  INSERT INTO public.journal_entries (description) VALUES ('unbalanced') RETURNING id INTO _je;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit) VALUES (_je, c.acc_exp, 3000);
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, credit) VALUES (_je, c.acc_liab, 2500);
  BEGIN
    UPDATE public.journal_entries SET status = 'posted' WHERE id = _je;
    INSERT INTO t_results (test, passed, detail) VALUES ('A unbalanced post rejected', false, 'posted!');
  EXCEPTION WHEN others THEN
    INSERT INTO t_results (test, passed, detail) VALUES ('A unbalanced post rejected', true, SQLERRM);
  END;
  BEGIN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (_je, c.acc_exp, 10, 10);
    INSERT INTO t_results (test, passed, detail) VALUES ('A2 line both debit+credit rejected', false, 'inserted!');
  EXCEPTION WHEN others THEN
    INSERT INTO t_results (test, passed, detail) VALUES ('A2 line both debit+credit rejected', true, SQLERRM);
  END;
END $$;

-- (ب) posted entry: no update / delete; (ج) lock + duplicate link + reversal; (و) lock behaviour
DO $$
DECLARE c t_ctx%ROWTYPE; _je uuid; _rev uuid; _je2 uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  INSERT INTO public.journal_entries (description, source, branch_id) VALUES ('payroll 2026-10', 'payroll', '00000000-0000-0000-0000-0000000000b1') RETURNING id INTO _je;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit) VALUES (_je, c.acc_exp, 3000);
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, credit) VALUES (_je, c.acc_liab, 3000);
  UPDATE public.journal_entries SET status = 'posted' WHERE id = _je;
  INSERT INTO t_results (test, passed, detail) VALUES ('B0 balanced entry posts', true, 'ok');

  BEGIN
    UPDATE public.journal_entries SET description = 'edit' WHERE id = _je;
    INSERT INTO t_results (test, passed, detail) VALUES ('B1 update posted entry rejected', false, 'updated!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('B1 update posted entry rejected', true, SQLERRM); END;
  BEGIN
    DELETE FROM public.journal_entries WHERE id = _je;
    INSERT INTO t_results (test, passed, detail) VALUES ('B2 delete posted entry rejected', false, 'deleted!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('B2 delete posted entry rejected', true, SQLERRM); END;
  BEGIN
    UPDATE public.journal_entry_lines SET debit = 1 WHERE journal_entry_id = _je AND debit > 0;
    INSERT INTO t_results (test, passed, detail) VALUES ('B3 update posted line rejected', false, 'updated!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('B3 update posted line rejected', true, SQLERRM); END;
  BEGIN
    DELETE FROM public.journal_entry_lines WHERE journal_entry_id = _je;
    INSERT INTO t_results (test, passed, detail) VALUES ('B4 delete posted line rejected', false, 'deleted!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('B4 delete posted line rejected', true, SQLERRM); END;

  -- lock the month
  INSERT INTO public.payroll_journal_links (payroll_month, branch_id, journal_entry_id) VALUES ('2026-10-01', '00000000-0000-0000-0000-0000000000b1', _je);

  -- (و) locked month
  BEGIN
    UPDATE public.payroll SET base_salary = 5000 WHERE id = '00000000-0000-0000-0000-0000000000p1'::text::uuid;
    INSERT INTO t_results (test, passed, detail) VALUES ('F1 financial update in locked month rejected', false, 'updated!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('F1 financial update in locked month rejected', true, SQLERRM); END;
  BEGIN
    UPDATE public.payroll SET status = 'approved' WHERE id = '00000000-0000-0000-0000-0000000000p1'::text::uuid;
    INSERT INTO t_results (test, passed, detail) VALUES ('F2 status-only update allowed', true, 'ok');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('F2 status-only update allowed', false, SQLERRM); END;
  BEGIN
    UPDATE public.employee_loans SET paid_amount = 1000 WHERE id = '00000000-0000-0000-0000-0000000000a1';
    INSERT INTO t_results (test, passed, detail) VALUES ('F3 paid_amount update allowed', true, 'ok');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('F3 paid_amount update allowed', false, SQLERRM); END;
  BEGIN
    UPDATE public.employee_loans SET monthly_installment = 500 WHERE id = '00000000-0000-0000-0000-0000000000a1';
    INSERT INTO t_results (test, passed, detail) VALUES ('F4 loan terms update rejected', false, 'updated!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('F4 loan terms update rejected', true, SQLERRM); END;
  BEGIN
    INSERT INTO public.payroll_adjustments (employee_id, month, kind, label, amount) VALUES ('00000000-0000-0000-0000-0000000000e1', '2026-10-01', 'addition', 'test add', 100);
    INSERT INTO t_results (test, passed, detail) VALUES ('F5 adjustment in locked month rejected', false, 'inserted!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('F5 adjustment in locked month rejected', true, SQLERRM); END;
  BEGIN
    INSERT INTO public.attendance (employee_id, date, status) VALUES ('00000000-0000-0000-0000-0000000000e1', '2026-10-07', 'present');
    INSERT INTO t_results (test, passed, detail) VALUES ('F6 attendance in locked month rejected', false, 'inserted!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('F6 attendance in locked month rejected', true, SQLERRM); END;

  -- (ج) second active link for same month/branch
  INSERT INTO public.journal_entries (description, source) VALUES ('payroll dup', 'payroll') RETURNING id INTO _je2;
  BEGIN
    INSERT INTO public.payroll_journal_links (payroll_month, branch_id, journal_entry_id) VALUES ('2026-10-01', '00000000-0000-0000-0000-0000000000b1', _je2);
    INSERT INTO t_results (test, passed, detail) VALUES ('C1 second active link rejected', false, 'inserted!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('C1 second active link rejected', true, SQLERRM); END;
  BEGIN
    UPDATE public.payroll_journal_links SET is_reversed = true WHERE journal_entry_id = _je;
    INSERT INTO t_results (test, passed, detail) VALUES ('C2 reverse flag without reversing entry rejected', false, 'updated!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('C2 reverse flag without reversing entry rejected', true, SQLERRM); END;

  -- reversing entry
  INSERT INTO public.journal_entries (description, source, reverses_entry_id) VALUES ('reversal', 'reversal', _je) RETURNING id INTO _rev;
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, credit) VALUES (_rev, c.acc_exp, 3000);
  INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit) VALUES (_rev, c.acc_liab, 3000);
  UPDATE public.journal_entries SET status = 'posted' WHERE id = _rev;
  UPDATE public.payroll_journal_links SET is_reversed = true WHERE journal_entry_id = _je;
  BEGIN
    INSERT INTO public.payroll_journal_links (payroll_month, branch_id, journal_entry_id) VALUES ('2026-10-01', '00000000-0000-0000-0000-0000000000b1', _je2);
    INSERT INTO t_results (test, passed, detail) VALUES ('C3 new link after reversal allowed', true, 'ok');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('C3 new link after reversal allowed', false, SQLERRM); END;
END $$;

-- (د) parent account
DO $$
DECLARE c t_ctx%ROWTYPE; _je uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  INSERT INTO public.journal_entries (description) VALUES ('parent') RETURNING id INTO _je;
  BEGIN
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit) VALUES (_je, c.acc_parent, 100);
    INSERT INTO t_results (test, passed, detail) VALUES ('D parent account line rejected', false, 'inserted!');
  EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('D parent account line rejected', true, SQLERRM); END;
END $$;

-- (ز) net_salary unchanged (3000 base, no absences => 3000)
INSERT INTO t_results (test, passed, detail)
SELECT 'G net_salary unchanged',
       p.net_salary = x.net_before AND p.net_salary = 3000,
       'before=' || x.net_before || ' after=' || p.net_salary
FROM public.payroll p, t_ctx x WHERE p.id = '00000000-0000-0000-0000-0000000000p1'::text::uuid;

-- (هـ) operator and viewer blocked by RLS
INSERT INTO auth.users (id, email, instance_id, aud, role) VALUES
  ('00000000-0000-0000-0000-00000000aa01', 'op_test@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000aa02', 'vw_test@example.invalid', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
UPDATE public.user_roles SET role = 'operator' WHERE user_id = '00000000-0000-0000-0000-00000000aa01';
UPDATE public.users SET branch_id = '00000000-0000-0000-0000-0000000000b1' WHERE id IN ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-00000000aa02');

DO $$
DECLARE _u text; _label text; _cnt int;
BEGIN
  FOREACH _u IN ARRAY ARRAY['00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-00000000aa02'] LOOP
    _label := CASE WHEN _u LIKE '%aa01' THEN 'operator' ELSE 'viewer' END;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _u, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT (SELECT count(*) FROM public.chart_of_accounts) + (SELECT count(*) FROM public.journal_entries)
         + (SELECT count(*) FROM public.payroll_accounting_rules) + (SELECT count(*) FROM public.payroll_journal_links)
      INTO _cnt;
    INSERT INTO t_results (test, passed, detail) VALUES ('E1 ' || _label || ' sees 0 accounting rows', _cnt = 0, 'rows=' || _cnt);
    BEGIN
      INSERT INTO public.journal_entries (description) VALUES ('hack');
      INSERT INTO t_results (test, passed, detail) VALUES ('E2 ' || _label || ' insert rejected', false, 'inserted!');
    EXCEPTION WHEN others THEN INSERT INTO t_results (test, passed, detail) VALUES ('E2 ' || _label || ' insert rejected', true, SQLERRM); END;
    RESET ROLE;
  END LOOP;
END $$;

SELECT n, test, passed, detail FROM t_results ORDER BY n;

ROLLBACK;
