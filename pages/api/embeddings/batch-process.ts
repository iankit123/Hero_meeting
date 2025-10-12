import { NextApiRequest, NextApiResponse } from 'next';
import { hfEmbeddingsService } from '../../../services/embeddings-hf';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orgName, batchSize = 20 } = req.body;

    if (!orgName) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    if (!hfEmbeddingsService.isConfigured()) {
      return res.status(500).json({ 
        error: 'Hugging Face API key not configured',
        details: 'Please add HUGGINGFACE_API_KEY to your environment variables'
      });
    }

    console.log(`🚀 [BATCH-EMBED] Starting batch processing for org: ${orgName}`);

    const count = await hfEmbeddingsService.embedAllTranscripts(orgName, batchSize);

    res.status(200).json({
      success: true,
      message: `Successfully embedded ${count} transcripts`,
      count,
      orgName,
      note: count === batchSize 
        ? 'More transcripts may need processing. Run again to continue.'
        : 'All transcripts have been processed.'
    });
  } catch (error) {
    console.error('❌ [BATCH-EMBED] Error:', error);
    res.status(500).json({ 
      error: 'Failed to process embeddings',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

