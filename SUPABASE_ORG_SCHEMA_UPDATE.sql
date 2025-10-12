-- Supabase Schema Update for Organization Support
-- Run this SQL in Supabase SQL Editor

-- Step 1: Add org_name column to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS org_name VARCHAR(100);

-- Step 2: Add org_name column to transcripts table
ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS org_name VARCHAR(100);

-- Step 3: Add org_name column to meeting_summaries table (if exists)
ALTER TABLE meeting_summaries 
ADD COLUMN IF NOT EXISTS org_name VARCHAR(100);

-- Step 4: Create index on org_name for faster queries
CREATE INDEX IF NOT EXISTS idx_meetings_org_name ON meetings(org_name);
CREATE INDEX IF NOT EXISTS idx_transcripts_org_name ON transcripts(org_name);
CREATE INDEX IF NOT EXISTS idx_meeting_summaries_org_name ON meeting_summaries(org_name);

-- Step 5: Create index on org_name + started_at for sorted queries
CREATE INDEX IF NOT EXISTS idx_meetings_org_started ON meetings(org_name, started_at DESC);

-- Verification queries (run these to check)
-- SELECT * FROM meetings WHERE org_name = 'ABC inc.' ORDER BY started_at DESC;
-- SELECT * FROM transcripts WHERE org_name = 'ABC inc.' ORDER BY timestamp;

-- Note: Existing meetings will have NULL org_name
-- You can manually update them if needed:
-- UPDATE meetings SET org_name = 'Demo Org' WHERE org_name IS NULL;

