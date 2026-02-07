-- Enable extensions for fuzzy/phonetic matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- GIN index for fast trigram similarity lookups on client names
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm
ON clients USING gin (name gin_trgm_ops);

-- Fuzzy client search function used by voice commands
-- Matches by: exact > contains > trigram similarity > phonetic (soundex/metaphone)
CREATE OR REPLACE FUNCTION search_clients_fuzzy(
    p_user_id uuid,
    p_search_term text,
    p_limit int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    name text,
    email text,
    phone text,
    suburb text,
    match_type text,
    confidence double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_term text := lower(trim(p_search_term));
    v_first_word text := split_part(v_term, ' ', 1);
BEGIN
    RETURN QUERY
    WITH scored AS (
        SELECT
            c.id,
            c.name,
            c.email,
            c.phone,
            c.suburb,
            CASE
                -- Exact match (case-insensitive)
                WHEN lower(c.name) = v_term THEN 'exact'
                -- Contains match (substring)
                WHEN lower(c.name) LIKE '%' || v_term || '%' THEN 'contains'
                -- Trigram similarity (handles typos, spelling variants)
                WHEN similarity(lower(c.name), v_term) >= 0.2 THEN 'similar'
                -- Soundex on first word (handles phonetic variants like Mohammad/Muhammad)
                WHEN soundex(split_part(lower(c.name), ' ', 1)) = soundex(v_first_word) THEN 'phonetic'
                -- Double Metaphone (better for non-English names)
                WHEN dmetaphone(split_part(lower(c.name), ' ', 1)) = dmetaphone(v_first_word) THEN 'metaphone'
                -- Soundex on full name
                WHEN soundex(c.name) = soundex(p_search_term) THEN 'phonetic'
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
    )
    SELECT s.id, s.name, s.email, s.phone, s.suburb, s.match_type, s.confidence
    FROM scored s
    WHERE s.match_type IS NOT NULL
    ORDER BY s.confidence DESC
    LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION search_clients_fuzzy(uuid, text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_clients_fuzzy(uuid, text, int) TO service_role;
