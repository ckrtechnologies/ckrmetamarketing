const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const orgRepo = require('../repositories/orgRepo');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role, org_id: user.org_id },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// POST /api/auth/register
// Creates a new org + owner user in one shot
async function register(req, res) {
  try {
    const { org_name, email, password, name } = req.body;
    if (!org_name || !email || !password || !name) {
      return res.status(400).json({ error: 'org_name, email, password, and name are required' });
    }

    // Derive slug from org name
    let slug = org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const exists = await orgRepo.orgSlugExists(slug);
    if (exists) slug = `${slug}-${uuidv4().split('-')[0]}`;

    // Check if email already used
    const existingUser = await orgRepo.getUserByEmail(email);
    if (existingUser) return res.status(409).json({ error: 'Email already registered' });

    // Create org
    const org = await orgRepo.createOrg(org_name, slug);

    // Hash password + create user as owner
    const password_hash = await bcrypt.hash(password, 12);
    const user = await orgRepo.createUser({ org_id: org.id, email, name, role: 'owner', password_hash });

    const token = generateToken(user);
    return res.status(201).json({
      message: 'Organization and account created successfully',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, org_id: user.org_id },
      org: { id: org.id, name: org.name, slug: org.slug },
    });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await orgRepo.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const org = await orgRepo.getOrgById(user.org_id);
    const token = generateToken(user);

    return res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, org_id: user.org_id },
      org: { id: org.id, name: org.name, slug: org.slug, plan: org.plan },
    });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const user = await orgRepo.getUserById(req.user.id);
    const org = await orgRepo.getOrgById(user.org_id);
    return res.json({ user, org });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/auth/invite  (owner/admin only)
async function invite(req, res) {
  try {
    const { email, name, role } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'email and name required' });

    const validRoles = ['admin', 'agent', 'viewer'];
    const assignedRole = validRoles.includes(role) ? role : 'agent';

    const existing = await orgRepo.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'User with this email already exists' });

    // Create with temp password (user must reset via email)
    const tempPassword = uuidv4().split('-')[0] + 'Aa1!';
    const password_hash = await bcrypt.hash(tempPassword, 12);
    const user = await orgRepo.createUser({ org_id: req.orgId, email, name, role: assignedRole, password_hash });

    return res.status(201).json({
      message: `${name} invited as ${assignedRole}. Temp password: ${tempPassword}`,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, me, invite };
