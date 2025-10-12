-- ⚠️ IMPORTANT: Run this SQL in Supabase SQL Editor
-- This adds the org_name column to your tables

-- Step 1: Add org_name to meetings table
ALTER TABLE meetings 
ADD COLUMN org_name VARCHAR(100);

-- Step 2: Add org_name to transcripts table  
ALTER TABLE transcripts 
ADD COLUMN org_name VARCHAR(100);

-- Step 3: Add org_name to meeting_summaries table (if exists)
ALTER TABLE meeting_summaries 
ADD COLUMN org_name VARCHAR(100);

-- Step 4: Create indexes for faster queries
CREATE INDEX idx_meetings_org_name ON meetings(org_name);
CREATE INDEX idx_transcripts_org_name ON transcripts(org_name);
CREATE INDEX idx_meeting_summaries_org_name ON meeting_summaries(org_name);
CREATE INDEX idx_meetings_org_started ON meetings(org_name, started_at DESC);

-- Step 5: Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'meetings' AND column_name = 'org_name';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transcripts' AND column_name = 'org_name';

-- You should see 2 rows returned if successful

