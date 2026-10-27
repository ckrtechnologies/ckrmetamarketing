const path = require('path');
const fs = require('fs');

/**
 * Returns the resolved absolute path to the public CDN storage directory.
 * Ensures the directory exists with proper permissions (0o755).
 */
function getPublicDir() {
  const envPath = process.env.PUBLIC_DIR || 'public';
  const resolved = path.isAbsolute(envPath)
    ? envPath
    : path.resolve(__dirname, '../../', envPath);

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true, mode: 0o755 });
  }
  return resolved;
}

/**
 * Returns the resolved absolute path to an organization's public directory or subfolder.
 * Creates folders with 0o755 permissions.
 */
function getOrgPublicDir(orgId, subDir = '') {
  const base = getPublicDir();
  const orgDir = subDir
    ? path.join(base, String(orgId), subDir)
    : path.join(base, String(orgId));

  if (!fs.existsSync(orgDir)) {
    fs.mkdirSync(orgDir, { recursive: true, mode: 0o755 });
  }
  return orgDir;
}

module.exports = { getPublicDir, getOrgPublicDir };
