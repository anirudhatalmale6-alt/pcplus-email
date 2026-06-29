const router = require('express').Router();
const pool = require('../db/pool');
const fetch = require('node-fetch');

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    if (settings.brevo_api_key) settings.brevo_api_key = '***' + settings.brevo_api_key.slice(-8);
    res.json({ ok: true, settings });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const entries = req.body;
    for (const [key, value] of Object.entries(entries)) {
      if (key === 'brevo_api_key' && value.startsWith('***')) continue;
      await pool.query(
        'INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
        [key, value]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/test-brevo', auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='brevo_api_key'");
    const apiKey = rows.length ? rows[0].value : process.env.BREVO_API_KEY;
    if (!apiKey) return res.json({ ok: false, error: 'No API key configured' });
    const resp = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey }
    });
    const data = await resp.json();
    if (!resp.ok) return res.json({ ok: false, error: data.message || 'Invalid API key' });
    res.json({ ok: true, account: { company: data.companyName, email: data.email, plan: data.plan?.[0]?.type } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/senders', auth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='brevo_api_key'");
    const apiKey = rows.length ? rows[0].value : process.env.BREVO_API_KEY;
    if (!apiKey) return res.json({ ok: false, error: 'No API key' });
    const resp = await fetch('https://api.brevo.com/v3/senders', { headers: { 'api-key': apiKey } });
    const data = await resp.json();
    res.json({ ok: true, senders: data.senders || [] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
