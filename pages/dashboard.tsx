import React, { useState } from 'react';
import Dashboard from '../components/Dashboard';
import MeetingsTab from '../components/MeetingsTab';
import PastMeetingsTab from '../components/PastMeetingsTab';

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'meetings' | 'past-meetings'>('meetings');

  return (
    <Dashboard activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'meetings' && <MeetingsTab />}
      {activeTab === 'past-meetings' && <PastMeetingsTab />}
    </Dashboard>
  );
};

export default DashboardPage;

