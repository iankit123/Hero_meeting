import React, { useState } from 'react';

interface NameInputModalProps {
  isOpen: boolean;
  onSubmit: (name: string) => void;
}

const NameInputModal: React.FC<NameInputModalProps> = ({ isOpen, onSubmit }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name');
      return;
    }
    
    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    
    if (trimmedName.length > 50) {
      setError('Name must be less than 50 characters');
      return;
    }
    
    // Save to localStorage for future meetings
    localStorage.setItem('hero_meeting_username', trimmedName);
    
    onSubmit(trimmedName);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '450px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        animation: 'slideIn 0.3s ease-out'
      }}>
        <h2 style={{
          margin: '0 0 10px 0',
          fontSize: '28px',
          fontWeight: '700',
          color: '#1a1a1a',
          textAlign: 'center'
        }}>
          Welcome to Hero Meeting
        </h2>
        
        <p style={{
          margin: '0 0 30px 0',
          fontSize: '15px',
          color: '#666',
          textAlign: 'center',
          lineHeight: '1.5'
        }}>
          Please enter your name to join the meeting
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            placeholder="Enter your name"
            autoFocus
            style={{
              width: '100%',
              padding: '14px 18px',
              fontSize: '16px',
              border: error ? '2px solid #ff4444' : '2px solid #e0e0e0',
              borderRadius: '10px',
              outline: 'none',
              marginBottom: '10px',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
              fontFamily: 'inherit'
            }}
            onFocus={(e) => {
              if (!error) {
                e.target.style.borderColor = '#667eea';
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.target.style.borderColor = '#e0e0e0';
              }
            }}
          />
          
          {error && (
            <p style={{
              margin: '0 0 15px 0',
              fontSize: '14px',
              color: '#ff4444',
              textAlign: 'left'
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              backgroundColor: '#667eea',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginTop: '10px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#5568d3';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#667eea';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Join Meeting
          </button>
        </form>

        <p style={{
          margin: '20px 0 0 0',
          fontSize: '13px',
          color: '#999',
          textAlign: 'center'
        }}>
          Your name will be visible to other participants
        </p>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-20px);
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

export default NameInputModal;

