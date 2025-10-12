import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName } = req.query;

    if (!roomName || typeof roomName !== 'string') {
      return res.status(400).json({ error: 'Room name is required' });
    }

    console.log(`📤 [EXPORT] Exporting transcript for room: ${roomName}`);

    const transcriptJSON = await supabaseContextService.getMeetingTranscriptJSON(roomName);

    console.log(`✅ [EXPORT] Transcript exported successfully - ${transcriptJSON.transcripts.length} messages`);

    res.status(200).json(transcriptJSON);
  } catch (error) {
    console.error('❌ [EXPORT] Error exporting transcript:', error);
    res.status(500).json({ 
      error: 'Failed to export transcript',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

