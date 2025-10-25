-- ============================================
-- ADD FEEDBACK TABLE FOR ORGANIZATIONS
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_name VARCHAR(100) NOT NULL,
  feedback_by VARCHAR(255) NOT NULL,
  feedback_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_org_name ON feedback(org_name);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_org_created ON feedback(org_name, created_at DESC);

-- Step 3: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- Step 5: Verify table was created
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'feedback' 
ORDER BY column_name;

-- Expected output:
-- column_name       | data_type    | is_nullable
-- ------------------|--------------|------------
-- id                | uuid         | NO
-- org_name          | character varying(100) | NO
-- feedback_by       | character varying(255) | NO
-- feedback_text     | text         | NO
-- created_at        | timestamp with time zone | YES
-- updated_at        | timestamp with time zone | YES
