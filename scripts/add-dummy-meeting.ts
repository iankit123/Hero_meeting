import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TranscriptEntry {
  speaker: string;
  participantName: string;
  message: string;
}

const transcript: TranscriptEntry[] = [
  {
    speaker: 'Neha',
    participantName: 'Neha',
    message: "Let's start with a quick look at our current customer acquisition performance. Google and Meta are still our primary drivers, right?"
  },
  {
    speaker: 'Arjun',
    participantName: 'Arjun',
    message: 'Yes, 70% of our traffic is from Meta Ads, around 20% from Google, and the rest is from referrals. Our CAC has gone up to Rs.240 last month, mostly due to higher competition in the Meta ad space.'
  },
  {
    speaker: 'Neha',
    participantName: 'Neha',
    message: "Hmm, that's higher than our target. We need to explore alternate channels soon. Maybe partnerships or community programs?"
  },
  {
    speaker: 'Arjun',
    participantName: 'Arjun',
    message: 'I was thinking we could test YouTube collaborations with educators. There are a lot of creators teaching Bank PO and SSC aspirants.'
  },
  {
    speaker: 'Priya',
    participantName: 'Priya',
    message: 'Right. Influencers already have trust with our target audience — that might reduce our CAC.'
  },
  {
    speaker: 'Neha',
    participantName: 'Neha',
    message: "Let's list possible categories of influencers — education, test prep, and maybe general motivation channels."
  },
  {
    speaker: 'Arjun',
    participantName: 'Arjun',
    message: 'Agreed. We\'ll do a small pilot in October to test influencer reach and engagement.'
  }
];

async function addDummyMeeting() {
  console.log('🚀 Adding dummy meeting...\n');

  try {
    const orgName = 'test';
    const roomName = 'meeting-dummy-' + Date.now();
    const now = new Date();
    const startedAt = new Date(now.getTime() - 45 * 60 * 1000); // 45 minutes ago
    const endedAt = now;

    // Calculate duration
    const durationMinutes = Math.round((endedAt.getTime() - startedAt.getTime()) / (1000 * 60));
    
    // Get unique participants
    const uniqueParticipants = Array.from(new Set(transcript.map(t => t.speaker)));
    const participantCount = uniqueParticipants.length;

    console.log(`📋 Meeting Details:`);
    console.log(`   Room: ${roomName}`);
    console.log(`   Org: ${orgName}`);
    console.log(`   Participants: ${participantCount} (${uniqueParticipants.join(', ')})`);
    console.log(`   Duration: ${durationMinutes} minutes`);
    console.log(`   Started: ${startedAt.toISOString()}`);
    console.log(`   Ended: ${endedAt.toISOString()}\n`);

    // Step 1: Create meeting record
    console.log('📝 Creating meeting record...');
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        room_name: roomName,
        org_name: orgName,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
        participant_count: participantCount
      })
      .select()
      .single();

    if (meetingError) {
      console.error('❌ Error creating meeting:', meetingError);
      throw meetingError;
    }

    console.log(`✅ Created meeting: ${meeting.id}\n`);

    // Step 2: Insert transcripts
    console.log('📝 Inserting transcripts...');
    const transcriptEntries = transcript.map((entry, index) => ({
      meeting_id: meeting.id,
      room_name: roomName,
      org_name: orgName,
      speaker: entry.speaker,
      message: entry.message,
      created_at: new Date(startedAt.getTime() + index * 5 * 60 * 1000).toISOString() // Spread over meeting time
    }));

    const { error: transcriptError } = await supabase
      .from('transcripts')
      .insert(transcriptEntries);

    if (transcriptError) {
      console.error('❌ Error inserting transcripts:', transcriptError);
      throw transcriptError;
    }

    console.log(`✅ Inserted ${transcript.length} transcripts\n`);

    // Summary
    console.log('🎉 Dummy meeting created successfully!\n');
    console.log('Meeting Summary:');
    console.log(`   ID: ${meeting.id}`);
    console.log(`   Room: ${roomName}`);
    console.log(`   Participants: ${uniqueParticipants.join(', ')}`);
    console.log(`   Transcripts: ${transcript.length}`);
    console.log(`   Duration: ${durationMinutes} minutes`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addDummyMeeting();

