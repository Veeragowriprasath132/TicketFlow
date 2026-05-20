/**
 * TicketFlow — Frontend App
 * Connects to TicketFlow backend API
 */

const API = 'http://localhost:8001';
let currentFilters = {};
let currentTicketId = null;
let allTeams = [];
let allAgents = [];

// ── Init ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  await loadTeams();
  await loadAgents();
  await loadDashboard();
  populateTeamFilter();
  populateCreateForm();
  updateSyncUrls();
});

// ── Theme ────────────────────────────────────────────────
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('tf-dark', !dark);
  document.getElementById('themeBtn').innerHTML = `<i class="ti ti-${dark ? 'moon' : 'sun'} icon"></i><span>Dark Mode</span>`;
}
function applyTheme() {
  if (localStorage.getItem('tf-dark') === 'true') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeBtn').innerHTML = `<i class="ti ti-sun icon"></i><span>Dark Mode</span>`;
  }
}

// ── Navigation ───────────────────────────────────────────
function nav(page, el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  const titles = { dashboard: 'Dashboard', tickets: 'All Tickets', create: 'New Ticket', teams: 'Teams', agents: 'Agents', sync: 'Sync to ServicePulse' };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  if (page === 'tickets') loadAllTickets();
  if (page === 'teams')   loadTeamsPage();
  if (page === 'agents')  loadAgentsPage();
}

// ── API Calls ─────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? null : await res.json();
  } catch (e) {
    console.error('API error:', e);
    throw e;
  }
}

// ── Load Teams ───────────────────────────────────────────
async function loadTeams() {
  try {
    allTeams = await apiFetch('/api/teams');
  } catch (e) {
    allTeams = [];
  }
}

async function loadAgents() {
  try {
    allAgents = await apiFetch('/api/agents');
  } catch (e) {
    allAgents = [];
  }
}

// ── Dashboard ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/summary');
    const k = data.kpis;

    document.getElementById('dashMetrics').innerHTML = `
      <div class="metric-card"><div class="metric-label">Total Tickets</div><div class="metric-value">${k.total_tickets}</div><div class="metric-sub">All time</div></div>
      <div class="metric-card"><div class="metric-label">Open</div><div class="metric-value" style="color:var(--accent)">${k.open_tickets}</div><div class="metric-sub">Needs attention</div></div>
      <div class="metric-card"><div class="metric-label">In Progress</div><div class="metric-value" style="color:var(--warning)">${k.in_progress}</div><div class="metric-sub">Being worked on</div></div>
      <div class="metric-card"><div class="metric-label">Resolved</div><div class="metric-value" style="color:var(--success)">${k.resolved}</div><div class="metric-sub">${k.resolution_rate}% rate</div></div>
      <div class="metric-card"><div class="metric-label">SLA Breaches</div><div class="metric-value" style="color:var(--danger)">${k.active_breaches}</div><div class="metric-sub">Overdue</div></div>
    `;

    // Recent tickets
    const tbody = document.getElementById('recentTicketsBody');
    tbody.innerHTML = data.recent_tickets.map(t => `
      <tr>
        <td><span class="td-id">${t.ticket_number}</span></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.subject}</td>
        <td>${t.team_name || '—'}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${formatDate(t.created_at)}</td>
      </tr>`).join('');

    // Team workload
    const max = Math.max(...data.teams.map(t => t.open), 1);
    document.getElementById('teamWorkload').innerHTML = data.teams.map(t => `
      <div class="wl-row">
        <div class="wl-name">${t.team_name}</div>
        <div class="wl-track"><div class="wl-fill" style="width:${(t.open/max*100)}%;background:var(--accent)"></div></div>
        <div class="wl-count">${t.open}</div>
      </div>`).join('');

  } catch (e) {
    document.getElementById('dashMetrics').innerHTML = `<div style="color:var(--danger);padding:16px">Cannot connect to TicketFlow backend. Make sure it's running on port 8001.</div>`;
  }
}

// ── All Tickets ───────────────────────────────────────────
async function loadAllTickets() {
  try {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(currentFilters).filter(([,v]) => v))
    ).toString();
    const data = await apiFetch(`/api/tickets${qs ? '?' + qs : ''}`);
    const tbody = document.getElementById('allTicketsBody');
    document.getElementById('ticketCount').textContent = `${data.total} tickets`;
    tbody.innerHTML = data.tickets.map(t => `
      <tr>
        <td><span class="td-id">${t.ticket_number}</span></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.subject}</td>
        <td>${t.team_name || '—'}</td>
        <td>${t.agent_name || '—'}</td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${formatDate(t.created_at)}</td>
        <td>
          <button class="action-btn" onclick="viewTicket(${t.id})" title="View"><i class="ti ti-eye"></i></button>
          <button class="action-btn" onclick="quickResolve(${t.id})" title="Resolve" style="color:var(--success)"><i class="ti ti-check"></i></button>
          <button class="action-btn" onclick="deleteTicket(${t.id})" title="Delete" style="color:var(--danger)"><i class="ti ti-trash"></i></button>
        </td>
      </tr>`).join('');
  } catch (e) {
    document.getElementById('allTicketsBody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:20px">Cannot load tickets. Backend may be offline.</td></tr>`;
  }
}

