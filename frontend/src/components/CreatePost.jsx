import { useState } from 'react';
import axios from 'axios';
import './CreatePost.css';

// Helper function to convert UTC to IST string
function formatUTCasIST(utcDateString) {
  const date = new Date(utcDateString);
  const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istDate = new Date(date.getTime() + istOffsetMs);
  return istDate.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
}

const PLATFORMS = [
  { value: 'facebook',  label: 'Facebook',  color: '#1877f2' },
  { value: 'instagram', label: 'Instagram', color: '#e1306c' },
  { value: 'linkedin',  label: 'LinkedIn',  color: '#0a66c2' },
  { value: 'pinterest', label: 'Pinterest', color: '#e60023' },
  { value: 'youtube',   label: 'YouTube',   color: '#ff0000' },
];

function CreatePost({ token }) {
  const [content, setContent]       = useState('');
  const [media, setMedia]           = useState(null);
  const [platforms, setPlatforms]   = useState([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [status, setStatus]         = useState(null); // 'success' | 'error' | null
  const [statusMessage, setStatusMessage] = useState(''); // Custom status message with IST time
  const [isLoading, setIsLoading]   = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handlePlatformToggle = (e) => {
    const { value, checked } = e.target;
    setPlatforms(prev =>
      checked ? [...prev, value] : prev.filter(p => p !== value)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Validate content or media
    if (!content && !media) {
      setStatus('error');
      alert('Please enter content or upload media.');
      setIsLoading(false);
      return;
    }
    
    // Validate platforms selected
    if (platforms.length === 0) {
      setStatus('error');
      alert('Please select at least one platform.');
      setIsLoading(false);
      return;
    }
    
    // Validate YouTube requires media
    if (platforms.includes('youtube') && !media) {
      setStatus('error');
      alert('YouTube requires a video file to be uploaded. Please upload a video.');
      setIsLoading(false);
      return;
    }
    
    const formData = new FormData();
    formData.append('content', content);
    if (media) formData.append('media', media);
    formData.append('platforms', JSON.stringify(platforms));
    
    // Convert Indian datetime-local to UTC for Supabase
    // datetime-local input is treated as IST (UTC+5:30)
    let utcScheduledAt = '';
    let displayScheduledAt = '';
    if (scheduledAt) {
      try {
        // Parse the datetime-local input (YYYY-MM-DDTHH:mm format)
        const localDate = new Date(scheduledAt);
        // Subtract 5:30 hours to convert from IST to UTC
        const istOffsetMs = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
        const utcDate = new Date(localDate.getTime() - istOffsetMs);
        utcScheduledAt = utcDate.toISOString();
        // Store the IST formatted version for display
        displayScheduledAt = formatUTCasIST(utcScheduledAt);
        console.log('Scheduled - Indian time:', scheduledAt, 'UTC time:', utcScheduledAt, 'Display:', displayScheduledAt);
      } catch (dateError) {
        console.error('Error parsing date:', dateError);
        setStatus('error');
        alert('Invalid date/time format.');
        return;
      }
    }
    formData.append('scheduledAt', utcScheduledAt);

    try {
      const response = await axios.post('http://localhost:5000/api/posts/create', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setStatus('success');
      setShowSuccessModal(true);
      // Set custom message with IST time if scheduled
      if (displayScheduledAt) {
        setStatusMessage(`Post scheduled for ${displayScheduledAt} IST`);
      } else {
        setStatusMessage('Post created and posted!');
      }
      setIsLoading(false);
      setTimeout(() => {
        setContent('');
        setMedia(null);
        setPlatforms([]);
        setScheduledAt('');
        setStatus(null);
        setStatusMessage('');
        setShowSuccessModal(false);
      }, 2000);
    } catch (err) {
      setStatus('error');
      setIsLoading(false);
      console.error('Error creating post:', err.response?.data || err.message);
      alert(err.response?.data?.error || 'Failed to create post. Please try again.');
    }
  };

  return (
    <section className="create-post-section">
      <h3 className="section-title">Create a Post</h3>

      <form className="create-post-form" onSubmit={handleSubmit}>

        {/* ── Content textarea ─────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="cp-content">Content</label>
          <div className="textarea-wrap">
            <textarea
              id="cp-content"
              className="cp-textarea"
              placeholder="What do you want to share today?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
            <span className="char-count">{content.length}</span>
          </div>
        </div>

        {/* ── Media upload ─────────────────────────────────── */}
        <div className="field-group">
          <label className="field-label">Media</label>
          <label className="file-drop" htmlFor="cp-media">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>{media ? media.name : 'Upload image or video'}</span>
            <input
              id="cp-media"
              type="file"
              className="sr-only"
              onChange={(e) => setMedia(e.target.files[0])}
            />
          </label>
        </div>

        {/* ── Platform toggles ─────────────────────────────── */}
        <div className="field-group">
          <label className="field-label">Platforms</label>
          <div className="platform-row">
            {PLATFORMS.map(({ value, label, color }) => {
              const checked = platforms.includes(value);
              return (
                <label
                  key={value}
                  className={`platform-chip ${checked ? 'active' : ''}`}
                  style={{ '--chip-color': color }}
                >
                  <input
                    type="checkbox"
                    value={value}
                    checked={checked}
                    onChange={handlePlatformToggle}
                    className="sr-only"
                  />
                  <span className="chip-dot" aria-hidden="true" />
                  {label}
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Schedule datetime ────────────────────────────── */}
        <div className="field-group">
          <label className="field-label" htmlFor="cp-schedule">
            Schedule (optional)
          </label>
          <input
            id="cp-schedule"
            type="datetime-local"
            className="cp-input"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        {/* ── Submit ───────────────────────────────────────── */}
        <button type="submit" className="cp-submit" disabled={isLoading}>
          <span>{isLoading ? 'Publishing...' : 'Publish Post'}</span>
          {isLoading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25"></circle>
              <path d="M12 6v6l4 2" stroke="currentColor" strokeOpacity="0.75"></path>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          )}
        </button>

      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="modal-content">
              <h4>Success!</h4>
              <p>{statusMessage}</p>
              <button className="modal-close" onClick={() => setShowSuccessModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
}

export default CreatePost;