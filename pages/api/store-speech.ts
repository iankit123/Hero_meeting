import { NextApiRequest, NextApiResponse } from 'next';
import { contextService } from '../../services/context';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomName, speech, speaker } = req.body;

    if (!roomName || !speech) {
      return res.status(400).json({ 
        error: 'Missing required parameters: roomName and speech' 
      });
    }

    // Store the speech in context
    contextService.addEntry(roomName, speaker || 'user', speech);

    console.log(`📝 [STORE-SPEECH] Stored speech for room ${roomName}: ${speech.substring(0, 50)}...`);

    res.status(200).json({
      success: true,
      message: 'Speech stored in context'
    });

  } catch (error) {
    console.error('Error storing speech:', error);
    res.status(500).json({ 
      error: 'Failed to store speech in context',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
