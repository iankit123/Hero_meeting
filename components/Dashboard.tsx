import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

interface DashboardProps {
  children?: React.ReactNode;
  activeTab?: 'meetings' | 'past-meetings';
  onTabChange?: (tab: 'meetings' | 'past-meetings') => void;
}

const Dashboard: React.FC<DashboardProps> = ({ children, activeTab = 'meetings', onTabChange }) => {
  const [orgName, setOrgName] = useState<string>('');
  const [orgDisplayName, setOrgDisplayName] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();

  // Trigger background summary generation for meetings without summaries
  const generateMissingSummaries = async (orgName: string) => {
    try {
      // Fire and forget - don't await, don't block UI
      fetch('/api/summaries/generate-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName })
      }).then(async response => {
        if (response.ok) {
          const data = await response.json();
          console.log('✅ [DASHBOARD] Background summary generation triggered:', data);
        } else {
          console.warn('⚠️ [DASHBOARD] Summary generation returned error');
        }
      }).catch(err => {
        console.warn('⚠️ [DASHBOARD] Summary generation failed:', err);
      });
    } catch (err) {
      // Silently fail - don't disrupt user experience
      console.warn('⚠️ [DASHBOARD] Could not trigger summary generation:', err);
    }
  };

  useEffect(() => {
    // Get org name from localStorage (normalized lowercase)
    const storedOrgName = localStorage.getItem('hero_meeting_org');
    if (!storedOrgName) {
      // Redirect to org entry if no org set
      router.push('/org-entry');
      return;
    }
    setOrgName(storedOrgName);
    
    // Get display name (original case) or fall back to normalized
    const displayName = localStorage.getItem('hero_meeting_org_display') || storedOrgName;
    setOrgDisplayName(displayName);

    // Trigger background summary generation with rate limiting
    // Only run once every 5 minutes per org to prevent duplicate runs
    const SUMMARY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
    const lastCheckKey = `summary_check_${storedOrgName}`;
    const lastCheck = localStorage.getItem(lastCheckKey);
    const now = Date.now();
    
    // Temporarily disabled until SQL script is run
    // TODO: Re-enable after running scripts/add-summary-columns.sql in Supabase
    // console.log('ℹ️ [DASHBOARD] Summary generation disabled - run SQL script first');
    
    // Uncomment below after running SQL:
    if (!lastCheck || now - parseInt(lastCheck) > SUMMARY_CHECK_INTERVAL) {
      console.log('🔄 [DASHBOARD] Triggering background summary generation...');
      generateMissingSummaries(storedOrgName);
      localStorage.setItem(lastCheckKey, now.toString());
    } else {
      const nextCheck = new Date(parseInt(lastCheck) + SUMMARY_CHECK_INTERVAL);
      console.log(`ℹ️ [DASHBOARD] Summary generation already ran recently. Next check: ${nextCheck.toLocaleTimeString()}`);
    }
  }, [router]);

  const handleTabClick = (tab: 'meetings' | 'past-meetings') => {
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const handleSwitchOrg = () => {
    localStorage.removeItem('hero_meeting_org');
    localStorage.removeItem('hero_meeting_org_display');
    router.push('/org-entry');
  };

  if (!orgName) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #374151',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Sidebar */}
      <div
        style={{
          width: sidebarCollapsed ? '70px' : '260px',
          backgroundColor: '#1e293b',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {!sidebarCollapsed && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>Hero Meeting</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>AI-Powered Meetings</div>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s'
              }}
            >
              <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Org Info */}
        {!sidebarCollapsed && (
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            backgroundColor: 'rgba(102, 126, 234, 0.1)'
          }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}>
              Organization
            </div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '8px' }}>
              {orgDisplayName}
            </div>
            <button
              onClick={handleSwitchOrg}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#94a3b8',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              Switch Organization
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '20px 0' }}>
          {/* Meetings */}
          <button
            onClick={() => handleTabClick('meetings')}
            style={{
              width: '100%',
              padding: sidebarCollapsed ? '12px 0' : '12px 20px',
              background: activeTab === 'meetings' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'meetings' ? '3px solid #667eea' : '3px solid transparent',
              color: activeTab === 'meetings' ? '#667eea' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'meetings') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'meetings') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {!sidebarCollapsed && <span>Meetings</span>}
          </button>

          {/* Past Meetings */}
          <button
            onClick={() => handleTabClick('past-meetings')}
            style={{
              width: '100%',
              padding: sidebarCollapsed ? '12px 0' : '12px 20px',
              background: activeTab === 'past-meetings' ? 'rgba(102, 126, 234, 0.2)' : 'transparent',
              border: 'none',
              borderLeft: activeTab === 'past-meetings' ? '3px solid #667eea' : '3px solid transparent',
              color: activeTab === 'past-meetings' ? '#667eea' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'past-meetings') {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = 'white';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'past-meetings') {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
              <path d="M9 22V12h6v10" />
              <path d="M12 2v7" />
              <circle cx="12" cy="9" r="1" />
            </svg>
            {!sidebarCollapsed && <span>Past Meetings</span>}
          </button>
        </nav>

        {/* Footer */}
        {!sidebarCollapsed && (
          <div style={{
            padding: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              textAlign: 'center'
            }}>
              © 2025 Hero Meeting
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
};

export default Dashboard;

