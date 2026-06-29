/* PCPlus Email — Frontend Application */
let currentUser = null;
let currentPage = 'dashboard';
let contactsPage = 1;

// ── Utilities ──
function toast(msg, type='success') {
  const c = document.getElementById('toastContainer');
  const d = document.createElement('div');
  d.className = `toast toast-${type}`;
  d.textContent = msg;
  c.appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

async function api(url, opts={}) {
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
  return res.json();
}

function escHtml(s) { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-CA') + ' ' + new Date(d).toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'}) : '—'; }

// ── Auth ──
async function checkAuth() {
  const data = await api('/api/auth/me');
  if (data.ok) {
    currentUser = data.user;
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appWrapper').style.display = 'flex';
    document.getElementById('userDisplay').textContent = currentUser.display_name || currentUser.username;
    navigate('dashboard');
  } else {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appWrapper').style.display = 'none';
  }
}

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = await api('/api/auth/login', {
    method:'POST',
    body: JSON.stringify({ username: document.getElementById('loginUsername').value, password: document.getElementById('loginPassword').value })
  });
  if (data.ok) { currentUser = data.user; checkAuth(); }
  else { const el=document.getElementById('loginError'); el.style.display='block'; el.textContent=data.error; }
});

document.getElementById('logoutBtn').addEventListener('click', async e => {
  e.preventDefault();
  await api('/api/auth/logout', {method:'POST'});
  location.reload();
});

// ── Navigation ──
document.querySelectorAll('[data-page]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.page));
});

document.getElementById('mobileToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarBackdrop').classList.toggle('show');
});
document.getElementById('sidebarBackdrop').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
});

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('[data-page]').forEach(el => el.classList.toggle('active', el.dataset.page===page));
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('show');
  const render = { dashboard:renderDashboard, contacts:renderContacts, lists:renderLists, templates:renderTemplates, compose:renderCompose, campaigns:renderCampaigns, activity:renderActivity, settings:renderSettings };
  if (render[page]) render[page]();
}

