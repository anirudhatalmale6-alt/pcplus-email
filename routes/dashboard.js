const router = require('express').Router();
const pool = require('../db/pool');

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const contacts = await pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='active') as active, COUNT(*) FILTER (WHERE unsubscribed=true) as unsubscribed FROM contacts");
    const lists = await pool.query('SELECT COUNT(*) as total FROM lists');
    const templates = await pool.query('SELECT COUNT(*) as total FROM templates');
    const campaigns = await pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='sent') as sent FROM campaigns");
    const emails = await pool.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='sent') as delivered, COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened, COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked, COUNT(*) FILTER (WHERE status='failed') as failed FROM send_log");
    const recent = await pool.query(`
      SELECT c.name, c.subject, c.status, c.total_sent, c.total_opened, c.sent_at
      FROM campaigns c ORDER BY c.created_at DESC LIMIT 5
    `);
    const dailySends = await pool.query(`
      SELECT DATE(sent_at) as day, COUNT(*) as count
      FROM send_log WHERE sent_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(sent_at) ORDER BY day
    `);
    res.json({
      ok: true,
      stats: {
        contacts: contacts.rows[0],
        lists: parseInt(lists.rows[0].total),
        templates: parseInt(templates.rows[0].total),
        campaigns: campaigns.rows[0],
        emails: emails.rows[0]
      },
      recent_campaigns: recent.rows,
      daily_sends: dailySends.rows
    });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
