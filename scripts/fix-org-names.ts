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

async function fixOrgNames() {
  console.log('\n🔍 Finding meetings with null org_name but transcripts with org_name...\n');
  
  // Get all meetings with null org_name
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('*')
    .is('org_name', null);
  
  if (meetingsError) {
    console.error('❌ Error fetching meetings:', meetingsError);
    return;
  }
  
  console.log(`📊 Found ${meetings.length} meetings with null org_name\n`);
  
  // For each meeting, check transcripts to get org_name
  for (const meeting of meetings) {
    const { data: transcripts, error: transcriptsError } = await supabase
      .from('transcripts')
      .select('org_name')
      .eq('room_name', meeting.room_name)
      .limit(1);
    
    if (transcriptsError) {
      console.error(`❌ Error fetching transcripts for ${meeting.room_name}:`, transcriptsError);
      continue;
    }
    
    if (transcripts && transcripts.length > 0 && transcripts[0].org_name) {
      const orgName = transcripts[0].org_name.toLowerCase();
      console.log(`Updating meeting ${meeting.room_name} with org_name: ${orgName}`);
      
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ org_name: orgName })
        .eq('id', meeting.id);
      
      if (updateError) {
        console.error(`❌ Error updating meeting ${meeting.room_name}:`, updateError);
      } else {
        console.log(`✅ Updated meeting ${meeting.room_name}\n`);
      }
    }
  }
  
  console.log('\n✅ Done!');
}

fixOrgNames();

