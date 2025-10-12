import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 50;

    console.log(`📋 [LIST] Fetching meetings (limit: ${limitNum})`);

    const meetings = await supabaseContextService.getAllMeetings(limitNum);

    console.log(`✅ [LIST] Retrieved ${meetings.length} meetings`);

    res.status(200).json({
      success: true,
      meetings,
      count: meetings.length
    });
  } catch (error) {
    console.error('❌ [LIST] Error fetching meetings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch meetings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

