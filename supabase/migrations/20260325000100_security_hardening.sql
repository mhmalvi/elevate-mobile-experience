-- ==========================================================================
-- Security hardening migration: storage policies, search_path, fuzzy search,
-- and public invoice field stripping.
-- ==========================================================================

-- ========== 1. Storage bucket INSERT policies: add ownership-path checks =====
-- Any authenticated user could previously write to any path in these buckets.
-- Now INSERT requires the first path segment to match auth.uid().

DROP POLICY IF EXISTS "Authenticated users can upload voice notes" ON storage.objects;
CREATE POLICY "Authenticated users can upload voice notes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-voice-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Authenticated users can upload quote photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload quote photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ========== 2. Fix SECURITY DEFINER functions missing SET search_path ========

-- 2a. increment_usage_if_under_limit — add SECURITY DEFINER + search_path
CREATE OR REPLACE FUNCTION increment_usage_if_under_limit(
  p_user_id UUID,
  p_field TEXT,
  p_limit INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  current_val INTEGER;
BEGIN
  EXECUTE format(
    'UPDATE usage_tracking SET %I = COALESCE(%I, 0) + 1 WHERE user_id = $1 AND COALESCE(%I, 0) < $2 RETURNING %I',
    p_field, p_field, p_field, p_field
  )
  INTO current_val
  USING p_user_id, p_limit;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2b. cleanup_old_webhook_events — add SET search_path
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM webhook_events
  WHERE created_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ========== 3. search_clients_fuzzy: add deleted_at IS NULL filter ============

CREATE OR REPLACE FUNCTION search_clients_fuzzy(
    p_user_id UUID,
    p_search_term TEXT,
    p_limit INT DEFAULT 5
)
RETURNS TABLE(
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    suburb TEXT,
    match_type TEXT,
    confidence FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_term TEXT;
    v_first_word TEXT;
BEGIN
    v_term := lower(trim(p_search_term));
    v_first_word := split_part(v_term, ' ', 1);

    IF length(v_term) < 2 THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH scored AS (
        SELECT
            c.id,
            c.name,
            c.email,
            c.phone,
            c.suburb,
            CASE
                WHEN lower(c.name) = v_term THEN 'exact'
                WHEN lower(c.name) LIKE '%' || v_term || '%' THEN 'contains'
                WHEN similarity(lower(c.name), v_term) >= 0.2 THEN 'similar'
                WHEN soundex(split_part(lower(c.name), ' ', 1)) = soundex(v_first_word) THEN 'phonetic'
                WHEN dmetaphone(split_part(lower(c.name), ' ', 1)) = dmetaphone(v_first_word) THEN 'metaphone'
                WHEN soundex(c.name) = soundex(p_search_term) THEN 'soundex_full'
                ELSE NULL
            END::text AS match_type,
            CASE
                WHEN lower(c.name) = v_term THEN 1.0
                WHEN lower(c.name) LIKE '%' || v_term || '%' THEN 0.85
                WHEN similarity(lower(c.name), v_term) >= 0.2
                    THEN (0.3 + similarity(lower(c.name), v_term)::double precision * 0.5)
                WHEN soundex(split_part(lower(c.name), ' ', 1)) = soundex(v_first_word) THEN 0.6
                WHEN dmetaphone(split_part(lower(c.name), ' ', 1)) = dmetaphone(v_first_word) THEN 0.5
                WHEN soundex(c.name) = soundex(p_search_term) THEN 0.45
                ELSE 0.0
            END::double precision AS confidence
        FROM clients c
        WHERE c.user_id = p_user_id
          AND c.deleted_at IS NULL  -- FIX: exclude soft-deleted clients
    )
    SELECT s.id, s.name, s.email, s.phone, s.suburb, s.match_type, s.confidence
    FROM scored s
    WHERE s.match_type IS NOT NULL
    ORDER BY s.confidence DESC
    LIMIT p_limit;
END;
$$;

-- ========== 4. get_public_invoice: strip internal fields from response ========

CREATE OR REPLACE FUNCTION get_public_invoice(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- Fetch the invoice row by token, stripping internal fields from the public payload
    SELECT
        to_jsonb(i)
            - 'user_id'
            - 'team_id'
            - 'xero_invoice_id'
            - 'qb_invoice_id'
            - 'xero_sync_error'
            - 'qb_sync_error'
            - 'last_synced_to_xero'
            - 'last_synced_to_qb'
            - 'stripe_payment_link'
            - 'parent_invoice_id'
            - 'is_recurring'
            - 'recurring_interval'
            - 'next_due_date',
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
        SELECT jsonb_build_object(
            'name',     c.name,
            'email',    c.email,
            'phone',    c.phone,
            'address',  c.address,
            'suburb',   c.suburb,
            'state',    c.state,
            'postcode', c.postcode
        )
        INTO v_client
        FROM public.clients c
        WHERE c.id = v_client_id
          AND c.deleted_at IS NULL
        LIMIT 1;
    END IF;

    -- Fetch profile (public business details only)
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

    -- Fetch branding settings (strip user_id)
    SELECT to_jsonb(b) - 'user_id' - 'id'
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

-- ========== 5. get_public_quote: strip internal fields from response =========

CREATE OR REPLACE FUNCTION public.get_public_quote(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    -- Fetch the quote row by token, stripping internal fields
    SELECT
        to_jsonb(q)
            - 'user_id'
            - 'team_id'
            - 'xero_invoice_id'
            - 'qb_invoice_id'
            - 'xero_sync_error'
            - 'qb_sync_error'
            - 'last_synced_to_xero'
            - 'last_synced_to_qb',
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

    -- Fetch client (only public-facing fields)
    IF v_client_id IS NOT NULL THEN
        SELECT jsonb_build_object(
            'name',     c.name,
            'email',    c.email,
            'phone',    c.phone,
            'address',  c.address,
            'suburb',   c.suburb,
            'state',    c.state,
            'postcode', c.postcode
        )
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

    -- Fetch branding settings (strip internal fields)
    SELECT to_jsonb(b) - 'user_id' - 'id'
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
