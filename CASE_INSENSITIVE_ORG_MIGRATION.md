# Case-Insensitive Organization Names - Migration Guide

## Overview
Organization names are now case-insensitive. "hero_test", "Hero_test", and "HERO_TEST" are treated as the same organization.

## Changes Made

### 1. Frontend Storage
- **OrgEntry.tsx**: Now stores both:
  - `hero_meeting_org`: Normalized lowercase version (used for queries)
  - `hero_meeting_org_display`: Original case (used for display)

### 2. Frontend Display
- **Dashboard.tsx**: Displays original case but queries with lowercase

### 3. Database Storage
All org names are now stored in **lowercase** in Supabase:
- `meetings.org_name`: Normalized to lowercase
- `transcripts.org_name`: Normalized to lowercase

### 4. Database Queries
- **getMeetingsByOrg()**: Normalizes input to lowercase before querying
- **startMeeting()**: Normalizes org name before inserting
- **addTranscript()**: Normalizes org name before inserting

## Migration Steps for Existing Data

If you have existing meetings with mixed-case org names in Supabase, run this SQL:

```sql
-- Normalize all existing org names to lowercase
UPDATE meetings 
SET org_name = LOWER(org_name) 
WHERE org_name IS NOT NULL;

UPDATE transcripts 
SET org_name = LOWER(org_name) 
WHERE org_name IS NOT NULL;
```

## Testing

### Test Case 1: New Organization
1. Enter "Hero_Test" as org name
2. Create a meeting
3. Check dashboard - should show "Hero_Test" (original case)
4. Check database - should store "hero_test" (lowercase)

### Test Case 2: Case Variations
1. Create meetings with org names: "ABC_Corp", "abc_corp", "ABC_CORP"
2. All should appear under the same organization
3. Past meetings should show all three meetings

### Test Case 3: Switching Organizations
1. Switch from "Hero_Test" to "hero_test"
2. Should see the same past meetings
3. Display name may change based on last entry

## Backward Compatibility

✅ **Old users**: When they next log in, their org name will be normalized
✅ **Existing meetings**: Will be queryable once SQL migration is run
✅ **New meetings**: Automatically stored in lowercase

## Benefits

1. ✅ No duplicate organizations due to case differences
2. ✅ Better user experience (case doesn't matter)
3. ✅ Cleaner data organization
4. ✅ Easier to manage multi-tenant system

## Notes

- Original case is preserved in `localStorage` for display purposes
- All database operations use lowercase for consistency
- Case normalization happens at the boundary (input/storage)
- Display layer shows original user input

---

**Last Updated**: October 12, 2025  
**Status**: ✅ Implemented