function filterTickets(field, value) {
  currentFilters[field] = value;
  loadAllTickets();
}

function clearFilters() {
  currentFilters = {};
  document.querySelectorAll('.filter-select').forEach(s => s.value = '');
  loadAllTickets();
}

function handleSearch(val) {
  currentFilters.search = val;
  if (document.getElementById('page-tickets').classList.contains('active')) loadAllTickets();
}

// ── Create Ticket ─────────────────────────────────────────
function populateCreateForm() {
  const teamSel = document.getElementById('ct-team');
  allTeams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id; opt.textContent = t.name;
    teamSel.appendChild(opt);
  });

  document.getElementById('ct-team').addEventListener('change', function() {
    const agentSel = document.getElementById('ct-agent');
    agentSel.innerHTML = '<option value="">Unassigned</option>';
    const teamAgents = allAgents.filter(a => a.team_id == this.value);
    teamAgents.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id; opt.textContent = a.name;
      agentSel.appendChild(opt);
    });
  });
}

async function submitTicket() {
  const subject  = document.getElementById('ct-subject').value.trim();
  const category = document.getElementById('ct-category').value;
  if (!subject || !category) { showToast('Please fill subject and category', 'warn'); return; }

  const data = {
    subject,
    description: document.getElementById('ct-desc').value,
    category,
    priority:     document.getElementById('ct-priority').value,
    team_id:      parseInt(document.getElementById('ct-team').value) || null,
    agent_id:     parseInt(document.getElementById('ct-agent').value) || null,
    reporter_name: document.getElementById('ct-reporter').value,
    reporter_email: document.getElementById('ct-email').value,
  };

  try {
    const ticket = await apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(data) });
    showToast(`✓ ${ticket.ticket_number} created successfully!`);
    clearCreateForm();
    await loadDashboard();
  } catch (e) {
    showToast('Failed to create ticket', 'error');
  }
}

function clearCreateForm() {
  ['ct-subject','ct-desc','ct-reporter','ct-email'].forEach(id => document.getElementById(id).value = '');
  ['ct-category','ct-priority','ct-team','ct-agent'].forEach(id => document.getElementById(id).selectedIndex = 0);
}

// ── Teams Page ────────────────────────────────────────────
async function loadTeamsPage() {
  const teams = await apiFetch('/api/teams');
  document.getElementById('teamGrid').innerHTML = teams.map(t => `
    <div class="team-card">
      <div class="team-name">${t.name}</div>
      <div class="team-desc">${t.description || ''}</div>
      <div class="team-stats">
        <div class="team-stat"><strong>${t.agent_count}</strong>Agents</div>
        <div class="team-stat"><strong>${t.open_tickets}</strong>Open</div>
        <div class="team-stat"><strong>${t.total_tickets}</strong>Total</div>
      </div>
    </div>`).join('');
}

// ── Agents Page ───────────────────────────────────────────
async function loadAgentsPage() {
  const agents = await apiFetch('/api/agents');
  const tbody = document.getElementById('agentsBody');
  tbody.innerHTML = agents.map(a => {
    const team = allTeams.find(t => t.id === a.team_id);
    return `<tr>
      <td style="font-weight:600">${a.name}</td>
      <td>${a.role || '—'}</td>
      <td>${team?.name || '—'}</td>
      <td style="color:var(--text-muted)">${a.email || '—'}</td>
      <td style="color:var(--accent);font-weight:600">${a.open_tickets}</td>
      <td style="color:var(--success);font-weight:600">${a.resolved_tickets}</td>
    </tr>`;
  }).join('');
}

// ── Ticket Detail Modal ───────────────────────────────────
async function viewTicket(id) {
  currentTicketId = id;
  const t = await apiFetch(`/api/tickets/${id}`);
  document.getElementById('modalTitle').textContent = `${t.ticket_number} — ${t.subject}`;
  document.getElementById('modalBody').innerHTML = `
    <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value">${statusBadge(t.status)}</span></div>
    <div class="detail-row"><span class="detail-label">Priority</span><span class="detail-value">${priorityBadge(t.priority)}</span></div>
    <div class="detail-row"><span class="detail-label">Category</span><span class="detail-value">${t.category || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Team</span><span class="detail-value">${t.team_name || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Agent</span><span class="detail-value">${t.agent_name || 'Unassigned'}</span></div>
    <div class="detail-row"><span class="detail-label">Reporter</span><span class="detail-value">${t.reporter_name || '—'} ${t.reporter_email ? `(${t.reporter_email})` : ''}</span></div>
    <div class="detail-row"><span class="detail-label">Created</span><span class="detail-value">${formatDate(t.created_at)}</span></div>
    <div class="detail-row"><span class="detail-label">SLA Due</span><span class="detail-value">${formatDate(t.sla_due_at)}</span></div>
    ${t.description ? `<div style="margin-top:10px;padding:10px;background:var(--bg-secondary);border-radius:var(--radius-md);font-size:13px;color:var(--text-secondary)">${t.description}</div>` : ''}
  `;
  document.getElementById('resolveBtn').style.display = t.status === 'Resolved' ? 'none' : 'flex';
  document.getElementById('ticketModal').classList.add('open');
}

