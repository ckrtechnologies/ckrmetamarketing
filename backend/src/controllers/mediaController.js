const fs = require('fs');
const path = require('path');
const { getOrgPublicDir } = require('../utils/paths');

const CDN_BASE_URL = process.env.CDN_BASE_URL || 'http://localhost:5001/public';

async function uploadMedia(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const orgId = req.orgId;
    const docsDir = getOrgPublicDir(orgId, 'docs');
    
    // Create a safe, unique filename
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const timestamp = Date.now();
    const finalName = `${timestamp}_${safeName}`;
    const filePath = path.join(docsDir, finalName);
    
    fs.writeFileSync(filePath, req.file.buffer);

    const publicUrl = `${CDN_BASE_URL}/${orgId}/docs/${finalName}`;

    res.status(201).json({
      message: 'File uploaded successfully',
      filename: finalName,
      url: publicUrl,
      size: req.file.size
    });
  } catch (err) {
    console.error('[uploadMedia]', err);
    res.status(500).json({ error: err.message });
  }
}

async function listMedia(req, res) {
  try {
    const orgId = req.orgId;
    const docsDir = getOrgPublicDir(orgId, 'docs');
    const rootDir = getOrgPublicDir(orgId);

    const mediaList = [];
    const seenFilenames = new Set();

    // 1. All explicitly uploaded docs & assets from the dedicated 'docs/' subfolder
    if (fs.existsSync(docsDir)) {
      const docFiles = fs.readdirSync(docsDir);
      for (const filename of docFiles) {
        const filePath = path.join(docsDir, filename);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            seenFilenames.add(filename);
            mediaList.push({
              filename,
              url: `${CDN_BASE_URL}/${orgId}/docs/${filename}`,
              size: stats.size,
              created_at: stats.mtime
            });
          }
        } catch (_) {}
      }
    }

    // 2. Previously uploaded documents in rootDir (strictly excluding chat folder and chat media)
    const DOC_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];
    const CHAT_AUDIO_EXTS = ['.ogg', '.opus', '.oga', '.m4a', '.wav', '.mp3'];

    if (fs.existsSync(rootDir)) {
      const rootFiles = fs.readdirSync(rootDir);
      for (const filename of rootFiles) {
        if (filename === 'chat' || filename === 'docs') continue;
        if (seenFilenames.has(filename)) continue;

        const filePath = path.join(rootDir, filename);
        try {
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) continue;

          const ext = path.extname(filename).toLowerCase();
          // Exclude WhatsApp voice notes and inbound numeric webhook IDs
          if (CHAT_AUDIO_EXTS.includes(ext)) continue;
          if (/^\d+\.[a-zA-Z0-9]+$/.test(filename)) continue;

          // Only show documents or user-named files (not chat multimedia)
          if (DOC_EXTS.includes(ext) || (!filename.includes('_chat_') && !filename.startsWith('chat_'))) {
            // If it's an image/video, only include if it was an intentional user upload (e.g. has timestamp_name pattern and not in chat)
            mediaList.push({
              filename,
              url: `${CDN_BASE_URL}/${orgId}/${filename}`,
              size: stats.size,
              created_at: stats.mtime
            });
          }
        } catch (_) {}
      }
    }

    // Sort by newest first
    mediaList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ files: mediaList });
  } catch (err) {
    console.error('[listMedia]', err);
    res.status(500).json({ error: err.message });
  }
}

async function deleteMedia(req, res) {
  try {
    const { filename } = req.params;
    const orgId = req.orgId;
    const safeFilename = path.basename(filename);

    const docsPath = path.join(getOrgPublicDir(orgId, 'docs'), safeFilename);
    const rootPath = path.join(getOrgPublicDir(orgId), safeFilename);

    if (fs.existsSync(docsPath)) {
      fs.unlinkSync(docsPath);
      res.json({ message: 'File deleted' });
    } else if (fs.existsSync(rootPath)) {
      fs.unlinkSync(rootPath);
      res.json({ message: 'File deleted' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error('[deleteMedia]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { uploadMedia, listMedia, deleteMedia };