// ── Dashboard ──
async function renderDashboard() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = '<div class="page-header"><h2><i class="bi bi-speedometer2"></i> Dashboard</h2></div><p style="color:var(--text-muted)">Loading...</p>';
  const data = await api('/api/dashboard');
  if (!data.ok) { mc.innerHTML += '<p style="color:var(--danger)">'+escHtml(data.error)+'</p>'; return; }
  const s = data.stats;
  mc.innerHTML = `
    <div class="page-header"><h2><i class="bi bi-speedometer2"></i> Dashboard</h2></div>
    <div class="grid-4" style="margin-bottom:20px;">
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div class="stat-value">${s.contacts.total}</div><div class="stat-label">Total Contacts</div></div>
          <div class="stat-icon" style="background:var(--primary-muted);color:var(--primary);"><i class="bi bi-people"></i></div>
        </div>
      </div>
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div class="stat-value">${s.lists}</div><div class="stat-label">Lists</div></div>
          <div class="stat-icon" style="background:rgba(46,160,67,.15);color:var(--success);"><i class="bi bi-collection"></i></div>
        </div>
      </div>
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div class="stat-value">${s.emails.total}</div><div class="stat-label">Emails Sent</div></div>
          <div class="stat-icon" style="background:rgba(88,166,255,.15);color:var(--info);"><i class="bi bi-envelope-check"></i></div>
        </div>
      </div>
      <div class="stat-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div class="stat-value">${s.campaigns.total}</div><div class="stat-label">Campaigns</div></div>
          <div class="stat-icon" style="background:rgba(210,153,34,.15);color:var(--warning);"><i class="bi bi-megaphone"></i></div>
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="card-dark">
        <div class="card-header">Email Performance</div>
        <div class="card-body">
          <div class="grid-3" style="text-align:center;">
            <div><div style="font-size:1.5rem;font-weight:600;color:var(--success);">${s.emails.delivered}</div><div class="stat-label">Delivered</div></div>
            <div><div style="font-size:1.5rem;font-weight:600;color:var(--info);">${s.emails.opened}</div><div class="stat-label">Opened</div></div>
            <div><div style="font-size:1.5rem;font-weight:600;color:var(--primary);">${s.emails.clicked}</div><div class="stat-label">Clicked</div></div>
          </div>
          ${parseInt(s.emails.total)>0?`<div style="margin-top:16px;display:flex;gap:12px;justify-content:center;">
            <span class="badge-status badge-active">Open Rate: ${(parseInt(s.emails.opened)/parseInt(s.emails.total)*100).toFixed(1)}%</span>
            <span class="badge-status badge-sent">Click Rate: ${(parseInt(s.emails.clicked)/parseInt(s.emails.total)*100).toFixed(1)}%</span>
            <span class="badge-status badge-failed">Bounce: ${(parseInt(s.emails.failed)/parseInt(s.emails.total)*100).toFixed(1)}%</span>
          </div>`:''}
        </div>
      </div>
      <div class="card-dark">
        <div class="card-header">Recent Campaigns</div>
        <div class="card-body" style="padding:0;">
          <table class="table-dark-custom">
            <thead><tr><th>Name</th><th>Sent</th><th>Opens</th><th>Date</th></tr></thead>
            <tbody>${data.recent_campaigns.length ? data.recent_campaigns.map(c=>`
              <tr><td>${escHtml(c.name)}</td><td>${c.total_sent}</td><td>${c.total_opened}</td><td>${fmtDate(c.sent_at)}</td></tr>
            `).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No campaigns yet</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── Contacts ──
async function renderContacts() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `
    <div class="page-header">
      <h2><i class="bi bi-people"></i> Contacts</h2>
      <div style="display:flex;gap:8px;">
        <button class="btn-outline-custom" onclick="importContactsModal()"><i class="bi bi-upload"></i> Import CSV</button>
        <button class="btn-primary-custom" onclick="addContactModal()"><i class="bi bi-plus-lg"></i> Add Contact</button>
      </div>
    </div>
    <div class="search-bar">
      <input class="form-control-dark" id="contactSearch" placeholder="Search contacts..." onkeyup="if(event.key==='Enter')loadContacts()">
      <select class="form-control-dark" id="contactStatusFilter" style="width:150px;" onchange="loadContacts()">
        <option value="">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
      </select>
      <select class="form-control-dark" id="contactListFilter" style="width:180px;" onchange="loadContacts()"><option value="">All Lists</option></select>
      <button class="btn-primary-custom" onclick="loadContacts()"><i class="bi bi-search"></i></button>
    </div>
    <div id="contactsTable"></div>`;
  const lists = await api('/api/lists');
  if (lists.ok) {
    const sel = document.getElementById('contactListFilter');
    lists.lists.forEach(l => { const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sel.appendChild(o); });
  }
  loadContacts();
}

async function loadContacts() {
  const search = document.getElementById('contactSearch')?.value || '';
  const status = document.getElementById('contactStatusFilter')?.value || '';
  const list_id = document.getElementById('contactListFilter')?.value || '';
  let url = `/api/contacts?page=${contactsPage}&limit=50`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (status) url += `&status=${status}`;
  if (list_id) url += `&list_id=${list_id}`;
  const data = await api(url);
  const tbl = document.getElementById('contactsTable');
  if (!data.ok) { tbl.innerHTML='<p style="color:var(--danger)">Error loading contacts</p>'; return; }
  tbl.innerHTML = `
    <div class="card-dark"><div class="card-body" style="padding:0;">
      <table class="table-dark-custom">
        <thead><tr><th><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)"></th><th>Email</th><th>Name</th><th>Company</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${data.contacts.map(c=>`
          <tr>
            <td><input type="checkbox" class="contact-cb" value="${c.id}"></td>
            <td>${escHtml(c.email)}</td>
            <td>${escHtml((c.first_name||'')+' '+(c.last_name||''))}</td>
            <td>${escHtml(c.company||'')}</td>
            <td><span class="badge-status badge-${c.unsubscribed?'inactive':c.status}">${c.unsubscribed?'Unsubscribed':c.status}</span></td>
            <td>${fmtDate(c.created_at)}</td>
            <td>
              <button class="btn-outline-custom btn-sm" onclick="editContactModal(${c.id})"><i class="bi bi-pencil"></i></button>
              <button class="btn-outline-custom btn-sm" onclick="sendToContact(${c.id},'${escHtml(c.email)}')"><i class="bi bi-envelope"></i></button>
              <button class="btn-danger-custom btn-sm" onclick="deleteContact(${c.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
      <span style="color:var(--text-muted);font-size:.85rem;">${data.total} contacts (page ${data.page} of ${data.pages})</span>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn-outline-custom btn-sm" onclick="contactsPage=1;loadContacts()" ${data.page<=1?'disabled':''}>First</button>
        <button class="btn-outline-custom btn-sm" onclick="contactsPage--;loadContacts()" ${data.page<=1?'disabled':''}>Prev</button>
        <span style="color:var(--text-muted);font-size:.85rem;">${data.page}/${data.pages}</span>
        <button class="btn-outline-custom btn-sm" onclick="contactsPage++;loadContacts()" ${data.page>=data.pages?'disabled':''}>Next</button>
        <button class="btn-outline-custom btn-sm" onclick="contactsPage=${data.pages};loadContacts()" ${data.page>=data.pages?'disabled':''}>Last</button>
        <button class="btn-primary-custom btn-sm" onclick="bulkSendSelected()"><i class="bi bi-envelope"></i> Send to Selected</button>
      </div>
    </div>`;
}

function toggleSelectAll(cb) { document.querySelectorAll('.contact-cb').forEach(c=>c.checked=cb.checked); }

function getSelectedContactIds() { return [...document.querySelectorAll('.contact-cb:checked')].map(c=>parseInt(c.value)); }

function addContactModal() { showContactForm({}); }

async function editContactModal(id) {
  const data = await api(`/api/contacts/${id}`);
  if (data.ok) showContactForm(data.contact);
}

async function showContactForm(contact) {
  const lists = await api('/api/lists');
  const listOpts = lists.ok ? lists.lists : [];
  const cLists = contact.list_ids || [];
  const isEdit = !!contact.id;
  showModal(isEdit?'Edit Contact':'Add Contact', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div><label class="form-label-dark">Email *</label><input class="form-control-dark" id="cEmail" value="${escHtml(contact.email||'')}" required></div>
      <div><label class="form-label-dark">Phone</label><input class="form-control-dark" id="cPhone" value="${escHtml(contact.phone||'')}"></div>
      <div><label class="form-label-dark">First Name</label><input class="form-control-dark" id="cFirst" value="${escHtml(contact.first_name||'')}"></div>
      <div><label class="form-label-dark">Last Name</label><input class="form-control-dark" id="cLast" value="${escHtml(contact.last_name||'')}"></div>
      <div><label class="form-label-dark">Company</label><input class="form-control-dark" id="cCompany" value="${escHtml(contact.company||'')}"></div>
      <div><label class="form-label-dark">Status</label><select class="form-control-dark" id="cStatus"><option value="active" ${contact.status==='active'?'selected':''}>Active</option><option value="inactive" ${contact.status==='inactive'?'selected':''}>Inactive</option></select></div>
    </div>
    <div style="margin-top:12px;"><label class="form-label-dark">Lists</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${listOpts.map(l=>`
        <label style="display:flex;align-items:center;gap:4px;color:var(--text-muted);font-size:.85rem;"><input type="checkbox" class="list-cb" value="${l.id}" ${cLists.includes(l.id)?'checked':''}> ${escHtml(l.name)}</label>
      `).join('')}</div>
    </div>
    <div style="margin-top:12px;"><label class="form-label-dark">Tags (comma-separated)</label><input class="form-control-dark" id="cTags" value="${(contact.tags||[]).join(', ')}"></div>
  `, async () => {
    const payload = {
      email: document.getElementById('cEmail').value,
      first_name: document.getElementById('cFirst').value,
      last_name: document.getElementById('cLast').value,
      company: document.getElementById('cCompany').value,
      phone: document.getElementById('cPhone').value,
      status: document.getElementById('cStatus').value,
      tags: document.getElementById('cTags').value.split(',').map(t=>t.trim()).filter(Boolean),
      list_ids: [...document.querySelectorAll('.list-cb:checked')].map(c=>parseInt(c.value))
    };
    const data = isEdit
      ? await api(`/api/contacts/${contact.id}`, {method:'PUT', body:JSON.stringify(payload)})
      : await api('/api/contacts', {method:'POST', body:JSON.stringify(payload)});
    if (data.ok) { closeModal(); toast(isEdit?'Contact updated':'Contact added'); loadContacts(); }
    else toast(data.error||'Error','error');
  });
}

