const pool = require('./pool');

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      display_name VARCHAR(200),
      role VARCHAR(20) DEFAULT 'admin',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS lists (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      brevo_list_id INTEGER,
      contact_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      email VARCHAR(320) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      company VARCHAR(200),
      phone VARCHAR(50),
      tags TEXT[] DEFAULT '{}',
      status VARCHAR(20) DEFAULT 'active',
      brevo_id BIGINT,
      unsubscribed BOOLEAN DEFAULT FALSE,
      bounced BOOLEAN DEFAULT FALSE,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(email)
    );

    CREATE TABLE IF NOT EXISTS contact_lists (
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      list_id INTEGER REFERENCES lists(id) ON DELETE CASCADE,
      added_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (contact_id, list_id)
    );

    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      subject VARCHAR(500),
      html_content TEXT,
      text_content TEXT,
      brevo_template_id BIGINT,
      category VARCHAR(50) DEFAULT 'marketing',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      subject VARCHAR(500),
      from_name VARCHAR(200),
      from_email VARCHAR(320),
      reply_to VARCHAR(320),
      template_id INTEGER REFERENCES templates(id),
      list_id INTEGER REFERENCES lists(id),
      status VARCHAR(30) DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      brevo_campaign_id BIGINT,
      total_sent INTEGER DEFAULT 0,
      total_delivered INTEGER DEFAULT 0,
      total_opened INTEGER DEFAULT 0,
      total_clicked INTEGER DEFAULT 0,
      total_bounced INTEGER DEFAULT 0,
      total_unsubscribed INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS send_log (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
      email VARCHAR(320),
      subject VARCHAR(500),
      status VARCHAR(30) DEFAULT 'sent',
      brevo_message_id VARCHAR(200),
      opened_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      bounced_at TIMESTAMPTZ,
      error TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
    CREATE INDEX IF NOT EXISTS idx_send_log_campaign ON send_log(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_send_log_contact ON send_log(contact_id);
    CREATE INDEX IF NOT EXISTS idx_send_log_status ON send_log(status);
  `);

  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('admin', 10);
  await pool.query(`
    INSERT INTO users (username, password, display_name, role)
    VALUES ('admin', $1, 'Administrator', 'admin')
    ON CONFLICT (username) DO NOTHING
  `, [hash]);

  console.log('Database initialized');
}

init().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
