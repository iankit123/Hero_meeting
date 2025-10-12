-- ============================================
-- ADD SUMMARY AND HYBRID SEARCH SUPPORT
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Add summary column to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Step 2: Add summary_embedding column for hybrid search
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS summary_embedding vector(384);

-- Step 3: Create index for fast summary search
CREATE INDEX IF NOT EXISTS meetings_summary_embedding_idx 
ON meetings 
USING hnsw (summary_embedding vector_cosine_ops);

-- Step 4: Create index for finding meetings without summaries (optimization)
CREATE INDEX IF NOT EXISTS idx_meetings_summary_null 
ON meetings(org_name, started_at DESC) 
WHERE summary IS NULL;

-- Step 5: Create hybrid search function (searches summaries first)
CREATE OR REPLACE FUNCTION search_meeting_summaries_by_similarity(
  query_embedding vector(384),
  org_filter text,
  match_threshold float DEFAULT 0.4,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  room_name text,
  summary text,
  started_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.room_name,
    m.summary,
    m.started_at,
    1 - (m.summary_embedding <=> query_embedding) as similarity
  FROM meetings m
  WHERE 
    m.org_name = LOWER(org_filter)
    AND m.summary_embedding IS NOT NULL
    AND m.summary IS NOT NULL
    AND 1 - (m.summary_embedding <=> query_embedding) > match_threshold
  ORDER BY m.summary_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 6: Verify columns were added
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name IN ('summary', 'summary_embedding')
ORDER BY column_name;

-- Expected output:
-- column_name       | data_type    | is_nullable
-- ------------------|--------------|------------
-- summary           | text         | YES
-- summary_embedding | USER-DEFINED | YES

-- Step 7: Verify indexes were created
SELECT 
  indexname, 
  tablename
FROM pg_indexes 
WHERE tablename = 'meetings' 
  AND indexname IN ('meetings_summary_embedding_idx', 'idx_meetings_summary_null')
ORDER BY indexname;

-- Expected: 2 rows showing both indexes

-- Step 8: Verify search function was created
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'search_meeting_summaries_by_similarity';

-- Expected: 1 row showing the function

-- Step 9: Check how many meetings need summaries
SELECT 
  org_name,
  COUNT(*) as total_meetings,
  COUNT(summary) as with_summaries,
  COUNT(*) - COUNT(summary) as need_summaries
FROM meetings
WHERE org_name IS NOT NULL
GROUP BY org_name
ORDER BY org_name;

-- Expected: Shows breakdown per org

-- ============================================
-- ✅ SETUP COMPLETE!
-- ============================================
-- Next steps:
-- 1. Dashboard will auto-trigger summary generation on next org login
-- 2. Summaries will be generated with embeddings
-- 3. Hybrid search will use summaries first, then drill down to transcripts
-- ============================================

