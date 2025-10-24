import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMeeting() {
  const roomName = 'meeting-1761208794408';
  
  console.log(`\n🔍 Checking meeting: ${roomName}\n`);
  
  // Check meetings table
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .eq('room_name', roomName)
    .single();
  
  if (meetingError) {
    console.error('❌ Error fetching meeting:', meetingError);
  } else {
    console.log('✅ Meeting found:');
    console.log(JSON.stringify(meeting, null, 2));
  }
  
  // Check transcripts
  const { data: transcripts, error: transcriptsError } = await supabase
    .from('transcripts')
    .select('*')
    .eq('room_name', roomName)
    .limit(5);
  
  if (transcriptsError) {
    console.error('❌ Error fetching transcripts:', transcriptsError);
  } else {
    console.log(`\n✅ Found ${transcripts.length} transcripts:`);
    transcripts.forEach(t => {
      console.log(`  - Speaker: ${t.speaker}, Org: ${t.org_name}, Message: ${t.message.substring(0, 50)}...`);
    });
  }
  
  // Check all meetings for 'soo' org
  const { data: sooMeetings, error: sooError } = await supabase
    .from('meetings')
    .select('*')
    .eq('org_name', 'soo')
    .order('started_at', { ascending: false })
    .limit(10);
  
  if (sooError) {
    console.error('❌ Error fetching soo meetings:', sooError);
  } else {
    console.log(`\n✅ Found ${sooMeetings.length} meetings for 'soo' org:`);
    sooMeetings.forEach(m => {
      console.log(`  - Room: ${m.room_name}, Started: ${m.started_at}`);
    });
  }
}

checkMeeting();

