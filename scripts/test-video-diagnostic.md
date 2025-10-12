# Video Diagnostic Checklist

## Expected Console Logs (in order):

When you join a meeting, you should see these logs in the browser console:

### 1. Track Creation
```
🎥 [TRACKS] Creating local video and audio tracks...
✅ [TRACKS] Successfully created video and audio tracks
```

### 2. Track Publishing
```
📤 [PUBLISH] Publishing pre-created tracks...
✅ [PUBLISH] Video track published
✅ [PUBLISH] Audio track published
```

### 3. Participant Tile Setup
```
🔧 [TILE] Setting up tracks for [your-identity] (isLocal: true)
🔧 [TILE] videoRef.current exists: true
📹 [TILE] Local participant has 1 video publication(s)
📹 [TILE] Video publication details: { kind: 'video', trackName: '...', hasTrack: true, isSubscribed: true }
🔗 [TILE] Attaching local video track...
✅ [TILE] Local video attached to participant tile successfully!
✅ [TILE] Local video playing
```

## Common Issues:

### Issue 1: "No video publications found"
- **Cause**: Video track not published before ParticipantTile renders
- **Fix**: Ensure tracks are published before rendering tiles

### Issue 2: "videoRef.current exists: false"
- **Cause**: Video element not rendered when useEffect runs
- **Fix**: Always render video element (hide with CSS if needed)

### Issue 3: "Cannot attach: videoRef=false"
- **Cause**: Video element ref not attached
- **Fix**: Check React rendering order

## Testing Steps:

1. Open browser console
2. Start a new meeting
3. Check for the logs above
4. If video shows "A" instead of camera:
   - Take screenshot of console logs
   - Check which expected logs are missing
   - Report findings