function closeModal() {
  document.getElementById('ticketModal').classList.remove('open');
  currentTicketId = null;
}

async function resolveTicket() {
  if (!currentTicketId) return;
  await apiFetch(`/api/tickets/${currentTicketId}`, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) });
  showToast('✓ Ticket resolved!');
  closeModal();
  loadAllTickets();
  loadDashboard();
}

async function quickResolve(id) {
  await apiFetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) });
  showToast('✓ Ticket resolved!');
  loadAllTickets();
  loadDashboard();
}

async function deleteTicket(id) {
  if (!confirm('Delete this ticket?')) return;
  await apiFetch(`/api/tickets/${id}`, { method: 'DELETE' });
  showToast('Ticket deleted');
  loadAllTickets();
  loadDashboard();
}

// ── Sync to ServicePulse ──────────────────────────────────
function updateSyncUrls() {
  const base = window.location.hostname === 'localhost' ? 'http://localhost:8001' : window.location.origin;
  document.getElementById('syncSummaryUrl').textContent = `${base}/api/summary`;
  document.getElementById('syncTicketsUrl').textContent = `${base}/api/tickets`;
  document.getElementById('syncUrl').textContent        = `${base}/api/sync`;
}

async function testConnection() {
  const url = document.getElementById('servicePulseUrl').value.trim();
  const result = document.getElementById('syncResult');
  try {
    const res = await fetch(`${url}/health`);
    const data = await res.json();
    result.innerHTML = `<div class="sync-result-card success"><div class="sync-result-title">✅ Connected to ServicePulse</div><div class="sync-result-row">App: ${data.app} v${data.version}</div><div class="sync-result-row">Status: ${data.status}</div></div>`;
  } catch (e) {
    result.innerHTML = `<div class="sync-result-card error"><div class="sync-result-title">❌ Connection Failed</div><div class="sync-result-row">${e.message}</div></div>`;
  }
}

async function syncNow() {
  const url = document.getElementById('servicePulseUrl').value.trim();
  const result = document.getElementById('syncResult');
  result.innerHTML = `<div class="sync-result-card"><div class="sync-result-title">⏳ Syncing...</div></div>`;
  try {
    // Get summary from TicketFlow
    const summary = await apiFetch('/api/summary');
    result.innerHTML = `
      <div class="sync-result-card success">
        <div class="sync-result-title">✅ Sync Complete!</div>
        <div class="sync-result-row">📋 Total tickets: ${summary.kpis.total_tickets}</div>
        <div class="sync-result-row">✅ Resolved: ${summary.kpis.resolved}</div>
        <div class="sync-result-row">🔓 Open: ${summary.kpis.open_tickets}</div>
        <div class="sync-result-row">⚠️ Breaches: ${summary.kpis.active_breaches}</div>
        <div class="sync-result-row" style="margin-top:8px;font-size:11px;color:var(--text-muted)">
          Synced at: ${new Date().toLocaleTimeString()}
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--success)">
          ServicePulse can now pull this data from:<br/>
          <code>${window.location.hostname === 'localhost' ? 'http://localhost:8001' : window.location.origin}/api/summary</code>
        </div>
      </div>`;
    showToast('✓ Sync complete!');
  } catch (e) {
    result.innerHTML = `<div class="sync-result-card error"><div class="sync-result-title">❌ Sync Failed</div><div class="sync-result-row">${e.message}</div></div>`;
  }
}

// ── Team Filter ───────────────────────────────────────────
function populateTeamFilter() {
  const sel = document.getElementById('teamFilter');
  allTeams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id; opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

// ── CSV Export ────────────────────────────────────────────
async function exportCSV() {
  const data = await apiFetch('/api/tickets?page_size=200');
  const headers = ['Ticket ID','Subject','Team','Agent','Priority','Status','Category','Created'];
  const rows = data.tickets.map(t => [t.ticket_number, t.subject, t.team_name||'', t.agent_name||'', t.priority, t.status, t.category||'', t.created_at]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'ticketflow_export.csv' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast('✓ CSV exported!');
}

// ── Helpers ───────────────────────────────────────────────
function statusBadge(s) {
  const map = { 'Open':'badge-open','In Progress':'badge-progress','Resolved':'badge-resolved','SLA Breach':'badge-breach' };
  return `<span class="badge ${map[s]||'badge-open'}">${s}</span>`;
}
function priorityBadge(p) {
  const map = { 'High':'badge-high','Medium':'badge-medium','Low':'badge-low','Critical':'badge-critical' };
  return `<span class="badge ${map[p]||'badge-medium'}">${p}</span>`;
}
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = type === 'warn' ? '#BA7517' : type === 'error' ? '#A32D2D' : '#0F6E56';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
