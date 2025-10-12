-- ============================================
-- FIX EMBEDDING DIMENSIONS
-- Problem: Database expects 1536 dims (OpenAI) but Hugging Face uses 384 dims
-- Solution: Recreate embedding column with correct dimensions
-- ============================================

-- Step 1: Drop the existing embedding column and index
DROP INDEX IF EXISTS transcripts_embedding_idx;
ALTER TABLE transcripts DROP COLUMN IF EXISTS embedding;

-- Verify column is dropped
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'transcripts' AND column_name = 'embedding';
-- Expected: 0 rows (column should be gone)

-- Step 2: Recreate embedding column with correct dimensions (384 for Hugging Face)
ALTER TABLE transcripts 
ADD COLUMN embedding vector(384);

-- Verify new column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transcripts' AND column_name = 'embedding';
-- Expected: 1 row showing embedding | USER-DEFINED

-- Step 3: Recreate HNSW index for fast similarity search
CREATE INDEX transcripts_embedding_idx 
ON transcripts 
USING hnsw (embedding vector_cosine_ops);

-- Verify index
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename = 'transcripts' AND indexname = 'transcripts_embedding_idx';
-- Expected: 1 row

-- Step 4: Recreate or verify the search function (with 384 dimensions)
CREATE OR REPLACE FUNCTION search_transcripts_by_similarity(
  query_embedding vector(384),
  org_filter text,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  message text,
  speaker text,
  room_name text,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.message,
    t.speaker,
    t.room_name,
    t.created_at,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM transcripts t
  WHERE 
    t.org_name = LOWER(org_filter)
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 5: Check how many transcripts need re-embedding
SELECT 
  org_name,
  COUNT(*) as total_transcripts,
  COUNT(embedding) as with_embeddings,
  COUNT(*) - COUNT(embedding) as need_embeddings
FROM transcripts
WHERE org_name IS NOT NULL
GROUP BY org_name
ORDER BY org_name;

-- Expected: All transcripts should show need_embeddings > 0

-- ============================================
-- ✅ FIX COMPLETE!
-- ============================================
-- Next steps:
-- 1. Run batch processing to re-embed all transcripts:
--    curl -X POST http://localhost:8002/api/embeddings/batch-process \
--      -H "Content-Type: application/json" \
--      -d '{"orgName": "hero_test", "batchSize": 20}'
-- 
-- 2. Run multiple times until all transcripts are embedded
-- ============================================

