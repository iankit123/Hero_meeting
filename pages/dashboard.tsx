import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Dashboard from '../components/Dashboard';
import MeetingsTab from '../components/MeetingsTab';
import PastMeetingsTab from '../components/PastMeetingsTab';
import FeedbackTab from '../components/FeedbackTab';

const DashboardPage: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'meetings' | 'past-meetings' | 'feedback'>('meetings');

  // Handle URL parameters for active tab
  useEffect(() => {
    if (router.isReady) {
      const tab = router.query.tab as string;
      if (tab === 'feedback' || tab === 'past-meetings' || tab === 'meetings') {
        setActiveTab(tab as 'meetings' | 'past-meetings' | 'feedback');
      }
    }
  }, [router.isReady, router.query.tab]);

  return (
    <Dashboard activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'meetings' && <MeetingsTab />}
      {activeTab === 'past-meetings' && <PastMeetingsTab />}
      {activeTab === 'feedback' && <FeedbackTab orgName={localStorage.getItem('hero_meeting_org') || ''} />}
    </Dashboard>
  );
};

export default DashboardPage;

