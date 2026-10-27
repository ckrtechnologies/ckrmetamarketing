import React, { useState, useEffect, useRef, useMemo } from 'react';
import { mediaAPI } from '../../api/media';

export default function MediaManager() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [filterType, setFilterType] = useState('ALL'); // 'ALL', 'DOCS', 'IMAGES', 'VIDEOS'
  const [search, setSearch] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(null);
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
      setError('Failed to load documents.');
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
      setError(err.response?.data?.error || 'Failed to upload document.');
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
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const getExt = (filename) => filename.split('.').pop()?.toLowerCase() || '';

  const getExtBadge = (filename) => {
    const ext = getExt(filename);
    if (['pdf'].includes(ext)) {
      return <span className="badge badge--red">PDF</span>;
    }
    if (['doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'].includes(ext)) {
      return <span className="badge badge--blue">{ext.toUpperCase()}</span>;
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return <span className="badge badge--green">IMG</span>;
    }
    if (['mp4', 'mov', 'webm', '3gp'].includes(ext)) {
      return <span className="badge badge--purple">VIDEO</span>;
    }
    return <span className="badge badge--gray">{ext.toUpperCase() || 'FILE'}</span>;
  };

  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      const ext = getExt(f.filename);
      const isDoc = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'].includes(ext);
      const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
      const isVid = ['mp4', 'mov', 'webm', '3gp'].includes(ext);

      if (filterType === 'DOCS' && !isDoc) return false;
      if (filterType === 'IMAGES' && !isImg) return false;
      if (filterType === 'VIDEOS' && !isVid) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        return f.filename.toLowerCase().includes(query);
      }
      return true;
    });
  }, [files, filterType, search]);

  const docCount = useMemo(() => {
    return files.filter(f => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'].includes(getExt(f.filename))).length;
  }, [files]);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📁 My Uploaded Documents</h1>
          <p>{filteredFiles.length} files • Only documents you upload appear here (user-generated chat files are excluded).</p>
        </div>
        
        <div className="page-header__actions">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            accept="application/pdf,.doc,.docx,.xls,.xlsx,.csv,image/jpeg,image/png,image/webp,video/mp4"
          />
          <button 
            className="btn btn--primary btn--sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload Document'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {[
            { id: 'ALL', label: `All Uploads (${files.length})` },
            { id: 'DOCS', label: `📄 Documents (${docCount})` },
            { id: 'IMAGES', label: '🖼️ Images' },
            { id: 'VIDEOS', label: '🎥 Videos' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn--xs ${filterType === tab.id ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setFilterType(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search documents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '5px 10px', fontSize: 12, width: 180 }}
          />

          <div className="day-picker">
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
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : filteredFiles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, marginBottom: 6, color: 'var(--text-primary)' }}>
            {search ? 'No matching documents found' : 'No documents uploaded yet'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginBottom: 14 }}>
            {search ? 'Try clearing your search query.' : 'Upload PDFs, invoices, brochures, or campaign media assets.'}
          </p>
          <button className="btn btn--primary btn--sm" onClick={() => fileInputRef.current?.click()}>
            📤 Upload Document
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
              {filteredFiles.map(f => (
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
                    <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <button 
                        className={`btn btn--xs ${copiedUrl === f.url ? 'btn--success' : 'btn--secondary'}`}
                        onClick={() => handleCopy(f.url)}
                      >
                        {copiedUrl === f.url ? '✓ Copied!' : '🔗 Copy Link'}
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
          {filteredFiles.map(f => (
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
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto', alignItems: 'center' }}>
                <button 
                  className={`btn btn--xs ${copiedUrl === f.url ? 'btn--success' : 'btn--secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => handleCopy(f.url)}
                >
                  {copiedUrl === f.url ? '✓ Copied!' : '🔗 Copy'}
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
