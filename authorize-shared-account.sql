-- Run only in the finance project, after replacing the placeholder UUID.
-- No financial rows are changed. Restrictive policies intersect existing policies.
BEGIN;
DO $$
DECLARE
  shared_uid uuid := 'REPLACE_WITH_SHARED_USER_UID';
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = shared_uid) THEN
    RAISE EXCEPTION 'Shared account not found';
  END IF;
  FOREACH t IN ARRAY ARRAY['debts','debt_payments','debt_history','money_transactions','savings_goals','wishlist_items'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'Missing table or RLS disabled: %', t;
    END IF;
    EXECUTE format('CREATE POLICY perhutangan_shared_account_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT auth.uid()) = %L::uuid) WITH CHECK ((SELECT auth.uid()) = %L::uuid)',t,shared_uid,shared_uid);
    EXECUTE format('CREATE POLICY perhutangan_anon_guard ON public.%I AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)',t);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, PUBLIC',t);
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM authenticated',t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated',t);
    IF t <> 'debt_history' THEN
      EXECUTE format('GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',t);
    END IF;
  END LOOP;
END $$;
COMMIT;