async function deleteContact(id) {
  if (!confirm('Delete this contact?')) return;
  const data = await api(`/api/contacts/${id}`, {method:'DELETE'});
  if (data.ok) { toast('Contact deleted'); loadContacts(); }
  else toast(data.error||'Error','error');
}

function importContactsModal() {
  showModal('Import Contacts from CSV', `
    <p style="color:var(--text-muted);margin-bottom:12px;">Upload a CSV file with columns: email, first_name, last_name, company, phone</p>
    <div style="margin-bottom:12px;"><label class="form-label-dark">CSV File</label><input type="file" id="csvFile" accept=".csv" class="form-control-dark"></div>
    <div><label class="form-label-dark">Add to List (optional)</label><select class="form-control-dark" id="importListId"><option value="">No list</option></select></div>
  `, async () => {
    const file = document.getElementById('csvFile').files[0];
    if (!file) { toast('Select a file','error'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('list_id', document.getElementById('importListId').value);
    const res = await fetch('/api/contacts/import', {method:'POST', body:fd});
    const data = await res.json();
    if (data.ok) { closeModal(); toast(`Imported ${data.imported}, skipped ${data.skipped}`); loadContacts(); }
    else toast(data.error||'Error','error');
  });
  api('/api/lists').then(d => {
    if (!d.ok) return;
    const sel = document.getElementById('importListId');
    d.lists.forEach(l => { const o=document.createElement('option'); o.value=l.id; o.textContent=l.name; sel.appendChild(o); });
  });
}

function sendToContact(id, email) {
  navigate('compose');
  setTimeout(() => {
    const el = document.getElementById('composeToType');
    if (el) { el.value='single'; updateComposeTarget(); }
    const inp = document.getElementById('composeSingleEmail');
    if (inp) inp.value = email;
  }, 200);
}

function bulkSendSelected() {
  const ids = getSelectedContactIds();
  if (!ids.length) { toast('Select contacts first','error'); return; }
  navigate('compose');
  setTimeout(() => {
    const el = document.getElementById('composeToType');
    if (el) { el.value='selected'; updateComposeTarget(); }
    window._selectedContactIds = ids;
    const info = document.getElementById('composeSelectedInfo');
    if (info) info.textContent = `${ids.length} contacts selected`;
  }, 200);
}

// ── Lists ──
async function renderLists() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `<div class="page-header"><h2><i class="bi bi-collection"></i> Lists</h2>
    <button class="btn-primary-custom" onclick="addListModal()"><i class="bi bi-plus-lg"></i> New List</button></div><div id="listsGrid"></div>`;
  const data = await api('/api/lists');
  if (!data.ok) return;
  document.getElementById('listsGrid').innerHTML = `<div class="grid-3">${data.lists.map(l=>`
    <div class="card-dark" style="cursor:pointer;" onclick="viewList(${l.id})">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:1.1rem;font-weight:600;">${escHtml(l.name)}</div>
            <div style="color:var(--text-muted);font-size:.85rem;margin-top:4px;">${escHtml(l.description||'No description')}</div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="btn-outline-custom btn-sm" onclick="event.stopPropagation();editListModal(${l.id},'${escHtml(l.name)}','${escHtml(l.description||'')}')"><i class="bi bi-pencil"></i></button>
            <button class="btn-danger-custom btn-sm" onclick="event.stopPropagation();deleteList(${l.id})"><i class="bi bi-trash"></i></button>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:12px;">
          <span class="badge-status badge-active"><i class="bi bi-people"></i> ${l.contact_count} contacts</span>
          <span style="color:var(--text-muted);font-size:.75rem;">${fmtDate(l.updated_at)}</span>
        </div>
      </div>
    </div>`).join('')}</div>`;
}

function addListModal() {
  showModal('Create List', `
    <div style="margin-bottom:12px;"><label class="form-label-dark">List Name *</label><input class="form-control-dark" id="listName" placeholder="e.g. Real Estate Agents"></div>
    <div><label class="form-label-dark">Description</label><textarea class="form-control-dark" id="listDesc" placeholder="Optional description"></textarea></div>
  `, async () => {
    const data = await api('/api/lists', {method:'POST', body:JSON.stringify({name:document.getElementById('listName').value, description:document.getElementById('listDesc').value})});
    if (data.ok) { closeModal(); toast('List created'); renderLists(); } else toast(data.error,'error');
  });
}

function editListModal(id, name, desc) {
  showModal('Edit List', `
    <div style="margin-bottom:12px;"><label class="form-label-dark">List Name</label><input class="form-control-dark" id="listName" value="${escHtml(name)}"></div>
    <div><label class="form-label-dark">Description</label><textarea class="form-control-dark" id="listDesc">${escHtml(desc)}</textarea></div>
  `, async () => {
    await api(`/api/lists/${id}`, {method:'PUT', body:JSON.stringify({name:document.getElementById('listName').value, description:document.getElementById('listDesc').value})});
    closeModal(); toast('List updated'); renderLists();
  });
}

async function deleteList(id) {
  if (!confirm('Delete this list? Contacts will NOT be deleted.')) return;
  await api(`/api/lists/${id}`, {method:'DELETE'});
  toast('List deleted'); renderLists();
}

async function viewList(id) {
  document.getElementById('contactListFilter') || navigate('contacts');
  navigate('contacts');
  setTimeout(() => {
    const sel = document.getElementById('contactListFilter');
    if (sel) { sel.value=id; loadContacts(); }
  }, 300);
}

// ── Templates ──
async function renderTemplates() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `<div class="page-header"><h2><i class="bi bi-file-earmark-code"></i> Templates</h2>
    <button class="btn-primary-custom" onclick="addTemplateModal()"><i class="bi bi-plus-lg"></i> New Template</button></div><div id="templatesGrid"></div>`;
  const data = await api('/api/templates');
  if (!data.ok) return;
  document.getElementById('templatesGrid').innerHTML = data.templates.length ? `<div class="grid-3">${data.templates.map(t=>`
    <div class="card-dark">
      <div class="card-body">
        <div style="font-size:1rem;font-weight:600;">${escHtml(t.name)}</div>
        <div style="color:var(--text-muted);font-size:.85rem;margin-top:4px;">Subject: ${escHtml(t.subject||'(none)')}</div>
        <div style="margin-top:8px;"><span class="badge-status badge-${t.category==='transactional'?'sent':'draft'}">${t.category}</span></div>
        <div style="margin-top:12px;display:flex;gap:6px;">
          <button class="btn-outline-custom btn-sm" onclick="editTemplateModal(${t.id})"><i class="bi bi-pencil"></i> Edit</button>
          <button class="btn-outline-custom btn-sm" onclick="previewTemplate(${t.id})"><i class="bi bi-eye"></i></button>
          <button class="btn-outline-custom btn-sm" onclick="duplicateTemplate(${t.id})"><i class="bi bi-copy"></i></button>
          <button class="btn-danger-custom btn-sm" onclick="deleteTemplate(${t.id})"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`).join('')}</div>` : '<p style="color:var(--text-muted);text-align:center;padding:40px;">No templates yet. Create your first template to get started.</p>';
}

