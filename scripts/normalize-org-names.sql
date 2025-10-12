-- Normalize Organization Names to Lowercase
-- Run this in Supabase SQL Editor to update existing data

-- Step 1: Check current org names (optional - for verification)
SELECT DISTINCT org_name, LOWER(org_name) as normalized_name, COUNT(*) as count
FROM meetings
WHERE org_name IS NOT NULL
GROUP BY org_name
ORDER BY org_name;

-- Step 2: Normalize meetings table
UPDATE meetings 
SET org_name = LOWER(org_name) 
WHERE org_name IS NOT NULL;

-- Step 3: Normalize transcripts table
UPDATE transcripts 
SET org_name = LOWER(org_name) 
WHERE org_name IS NOT NULL;

-- Step 4: Verify the changes
SELECT 'Meetings' as table_name, org_name, COUNT(*) as count
FROM meetings
WHERE org_name IS NOT NULL
GROUP BY org_name
UNION ALL
SELECT 'Transcripts' as table_name, org_name, COUNT(*) as count
FROM transcripts
WHERE org_name IS NOT NULL
GROUP BY org_name
ORDER BY table_name, org_name;

-- Expected result: All org names should now be lowercase

