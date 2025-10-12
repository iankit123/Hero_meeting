# 🔧 Embedding Dimension Mismatch - Fix Guide

## 🐛 **The Problem**

Your database was configured for **1536 dimensions** (OpenAI embeddings), but Hugging Face's `all-MiniLM-L6-v2` model generates **384 dimensions**.

**Error from logs:**
```
❌ [HF-EMBEDDINGS] Error storing embedding: {
  message: 'expected 1536 dimensions, not 384'
}
```

**This causes:**
- ❌ New embeddings fail to store
- ❌ Vector search finds no results
- ❌ Hero falls back to recent meetings only

---

## ✅ **The Solution** (3 Steps)

### **Step 1: Assign NULL Org Names** (30 seconds)

You have **19 transcripts with NULL org_name** (including the Sept 20 payment failure meeting).

**Run this in Supabase SQL Editor:**

1. Open: https://app.supabase.com
2. Select your project
3. Click "SQL Editor" → "New query"
4. Copy contents of: `scripts/assign-null-orgs.sql`
5. Paste and Run

**This will:**
- Assign all NULL transcripts to `hero_test`
- Show you which meetings are affected

---

### **Step 2: Fix Embedding Dimensions** (1 minute)

**Run this in Supabase SQL Editor:**

1. Same SQL Editor
2. Click "New query"
3. Copy contents of: `scripts/fix-embedding-dimensions.sql`
4. Paste and Run

**This will:**
- Drop old embedding column (1536 dims)
- Create new embedding column (384 dims)
- Recreate HNSW index
- Update search function

**Expected output:**
```sql
org_name   | total_transcripts | need_embeddings
-----------|-------------------|----------------
hero_test  | 25                | 25
```

---

### **Step 3: Re-Embed All Transcripts** (2-5 minutes)

**Run this in your terminal:**

```bash
# Process all transcripts (run multiple times until complete)
curl -X POST http://localhost:8002/api/embeddings/batch-process \
  -H "Content-Type: application/json" \
  -d '{"orgName": "hero_test", "batchSize": 20}'
```

**Keep running until you see:**
```json
{
  "success": true,
  "message": "Successfully embedded 0 transcripts",
  "note": "All transcripts have been processed."
}
```

**Progress tracking:**
- Run 1: ~20 transcripts embedded
- Run 2: ~5 transcripts embedded  
- Run 3: 0 transcripts (done!)

---

## 🧪 **Step 4: Test Vector Search**

1. **Start a new meeting** with org: `hero_test`
2. **Ask Hero:** "Hero, do you know anything about payment failures?"
3. **Check server logs** for:

```
🔍 [RAG] Searching for context: "payment failures..."
🤗 [HF-EMBEDDINGS] Generating embedding for text (42 chars)
✅ [HF-EMBEDDINGS] Generated embedding (384 dimensions)
✅ [RAG] Found 3 relevant transcripts  ← SUCCESS!
```

4. **Hero should respond** with specific details from the Sept 20 meeting!

---

## 📊 **What You Should See**

### **Before Fix:**
```
🔍 [RAG] Searching for context...
❌ [HF-EMBEDDINGS] Error storing embedding: expected 1536 dimensions, not 384
ℹ️ [RAG] No relevant past meetings found, falling back to recent
```

### **After Fix:**
```
🔍 [RAG] Searching for context: "payment failures..."
🤗 [HF-EMBEDDINGS] Generating embedding for text (42 chars)
✅ [HF-EMBEDDINGS] Generated embedding (384 dimensions)
✅ [RAG] Found 3 relevant transcripts
[87% relevant] Matt: "We're seeing payment failures with credit cards..."
[82% relevant] Tom: "Check the payment provider API logs..."
```

---

## ❓ **Why Did This Happen?**

The `scripts/add-vector-search.sql` file I created specified `vector(384)`, but you might have:
1. Run an older SQL script with `vector(1536)`
2. Or manually created the column with default OpenAI dimensions

**Either way, we're fixing it now!** 🚀

---

## 🎯 **Summary Checklist**

- [ ] **Step 1:** Run `assign-null-orgs.sql` in Supabase
- [ ] **Step 2:** Run `fix-embedding-dimensions.sql` in Supabase  
- [ ] **Step 3:** Run batch processing curl command (multiple times)
- [ ] **Step 4:** Test with a meeting about payment failures
- [ ] **Verify:** Hero responds with specific Sept 20 meeting details

---

## 🆘 **If It Still Doesn't Work**

1. **Check server logs** for the actual error message
2. **Verify dimensions** in Supabase:
   ```sql
   SELECT atttypmod 
   FROM pg_attribute 
   WHERE attrelid = 'transcripts'::regclass 
   AND attname = 'embedding';
   ```
   - Should return: `388` (which means 384 dimensions + 4 bytes overhead)
   - If returns: `1540`, the column is still 1536 dimensions

3. **Check embeddings are storing**:
   ```sql
   SELECT COUNT(*) 
   FROM transcripts 
   WHERE embedding IS NOT NULL;
   ```
   - Should increase after batch processing

---

## 🎉 **You're Almost There!**

Once you complete these 3 steps, Hero will have full semantic memory and will find the Sept 20 payment failure discussion! 

Run the SQL scripts now and let me know what happens! 🚀

