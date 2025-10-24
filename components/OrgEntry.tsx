import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const OrgEntry: React.FC = () => {
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Clear cached organization when page loads
  useEffect(() => {
    localStorage.removeItem('hero_meeting_org');
    localStorage.removeItem('hero_meeting_org_display');
    console.log('🧹 [ORG] Cleared cached organization');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedOrgName = orgName.trim();
    
    // Validation
    if (!trimmedOrgName) {
      setError('Please enter your organization name');
      return;
    }
    
    if (trimmedOrgName.length < 3) {
      setError('Organization name must be at least 3 characters');
      return;
    }
    
    if (trimmedOrgName.length > 50) {
      setError('Organization name must be less than 50 characters');
      return;
    }
    
    setIsLoading(true);
    
    // Normalize org name to lowercase for case-insensitive matching
    const normalizedOrgName = trimmedOrgName.toLowerCase();
    
    // Save to localStorage (normalized for consistency)
    localStorage.setItem('hero_meeting_org', normalizedOrgName);
    localStorage.setItem('hero_meeting_org_display', trimmedOrgName); // Keep original for display
    
    console.log(`🏢 [ORG] Organization set: ${trimmedOrgName} (normalized: ${normalizedOrgName})`);
    
    // Navigate to dashboard
    router.push('/dashboard');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '50px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'fadeIn 0.5s ease-out'
      }}>
        {/* Logo/Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '40px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1a1a1a',
            marginBottom: '10px'
          }}>
            Welcome to Hero Meeting
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#666',
            lineHeight: '1.6'
          }}>
            Enter your organization name to get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => {
                setOrgName(e.target.value);
                setError('');
              }}
              placeholder="e.g., ABC Inc."
              autoFocus
              style={{
                width: '100%',
                padding: '14px 18px',
                fontSize: '16px',
                border: error ? '2px solid #ef4444' : '2px solid #e5e7eb',
                borderRadius: '12px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => {
                if (!error) {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }
              }}
              onBlur={(e) => {
                if (!error) {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }
              }}
            />
            {error && (
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '14px',
                color: '#ef4444'
              }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: isLoading 
                ? '#9ca3af' 
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              borderRadius: '12px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: '10px',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            {isLoading ? 'Loading...' : 'Continue'}
          </button>
        </form>

        {/* Info */}
        <div style={{
          marginTop: '30px',
          padding: '16px',
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{
            fontSize: '13px',
            color: '#6b7280',
            margin: 0,
            lineHeight: '1.6'
          }}>
            <strong>Note:</strong> Your organization name will be used to organize meetings and transcripts. You can change it later from settings.
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `
      }} />
    </div>
  );
};

export default OrgEntry;

