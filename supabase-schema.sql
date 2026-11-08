-- ==========================================
-- FAMILY DEBT TRACKER DATABASE
-- ==========================================

-- TABLE 1: DEBTS

CREATE TABLE IF NOT EXISTS public.debts (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    person TEXT NOT NULL
        CHECK (char_length(person) BETWEEN 1 AND 50),

    name TEXT NOT NULL
        CHECK (char_length(name) BETWEEN 1 AND 80),

    amount NUMERIC(12,2) NOT NULL
        CHECK (amount > 0),

    months INTEGER NOT NULL
        CHECK (months BETWEEN 1 AND 600),

    first_due_date DATE NOT NULL,

    note TEXT DEFAULT ''
        CHECK (char_length(note) <= 160),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);


-- TABLE 2: PAYMENT STATUS

CREATE TABLE IF NOT EXISTS public.debt_payments (

    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    debt_id UUID NOT NULL
        REFERENCES public.debts(id)
        ON DELETE CASCADE,

    due_date DATE NOT NULL,

    paid BOOLEAN NOT NULL DEFAULT FALSE,

    UNIQUE (debt_id, due_date)

);


-- ==========================================
-- ENABLE SECURITY POLICIES
-- ==========================================

ALTER TABLE public.debts
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.debt_payments
ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- DEBT ACCESS
-- ==========================================

CREATE POLICY "Public can view debts"
ON public.debts
FOR SELECT
TO anon, authenticated
USING (true);


CREATE POLICY "Public can add debts"
ON public.debts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);


CREATE POLICY "Public can delete debts"
ON public.debts
FOR DELETE
TO anon, authenticated
USING (true);


-- ==========================================
-- PAYMENT ACCESS
-- ==========================================

CREATE POLICY "Public can view payments"
ON public.debt_payments
FOR SELECT
TO anon, authenticated
USING (true);


CREATE POLICY "Public can add payments"
ON public.debt_payments
FOR INSERT
TO anon, authenticated
WITH CHECK (true);


CREATE POLICY "Public can update payments"
ON public.debt_payments
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);


CREATE POLICY "Public can delete payments"
ON public.debt_payments
FOR DELETE
TO anon, authenticated
USING (true);
