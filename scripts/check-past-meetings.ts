import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPastMeetings() {
  const orgName = 'soo';
  
  console.log(`\n🔍 Checking past meetings for org: "${orgName}"\n`);
  
  // Check meetings table
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('id, room_name, org_name, created_at, summary')
    .ilike('org_name', orgName)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (meetingsError) {
    console.error('❌ Error fetching meetings:', meetingsError);
  } else {
    console.log(`✅ Found ${meetings?.length || 0} meetings:`);
    meetings?.forEach((meeting, idx) => {
      console.log(`\n${idx + 1}. Meeting ID: ${meeting.id}`);
      console.log(`   Room: ${meeting.room_name}`);
      console.log(`   Org: ${meeting.org_name}`);
      console.log(`   Created: ${meeting.created_at}`);
      console.log(`   Summary: ${meeting.summary?.substring(0, 100)}...`);
    });
  }
  
  // Check speech entries
  const { data: speeches, error: speechError } = await supabase
    .from('meeting_speech')
    .select('meeting_id, speaker, speech_text, created_at')
    .ilike('org_name', orgName)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (speechError) {
    console.error('\n❌ Error fetching speech entries:', speechError);
  } else {
    console.log(`\n\n✅ Found ${speeches?.length || 0} speech entries (sample):`);
    speeches?.forEach((speech, idx) => {
      console.log(`\n${idx + 1}. Speaker: ${speech.speaker}`);
      console.log(`   Text: ${speech.speech_text?.substring(0, 80)}...`);
      console.log(`   Created: ${speech.created_at}`);
    });
  }
}

checkPastMeetings().catch(console.error);

