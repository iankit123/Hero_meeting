-- ============================================
-- ASSIGN NULL ORG NAMES TO hero_test
-- This assigns all transcripts with NULL org_name to hero_test
-- ============================================

-- Step 1: Check which transcripts have NULL org_name
SELECT 
  room_name,
  COUNT(*) as transcript_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM transcripts
WHERE org_name IS NULL
GROUP BY room_name
ORDER BY oldest DESC;

-- Step 2: Assign all NULL org_name to hero_test
UPDATE transcripts 
SET org_name = 'hero_test' 
WHERE org_name IS NULL;

-- Step 3: Verify the update
SELECT 
  org_name,
  COUNT(*) as total_transcripts
FROM transcripts
GROUP BY org_name
ORDER BY org_name;

-- Expected: All transcripts should now have org_name = 'hero_test'
-- NULL row should be gone

-- ============================================
-- ✅ UPDATE COMPLETE!
-- ============================================

