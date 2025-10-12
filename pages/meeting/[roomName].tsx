import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import MeetingPage from '../../components/MeetingPage';

export default function Meeting() {
  const router = useRouter();
  const { roomName } = router.query;
  const [isReady, setIsReady] = useState(false);

  // Prevent body scroll on meeting pages
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.height = 'auto';
    };
  }, []);

  useEffect(() => {
    if (router.isReady && roomName) {
      setIsReady(true);
    }
  }, [router.isReady, roomName]);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!roomName || typeof roomName !== 'string') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Invalid room name</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return <MeetingPage roomName={roomName} />;
}
