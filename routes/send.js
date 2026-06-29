const router = require('express').Router();
const pool = require('../db/pool');
const fetch = require('node-fetch');

function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  next();
}

async function getBrevoKey() {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key='brevo_api_key'");
  return rows.length ? rows[0].value : process.env.BREVO_API_KEY;
}

async function getSenderInfo() {
  const nameR = await pool.query("SELECT value FROM settings WHERE key='from_name'");
  const emailR = await pool.query("SELECT value FROM settings WHERE key='from_email'");
  return {
    name: nameR.rows.length ? nameR.rows[0].value : process.env.DEFAULT_FROM_NAME || 'PC Plus Computing',
    email: emailR.rows.length ? emailR.rows[0].value : process.env.DEFAULT_FROM_EMAIL || 'noreply@pcpluscomputing.com'
  };
}

function personalize(html, contact) {
  if (!html) return html;
  return html
    .replace(/\{\{first_name\}\}/gi, contact.first_name || '')
    .replace(/\{\{last_name\}\}/gi, contact.last_name || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{company\}\}/gi, contact.company || '')
    .replace(/\{\{phone\}\}/gi, contact.phone || '');
}

router.post('/single', auth, async (req, res) => {
  try {
    const { contact_id, subject, html_content, template_id } = req.body;
    const apiKey = await getBrevoKey();
    if (!apiKey) return res.json({ ok: false, error: 'Brevo API key not configured. Go to Settings.' });

    const { rows: [contact] } = await pool.query('SELECT * FROM contacts WHERE id=$1', [contact_id]);
    if (!contact) return res.json({ ok: false, error: 'Contact not found' });

    let html = html_content, subj = subject;
    if (template_id) {
      const { rows: [tpl] } = await pool.query('SELECT * FROM templates WHERE id=$1', [template_id]);
      if (tpl) { html = html || tpl.html_content; subj = subj || tpl.subject; }
    }
    html = personalize(html, contact);
    subj = personalize(subj, contact);

    const sender = await getSenderInfo();
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: sender.name, email: sender.email },
        to: [{ email: contact.email, name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() }],
        subject: subj,
        htmlContent: html
      })
    });
    const data = await resp.json();
    if (!resp.ok) return res.json({ ok: false, error: data.message || 'Brevo API error' });

    await pool.query(
      'INSERT INTO send_log (contact_id, email, subject, status, brevo_message_id) VALUES ($1,$2,$3,$4,$5)',
      [contact.id, contact.email, subj, 'sent', data.messageId]
    );
    res.json({ ok: true, messageId: data.messageId });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/bulk', auth, async (req, res) => {
  try {
    const { list_id, contact_ids, subject, html_content, template_id, campaign_name } = req.body;
    const apiKey = await getBrevoKey();
    if (!apiKey) return res.json({ ok: false, error: 'Brevo API key not configured. Go to Settings.' });

    let contacts;
    if (contact_ids && contact_ids.length) {
      const { rows } = await pool.query('SELECT * FROM contacts WHERE id=ANY($1) AND status=$2 AND unsubscribed=false', [contact_ids, 'active']);
      contacts = rows;
    } else if (list_id) {
      const { rows } = await pool.query(`
        SELECT c.* FROM contacts c JOIN contact_lists cl ON c.id=cl.contact_id
        WHERE cl.list_id=$1 AND c.status='active' AND c.unsubscribed=false
      `, [list_id]);
      contacts = rows;
    } else {
      return res.json({ ok: false, error: 'Provide list_id or contact_ids' });
    }
    if (!contacts.length) return res.json({ ok: false, error: 'No active contacts found' });

    let html = html_content, subj = subject;
    if (template_id) {
      const { rows: [tpl] } = await pool.query('SELECT * FROM templates WHERE id=$1', [template_id]);
      if (tpl) { html = html || tpl.html_content; subj = subj || tpl.subject; }
    }

    const { rows: [campaign] } = await pool.query(
      `INSERT INTO campaigns (name, subject, template_id, list_id, status, total_sent)
       VALUES ($1,$2,$3,$4,'sending',$5) RETURNING *`,
      [campaign_name || `Bulk Send ${new Date().toISOString().slice(0,16)}`, subj, template_id, list_id, contacts.length]
    );

    const sender = await getSenderInfo();
    let sent = 0, failed = 0;
    for (const contact of contacts) {
      try {
        const pHtml = personalize(html, contact);
        const pSubj = personalize(subj, contact);
        const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { name: sender.name, email: sender.email },
            to: [{ email: contact.email, name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() }],
            subject: pSubj,
            htmlContent: pHtml,
            tags: [campaign.name]
          })
        });
        const data = await resp.json();
        await pool.query(
          'INSERT INTO send_log (campaign_id, contact_id, email, subject, status, brevo_message_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [campaign.id, contact.id, contact.email, pSubj, resp.ok ? 'sent' : 'failed', data.messageId || null]
        );
        if (resp.ok) sent++; else failed++;
      } catch {
        failed++;
        await pool.query(
          'INSERT INTO send_log (campaign_id, contact_id, email, subject, status, error) VALUES ($1,$2,$3,$4,$5,$6)',
          [campaign.id, contact.id, contact.email, subj, 'failed', 'API request failed']
        );
      }
    }

    await pool.query(
      "UPDATE campaigns SET status='sent', sent_at=NOW(), total_sent=$1, total_delivered=$1 WHERE id=$2",
      [sent, campaign.id]
    );
    res.json({ ok: true, campaign_id: campaign.id, sent, failed, total: contacts.length });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/test', auth, async (req, res) => {
  try {
    const { to_email, subject, html_content } = req.body;
    const apiKey = await getBrevoKey();
    if (!apiKey) return res.json({ ok: false, error: 'Brevo API key not configured' });
    const sender = await getSenderInfo();
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: sender.name, email: sender.email },
        to: [{ email: to_email }],
        subject: subject || 'Test Email',
        htmlContent: html_content || '<p>This is a test email from PCPlus Email Marketing.</p>'
      })
    });
    const data = await resp.json();
    if (!resp.ok) return res.json({ ok: false, error: data.message });
    res.json({ ok: true, messageId: data.messageId });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

module.exports = router;
