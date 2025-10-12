// services/embeddings-hf.ts
import { HfInference } from '@huggingface/inference';
import { supabaseContextService } from './supabase-context';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export class HuggingFaceEmbeddingsService {
  private model = 'sentence-transformers/all-MiniLM-L6-v2';
  private maxTokens = 512; // Model's max input length

  /**
   * Generate embedding for text using Hugging Face API
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      console.log(`🤗 [HF-EMBEDDINGS] Generating embedding for text (${text.length} chars)`);
      
      // Truncate text to model's max length
      const truncatedText = text.substring(0, this.maxTokens);
      
      const embedding = await hf.featureExtraction({
        model: this.model,
        inputs: truncatedText
      });
      
      // Convert to number array
      // The API returns a single vector for sentence embeddings
      const embeddingArray = Array.from(embedding as number[]);
      
      console.log(`✅ [HF-EMBEDDINGS] Generated embedding (${embeddingArray.length} dimensions)`);
      return embeddingArray;
    } catch (error) {
      console.error('❌ [HF-EMBEDDINGS] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate and store embedding for a specific transcript
   */
  async embedTranscript(transcriptId: string, text: string): Promise<boolean> {
    try {
      if (!process.env.HUGGINGFACE_API_KEY) {
        console.warn('⚠️ [HF-EMBEDDINGS] Hugging Face API key not configured');
        return false;
      }

      const embedding = await this.generateEmbedding(text);
      
      const { error } = await supabaseContextService.supabase
        .from('transcripts')
        .update({ embedding })
        .eq('id', transcriptId);

      if (error) throw error;
      
      console.log(`✅ [HF-EMBEDDINGS] Stored embedding for transcript: ${transcriptId}`);
      return true;
    } catch (error) {
      console.error('❌ [HF-EMBEDDINGS] Error storing embedding:', error);
      return false;
    }
  }

  /**
   * Batch process transcripts without embeddings
   */
  async embedAllTranscripts(orgName: string, batchSize: number = 10): Promise<number> {
    try {
      if (!process.env.HUGGINGFACE_API_KEY) {
        console.warn('⚠️ [HF-EMBEDDINGS] Hugging Face API key not configured');
        return 0;
      }

      const { data: transcripts, error } = await supabaseContextService.supabase
        .from('transcripts')
        .select('id, message')
        .eq('org_name', orgName.toLowerCase())
        .is('embedding', null)
        .limit(batchSize);

      if (error) throw error;
      if (!transcripts || transcripts.length === 0) {
        console.log('ℹ️ [HF-EMBEDDINGS] No transcripts to embed');
        return 0;
      }

      console.log(`🚀 [HF-EMBEDDINGS] Processing ${transcripts.length} transcripts...`);
      let successCount = 0;

      for (const transcript of transcripts) {
        try {
          await this.embedTranscript(transcript.id, transcript.message);
          successCount++;
          
          // Rate limiting: ~2 requests per second to avoid hitting API limits
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`❌ Failed to embed transcript ${transcript.id}:`, err);
        }
      }

      console.log(`✅ [HF-EMBEDDINGS] Successfully embedded ${successCount}/${transcripts.length} transcripts`);
      return successCount;
    } catch (error) {
      console.error('❌ [HF-EMBEDDINGS] Batch embedding error:', error);
      return 0;
    }
  }

  /**
   * Check if embeddings service is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.HUGGINGFACE_API_KEY;
  }
}

// Singleton instance
export const hfEmbeddingsService = new HuggingFaceEmbeddingsService();

