import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('🧹 [CLEANUP] Starting removal of hallucinated responses...');

    // Find and remove responses that contain "Ankit" in past meeting references
    const { data: transcripts, error } = await supabaseContextService.supabase
      .from('transcripts')
      .select('*')
      .or('message.ilike.%Ankit asked a similar question%,message.ilike.%Ankit also asked%,message.ilike.%Ankit also inquired%');

    if (error) {
      console.error('❌ [CLEANUP] Error fetching transcripts:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log(`🔍 [CLEANUP] Found ${transcripts?.length || 0} hallucinated responses`);

    const removedCount = transcripts?.length || 0;

    if (transcripts && transcripts.length > 0) {
      for (const transcript of transcripts) {
        console.log(`🗑️ [CLEANUP] Removing: "${transcript.message.substring(0, 100)}..."`);
        
        const { error: deleteError } = await supabaseContextService.supabase
          .from('transcripts')
          .delete()
          .eq('id', transcript.id);

        if (deleteError) {
          console.error('❌ [CLEANUP] Error deleting transcript:', deleteError);
          return res.status(500).json({ success: false, error: deleteError.message });
        } else {
          console.log('✅ [CLEANUP] Successfully removed hallucinated response');
        }
      }
    }

    console.log('✅ [CLEANUP] Cleanup completed');

    res.status(200).json({
      success: true,
      message: `Removed ${removedCount} hallucinated responses`,
      removedCount
    });

  } catch (error) {
    console.error('❌ [CLEANUP] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup hallucinated responses'
    });
  }
}
