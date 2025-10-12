-- ============================================
-- VECTOR SEARCH SETUP - MINIMAL CHANGES ONLY
-- Run this AFTER checking your database status
-- ============================================

-- This script ONLY adds what's needed for vector search:
-- 1. pgvector extension
-- 2. embedding column (384 dimensions)
-- 3. HNSW index for fast similarity search
-- 4. Search function

-- ============================================
-- Step 1: Enable pgvector extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it was added:
-- You should see: extension_name | version
--                 vector         | 0.7.0 (or similar)
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- ============================================
-- Step 2: Add embedding column to transcripts
-- ============================================
-- Using 384 dimensions for sentence-transformers/all-MiniLM-L6-v2 model
ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Verify it was added:
-- You should see: column_name | data_type
--                 embedding   | USER-DEFINED
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transcripts' AND column_name = 'embedding';

-- ============================================
-- Step 3: Create HNSW index for fast searches
-- ============================================
-- This makes vector similarity searches MUCH faster (50-100x)
-- Using cosine distance (best for semantic similarity)
CREATE INDEX IF NOT EXISTS transcripts_embedding_idx 
ON transcripts 
USING hnsw (embedding vector_cosine_ops);

-- Verify it was created:
-- You should see: indexname | tablename  | indexdef (shows HNSW)
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE tablename = 'transcripts' AND indexname = 'transcripts_embedding_idx';

-- ============================================
-- Step 4: Create similarity search function
-- ============================================
-- This function searches for transcripts similar to a query embedding
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

-- Verify it was created:
-- You should see: function_name | arguments
SELECT proname, pg_get_function_identity_arguments(oid) 
FROM pg_proc 
WHERE proname = 'search_transcripts_by_similarity';

-- ============================================
-- Step 5: Verify Everything Works
-- ============================================

-- Check how many transcripts need embeddings:
SELECT 
  org_name,
  COUNT(*) as total_transcripts,
  COUNT(embedding) as with_embeddings,
  COUNT(*) - COUNT(embedding) as need_embeddings
FROM transcripts
WHERE org_name IS NOT NULL
GROUP BY org_name
ORDER BY org_name;

-- Expected output:
-- org_name   | total_transcripts | with_embeddings | need_embeddings
-- -----------|-------------------|-----------------|----------------
-- hero_test  | 25                | 0               | 25

-- ============================================
-- ✅ SETUP COMPLETE!
-- ============================================
-- Next step: Run the batch processing API to generate embeddings
-- 
-- curl -X POST http://localhost:8002/api/embeddings/batch-process \
--   -H "Content-Type: application/json" \
--   -d '{"orgName": "hero_test", "batchSize": 20}'
-- ============================================

