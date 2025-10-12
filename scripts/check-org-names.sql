-- Check what org names actually exist in the database
SELECT 
  DISTINCT org_name,
  COUNT(*) as meeting_count
FROM meetings
GROUP BY org_name
ORDER BY org_name;

-- Also check transcripts
SELECT 
  DISTINCT org_name,
  COUNT(*) as transcript_count
FROM transcripts
GROUP BY org_name
ORDER BY org_name;

-- Check if there are meetings without org_name
SELECT 
  COUNT(*) as meetings_without_org
FROM meetings
WHERE org_name IS NULL;