function addTemplateModal() { showTemplateForm({}); }

async function editTemplateModal(id) {
  const data = await api(`/api/templates/${id}`);
  if (data.ok) showTemplateForm(data.template);
}

function showTemplateForm(tpl) {
  const isEdit = !!tpl.id;
  showModal(isEdit?'Edit Template':'Create Template', `
    <div class="grid-2" style="margin-bottom:12px;">
      <div><label class="form-label-dark">Template Name *</label><input class="form-control-dark" id="tplName" value="${escHtml(tpl.name||'')}"></div>
      <div><label class="form-label-dark">Category</label><select class="form-control-dark" id="tplCategory"><option value="marketing" ${tpl.category==='marketing'?'selected':''}>Marketing</option><option value="transactional" ${tpl.category==='transactional'?'selected':''}>Transactional</option></select></div>
    </div>
    <div style="margin-bottom:12px;"><label class="form-label-dark">Subject Line</label><input class="form-control-dark" id="tplSubject" value="${escHtml(tpl.subject||'')}" placeholder="Email subject - use {{first_name}} for personalization"></div>
    <div style="margin-bottom:12px;">
      <label class="form-label-dark">HTML Content</label>
      <div style="color:var(--text-muted);font-size:.75rem;margin-bottom:4px;">Variables: {{first_name}}, {{last_name}}, {{email}}, {{company}}, {{phone}}</div>
      <textarea class="form-control-dark" id="tplHtml" style="min-height:250px;font-family:monospace;font-size:.8rem;">${escHtml(tpl.html_content||defaultTemplate())}</textarea>
    </div>
  `, async () => {
    const payload = {
      name: document.getElementById('tplName').value,
      subject: document.getElementById('tplSubject').value,
      html_content: document.getElementById('tplHtml').value,
      category: document.getElementById('tplCategory').value
    };
    const data = isEdit
      ? await api(`/api/templates/${tpl.id}`, {method:'PUT', body:JSON.stringify(payload)})
      : await api('/api/templates', {method:'POST', body:JSON.stringify(payload)});
    if (data.ok) { closeModal(); toast(isEdit?'Template updated':'Template created'); renderTemplates(); }
    else toast(data.error,'error');
  });
}

