import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    console.log(`🏁 [END-MEETING] Ending meeting: ${roomName}`);

    await supabaseContextService.endMeeting(roomName);

    console.log(`✅ [END-MEETING] Meeting ended successfully: ${roomName}`);

    res.status(200).json({ 
      success: true, 
      message: 'Meeting ended successfully',
      roomName 
    });
  } catch (error) {
    console.error('❌ [END-MEETING] Error ending meeting:', error);
    res.status(500).json({ 
      error: 'Failed to end meeting',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

