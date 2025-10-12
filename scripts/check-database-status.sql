-- ============================================
-- DATABASE STATUS CHECK
-- Run this FIRST to see what you already have
-- ============================================

-- Step 1: Check if pgvector extension exists
SELECT 
  extname as extension_name,
  extversion as version
FROM pg_extension 
WHERE extname = 'vector';
-- Expected: 1 row if pgvector is installed, 0 rows if not

-- Step 2: Check if meetings table has org_name column
SELECT 
  table_name,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name IN ('id', 'room_name', 'org_name', 'started_at', 'ended_at');
-- Expected: Should show all 5 columns

-- Step 3: Check if transcripts table has org_name AND embedding columns
SELECT 
  table_name,
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'transcripts' 
  AND column_name IN ('id', 'room_name', 'org_name', 'speaker', 'message', 'embedding');
-- Expected: Should show org_name column, may NOT show embedding yet

-- Step 4: Check existing indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename IN ('meetings', 'transcripts')
ORDER BY tablename, indexname;
-- Expected: Should show idx_meetings_org_name, idx_transcripts_org_name, etc.

-- Step 5: Check if search function exists
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'search_transcripts_by_similarity';
-- Expected: 0 rows (function doesn't exist yet)

-- Step 6: Count existing transcripts by org
SELECT 
  org_name,
  COUNT(*) as total_transcripts,
  COUNT(embedding) as with_embeddings,
  COUNT(*) - COUNT(embedding) as need_embeddings
FROM transcripts
GROUP BY org_name
ORDER BY org_name;
-- Expected: Shows your orgs and how many transcripts need embeddings

-- ============================================
-- SUMMARY: What to look for
-- ============================================
-- ✅ pgvector: Should return 0 rows (not installed yet)
-- ✅ org_name in meetings: Should return 1 row
-- ✅ org_name in transcripts: Should return 1 row  
-- ❌ embedding in transcripts: Should return 0 rows (doesn't exist yet)
-- ❌ search function: Should return 0 rows (doesn't exist yet)
-- ============================================

