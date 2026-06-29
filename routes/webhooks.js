const router = require('express').Router();
const pool = require('../db/pool');

router.post('/brevo', async (req, res) => {
  try {
    const event = req.body;
    const messageId = event['message-id'];
    const eventType = event.event;
    const email = event.email;

    if (!messageId && !email) return res.json({ ok: true });

    let update = '';
    if (eventType === 'delivered') update = "status='delivered'";
    else if (eventType === 'opened' || eventType === 'unique_opened') update = "status='opened', opened_at=NOW()";
    else if (eventType === 'click') update = "status='clicked', clicked_at=NOW()";
    else if (eventType === 'hard_bounce' || eventType === 'soft_bounce') {
      update = "status='bounced', bounced_at=NOW()";
      if (email) await pool.query("UPDATE contacts SET bounced=true WHERE email=$1", [email]);
    } else if (eventType === 'unsubscribed') {
      if (email) await pool.query("UPDATE contacts SET unsubscribed=true WHERE email=$1", [email]);
      update = "status='unsubscribed'";
    } else if (eventType === 'spam') {
      if (email) await pool.query("UPDATE contacts SET unsubscribed=true, status='spam' WHERE email=$1", [email]);
      update = "status='spam'";
    }

    if (update && messageId) {
      await pool.query(`UPDATE send_log SET ${update} WHERE brevo_message_id=$1`, [messageId]);
      const log = await pool.query('SELECT campaign_id FROM send_log WHERE brevo_message_id=$1', [messageId]);
      if (log.rows.length && log.rows[0].campaign_id) {
        const cid = log.rows[0].campaign_id;
        await pool.query(`
          UPDATE campaigns SET
            total_delivered=(SELECT COUNT(*) FROM send_log WHERE campaign_id=$1 AND status IN ('delivered','opened','clicked')),
            total_opened=(SELECT COUNT(*) FROM send_log WHERE campaign_id=$1 AND opened_at IS NOT NULL),
            total_clicked=(SELECT COUNT(*) FROM send_log WHERE campaign_id=$1 AND clicked_at IS NOT NULL),
            total_bounced=(SELECT COUNT(*) FROM send_log WHERE campaign_id=$1 AND status='bounced'),
            total_unsubscribed=(SELECT COUNT(*) FROM send_log WHERE campaign_id=$1 AND status='unsubscribed')
          WHERE id=$1
        `, [cid]);
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    res.json({ ok: true });
  }
});

module.exports = router;
