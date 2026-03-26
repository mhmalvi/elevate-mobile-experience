-- SEC-H1 / DB-C1: Tighten anon RLS on invoices and quotes.
-- Replace USING(true) anon policies with SECURITY DEFINER RPC functions.
--
-- THE FLAW IN THE PRIOR APPROACH:
-- Using `USING (public_token IS NOT NULL)` is always true because public_token
-- has DEFAULT gen_random_uuid(), so every row satisfies the predicate. An anon
-- user could call .from('invoices').select('*') and read the entire table.
--
-- THE CORRECT APPROACH:
-- 1. Add public_token columns (unchanged).
-- 2. Set anon direct-table SELECT to USING (false) — no direct table access.
-- 3. Create SECURITY DEFINER functions that accept a token argument and return
--    exactly the row (plus related data) that matches. The function executes as
--    its owner (postgres), bypasses RLS internally, and enforces the token match
--    in a WHERE clause that cannot be bypassed by the caller.
-- 4. Grant EXECUTE on those functions to the anon role.
-- 5. Frontend calls .rpc('get_public_invoice', { p_token }) instead of
--    .from('invoices').eq('public_token', ...).
--
-- ROLLBACK: See bottom of file.

BEGIN;

-- ==========================================================================
-- STEP 1: Add public_token columns
-- ==========================================================================

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();
ALTER TABLE public.quotes   ADD COLUMN IF NOT EXISTS public_token UUID DEFAULT gen_random_uuid();

-- Ensure no existing row has a NULL token (back-fill any that slipped through)
UPDATE public.invoices SET public_token = gen_random_uuid() WHERE public_token IS NULL;
UPDATE public.quotes   SET public_token = gen_random_uuid() WHERE public_token IS NULL;

-- Lock the columns to NOT NULL now that every row has a value
ALTER TABLE public.invoices ALTER COLUMN public_token SET NOT NULL;
ALTER TABLE public.quotes   ALTER COLUMN public_token SET NOT NULL;

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_invoices_public_token ON public.invoices(public_token);
CREATE INDEX IF NOT EXISTS idx_quotes_public_token   ON public.quotes(public_token);

-- ==========================================================================
-- STEP 2: Lock down anon direct SELECT on all four tables
-- ==========================================================================
-- Anon users must go through the RPC functions below. Direct table access
-- is denied via USING (false) so PostgREST returns 0 rows regardless of any
-- filter the client supplies.

DROP POLICY IF EXISTS invoices_anon_select          ON public.invoices;
DROP POLICY IF EXISTS quotes_anon_select            ON public.quotes;
DROP POLICY IF EXISTS invoice_line_items_anon_select ON public.invoice_line_items;
DROP POLICY IF EXISTS quote_line_items_anon_select  ON public.quote_line_items;

CREATE POLICY invoices_anon_select ON public.invoices
    FOR SELECT TO anon
    USING (false);

CREATE POLICY quotes_anon_select ON public.quotes
    FOR SELECT TO anon
    USING (false);

CREATE POLICY invoice_line_items_anon_select ON public.invoice_line_items
    FOR SELECT TO anon
    USING (false);

CREATE POLICY quote_line_items_anon_select ON public.quote_line_items
    FOR SELECT TO anon
    USING (false);

-- ==========================================================================
-- STEP 3: SECURITY DEFINER function — get_public_invoice(p_token uuid)
-- ==========================================================================
-- Returns a JSON object containing the invoice, its line items, the owner's
-- profile, and branding settings. Returns NULL when the token does not match
-- any row (caller sees a null result, not an error exposing row existence).
--
-- SECURITY DEFINER + search_path = '' prevents search-path hijacking.

