const router = require('express').Router();
const pool = require('../db/pool');

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const { category } = req.query;
    let q = 'SELECT * FROM templates';
    const params = [];
    if (category) { q += ' WHERE category=$1'; params.push(category); }
    q += ' ORDER BY updated_at DESC';
    const { rows } = await pool.query(q, params);
    res.json({ ok: true, templates: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM templates WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false });
    res.json({ ok: true, template: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, subject, html_content, text_content, category } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO templates (name, subject, html_content, text_content, category) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, subject, html_content, text_content, category || 'marketing']
    );
    res.json({ ok: true, template: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, subject, html_content, text_content, category } = req.body;
    await pool.query(
      'UPDATE templates SET name=$1, subject=$2, html_content=$3, text_content=$4, category=$5, updated_at=NOW() WHERE id=$6',
      [name, subject, html_content, text_content, category, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM templates WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const { rows: [orig] } = await pool.query('SELECT * FROM templates WHERE id=$1', [req.params.id]);
    if (!orig) return res.status(404).json({ ok: false });
    const { rows } = await pool.query(
      'INSERT INTO templates (name, subject, html_content, text_content, category) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [orig.name + ' (Copy)', orig.subject, orig.html_content, orig.text_content, orig.category]
    );
    res.json({ ok: true, template: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
