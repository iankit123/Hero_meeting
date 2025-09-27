import { NextApiRequest, NextApiResponse } from 'next';
import { AccessToken } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName } = req.body;
    const room = roomName || `room-${uuidv4()}`;

    // Validate environment variables
    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return res.status(500).json({ 
        error: 'LiveKit configuration missing. Please check environment variables.' 
      });
    }

    // Create access token for user
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: `user-${uuidv4()}`,
      name: 'Meeting Participant',
    });

    token.addGrant({
      room: room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();

    // Trigger Hero bot to join the room
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/hero-join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: room,
          action: 'join',
        }),
      });
    } catch (error) {
      console.warn('Failed to trigger Hero bot join:', error);
      // Don't fail the entire request if Hero bot fails to join
    }

    res.status(200).json({
      roomName: room,
      token: jwt,
      url: livekitUrl,
    });

  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ 
      error: 'Failed to create meeting room',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
