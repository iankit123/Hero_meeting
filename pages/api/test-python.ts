import { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'child_process';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🧪 [PYTHON-TEST] === TESTING PYTHON AND EDGE-TTS ===');
    
    // Test 1: Check if Python is available
    console.log('🧪 [PYTHON-TEST] Testing Python availability...');
    const pythonTest = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, version: stdout.trim() });
        } else {
          reject(new Error(`Python test failed: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(error);
      });
    });

    console.log('✅ [PYTHON-TEST] Python test result:', pythonTest);

    // Test 2: Check if edge_tts module is available
    console.log('🧪 [PYTHON-TEST] Testing edge_tts module...');
    const edgeTtsTest = await new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', ['-c', 'import edge_tts; print("edge_tts module available")'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout.trim() });
        } else {
          reject(new Error(`edge_tts test failed: ${stderr}`));
        }
      });

      pythonProcess.on('error', (error) => {
        reject(error);
      });
    });

    console.log('✅ [PYTHON-TEST] edge_tts test result:', edgeTtsTest);

    // Test 3: Check if edge-tts CLI is available
    console.log('🧪 [PYTHON-TEST] Testing edge-tts CLI...');
    const cliTest = await new Promise((resolve, reject) => {
      const cliProcess = spawn('edge-tts', ['--help'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      cliProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      cliProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      cliProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout.trim().substring(0, 200) });
        } else {
          reject(new Error(`edge-tts CLI test failed: ${stderr}`));
        }
      });

      cliProcess.on('error', (error) => {
        reject(error);
      });
    });

    console.log('✅ [PYTHON-TEST] edge-tts CLI test result:', cliTest);

    res.status(200).json({
      success: true,
      python: pythonTest,
      edgeTtsModule: edgeTtsTest,
      edgeTtsCli: cliTest
    });

  } catch (error) {
    console.error('🧪 [PYTHON-TEST] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}
