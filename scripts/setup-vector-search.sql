-- ============================================
-- Hugging Face Vector Search Setup for Supabase
-- ============================================
-- Run this in your Supabase SQL Editor

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to transcripts table
-- Using 384 dimensions for sentence-transformers/all-MiniLM-L6-v2
ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS embedding vector(384);

-- Step 3: Create HNSW index for fast similarity search
-- This dramatically speeds up vector similarity queries
CREATE INDEX IF NOT EXISTS transcripts_embedding_idx 
ON transcripts 
USING hnsw (embedding vector_cosine_ops);

-- Step 4: Create similarity search function
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

-- Step 5: Verify setup
-- Check if column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transcripts' AND column_name = 'embedding';

-- Check if index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'transcripts' AND indexname = 'transcripts_embedding_idx';

-- Check if function was created
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'search_transcripts_by_similarity';

-- Step 6: Check how many transcripts need embeddings
SELECT 
  org_name,
  COUNT(*) as total_transcripts,
  COUNT(embedding) as with_embeddings,
  COUNT(*) - COUNT(embedding) as need_embeddings
FROM transcripts
GROUP BY org_name
ORDER BY org_name;

-- ============================================
-- Setup Complete! 
-- Next: Run the batch processing API to generate embeddings
-- ============================================