function defaultTemplate() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr><td style="padding:30px 40px;background:#0a1628;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:24px;">PC Plus Computing</h1>
    </td></tr>
    <tr><td style="padding:40px;">
      <h2 style="color:#333;margin-top:0;">Hello {{first_name}},</h2>
      <p style="color:#555;line-height:1.6;">Your email content here.</p>
      <p style="text-align:center;margin:30px 0;">
        <a href="#" style="background:#2596be;color:#fff;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;">Call to Action</a>
      </p>
    </td></tr>
    <tr><td style="padding:20px 40px;background:#f8f8f8;text-align:center;font-size:12px;color:#999;">
      <p>PC Plus Computing Inc.<br>604-760-1662 | 236-500-2700</p>
    </td></tr>
  </table>
</body></html>`;
}

async function previewTemplate(id) {
  const data = await api(`/api/templates/${id}`);
  if (!data.ok) return;
  showModal('Preview: '+data.template.name, `
    <div style="margin-bottom:8px;color:var(--text-muted);font-size:.85rem;">Subject: ${escHtml(data.template.subject||'(none)')}</div>
    <div class="template-preview">${data.template.html_content||'<p>No content</p>'}</div>
  `);
}

async function duplicateTemplate(id) {
  const data = await api(`/api/templates/${id}/duplicate`, {method:'POST'});
  if (data.ok) { toast('Template duplicated'); renderTemplates(); }
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template?')) return;
  await api(`/api/templates/${id}`, {method:'DELETE'});
  toast('Template deleted'); renderTemplates();
}

// ── Compose ──
async function renderCompose() {
  const lists = await api('/api/lists');
  const templates = await api('/api/templates');
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `
    <div class="page-header"><h2><i class="bi bi-pencil-square"></i> Compose Email</h2></div>
    <div class="card-dark"><div class="card-body">
      <div class="grid-2" style="margin-bottom:16px;">
        <div>
          <label class="form-label-dark">Send To</label>
          <select class="form-control-dark" id="composeToType" onchange="updateComposeTarget()">
            <option value="single">Single Contact</option>
            <option value="list">Entire List</option>
            <option value="selected">Selected Contacts</option>
          </select>
        </div>
        <div id="composeTargetDiv">
          <label class="form-label-dark">Email Address</label>
          <input class="form-control-dark" id="composeSingleEmail" placeholder="recipient@example.com">
        </div>
      </div>
      <div class="grid-2" style="margin-bottom:16px;">
        <div>
          <label class="form-label-dark">Template (optional)</label>
          <select class="form-control-dark" id="composeTemplate" onchange="loadTemplateContent()">
            <option value="">-- No template --</option>
            ${(templates.ok?templates.templates:[]).map(t=>`<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label-dark">Campaign Name (for bulk)</label>
          <input class="form-control-dark" id="composeCampaignName" placeholder="Optional campaign name">
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <label class="form-label-dark">Subject *</label>
        <input class="form-control-dark" id="composeSubject" placeholder="Email subject line">
      </div>
      <div style="margin-bottom:16px;">
        <label class="form-label-dark">HTML Content *</label>
        <div style="color:var(--text-muted);font-size:.75rem;margin-bottom:4px;">Variables: {{first_name}}, {{last_name}}, {{email}}, {{company}}</div>
        <textarea class="form-control-dark" id="composeHtml" style="min-height:300px;font-family:monospace;font-size:.8rem;">${defaultTemplate()}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn-outline-custom" onclick="sendTestEmail()"><i class="bi bi-send-check"></i> Send Test</button>
        <button class="btn-primary-custom" onclick="sendEmail()" style="padding:10px 24px;"><i class="bi bi-send"></i> Send Email</button>
      </div>
      <div id="sendResult" style="margin-top:16px;"></div>
    </div></div>`;
  window._composeListsData = lists.ok ? lists.lists : [];
}

function updateComposeTarget() {
  const type = document.getElementById('composeToType').value;
  const div = document.getElementById('composeTargetDiv');
  if (type==='single') {
    div.innerHTML = '<label class="form-label-dark">Email Address</label><input class="form-control-dark" id="composeSingleEmail" placeholder="recipient@example.com">';
  } else if (type==='list') {
    div.innerHTML = `<label class="form-label-dark">Select List</label><select class="form-control-dark" id="composeListId">
      ${(window._composeListsData||[]).map(l=>`<option value="${l.id}">${escHtml(l.name)} (${l.contact_count})</option>`).join('')}</select>`;
  } else {
    div.innerHTML = '<label class="form-label-dark">Selected Contacts</label><div id="composeSelectedInfo" class="form-control-dark" style="color:var(--text-muted);">Go to Contacts, select, then click Send to Selected</div>';
  }
}

async function loadTemplateContent() {
  const tid = document.getElementById('composeTemplate').value;
  if (!tid) return;
  const data = await api(`/api/templates/${tid}`);
  if (data.ok && data.template) {
    document.getElementById('composeSubject').value = data.template.subject || '';
    document.getElementById('composeHtml').value = data.template.html_content || '';
  }
}

async function sendTestEmail() {
  const email = prompt('Send test email to:');
  if (!email) return;
  const data = await api('/api/send/test', {method:'POST', body:JSON.stringify({
    to_email: email,
    subject: document.getElementById('composeSubject').value || 'Test Email',
    html_content: document.getElementById('composeHtml').value
  })});
  if (data.ok) toast('Test email sent!');
  else toast(data.error||'Failed to send test','error');
}

async function sendEmail() {
  const type = document.getElementById('composeToType').value;
  const subject = document.getElementById('composeSubject').value;
  const html_content = document.getElementById('composeHtml').value;
  if (!subject || !html_content) { toast('Subject and content required','error'); return; }

  const resultDiv = document.getElementById('sendResult');

  if (type==='single') {
    const email = document.getElementById('composeSingleEmail').value;
    if (!email) { toast('Enter an email address','error'); return; }
    const contacts = await api(`/api/contacts?search=${encodeURIComponent(email)}&limit=1`);
    if (!contacts.ok || !contacts.contacts.length) { toast('Contact not found. Add them first.','error'); return; }
    if (!confirm(`Send email to ${email}?`)) return;
    resultDiv.innerHTML = '<p style="color:var(--info);"><i class="bi bi-hourglass-split"></i> Sending...</p>';
    const data = await api('/api/send/single', {method:'POST', body:JSON.stringify({
      contact_id: contacts.contacts[0].id, subject, html_content
    })});
    resultDiv.innerHTML = data.ok
      ? '<p style="color:var(--success);"><i class="bi bi-check-circle"></i> Email sent successfully!</p>'
      : `<p style="color:var(--danger);"><i class="bi bi-x-circle"></i> ${escHtml(data.error)}</p>`;
  } else if (type==='list') {
    const list_id = document.getElementById('composeListId')?.value;
    if (!list_id) { toast('Select a list','error'); return; }
    const listName = window._composeListsData?.find(l=>l.id==list_id)?.name || 'this list';
    if (!confirm(`Send bulk email to all contacts in "${listName}"?`)) return;
    resultDiv.innerHTML = '<p style="color:var(--info);"><i class="bi bi-hourglass-split"></i> Sending to all contacts in list...</p>';
    const data = await api('/api/send/bulk', {method:'POST', body:JSON.stringify({
      list_id: parseInt(list_id), subject, html_content,
      campaign_name: document.getElementById('composeCampaignName').value
    })});
    resultDiv.innerHTML = data.ok
      ? `<p style="color:var(--success);"><i class="bi bi-check-circle"></i> Sent: ${data.sent}, Failed: ${data.failed}, Total: ${data.total}</p>`
      : `<p style="color:var(--danger);"><i class="bi bi-x-circle"></i> ${escHtml(data.error)}</p>`;
  } else if (type==='selected') {
    const ids = window._selectedContactIds || [];
    if (!ids.length) { toast('No contacts selected. Go to Contacts page first.','error'); return; }
    if (!confirm(`Send email to ${ids.length} selected contacts?`)) return;
    resultDiv.innerHTML = '<p style="color:var(--info);"><i class="bi bi-hourglass-split"></i> Sending to selected contacts...</p>';
    const data = await api('/api/send/bulk', {method:'POST', body:JSON.stringify({
      contact_ids: ids, subject, html_content,
      campaign_name: document.getElementById('composeCampaignName').value
    })});
    resultDiv.innerHTML = data.ok
      ? `<p style="color:var(--success);"><i class="bi bi-check-circle"></i> Sent: ${data.sent}, Failed: ${data.failed}, Total: ${data.total}</p>`
      : `<p style="color:var(--danger);"><i class="bi bi-x-circle"></i> ${escHtml(data.error)}</p>`;
  }
}

// ── Campaigns ──
async function renderCampaigns() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `<div class="page-header"><h2><i class="bi bi-megaphone"></i> Campaigns</h2></div><div id="campaignsList"></div>`;
  const data = await api('/api/campaigns');
  if (!data.ok) return;
  document.getElementById('campaignsList').innerHTML = data.campaigns.length ? `
    <div class="card-dark"><div class="card-body" style="padding:0;">
      <table class="table-dark-custom">
        <thead><tr><th>Name</th><th>Subject</th><th>List</th><th>Status</th><th>Sent</th><th>Opened</th><th>Clicked</th><th>Date</th><th></th></tr></thead>
        <tbody>${data.campaigns.map(c=>{
          const openRate = c.total_sent>0 ? (c.total_opened/c.total_sent*100).toFixed(1) : '0';
          return `<tr>
            <td style="font-weight:600;">${escHtml(c.name)}</td>
            <td>${escHtml(c.subject||'')}</td>
            <td>${escHtml(c.list_name||'—')}</td>
            <td><span class="badge-status badge-${c.status}">${c.status}</span></td>
            <td>${c.total_sent}</td>
            <td>${c.total_opened} (${openRate}%)</td>
            <td>${c.total_clicked}</td>
            <td>${fmtDate(c.sent_at||c.created_at)}</td>
            <td>
              <button class="btn-outline-custom btn-sm" onclick="viewCampaign(${c.id})"><i class="bi bi-eye"></i></button>
              <button class="btn-danger-custom btn-sm" onclick="deleteCampaign(${c.id})"><i class="bi bi-trash"></i></button>
            </td>
          </tr>`}).join('')}</tbody>
      </table>
    </div></div>` : '<p style="color:var(--text-muted);text-align:center;padding:40px;">No campaigns yet. Send your first bulk email to create one.</p>';
}

