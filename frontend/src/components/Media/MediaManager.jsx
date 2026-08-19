import React, { useState, useEffect, useRef } from 'react';
import { mediaAPI } from '../../api/media';

export default function MediaManager() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await mediaAPI.listMedia();
      setFiles(data.files || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load media files.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      await mediaAPI.uploadMedia(file);
      await loadFiles();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;
    try {
      await mediaAPI.deleteMedia(filename);
      await loadFiles();
    } catch (err) {
      console.error(err);
      setError('Failed to delete file.');
    }
  };

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url);
    alert('Copied to clipboard!');
  };

  return (
    <div className="page-container" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 'bold' }}>Media & Documents</h1>
        
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="image/*,application/pdf,video/*"
          />
          <button 
            className="btn btn--primary" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Loading files...</p>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, backgroundColor: 'var(--clr-bg-alt)', borderRadius: 8 }}>
          <p style={{ color: 'var(--clr-text-muted)' }}>No files uploaded yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
          {files.map(f => (
            <div key={f.filename} style={{ padding: 16, backgroundColor: 'var(--clr-bg-alt)', borderRadius: 8, border: '1px solid var(--clr-border)' }}>
              <div style={{ marginBottom: 12, wordBreak: 'break-all' }}>
                <strong>{f.filename}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginBottom: 16 }}>
                {(f.size / 1024).toFixed(1)} KB • {new Date(f.created_at).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn btn--sm" 
                  style={{ flex: 1, backgroundColor: 'var(--clr-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}
                  onClick={() => handleCopy(f.url)}
                >
                  Copy Link
                </button>
                <button 
                  className="btn btn--sm" 
                  style={{ flex: 1, backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}
                  onClick={() => handleDelete(f.filename)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
