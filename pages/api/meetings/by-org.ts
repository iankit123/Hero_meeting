import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgName, limit } = req.query;

    if (!orgName || typeof orgName !== 'string') {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const limitNum = limit ? parseInt(limit as string) : 50;

    console.log(`📋 [BY-ORG] Fetching meetings for org: ${orgName} (limit: ${limitNum})`);

    const meetings = await supabaseContextService.getMeetingsByOrg(orgName, limitNum);

    console.log(`✅ [BY-ORG] Retrieved ${meetings.length} meetings for org: ${orgName}`);

    res.status(200).json({
      success: true,
      meetings,
      count: meetings.length,
      orgName
    });
  } catch (error) {
    console.error('❌ [BY-ORG] Error fetching meetings by org:', error);
    res.status(500).json({ 
      error: 'Failed to fetch meetings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