async function viewCampaign(id) {
  const data = await api(`/api/campaigns/${id}`);
  if (!data.ok) return;
  const c = data.campaign;
  showModal(`Campaign: ${c.name}`, `
    <div class="grid-3" style="margin-bottom:16px;text-align:center;">
      <div class="stat-card"><div class="stat-value" style="color:var(--info);">${c.total_sent}</div><div class="stat-label">Sent</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--success);">${c.total_opened}</div><div class="stat-label">Opened</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--primary);">${c.total_clicked}</div><div class="stat-label">Clicked</div></div>
    </div>
    <h4 style="margin:16px 0 8px;">Send Log</h4>
    <div style="max-height:300px;overflow-y:auto;">
      <table class="table-dark-custom">
        <thead><tr><th>Email</th><th>Status</th><th>Opened</th><th>Clicked</th><th>Sent</th></tr></thead>
        <tbody>${data.logs.map(l=>`
          <tr><td>${escHtml(l.email)}</td><td><span class="badge-status badge-${l.status}">${l.status}</span></td>
          <td>${l.opened_at?fmtDate(l.opened_at):'—'}</td><td>${l.clicked_at?fmtDate(l.clicked_at):'—'}</td><td>${fmtDate(l.sent_at)}</td></tr>
        `).join('')}</tbody>
      </table>
    </div>
  `);
}

