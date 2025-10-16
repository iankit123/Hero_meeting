import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { org } = req.query;
    const orgName = (org as string) || 'soo';
    
    console.log(`\n🔍 [DEBUG] Checking meetings for org: "${orgName}"`);
    
    // Check all meetings
    const allMeetings = await supabaseContextService.getAllMeetings(10);
    console.log(`📊 [DEBUG] Total meetings in database: ${allMeetings.length}`);
    
    // Check meetings for specific org
    const orgMeetings = await supabaseContextService.getMeetingsByOrg(orgName, 10);
    console.log(`📊 [DEBUG] Meetings for org "${orgName}": ${orgMeetings.length}`);
    
    // Get sample org names
    const sampleOrgNames = allMeetings.slice(0, 10).map(m => m.org_name);
    console.log(`📊 [DEBUG] Sample org names:`, sampleOrgNames);
    
    res.status(200).json({
      success: true,
      org: orgName,
      totalMeetings: allMeetings.length,
      orgMeetings: orgMeetings.length,
      sampleOrgNames,
      meetings: orgMeetings.map(m => ({
        id: m.id,
        room_name: m.room_name,
        org_name: m.org_name,
        started_at: m.started_at,
        summary: m.summary?.substring(0, 100)
      }))
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    res.status(500).json({ 
      error: 'Failed to debug meetings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

