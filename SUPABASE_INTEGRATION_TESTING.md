# 🧪 Supabase Integration - Testing Guide

## ✅ Implementation Status

All Supabase integration changes have been implemented and are ready for testing!

### What Was Implemented

1. **Automatic Transcript Storage** - All meeting conversations are automatically saved to Supabase
2. **Database Service Layer** - `services/supabase-context.ts` handles all Supabase operations
3. **API Endpoints** - 3 new REST APIs for managing meeting data
4. **Environment Detection** - Automatically enables/disables based on `.env.local` configuration

---

## 🗄️ Database Schema

You should have created these 3 tables in Supabase:

- ✅ `meetings` - Stores meeting metadata (room name, start time, duration, etc.)
- ✅ `transcripts` - Stores individual messages/transcripts with timestamps
- ✅ `meeting_summaries` - Stores AI-generated summaries (future enhancement)

---

## 🚀 How to Test

### Step 1: Verify Server is Running

The server is currently running on **http://localhost:8002**

```bash
# Check server status
curl http://localhost:8002
```

### Step 2: Start a Meeting

1. Open your browser: **http://localhost:8002**
2. Click **"Start Free Meeting"**
3. Allow camera/microphone permissions
4. You'll be taken to a meeting room (e.g., `meeting-1760210135601`)

### Step 3: Have a Conversation with Hero

Say these test phrases to trigger Hero:

```
"Hey Hero, what is the time?"
"Hi Hero, tell me a joke"
"Hero, what are we discussing today?"
```

**What happens behind the scenes:**
- ✅ Your speech is transcribed in real-time
- ✅ **Automatically saved to Supabase `transcripts` table**
- ✅ Hero's responses are also **saved to Supabase**
- ✅ Meeting metadata is **saved to Supabase `meetings` table**

### Step 4: Check Supabase Dashboard

1. Open your Supabase project: https://supabase.com/dashboard
2. Go to **Table Editor**
3. Check the **`meetings`** table:
   - You should see 1 row with your room name
   - Example: `meeting-1760210135601`
   - Check `started_at` timestamp
   
4. Check the **`transcripts`** table:
   - You should see multiple rows (one per message)
   - Each row contains: `room_name`, `speaker`, `message`, `timestamp`
   - Example data:
     ```
     room_name: meeting-1760210135601
     speaker: John Doe (or your participant ID)
     message: "Hey Hero, what is the time?"
     timestamp: 2025-10-11T19:30:00.000Z
     ```

### Step 5: Test API Endpoints

#### A. List All Meetings
```bash
curl "http://localhost:8002/api/meetings/list?limit=10" | jq
```

**Expected Output:**
```json
{
  "success": true,
  "meetings": [
    {
      "id": "uuid",
      "room_name": "meeting-1760210135601",
      "started_at": "2025-10-11T19:30:00.000Z",
      "participant_count": 1
    }
  ],
  "count": 1
}
```

#### B. Export Meeting Transcript as JSON
```bash
curl "http://localhost:8002/api/meetings/export-transcript?roomName=meeting-1760210135601" | jq
```

**Expected Output:**
```json
{
  "meeting": {
    "id": "uuid",
    "room_name": "meeting-1760210135601",
    "started_at": "2025-10-11T19:30:00.000Z",
    "participant_count": 1
  },
  "transcripts": [
    {
      "id": "uuid",
      "speaker": "John Doe",
      "message": "Hey Hero, what is the time?",
      "timestamp": "2025-10-11T19:30:15.000Z"
    },
    {
      "id": "uuid",
      "speaker": "Hero AI",
      "message": "The current time is 7:30 PM.",
      "timestamp": "2025-10-11T19:30:18.000Z"
    }
  ],
  "metadata": {
    "totalMessages": 2,
    "exportedAt": "2025-10-11T19:35:00.000Z"
  }
}
```

#### C. End a Meeting
```bash
curl -X POST http://localhost:8002/api/meetings/end \
  -H "Content-Type: application/json" \
  -d '{"roomName":"meeting-1760210135601"}' | jq
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Meeting ended successfully",
  "roomName": "meeting-1760210135601"
}
```

**What this does:**
- Sets `ended_at` timestamp in `meetings` table
- Calculates `duration_minutes`

---

## 🔍 Troubleshooting

### Issue: "Supabase not enabled" in logs

**Solution:**
```bash
# Check if environment variables are set
grep SUPABASE .env.local

# Restart server to load env vars
lsof -ti:8002 | xargs kill -9
PORT=8002 npm run dev
```

### Issue: No data in Supabase

**Solution:**
1. Check if RLS policies are disabled (you already did this ✅)
2. Check browser console for errors
3. Check server logs for Supabase errors:
   ```
   ⚠️ [CONTEXT] Failed to save to Supabase: <error message>
   ```

### Issue: API returns 404

**Solution:**
- Make sure server is running on port 8002
- Check that files exist:
  ```bash
  ls pages/api/meetings/
  # Should show: end.ts  export-transcript.ts  list.ts
  ```

---

## 📊 Console Logs to Watch For

When Supabase is working correctly, you'll see these logs:

```
✅ [SUPABASE] Service initialized
✅ [SUPABASE] Supabase is enabled and ready
📝 [SUPABASE] Meeting started: meeting-1760210135601
📝 [SUPABASE] Transcript added for meeting-1760210135601
```

---

## 🎯 What to Test

### ✅ Checklist

- [ ] **Start a meeting** - Check `meetings` table in Supabase
- [ ] **Say "Hey Hero"** - Check `transcripts` table for your message
- [ ] **Hero responds** - Check `transcripts` table for Hero's message  
- [ ] **API: List meetings** - Should return your meeting
- [ ] **API: Export transcript** - Should return full conversation JSON
- [ ] **API: End meeting** - Should update `ended_at` in Supabase
- [ ] **Start 2nd meeting** - Verify both meetings are separate in Supabase
- [ ] **Check timestamps** - All timestamps should be accurate

---

## 🚀 Next Steps (Future Enhancements)

After confirming the basic integration works:

1. **Vector Embeddings** - Generate embeddings for semantic search
2. **Meeting Summaries** - Auto-generate summaries when meeting ends
3. **Transcript Search** - Search across all past meetings
4. **Meeting Dashboard** - UI to view past meetings
5. **Export to PDF** - Download transcripts as PDF

---

## 📞 Support

If you encounter any issues:

1. Check Supabase dashboard for data
2. Check browser console (F12) for errors
3. Check server logs in terminal
4. Verify `.env.local` has correct Supabase credentials

**Current Server Status:** ✅ Running on http://localhost:8002

---

## 🎉 Ready to Test!

Everything is implemented and the server is running. Just follow the steps above to test the integration!

