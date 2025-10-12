-- Debug: Check exact org_name values (including hidden characters)
SELECT 
  org_name,
  LENGTH(org_name) as name_length,
  '"' || org_name || '"' as quoted_name,
  COUNT(*) as count
FROM meetings
WHERE org_name IS NOT NULL
GROUP BY org_name
ORDER BY org_name;

-- Show actual meetings with org_name = 'hero_test'
SELECT 
  id,
  room_name,
  org_name,
  started_at::date as date,
  participant_count
FROM meetings
WHERE org_name = 'hero_test'
ORDER BY started_at DESC;

-- Check for case-sensitive matches
SELECT 
  id,
  room_name,
  org_name,
  started_at::date as date
FROM meetings
WHERE LOWER(org_name) = 'hero_test'
ORDER BY started_at DESC;