async function deleteCampaign(id) {
  if (!confirm('Delete this campaign and its logs?')) return;
  await api(`/api/campaigns/${id}`, {method:'DELETE'});
  toast('Campaign deleted'); renderCampaigns();
}

// ── Activity Log ──
async function renderActivity() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `<div class="page-header"><h2><i class="bi bi-activity"></i> Activity Log</h2>
    <button class="btn-outline-custom" onclick="renderActivity()"><i class="bi bi-arrow-clockwise"></i> Refresh</button></div><div id="activityLog">Loading...</div>`;
  const data = await api('/api/campaigns');
  if (!data.ok) return;
  // Show recent send logs from all campaigns
  let allLogs = [];
  for (const c of data.campaigns.slice(0, 10)) {
    const d = await api(`/api/campaigns/${c.id}`);
    if (d.ok) allLogs = allLogs.concat(d.logs.map(l=>({...l, campaign_name:c.name})));
  }
  allLogs.sort((a,b) => new Date(b.sent_at)-new Date(a.sent_at));
  document.getElementById('activityLog').innerHTML = allLogs.length ? `
    <div class="card-dark"><div class="card-body" style="padding:0;">
      <table class="table-dark-custom">
        <thead><tr><th>Time</th><th>Campaign</th><th>Email</th><th>Status</th><th>Opened</th><th>Clicked</th></tr></thead>
        <tbody>${allLogs.slice(0,100).map(l=>`
          <tr><td>${fmtDate(l.sent_at)}</td><td>${escHtml(l.campaign_name||'—')}</td><td>${escHtml(l.email)}</td>
          <td><span class="badge-status badge-${l.status}">${l.status}</span></td>
          <td>${l.opened_at?fmtDate(l.opened_at):'—'}</td><td>${l.clicked_at?fmtDate(l.clicked_at):'—'}</td></tr>
        `).join('')}</tbody>
      </table>
    </div></div>` : '<p style="color:var(--text-muted);text-align:center;padding:40px;">No activity yet.</p>';
}

