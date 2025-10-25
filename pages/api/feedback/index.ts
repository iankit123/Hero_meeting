import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseContextService } from '../../../services/supabase-context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // Create new feedback
    try {
      const { orgName, feedbackBy, feedbackText } = req.body;

      if (!orgName || !feedbackBy || !feedbackText) {
        return res.status(400).json({ 
          error: 'Missing required fields: orgName, feedbackBy, feedbackText' 
        });
      }

      console.log(`📝 [FEEDBACK] Creating feedback for org: ${orgName}`);

      const { data, error } = await supabaseContextService.supabase
        .from('feedback')
        .insert({
          org_name: orgName.toLowerCase(),
          feedback_by: feedbackBy,
          feedback_text: feedbackText
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [FEEDBACK] Error creating feedback:', error);
        return res.status(500).json({ 
          error: 'Failed to create feedback',
          details: error.message 
        });
      }

      console.log(`✅ [FEEDBACK] Feedback created successfully: ${data.id}`);
      res.status(201).json({ 
        success: true, 
        feedback: data,
        message: 'Feedback saved successfully' 
      });

    } catch (error) {
      console.error('❌ [FEEDBACK] Error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (req.method === 'GET') {
    // Get feedback for an organization
    try {
      const { orgName } = req.query;

      if (!orgName || typeof orgName !== 'string') {
        return res.status(400).json({ 
          error: 'orgName query parameter is required' 
        });
      }

      console.log(`📝 [FEEDBACK] Fetching feedback for org: ${orgName}`);

      const { data, error } = await supabaseContextService.supabase
        .from('feedback')
        .select('*')
        .eq('org_name', orgName.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [FEEDBACK] Error fetching feedback:', error);
        return res.status(500).json({ 
          error: 'Failed to fetch feedback',
          details: error.message 
        });
      }

      console.log(`✅ [FEEDBACK] Found ${data?.length || 0} feedback entries`);
      res.status(200).json({ 
        success: true, 
        feedback: data || [],
        count: data?.length || 0
      });

    } catch (error) {
      console.error('❌ [FEEDBACK] Error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else if (req.method === 'DELETE') {
    // Delete feedback
    try {
      const { feedbackId } = req.body;

      if (!feedbackId) {
        return res.status(400).json({ 
          error: 'feedbackId is required' 
        });
      }

      console.log(`📝 [FEEDBACK] Deleting feedback: ${feedbackId}`);

      const { error } = await supabaseContextService.supabase
        .from('feedback')
        .delete()
        .eq('id', feedbackId);

      if (error) {
        console.error('❌ [FEEDBACK] Error deleting feedback:', error);
        return res.status(500).json({ 
          error: 'Failed to delete feedback',
          details: error.message 
        });
      }

      console.log(`✅ [FEEDBACK] Feedback deleted successfully: ${feedbackId}`);
      res.status(200).json({ 
        success: true,
        message: 'Feedback deleted successfully' 
      });

    } catch (error) {
      console.error('❌ [FEEDBACK] Error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
