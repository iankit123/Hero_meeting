const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAndReimport() {
  try {
    const orgName = 'Hero_test';
    const roomName = 'meeting-payment-failures-sept-20-2025';
    const meetingDate = new Date('2025-09-20T10:00:00Z');
    
    console.log('🗑️ [DELETE] Deleting old meeting...');
    
    // Delete the old meeting (this will cascade delete transcripts if any)
    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('room_name', roomName);

    if (deleteError) {
      console.error('❌ [DELETE] Error:', deleteError);
    } else {
      console.log('✅ [DELETE] Old meeting deleted');
    }
    
    console.log('\n📋 [IMPORT] Creating new meeting...');
    
    // 1. Create a meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        room_name: roomName,
        started_at: meetingDate.toISOString(),
        org_name: orgName,
        participant_count: 2,
        ended_at: new Date(meetingDate.getTime() + 180000).toISOString(), // 3 minutes later
        duration_minutes: 3
      })
      .select()
      .single();

    if (meetingError) {
      console.error('❌ [IMPORT] Error creating meeting:', meetingError);
      return;
    }

    console.log(`✅ [IMPORT] Meeting created: ${meeting.id}`);

    // 2. Create transcript entries from the meeting
    const transcripts = [
      {
        meeting_id: meeting.id,
        room_name: roomName,
        speaker: 'Matt-2025sept',
        message: "Hey Tom, I've noticed some payment failures in our dashboard over the last few days. The success rate dropped from 96% to around 82%.",
        timestamp: new Date(meetingDate.getTime() + 1000).toISOString(),
        org_name: orgName
      },
      {
        meeting_id: meeting.id,
        room_name: roomName,
        speaker: 'Tom-2025sept',
        message: "Yeah, I checked this too. It seems to be happening mostly with credit card payments, especially through one of our gateways.",
        timestamp: new Date(meetingDate.getTime() + 30000).toISOString(),
        org_name: orgName
      },
      {
        meeting_id: meeting.id,
        room_name: roomName,
        speaker: 'Matt-2025sept',
        message: "That could explain why overall conversions dipped. If payments are failing at the last step, users might be abandoning before completion.",
        timestamp: new Date(meetingDate.getTime() + 60000).toISOString(),
        org_name: orgName
      },
      {
        meeting_id: meeting.id,
        room_name: roomName,
        speaker: 'Tom-2025sept',
        message: "Exactly. We'll need to check with the payment provider's API logs. Maybe a timeout or validation issue.",
        timestamp: new Date(meetingDate.getTime() + 90000).toISOString(),
        org_name: orgName
      },
      {
        meeting_id: meeting.id,
        room_name: roomName,
        speaker: 'Matt-2025sept',
        message: "Let's flag this in the metrics and track recovery over the next few days. If this continues, we should consider fallback routing for that provider.",
        timestamp: new Date(meetingDate.getTime() + 120000).toISOString(),
        org_name: orgName
      },
      {
        meeting_id: meeting.id,
        room_name: roomName,
        speaker: 'system',
        message: "Summary: Payment failures with one gateway caused drop-offs in final purchase stage. Team will review logs and track success rate improvements.",
        timestamp: new Date(meetingDate.getTime() + 150000).toISOString(),
        org_name: orgName
      }
    ];

    // 3. Insert all transcripts
    const { data: insertedTranscripts, error: transcriptError } = await supabase
      .from('transcripts')
      .insert(transcripts)
      .select();

    if (transcriptError) {
      console.error('❌ [IMPORT] Error creating transcripts:', transcriptError);
      return;
    }

    console.log(`✅ [IMPORT] ${insertedTranscripts.length} transcripts created`);
    console.log('🎉 [IMPORT] Previous meeting imported successfully!');
    console.log(`📊 [IMPORT] Meeting ID: ${meeting.id}`);
    console.log(`🏢 [IMPORT] Organization: ${orgName}`);
    console.log(`📅 [IMPORT] Date: ${meetingDate.toISOString()}`);
    
  } catch (error) {
    console.error('❌ [IMPORT] Error:', error);
  }
}

// Run the import
deleteAndReimport()
  .then(() => {
    console.log('\n✅ Import complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });

