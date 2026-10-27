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

    const mediaList = [];

    // ONLY show files from the dedicated 'docs/' subfolder (files explicitly uploaded by the admin)
    if (fs.existsSync(docsDir)) {
      const docFiles = fs.readdirSync(docsDir);
      for (const filename of docFiles) {
        const filePath = path.join(docsDir, filename);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
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

    if (fs.existsSync(docsPath)) {
      fs.unlinkSync(docsPath);
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
