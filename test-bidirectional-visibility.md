# Bidirectional Visibility Test Plan

## 🧪 **COMPREHENSIVE TEST: 2 Users Visibility**

### **Expected Result**
Both users should be able to:
- ✅ See their own video preview (not black/grey)
- ✅ See the other person's video feed
- ✅ Hear the other person's audio
- ✅ See correct participant count (2 participants)

---

## 📋 **AUTOMATED TEST PROCEDURE**

### **Step 1: Setup Test**
1. **User A (First Person)**:
   - Open browser to `http://localhost:3000/`
   - Click "Start Meeting" 
   - Wait for redirect to `/meeting/meeting-xxxxx`
   - Grant camera/microphone permissions
   - Note the meeting URL

2. **User B (Second Person)**:
   - Open browser to the meeting URL from User A
   - Grant camera/microphone permissions

### **Step 2: Automatic Test Execution**
Tests automatically run every 10 seconds. Check browser console for:

```
🧪 [TEST] === BIDIRECTIONAL VISIBILITY TEST START ===
🧪 [TEST] LOCAL VIDEO: ✅ PUBLISHED
🧪 [TEST] LOCAL AUDIO: ✅ PUBLISHED
🧪 [TEST] LOCAL PREVIEW: ✅ YES
🧪 [TEST] REMOTE PARTICIPANTS: 1
🧪 [TEST] REMOTE VIDEO FEEDS: 1 visible
🧪 [TEST] === TEST COMPLETE ===
```

### **Step 3: Manual Test Trigger**
Both users can run additional tests in browser console:
1. Press `F12` to open Developer Tools
2. Go to **Console** tab
3. Type: `runVisibilityTest()`
4. Press Enter

---

## 🔍 **DETAILED VISUAL VERIFICATION**

### **User A (First Person) Should See:**
- [ ] Own video preview (bottom-left) ≠ black/grey box
- [ ] Working camera feed in preview
- [ ] Header shows "2 participants" 
- [ ] Sidebar shows "Meeting Attendees (2)"
- [ ] Remote participant video feed visible
- [ ] Can hear User B speaking

### **User B (Second Person) Should See:**
- [ ] Own video preview (bottom-left) ≠ black/grey box  
- [ ] Working camera feed in preview
- [ ] Header shows "2 participants"
- [ ] Sidebar shows "Meeting Attendees (2)"
- [ ] Remote participant video feed visible
- [ ] Can hear User A speaking

---

## 🐛 **TROUBLESHOOTING CHECKLIST**

### **If User A Can See User B, But User B Cannot See User A:**

Check User A's console:
```
🧪 [TEST] LOCAL VIDEO: ❌ NOT PUBLISHED  ← FIX NEEDED
🧪 [TEST] LOCAL AUDIO: ❌ NOT PUBLISHED  ← FIX NEEDED
```

Check User B's console:
```
🧪 [TEST] REMOTE VIDEO FEEDS: 0 visible  ← FIX NEEDED
🧪 [TEST] REMOTE PARTICIPANTS: 0  ← FIX NEEDED
```

### **If Both See Black/Grey Preview:**

Check both consoles for:
```
🎥 [VIDEO] Video stream exists: ❌ NO  ← FIX NEEDED
🎥 [VIDEO] Video paused: ❌ YES  ← FIX NEEDED
```

### **If Participant Count is Wrong:**

Check both consoles for:
```
📊 [PARTICIPANT] Total participants: 1  ← Should be 2
🔄 [SYNC] Participant count changed: 1 → 2  ← Should see this
```

---

## 📊 **TEST RESULTS LOGGING**

### **Successful Test Output:**
```javascript
🧪 [TEST] SUMMARY: {
  localVideoPublished: true,
  localAudioPublished: true, 
  localPreviewVisible: true,
  remoteParticipantsCount: 1,  // Should be 1 for remote participants
  remoteVideoFeedsVisible: 1   // Should be 1 for remote video feeds
}
```

### **Failed Test Output:**
```javascript
🧪 [TEST] SUMMARY: {
  localVideoPublished: false,   // ❌ PROBLEM
  localAudioPublished: true,
  localPreviewVisible: false,  // ❌ PROBLEM
  remoteParticipantsCount: 0,  // ❌ PROBLEM
  remoteVideoFeedsVisible: 0   // ❌ PROBLEM
}
```

---

## 🎯 **ACCEPTANCE CRITERIA**

**✅ PASS**: Both users see:
- Working local video preview
- Working remote video feed
- Correct participant count (2)
- Bidirectional audio

**❌ FAIL**: Any user sees:
- Black/grey video preview
- No remote video feeds
- Wrong participant count
- One-way audio only

---

## 🔧 **COMMON FIXES**

1. **Black Preview**: Click anywhere on page to trigger autoplay
2. **Missing Tracks**: Refresh browser page
3. **Participant Count**: Wait 10 seconds for automatic sync
4. **Audio Issues**: Check browser permissions

---

**Ready to test! Both users should now run this procedure and report results.**