CREATE OR REPLACE FUNCTION public.get_public_invoice(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_invoice       jsonb;
    v_line_items    jsonb;
    v_profile       jsonb;
    v_branding      jsonb;
    v_client        jsonb;
    v_invoice_id    uuid;
    v_user_id       uuid;
    v_client_id     uuid;
BEGIN
    -- Fetch the invoice row by token. Use explicit schema qualification.
    SELECT
        to_jsonb(i) - 'user_id',   -- omit user_id from the public payload
        i.id,
        i.user_id,
        i.client_id
    INTO v_invoice, v_invoice_id, v_user_id, v_client_id
    FROM public.invoices i
    WHERE i.public_token = p_token
      AND i.deleted_at IS NULL
    LIMIT 1;

    -- Token did not match any live invoice
    IF v_invoice_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Fetch line items
    SELECT COALESCE(jsonb_agg(to_jsonb(li) ORDER BY li.sort_order), '[]'::jsonb)
    INTO v_line_items
    FROM public.invoice_line_items li
    WHERE li.invoice_id = v_invoice_id;

    -- Fetch client (only the fields the public page needs)
    IF v_client_id IS NOT NULL THEN
        SELECT to_jsonb(c)
        INTO v_client
        FROM public.clients c
        WHERE c.id = v_client_id
          AND c.deleted_at IS NULL
        LIMIT 1;
    END IF;

    -- Fetch profile (public business details only — no internal fields)
    SELECT jsonb_build_object(
        'business_name',      p.business_name,
        'address',            p.address,
        'phone',              p.phone,
        'email',              p.email,
        'abn',                p.abn,
        'logo_url',           p.logo_url,
        'bank_name',          p.bank_name,
        'bank_bsb',           p.bank_bsb,
        'bank_account_name',  p.bank_account_name,
        'bank_account_number',p.bank_account_number
    )
    INTO v_profile
    FROM public.profiles p
    WHERE p.user_id = v_user_id
    LIMIT 1;

    -- Fetch branding settings
    SELECT to_jsonb(b)
    INTO v_branding
    FROM public.branding_settings b
    WHERE b.user_id = v_user_id
    LIMIT 1;

    RETURN jsonb_build_object(
        'invoice',    v_invoice || jsonb_build_object('clients', v_client),
        'line_items', v_line_items,
        'profile',    v_profile,
        'branding',   v_branding
    );
END;
$$;

-- ==========================================================================
-- STEP 4: SECURITY DEFINER function — get_public_quote(p_token uuid)
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_public_quote(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_quote         jsonb;
    v_line_items    jsonb;
    v_profile       jsonb;
    v_branding      jsonb;
    v_client        jsonb;
    v_quote_id      uuid;
    v_user_id       uuid;
    v_client_id     uuid;
BEGIN
    -- Fetch the quote row by token
    SELECT
        to_jsonb(q) - 'user_id',
        q.id,
        q.user_id,
        q.client_id
    INTO v_quote, v_quote_id, v_user_id, v_client_id
    FROM public.quotes q
    WHERE q.public_token = p_token
      AND q.deleted_at IS NULL
    LIMIT 1;

    IF v_quote_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Fetch line items
    SELECT COALESCE(jsonb_agg(to_jsonb(li) ORDER BY li.sort_order), '[]'::jsonb)
    INTO v_line_items
    FROM public.quote_line_items li
    WHERE li.quote_id = v_quote_id;

    -- Fetch client
    IF v_client_id IS NOT NULL THEN
        SELECT to_jsonb(c)
        INTO v_client
        FROM public.clients c
        WHERE c.id = v_client_id
          AND c.deleted_at IS NULL
        LIMIT 1;
    END IF;

    -- Fetch profile (public business details only)
    SELECT jsonb_build_object(
        'business_name', p.business_name,
        'address',       p.address,
        'phone',         p.phone,
        'email',         p.email,
        'abn',           p.abn,
        'logo_url',      p.logo_url
    )
    INTO v_profile
    FROM public.profiles p
    WHERE p.user_id = v_user_id
    LIMIT 1;

    -- Fetch branding settings
    SELECT to_jsonb(b)
    INTO v_branding
    FROM public.branding_settings b
    WHERE b.user_id = v_user_id
    LIMIT 1;

    RETURN jsonb_build_object(
        'quote',      v_quote || jsonb_build_object('clients', v_client),
        'line_items', v_line_items,
        'profile',    v_profile,
        'branding',   v_branding
    );
END;
$$;

-- ==========================================================================
-- STEP 5: Grant EXECUTE to anon and authenticated
-- ==========================================================================
-- Revoke public EXECUTE first (SECURITY DEFINER functions default to public),
-- then grant explicitly to only the roles that need it.

REVOKE ALL ON FUNCTION public.get_public_invoice(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_quote(uuid)   FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_invoice(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_quote(uuid)   TO anon, authenticated;

-- ==========================================================================
-- STEP 6: Verification
-- ==========================================================================

DO $$
DECLARE
    v_count integer;
BEGIN
    -- Confirm anon policies on invoices are now USING (false)
    SELECT COUNT(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'invoices'
      AND policyname = 'invoices_anon_select'
      AND qual = 'false';

    IF v_count = 0 THEN
        RAISE WARNING 'FAIL: invoices_anon_select is not USING (false)!';
    ELSE
        RAISE NOTICE 'OK: invoices_anon_select is locked to USING (false)';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quotes'
      AND policyname = 'quotes_anon_select'
      AND qual = 'false';

    IF v_count = 0 THEN
        RAISE WARNING 'FAIL: quotes_anon_select is not USING (false)!';
    ELSE
        RAISE NOTICE 'OK: quotes_anon_select is locked to USING (false)';
    END IF;

    -- Confirm RPC functions exist
    SELECT COUNT(*) INTO v_count
    FROM pg_proc
    WHERE proname IN ('get_public_invoice', 'get_public_quote')
      AND pronamespace = 'public'::regnamespace;

    IF v_count < 2 THEN
        RAISE WARNING 'FAIL: one or both public RPC functions are missing!';
    ELSE
        RAISE NOTICE 'OK: get_public_invoice and get_public_quote functions exist';
    END IF;
END;
$$;

COMMIT;

-- ==========================================================================
-- ROLLBACK SCRIPT (run manually if this migration needs to be reverted)
-- ==========================================================================
-- BEGIN;
--
-- DROP FUNCTION IF EXISTS public.get_public_invoice(uuid);
-- DROP FUNCTION IF EXISTS public.get_public_quote(uuid);
--
-- DROP POLICY IF EXISTS invoices_anon_select           ON public.invoices;
-- DROP POLICY IF EXISTS quotes_anon_select             ON public.quotes;
-- DROP POLICY IF EXISTS invoice_line_items_anon_select ON public.invoice_line_items;
-- DROP POLICY IF EXISTS quote_line_items_anon_select   ON public.quote_line_items;
--
-- -- Restore the prior (flawed) policies for continuity
-- CREATE POLICY invoices_anon_select ON public.invoices
--     FOR SELECT TO anon USING (public_token IS NOT NULL);
-- CREATE POLICY quotes_anon_select ON public.quotes
--     FOR SELECT TO anon USING (public_token IS NOT NULL);
-- CREATE POLICY invoice_line_items_anon_select ON public.invoice_line_items
--     FOR SELECT TO anon USING (
--         EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_id AND public_token IS NOT NULL));
-- CREATE POLICY quote_line_items_anon_select ON public.quote_line_items
--     FOR SELECT TO anon USING (
--         EXISTS (SELECT 1 FROM public.quotes WHERE id = quote_id AND public_token IS NOT NULL));
--
-- ALTER TABLE public.invoices ALTER COLUMN public_token DROP NOT NULL;
-- ALTER TABLE public.quotes   ALTER COLUMN public_token DROP NOT NULL;
--
-- COMMIT;
