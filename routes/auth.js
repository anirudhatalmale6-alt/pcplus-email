const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    if (!rows.length) return res.json({ ok: false, error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.json({ ok: false, error: 'Invalid credentials' });
    req.session.user = { id: rows[0].id, username: rows[0].username, display_name: rows[0].display_name, role: rows[0].role };
    res.json({ ok: true, user: req.session.user });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  res.json({ ok: true, user: req.session.user });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.post('/change-password', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  try {
    const { current, newpass } = req.body;
    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [req.session.user.id]);
    const valid = await bcrypt.compare(current, rows[0].password);
    if (!valid) return res.json({ ok: false, error: 'Current password incorrect' });
    const hash = await bcrypt.hash(newpass, 10);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, req.session.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
