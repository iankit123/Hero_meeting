import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { meetingId } = req.body;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID is required' });
    }

    console.log(`🗑️ [DELETE] Deleting meeting: ${meetingId}`);

    const success = await supabaseContextService.deleteMeeting(meetingId);

    if (success) {
      console.log(`✅ [DELETE] Meeting deleted successfully: ${meetingId}`);
      res.status(200).json({
        success: true,
        message: 'Meeting deleted successfully',
        meetingId
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete meeting'
      });
    }
  } catch (error) {
    console.error('❌ [DELETE] Error deleting meeting:', error);
    res.status(500).json({ 
      error: 'Failed to delete meeting',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

