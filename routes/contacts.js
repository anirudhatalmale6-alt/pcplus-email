const router = require('express').Router();
const pool = require('../db/pool');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const upload = multer({ dest: '/tmp/email-uploads/' });

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}

router.get('/', auth, async (req, res) => {
  try {
    const { list_id, status, search, page = 1, limit = 50 } = req.query;
    let where = [], params = [], i = 1;
    if (list_id) { where.push(`c.id IN (SELECT contact_id FROM contact_lists WHERE list_id=$${i++})`); params.push(list_id); }
    if (status) { where.push(`c.status=$${i++}`); params.push(status); }
    if (search) { where.push(`(c.email ILIKE $${i} OR c.first_name ILIKE $${i} OR c.last_name ILIKE $${i} OR c.company ILIKE $${i})`); params.push(`%${search}%`); i++; }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const offset = (page - 1) * limit;
    const countQ = await pool.query(`SELECT COUNT(*) FROM contacts c ${w}`, params);
    params.push(limit, offset);
    const { rows } = await pool.query(`
      SELECT c.*, array_agg(cl.list_id) FILTER (WHERE cl.list_id IS NOT NULL) as list_ids
      FROM contacts c LEFT JOIN contact_lists cl ON c.id=cl.contact_id
      ${w} GROUP BY c.id ORDER BY c.created_at DESC LIMIT $${i++} OFFSET $${i++}
    `, params);
    res.json({ ok: true, contacts: rows, total: parseInt(countQ.rows[0].count), page: parseInt(page), pages: Math.ceil(countQ.rows[0].count / limit) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, array_agg(cl.list_id) FILTER (WHERE cl.list_id IS NOT NULL) as list_ids
      FROM contacts c LEFT JOIN contact_lists cl ON c.id=cl.contact_id
      WHERE c.id=$1 GROUP BY c.id
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false });
    const logs = await pool.query('SELECT * FROM send_log WHERE contact_id=$1 ORDER BY sent_at DESC LIMIT 20', [req.params.id]);
    res.json({ ok: true, contact: rows[0], send_history: logs.rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { email, first_name, last_name, company, phone, tags, list_ids } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO contacts (email, first_name, last_name, company, phone, tags)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [email, first_name, last_name, company, phone, tags || []]
    );
    if (list_ids && list_ids.length) {
      for (const lid of list_ids) {
        await pool.query('INSERT INTO contact_lists (contact_id, list_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, lid]);
      }
      for (const lid of list_ids) {
        await pool.query('UPDATE lists SET contact_count=(SELECT COUNT(*) FROM contact_lists WHERE list_id=$1), updated_at=NOW() WHERE id=$1', [lid]);
      }
    }
    res.json({ ok: true, contact: rows[0] });
  } catch (e) {
    if (e.code === '23505') return res.json({ ok: false, error: 'Email already exists' });
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { email, first_name, last_name, company, phone, tags, status, list_ids } = req.body;
    await pool.query(
      `UPDATE contacts SET email=$1, first_name=$2, last_name=$3, company=$4, phone=$5, tags=$6, status=$7, updated_at=NOW() WHERE id=$8`,
      [email, first_name, last_name, company, phone, tags || [], status || 'active', req.params.id]
    );
    if (list_ids !== undefined) {
      const old = await pool.query('SELECT list_id FROM contact_lists WHERE contact_id=$1', [req.params.id]);
      const oldIds = old.rows.map(r => r.list_id);
      await pool.query('DELETE FROM contact_lists WHERE contact_id=$1', [req.params.id]);
      for (const lid of list_ids) {
        await pool.query('INSERT INTO contact_lists (contact_id, list_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, lid]);
      }
      const allIds = [...new Set([...oldIds, ...list_ids])];
      for (const lid of allIds) {
        await pool.query('UPDATE lists SET contact_count=(SELECT COUNT(*) FROM contact_lists WHERE list_id=$1), updated_at=NOW() WHERE id=$1', [lid]);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM contacts WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ ok: false, error: 'No file uploaded' });
  try {
    const list_id = req.body.list_id ? parseInt(req.body.list_id) : null;
    const records = [];
    const parser = fs.createReadStream(req.file.path).pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));
    for await (const row of parser) {
      records.push(row);
    }
    let imported = 0, skipped = 0;
    for (const row of records) {
      const email = (row.email || row.Email || row.EMAIL || '').trim().toLowerCase();
      if (!email || !email.includes('@')) { skipped++; continue; }
      try {
        const { rows } = await pool.query(
          `INSERT INTO contacts (email, first_name, last_name, company, phone)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET
           first_name=COALESCE(NULLIF($2,''), contacts.first_name),
           last_name=COALESCE(NULLIF($3,''), contacts.last_name),
           company=COALESCE(NULLIF($4,''), contacts.company),
           phone=COALESCE(NULLIF($5,''), contacts.phone),
           updated_at=NOW() RETURNING id`,
          [email, row.first_name || row.FirstName || '', row.last_name || row.LastName || '', row.company || row.Company || '', row.phone || row.Phone || '']
        );
        if (list_id) {
          await pool.query('INSERT INTO contact_lists (contact_id, list_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, list_id]);
        }
        imported++;
      } catch { skipped++; }
    }
    if (list_id) {
      await pool.query('UPDATE lists SET contact_count=(SELECT COUNT(*) FROM contact_lists WHERE list_id=$1), updated_at=NOW() WHERE id=$1', [list_id]);
    }
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, imported, skipped, total: records.length });
  } catch (e) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
