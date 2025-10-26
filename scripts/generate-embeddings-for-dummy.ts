import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Hugging Face embeddings service
class EmbeddingsService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    this.apiUrl = 'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2';

    if (!this.apiKey) {
      console.warn('⚠️ HUGGINGFACE_API_KEY not found - embeddings will be skipped');
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isConfigured()) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle array of arrays response
      if (Array.isArray(data) && Array.isArray(data[0])) {
        return data[0];
      }
      
      return data as number[];
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw error;
    }
  }
}

const embeddingsService = new EmbeddingsService();

async function generateEmbeddingsForDummyMeeting() {
  console.log('🔍 Finding transcripts without embeddings...\n');

  try {
    // Get all transcripts with NULL embeddings
    const { data: transcripts, error } = await supabase
      .from('transcripts')
      .select('*')
      .is('embedding', null);

    if (error) {
      console.error('❌ Error fetching transcripts:', error);
      throw error;
    }

    if (!transcripts || transcripts.length === 0) {
      console.log('✅ No transcripts without embeddings found!');
      return;
    }

    console.log(`📋 Found ${transcripts.length} transcripts without embeddings\n`);

    if (!embeddingsService.isConfigured()) {
      console.error('❌ Hugging Face API key not configured');
      console.log('💡 Set HUGGINGFACE_API_KEY in your .env.local file');
      return;
    }

    // Process in batches to avoid rate limits
    const batchSize = 5;
    let processed = 0;

    for (let i = 0; i < transcripts.length; i += batchSize) {
      const batch = transcripts.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transcripts.length / batchSize)}...`);

      for (const transcript of batch) {
        try {
          console.log(`  → Generating embedding for: "${transcript.message.substring(0, 50)}..."`);
          
          const embedding = await embeddingsService.generateEmbedding(transcript.message);
          
          // Update the transcript with the embedding
          const { error: updateError } = await supabase
            .from('transcripts')
            .update({ embedding })
            .eq('id', transcript.id);

          if (updateError) {
            console.error(`  ❌ Error updating transcript ${transcript.id}:`, updateError);
          } else {
            processed++;
            console.log(`  ✅ Updated transcript ${transcript.id}`);
          }

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`  ❌ Error processing transcript ${transcript.id}:`, error);
        }
      }

      // Wait between batches
      if (i + batchSize < transcripts.length) {
        console.log('  ⏳ Waiting 2 seconds before next batch...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n✅ Successfully processed ${processed}/${transcripts.length} transcripts!`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateEmbeddingsForDummyMeeting();

