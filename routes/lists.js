const router = require('express').Router();
const pool = require('../db/pool');

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM lists ORDER BY created_at DESC');
    res.json({ ok: true, lists: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const { rows } = await pool.query('INSERT INTO lists (name, description) VALUES ($1,$2) RETURNING *', [name, description]);
    res.json({ ok: true, list: rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    await pool.query('UPDATE lists SET name=$1, description=$2, updated_at=NOW() WHERE id=$3', [name, description, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM lists WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/:id/contacts', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.* FROM contacts c
      JOIN contact_lists cl ON c.id=cl.contact_id
      WHERE cl.list_id=$1 ORDER BY c.email
    `, [req.params.id]);
    res.json({ ok: true, contacts: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
