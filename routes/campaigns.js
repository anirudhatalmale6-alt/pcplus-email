const router = require('express').Router();
const pool = require('../db/pool');

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, t.name as template_name, l.name as list_name
      FROM campaigns c
      LEFT JOIN templates t ON c.template_id=t.id
      LEFT JOIN lists l ON c.list_id=l.id
      ORDER BY c.created_at DESC
    `);
    res.json({ ok: true, campaigns: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows: [campaign] } = await pool.query(`
      SELECT c.*, t.name as template_name, l.name as list_name
      FROM campaigns c
      LEFT JOIN templates t ON c.template_id=t.id
      LEFT JOIN lists l ON c.list_id=l.id
      WHERE c.id=$1
    `, [req.params.id]);
    if (!campaign) return res.status(404).json({ ok: false });
    const logs = await pool.query('SELECT * FROM send_log WHERE campaign_id=$1 ORDER BY sent_at DESC', [req.params.id]);
    res.json({ ok: true, campaign, logs: logs.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM campaigns WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
