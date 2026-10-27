import React, { useState, useEffect, useRef } from 'react';
import { mediaAPI } from '../../api/media';

export default function MediaManager() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
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
    alert('Copied CDN link to clipboard!');
  };

  const getExtBadge = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return <span className="badge badge--green">IMG</span>;
    }
    if (ext === 'pdf') {
      return <span className="badge badge--red">PDF</span>;
    }
    if (['mp4', 'mov', 'webm'].includes(ext)) {
      return <span className="badge badge--purple">VIDEO</span>;
    }
    return <span className="badge badge--gray">{ext?.toUpperCase() || 'FILE'}</span>;
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📁 Documents & Media Assets</h1>
          <p>{files.length} uploaded assets stored on CDN for WhatsApp broadcast messages</p>
        </div>
        
        <div className="page-header__actions">
          <div className="day-picker" style={{ marginRight: 4 }}>
            <button
              className={`day-picker-btn ${viewMode === 'table' ? 'day-picker-btn--active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              ☰ Table
            </button>
            <button
              className={`day-picker-btn ${viewMode === 'grid' ? 'day-picker-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              ⊞ Grid
            </button>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="image/*,application/pdf,video/*"
          />
          <button 
            className="btn btn--primary btn--sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload Asset'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert--error">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : files.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 6, color: 'var(--text-primary)' }}>No media uploaded yet</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 14 }}>Upload images or PDF brochures to include them in WhatsApp broadcast templates.</p>
          <button className="btn btn--primary btn--sm" onClick={() => fileInputRef.current?.click()}>
            📤 Upload First File
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="table-wrap">
          <table className="table-compact">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Type</th>
                <th>File Name</th>
                <th className="text-right">File Size</th>
                <th>Uploaded Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.filename}>
                  <td>{getExtBadge(f.filename)}</td>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="text-mono" style={{ fontSize: 12 }}>{f.filename}</span>
                    </div>
                  </td>
                  <td className="text-right text-mono" style={{ fontSize: 11.5 }}>
                    {(f.size / 1024).toFixed(1)} KB
                  </td>
                  <td className="text-mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {new Date(f.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="text-right">
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button 
                        className="btn btn--secondary btn--xs"
                        onClick={() => handleCopy(f.url)}
                      >
                        🔗 Copy Link
                      </button>
                      <button 
                        className="btn btn--danger btn--xs"
                        onClick={() => handleDelete(f.filename)}
                      >
                        ✕ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {files.map(f => (
            <div key={f.filename} className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                {getExtBadge(f.filename)}
                <span className="text-mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  {(f.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="text-mono" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {f.filename}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                <button 
                  className="btn btn--secondary btn--xs" 
                  style={{ flex: 1 }}
                  onClick={() => handleCopy(f.url)}
                >
                  🔗 Copy
                </button>
                <button 
                  className="btn btn--danger btn--xs" 
                  onClick={() => handleDelete(f.filename)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