// ── Settings ──
async function renderSettings() {
  const mc = document.getElementById('mainContent');
  mc.innerHTML = `<div class="page-header"><h2><i class="bi bi-gear"></i> Settings</h2></div><div id="settingsContent">Loading...</div>`;
  const data = await api('/api/settings');
  const s = data.ok ? data.settings : {};
  document.getElementById('settingsContent').innerHTML = `
    <div class="grid-2">
      <div class="card-dark">
        <div class="card-header"><i class="bi bi-key"></i> Brevo API</div>
        <div class="card-body">
          <div style="margin-bottom:12px;"><label class="form-label-dark">API Key</label><input class="form-control-dark" id="setBrevoKey" value="${escHtml(s.brevo_api_key||'')}" placeholder="xkeysib-..."></div>
          <div style="display:flex;gap:8px;">
            <button class="btn-primary-custom" onclick="saveSettings()"><i class="bi bi-check-lg"></i> Save</button>
            <button class="btn-outline-custom" onclick="testBrevo()"><i class="bi bi-lightning"></i> Test Connection</button>
          </div>
          <div id="brevoTestResult" style="margin-top:12px;"></div>
        </div>
      </div>
      <div class="card-dark">
        <div class="card-header"><i class="bi bi-envelope"></i> Sender Settings</div>
        <div class="card-body">
          <div style="margin-bottom:12px;"><label class="form-label-dark">From Name</label><input class="form-control-dark" id="setFromName" value="${escHtml(s.from_name||'PC Plus Computing')}"></div>
          <div style="margin-bottom:12px;"><label class="form-label-dark">From Email</label><input class="form-control-dark" id="setFromEmail" value="${escHtml(s.from_email||'')}" placeholder="noreply@yourdomain.com"></div>
          <div style="margin-bottom:12px;"><label class="form-label-dark">Reply-To Email</label><input class="form-control-dark" id="setReplyTo" value="${escHtml(s.reply_to||'')}" placeholder="support@yourdomain.com"></div>
          <button class="btn-primary-custom" onclick="saveSettings()"><i class="bi bi-check-lg"></i> Save</button>
        </div>
      </div>
      <div class="card-dark">
        <div class="card-header"><i class="bi bi-link-45deg"></i> Webhook URL</div>
        <div class="card-body">
          <p style="color:var(--text-muted);font-size:.85rem;">Set this URL in your Brevo account under Settings > Webhooks to track opens, clicks, bounces, and unsubscribes:</p>
          <div class="form-control-dark" style="font-family:monospace;font-size:.8rem;word-break:break-all;cursor:pointer;" onclick="navigator.clipboard.writeText(this.textContent);toast('Copied!')">${location.origin}/api/webhooks/brevo</div>
        </div>
      </div>
      <div class="card-dark">
        <div class="card-header"><i class="bi bi-shield-lock"></i> Change Password</div>
        <div class="card-body">
          <div style="margin-bottom:12px;"><label class="form-label-dark">Current Password</label><input type="password" class="form-control-dark" id="setCurPass"></div>
          <div style="margin-bottom:12px;"><label class="form-label-dark">New Password</label><input type="password" class="form-control-dark" id="setNewPass"></div>
          <button class="btn-primary-custom" onclick="changePassword()"><i class="bi bi-check-lg"></i> Update Password</button>
        </div>
      </div>
    </div>`;
}

async function saveSettings() {
  const payload = {
    brevo_api_key: document.getElementById('setBrevoKey').value,
    from_name: document.getElementById('setFromName').value,
    from_email: document.getElementById('setFromEmail').value,
    reply_to: document.getElementById('setReplyTo').value
  };
  const data = await api('/api/settings', {method:'POST', body:JSON.stringify(payload)});
  if (data.ok) toast('Settings saved');
  else toast(data.error,'error');
}

async function testBrevo() {
  const div = document.getElementById('brevoTestResult');
  div.innerHTML = '<span style="color:var(--info);">Testing...</span>';
  const data = await api('/api/settings/test-brevo', {method:'POST'});
  div.innerHTML = data.ok
    ? `<span style="color:var(--success);"><i class="bi bi-check-circle"></i> Connected! Account: ${escHtml(data.account.company||'')} (${escHtml(data.account.plan||'')})</span>`
    : `<span style="color:var(--danger);"><i class="bi bi-x-circle"></i> ${escHtml(data.error)}</span>`;
}

async function changePassword() {
  const data = await api('/api/auth/change-password', {method:'POST', body:JSON.stringify({
    current: document.getElementById('setCurPass').value,
    newpass: document.getElementById('setNewPass').value
  })});
  if (data.ok) { toast('Password updated'); document.getElementById('setCurPass').value=''; document.getElementById('setNewPass').value=''; }
  else toast(data.error||'Error','error');
}

// ── Modal ──
function showModal(title, body, onSave) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalOverlay';
  overlay.innerHTML = `<div class="modal-dark">
    <div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="closeModal()">&times;</button></div>
    <div class="modal-body">${body}</div>
    ${onSave?'<div class="modal-footer"><button class="btn-outline-custom" onclick="closeModal()">Cancel</button><button class="btn-primary-custom" id="modalSaveBtn">Save</button></div>':'<div class="modal-footer"><button class="btn-outline-custom" onclick="closeModal()">Close</button></div>'}
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target===overlay) closeModal(); });
  if (onSave) document.getElementById('modalSaveBtn').addEventListener('click', onSave);
}

function closeModal() {
  const m = document.getElementById('modalOverlay');
  if (m) m.remove();
}

// ── Init ──
checkAuth();
