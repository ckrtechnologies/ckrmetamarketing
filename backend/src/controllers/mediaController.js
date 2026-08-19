const fs = require('fs');
const path = require('path');

function getBaseDir() {
  return process.env.PUBLIC_DIR || path.join(__dirname, '../../uploads');
}

function getOrgDir(orgId) {
  const dir = path.join(getBaseDir(), String(orgId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://cdn.ckrtechnologies.in';

async function uploadMedia(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const orgId = req.orgId;
    const orgDir = getOrgDir(orgId);
    
    // Create a safe, unique filename
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const timestamp = Date.now();
    const finalName = `${timestamp}_${safeName}`;
    const filePath = path.join(orgDir, finalName);
    
    fs.writeFileSync(filePath, req.file.buffer);

    const publicUrl = `${CDN_BASE_URL}/${orgId}/${finalName}`;

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
    const orgDir = getOrgDir(orgId);

    const files = fs.readdirSync(orgDir);
    const mediaList = files
      .map(filename => {
        const filePath = path.join(orgDir, filename);
        const stats = fs.statSync(filePath);
        return { filename, filePath, stats };
      })
      .filter(({ stats }) => stats.isFile())
      .map(({ filename, stats }) => ({
        filename,
        url: `${CDN_BASE_URL}/${orgId}/${filename}`,
        size: stats.size,
        created_at: stats.mtime
      }));

    // Sort by newest first
    mediaList.sort((a, b) => b.created_at - a.created_at);

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
    const orgDir = getOrgDir(orgId);
    
    // Prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(orgDir, safeFilename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
