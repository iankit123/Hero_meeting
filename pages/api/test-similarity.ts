import { NextApiRequest, NextApiResponse } from 'next';
import { hfEmbeddingsService } from '../../services/embeddings-hf';
import { supabaseContextService } from '../../services/supabase-context';

/**
 * Test API to check similarity scores for different thresholds
 * Usage: GET /api/test-similarity?query=payment+failures&org=hero_test&threshold=0.3
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, org = 'hero_test', threshold = '0.3', limit = '10' } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    if (!hfEmbeddingsService.isConfigured()) {
      return res.status(500).json({ 
        error: 'Hugging Face API key not configured'
      });
    }

    console.log(`🔍 [TEST-SIMILARITY] Testing query: "${query}"`);
    console.log(`🔍 [TEST-SIMILARITY] Org: ${org}, Threshold: ${threshold}, Limit: ${limit}`);

    // Generate embedding for the query
    const queryEmbedding = await hfEmbeddingsService.generateEmbedding(query);
    console.log(`✅ [TEST-SIMILARITY] Generated embedding (${queryEmbedding.length} dimensions)`);

    // Search for similar transcripts with specified threshold
    const { data: results, error } = await supabaseContextService.supabase
      .rpc('search_transcripts_by_similarity', {
        query_embedding: queryEmbedding,
        org_filter: org,
        match_threshold: parseFloat(threshold as string),
        match_count: parseInt(limit as string)
      });

    if (error) {
      console.error('❌ [TEST-SIMILARITY] Error:', error);
      throw error;
    }

    console.log(`✅ [TEST-SIMILARITY] Found ${results?.length || 0} results`);

    // Format results for easy reading
    const formattedResults = results?.map((r: any) => ({
      similarity: `${(r.similarity * 100).toFixed(1)}%`,
      speaker: r.speaker,
      message: r.message,
      room_name: r.room_name,
      date: new Date(r.created_at).toLocaleDateString(),
      raw_similarity: r.similarity
    })) || [];

    res.status(200).json({
      success: true,
      query,
      org,
      threshold: parseFloat(threshold as string),
      limit: parseInt(limit as string),
      resultsFound: formattedResults.length,
      results: formattedResults,
      summary: {
        highestSimilarity: formattedResults[0]?.similarity || 'N/A',
        lowestSimilarity: formattedResults[formattedResults.length - 1]?.similarity || 'N/A',
        averageSimilarity: formattedResults.length > 0
          ? `${(formattedResults.reduce((sum: number, r: any) => sum + r.raw_similarity, 0) / formattedResults.length * 100).toFixed(1)}%`
          : 'N/A'
      }
    });

  } catch (error) {
    console.error('❌ [TEST-SIMILARITY] Error:', error);
    res.status(500).json({ 
      error: 'Failed to test similarity',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

