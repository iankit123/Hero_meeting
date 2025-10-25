import React, { useState, useEffect } from 'react';

interface Feedback {
  id: string;
  org_name: string;
  feedback_by: string;
  feedback_text: string;
  created_at: string;
  updated_at: string;
}

interface FeedbackTabProps {
  orgName: string;
}

const FeedbackTab: React.FC<FeedbackTabProps> = ({ orgName }) => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackBy, setFeedbackBy] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  // Fetch feedback on component mount
  useEffect(() => {
    fetchFeedback();
  }, [orgName]);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/feedback?orgName=${encodeURIComponent(orgName)}`);
      const data = await response.json();
      
      if (data.success) {
        setFeedback(data.feedback);
      } else {
        setError(data.error || 'Failed to fetch feedback');
      }
    } catch (err) {
      setError('Failed to fetch feedback');
      console.error('Error fetching feedback:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedbackBy.trim() || !feedbackText.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orgName,
          feedbackBy: feedbackBy.trim(),
          feedbackText: feedbackText.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Reset form
        setFeedbackBy('');
        setFeedbackText('');
        setShowForm(false);
        
        // Refresh feedback list
        await fetchFeedback();
      } else {
        setError(data.error || 'Failed to save feedback');
      }
    } catch (err) {
      setError('Failed to save feedback');
      console.error('Error saving feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (feedbackId: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedbackId }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh feedback list
        await fetchFeedback();
      } else {
        setError(data.error || 'Failed to delete feedback');
      }
    } catch (err) {
      setError('Failed to delete feedback');
      console.error('Error deleting feedback:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px auto'
        }}></div>
        <p style={{ color: '#6b7280' }}>Loading feedback...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '32px',
        paddingBottom: '24px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1f2937',
          margin: '0 0 8px 0'
        }}>
          Feedback
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          margin: '0 0 24px 0'
        }}>
          Collect and manage feedback for {orgName}
        </p>
        
        {/* Big Bold Add Feedback Button */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            padding: '16px 32px',
            fontSize: '18px',
            fontWeight: '700',
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '0 auto',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.3)';
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {showForm ? 'Cancel Feedback' : 'Add Feedback'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          color: '#dc2626',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Feedback Form */}
      {showForm && (
        <div style={{
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 20px 0'
          }}>
            Add New Feedback
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Feedback By
              </label>
              <input
                type="text"
                value={feedbackBy}
                onChange={(e) => setFeedbackBy(e.target.value)}
                placeholder="Enter your name or identifier"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Feedback
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Share your feedback about the meeting experience..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                required
              />
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  background: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: submitting ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Saving...' : 'Save Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feedback List */}
      <div>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1f2937',
          margin: '0 0 16px 0'
        }}>
          Recent Feedback ({feedback.length})
        </h3>

        {feedback.length === 0 ? (
          <div style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 16px auto', opacity: 0.5 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p style={{ margin: '0', fontSize: '16px' }}>No feedback yet</p>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {feedback.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1f2937',
                      marginBottom: '4px'
                    }}>
                      {item.feedback_by}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title="Delete feedback"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#374151',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap'
                }}>
                  {item.feedback_text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackTab;
