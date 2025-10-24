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

async function fixMissingMeetings() {
  console.log('\n🔍 Checking for transcripts without corresponding meetings...\n');
  
  // Get all unique room_names from transcripts
  const { data: transcripts, error: transcriptsError } = await supabase
    .from('transcripts')
    .select('room_name, org_name, timestamp, created_at')
    .order('created_at', { ascending: true });
  
  if (transcriptsError) {
    console.error('❌ Error fetching transcripts:', transcriptsError);
    return;
  }
  
  console.log(`📊 Found ${transcripts.length} transcripts`);
  
  // Group by room_name
  const roomsByTranscripts = new Map<string, any[]>();
  transcripts.forEach(t => {
    if (!roomsByTranscripts.has(t.room_name)) {
      roomsByTranscripts.set(t.room_name, []);
    }
    roomsByTranscripts.get(t.room_name)!.push(t);
  });
  
  console.log(`📊 Found ${roomsByTranscripts.size} unique rooms in transcripts\n`);
  
  // Check which rooms don't have meetings
  const { data: meetings, error: meetingsError } = await supabase
    .from('meetings')
    .select('room_name');
  
  if (meetingsError) {
    console.error('❌ Error fetching meetings:', meetingsError);
    return;
  }
  
  const existingRoomNames = new Set(meetings.map(m => m.room_name));
  console.log(`📊 Found ${existingRoomNames.size} existing meetings\n`);
  
  // Find missing meetings
  const missingRooms: string[] = [];
  roomsByTranscripts.forEach((transcripts, roomName) => {
    if (!existingRoomNames.has(roomName)) {
      missingRooms.push(roomName);
    }
  });
  
  console.log(`⚠️ Found ${missingRooms.length} rooms with transcripts but no meeting record:\n`);
  
  if (missingRooms.length === 0) {
    console.log('✅ No missing meetings found!');
    return;
  }
  
  // Create missing meetings
  for (const roomName of missingRooms) {
    const roomTranscripts = roomsByTranscripts.get(roomName)!;
    const firstTranscript = roomTranscripts[0];
    const lastTranscript = roomTranscripts[roomTranscripts.length - 1];
    
    // Get org_name from first transcript
    const orgName = firstTranscript.org_name || null;
    
    // Calculate participant count from unique speakers
    const uniqueSpeakers = new Set(roomTranscripts.map(t => t.speaker));
    const participantCount = uniqueSpeakers.size;
    
    // Calculate duration
    const startTime = new Date(firstTranscript.created_at);
    const endTime = new Date(lastTranscript.created_at);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    console.log(`Creating meeting for room: ${roomName}`);
    console.log(`  - Org: ${orgName}`);
    console.log(`  - Participants: ${participantCount}`);
    console.log(`  - Duration: ${durationMinutes} minutes`);
    console.log(`  - Transcripts: ${roomTranscripts.length}`);
    
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        room_name: roomName,
        org_name: orgName,
        started_at: firstTranscript.created_at,
        ended_at: lastTranscript.created_at,
        participant_count: participantCount,
        duration_minutes: durationMinutes
      })
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Error creating meeting for ${roomName}:`, error);
    } else {
      console.log(`✅ Created meeting: ${data.id}\n`);
    }
  }
  
  console.log('\n✅ Done!');
}

fixMissingMeetings();

