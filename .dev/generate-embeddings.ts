import { createClient } from '@supabase/supabase-js';
import { HfInference } from '@huggingface/inference';
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

// Hugging Face client - using the new endpoint
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const model = 'sentence-transformers/all-MiniLM-L6-v2';

async function generateEmbeddings() {
  console.log('🔍 Finding transcripts without embeddings...\n');

  try {
    const { data: transcripts, error } = await supabase
      .from('transcripts')
      .select('*')
      .is('embedding', null)
      .limit(100);

    if (error) {
      console.error('❌ Error fetching transcripts:', error);
      throw error;
    }

    if (!transcripts || transcripts.length === 0) {
      console.log('✅ No transcripts without embeddings found!');
      return;
    }

    console.log(`📋 Found ${transcripts.length} transcripts without embeddings\n`);

    if (!process.env.HUGGINGFACE_API_KEY) {
      console.error('❌ Hugging Face API key not configured');
      console.log('💡 Set HUGGINGFACE_API_KEY in your .env.local file');
      return;
    }

    // Process in batches
    const batchSize = 5;
    let processed = 0;

    for (let i = 0; i < transcripts.length; i += batchSize) {
      const batch = transcripts.slice(i, i + batchSize);
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(transcripts.length / batchSize)}...`);

      for (const transcript of batch) {
        try {
          console.log(`  → Generating embedding for: "${transcript.message.substring(0, 50)}..."`);
          
          // Generate embedding using Hugging Face SDK
          const embedding = await hf.featureExtraction({
            model,
            inputs: transcript.message.substring(0, 512) // Model max length
          });
          
          // Convert to array
          const embeddingArray = Array.from(embedding as number[]);
          
          // Update the transcript with the embedding
          const { error: updateError } = await supabase
            .from('transcripts')
            .update({ embedding: embeddingArray })
            .eq('id', transcript.id);

          if (updateError) {
            console.error(`  ❌ Error updating transcript ${transcript.id}:`, updateError);
          } else {
            processed++;
            console.log(`  ✅ Updated transcript ${transcript.id}`);
          }

          // Rate limiting
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

generateEmbeddings();

