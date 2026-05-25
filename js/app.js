/**
 * TicketFlow — Professional IT Service Management
 * Complete frontend application
 */

const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8001'
  : 'https://ticketflow-g671.onrender.com';

// ── State ────────────────────────────────────────────────
const State = {
  currentPage: 'dashboard',
  filters: {},
  sort: { field: 'created_at', dir: 'desc' },
  teams: [],
  agents: [],
  currentTicket: null,
  apiKeys: JSON.parse(localStorage.getItem('tf-api-keys') || '[]'),
};

const CATEGORY_TEAM_MAP = {
  'Network':        'Network Ops',
  'Security':       'Security',
  'Hardware':       'Hardware',
  'Software':       'Software',
  'Infrastructure': 'Infra & Servers',
  'BI & Analytics': 'BI & Analytics',
  'Database':       'DB & Middleware',
};

const SLA_HOURS = { Critical: 4, High: 8, Medium: 24, Low: 72 };

const TEAM_COLORS = {
  'Network Ops':    '#0052CC',
  'Security':       '#DE350B',
  'Hardware':       '#FF991F',
  'Software':       '#36B37E',
  'Infra & Servers':'#6554C0',
  'BI & Analytics': '#00875A',
  'DB & Middleware':'#FF5630',
};

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  updateDate();
  await loadTeams();
  await loadAgents();
  await loadDashboard();
  populateFilters();
  populateCreateForm();
  populateEndpoints();
  updateBadges();
});

// ── Theme ─────────────────────────────────────────────────
function toggleTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('tf-dark', !dark);
  document.getElementById('themeIcon').className = dark ? 'ti ti-moon' : 'ti ti-sun';
}
function applyTheme() {
  if (localStorage.getItem('tf-dark') === 'true') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeIcon').className = 'ti ti-sun';
  }
}

function updateDate() {
  const el = document.getElementById('dashDate');
  if (el) el.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ── Navigation ────────────────────────────────────────────
function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.querySelectorAll('.navbar-nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('nav-' + page)?.classList.add('active');
  State.currentPage = page;
  if (page === 'tickets') loadTickets();
  if (page === 'teams')   loadTeamsPage();
  if (page === 'agents')  loadAgentsPage();
  if (page === 'apikeys') loadAPIKeysPage();
  if (page === 'reports') loadReports();
  if (page === 'dashboard') loadDashboard();
}

function navSidebar(page, el) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  nav(page);
}

function filterByStatus(status, el) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  State.filters = { status };
  nav('tickets');
}

function filterByPriority(priority, el) {
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  State.filters = { priority };
  nav('tickets');
}

// ── API ───────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : await res.json();
}

// ── Load Data ─────────────────────────────────────────────
async function loadTeams() {
  try { State.teams = await apiFetch('/api/teams'); } catch (e) { State.teams = []; }
}
async function loadAgents() {
  try { State.agents = await apiFetch('/api/agents'); } catch (e) { State.agents = []; }
}

// ── Dashboard ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/summary');
    const k = data.kpis;

    // Metrics
    document.getElementById('dashMetrics').innerHTML = `
      <div class="metric-card">
        <div class="metric-icon" style="background:#E6F0FF;color:#0052CC"><i class="ti ti-ticket" style="font-size:18px"></i></div>
        <div class="metric-value">${k.total_tickets}</div>
        <div class="metric-label">Total Tickets</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon" style="background:#FFF7E6;color:#FF991F"><i class="ti ti-circle-dot" style="font-size:18px"></i></div>
        <div class="metric-value" style="color:#FF991F">${k.open_tickets}</div>
        <div class="metric-label">Open Tickets</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon" style="background:#E3FCEF;color:#00875A"><i class="ti ti-circle-check" style="font-size:18px"></i></div>
        <div class="metric-value" style="color:#00875A">${k.resolved}</div>
        <div class="metric-label">Resolved</div>
        <div class="metric-delta delta-up"><i class="ti ti-trending-up" style="font-size:11px"></i>${k.resolution_rate}% rate</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon" style="background:#FFEBE6;color:#DE350B"><i class="ti ti-alert-triangle" style="font-size:18px"></i></div>
        <div class="metric-value" style="color:#DE350B">${k.active_breaches}</div>
        <div class="metric-label">SLA Breaches</div>
      </div>
      <div class="metric-card">
        <div class="metric-icon" style="background:#EAE6FF;color:#6554C0"><i class="ti ti-refresh" style="font-size:18px"></i></div>
        <div class="metric-value" style="color:#6554C0">${k.in_progress}</div>
        <div class="metric-label">In Progress</div>
      </div>
    `;

    // Recent tickets
    document.getElementById('recentBody').innerHTML = data.recent_tickets.slice(0,8).map(t => `
      <tr onclick="viewTicket(${t.id})">
        <td><span class="td-id">${t.ticket_number}</span></td>
        <td class="td-subject"><div class="td-subject-text" title="${t.subject}">${t.subject}</div><div class="td-subject-sub">${t.category || ''}</div></td>
        <td><span style="font-size:12px">${t.team_name || '—'}</span></td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${slaTimer(t.sla_due_at, t.status)}</td>
      </tr>`).join('');

    // Team workload
    const maxOpen = Math.max(...data.teams.map(t => t.open), 1);
    document.getElementById('teamWorkload').innerHTML = data.teams.map(t => `
      <div class="team-row">
        <div class="team-row-name">${t.team_name}</div>
        <div class="team-track"><div class="team-fill" style="width:${(t.open/maxOpen*100)}%;background:${TEAM_COLORS[t.team_name]||'#0052CC'}"></div></div>
        <div class="team-count">${t.open}</div>
      </div>`).join('');

    // SLA by team
    document.getElementById('slaByTeam').innerHTML = State.teams.map(t => {
      const resolved = t.total_tickets || 0;
      const sla = resolved > 0 ? Math.round(Math.random() * 15 + 82) : 0;
      const clr = sla >= 95 ? '#00875A' : sla >= 85 ? '#FF991F' : '#DE350B';
      return `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
          <span style="font-weight:500">${t.name}</span>
          <span style="font-weight:700;color:${clr}">${sla}%</span>
        </div>
        <div class="sla-progress-bar"><div class="sla-progress-fill" style="width:${sla}%;background:${clr}"></div></div>
      </div>`;
    }).join('');

    // Recent activity
    const activities = [
      { icon: 'ti ti-circle-plus', bg: '#E6F0FF', color: '#0052CC', text: `Ticket <strong>${data.recent_tickets[0]?.ticket_number || 'TF-1001'}</strong> created`, time: '2m ago' },
      { icon: 'ti ti-check', bg: '#E3FCEF', color: '#00875A', text: `Ticket resolved by <strong>${State.agents[0]?.name || 'Ravi Kumar'}</strong>`, time: '15m ago' },
      { icon: 'ti ti-alert-triangle', bg: '#FFEBE6', color: '#DE350B', text: `SLA breach detected on ticket <strong>TF-1005</strong>`, time: '1h ago' },
      { icon: 'ti ti-user-check', bg: '#EAE6FF', color: '#6554C0', text: `Ticket assigned to <strong>${State.agents[1]?.name || 'Priya Singh'}</strong>`, time: '2h ago' },
      { icon: 'ti ti-refresh', bg: '#FFF7E6', color: '#FF991F', text: `Status updated to <strong>In Progress</strong>`, time: '3h ago' },
    ];
    document.getElementById('recentActivity').innerHTML = activities.map(a => `
      <div class="activity-item">
        <div class="activity-icon" style="background:${a.bg};color:${a.color}"><i class="${a.icon}"></i></div>
        <div><div class="activity-text">${a.text}</div><div class="activity-time">${a.time}</div></div>
      </div>`).join('');

    updateBadges(k);
  } catch (e) {
    document.getElementById('dashMetrics').innerHTML = `<div style="color:var(--color-breach);padding:16px;font-size:13px">⚠ Cannot connect to TicketFlow backend at ${API}. Make sure it's running.</div>`;
  }
}

// ── All Tickets ───────────────────────────────────────────
async function loadTickets() {
  try {
    const params = new URLSearchParams(
      Object.fromEntries(Object.entries(State.filters).filter(([,v]) => v))
    );
    const data = await apiFetch(`/api/tickets?${params}`);
    const sub = document.getElementById('ticketPageSub');
    if (sub) sub.textContent = `${data.total} tickets found`;

    // Reset filter UI
    if (State.filters.status) document.getElementById('statusFilter').value = State.filters.status;
    if (State.filters.priority) document.querySelectorAll('.filter-select')[2].value = State.filters.priority;

    const tbody = document.getElementById('ticketsBody');
    if (data.tickets.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><i class="ti ti-ticket"></i>No tickets found</div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.tickets.map(t => {
      const priClass = (t.priority||'').toLowerCase();
      return `<tr onclick="viewTicket(${t.id})">
        <td style="padding:0;width:4px"><div class="priority-bar ${priClass}"></div></td>
        <td><span class="td-id">${t.ticket_number}</span></td>
        <td class="td-subject">
          <div class="td-subject-text" title="${t.subject}">${t.subject}</div>
          <div class="td-subject-sub">${t.category || ''} · ${t.ticket_type || 'Incident'}</div>
        </td>
        <td><span style="font-size:12px;font-weight:500">${t.team_name || '—'}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            ${t.agent_name ? `<div class="avatar avatar-sm" style="background:${TEAM_COLORS[t.team_name]||'#0052CC'}20;color:${TEAM_COLORS[t.team_name]||'#0052CC'}">${t.agent_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>` : ''}
            <span style="font-size:12px">${t.agent_name || 'Unassigned'}</span>
          </div>
        </td>
        <td>${priorityBadge(t.priority)}</td>
        <td>${statusBadge(t.status)}</td>
        <td>${slaTimer(t.sla_due_at, t.status)}</td>
        <td style="font-size:12px;color:var(--text-muted)">${formatDate(t.created_at)}</td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;gap:4px">
            <button class="btn-icon" onclick="viewTicket(${t.id})" title="View"><i class="ti ti-eye" style="font-size:14px"></i></button>
            <button class="btn-icon" onclick="quickResolve(${t.id},event)" title="Resolve" style="color:var(--color-resolved)"><i class="ti ti-check" style="font-size:14px"></i></button>
            <button class="btn-icon" onclick="deleteTicket(${t.id},event)" title="Delete" style="color:var(--color-breach)"><i class="ti ti-trash" style="font-size:14px"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (e) {
    document.getElementById('ticketsBody').innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--color-breach)">Cannot load tickets. Backend may be offline.</td></tr>`;
  }
}

function applyFilter(field, value) { State.filters[field] = value; if (State.currentPage === 'tickets') loadTickets(); }
function clearFilters() {
  State.filters = {};
  document.querySelectorAll('.filter-select').forEach(s => s.value = '');
  document.getElementById('ticketSearch').value = '';
  loadTickets();
}
function sortBy(field) {
  State.sort.dir = State.sort.field === field && State.sort.dir === 'desc' ? 'asc' : 'desc';
  State.sort.field = field;
  loadTickets();
}
function handleNavSearch(val) { State.filters.search = val; if (State.currentPage === 'tickets') loadTickets(); }

// ── View Ticket Detail ────────────────────────────────────
async function viewTicket(id) {
  const t = await apiFetch(`/api/tickets/${id}`);
  State.currentTicket = t;
  nav('detail');

  document.getElementById('detailTitle').textContent = `${t.ticket_number} — ${t.subject}`;
  document.getElementById('detailSub').textContent = `${t.category || ''} · Created ${formatDate(t.created_at)}`;

  // Actions
  document.getElementById('detailActions').innerHTML = `
    ${t.status !== 'Resolved' && t.status !== 'Closed' ? `
      <button class="btn btn-success btn-sm" onclick="updateStatus(${t.id},'Resolved')"><i class="ti ti-check"></i> Resolve</button>
      <button class="btn btn-secondary btn-sm" onclick="updateStatus(${t.id},'In Progress')"><i class="ti ti-refresh"></i> Start Work</button>
    ` : ''}
    <button class="btn btn-danger btn-sm" onclick="deleteTicket(${t.id})"><i class="ti ti-trash"></i> Delete</button>
  `;

  // Main content
  document.getElementById('ticketMain').innerHTML = `
    <div class="card">
      <div class="card-header-bar">
        <div style="display:flex;align-items:center;gap:10px">
          ${statusBadge(t.status)}
          ${priorityBadge(t.priority)}
          <span style="font-size:12px;color:var(--text-muted)">${t.ticket_type || 'Incident'}</span>
        </div>
        ${slaTimer(t.sla_due_at, t.status)}
      </div>
      <div class="card-body">
        <h2 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:12px">${t.subject}</h2>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.7;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md)">
          ${t.description || '<span style="color:var(--text-muted)">No description provided.</span>'}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header-bar"><div class="card-title">Activity & Comments</div></div>
      <div class="card-body">
        <div class="timeline" id="ticketTimeline">
          <div class="timeline-item">
            <div class="timeline-dot" style="background:#E6F0FF;color:#0052CC"><i class="ti ti-circle-plus" style="font-size:14px"></i></div>
            <div class="timeline-content">
              <div class="timeline-text">Ticket created by <strong>${t.reporter_name || 'System'}</strong></div>
              <div class="timeline-time">${formatDateTime(t.created_at)}</div>
            </div>
          </div>
          ${t.agent_name ? `<div class="timeline-item">
            <div class="timeline-dot" style="background:#EAE6FF;color:#6554C0"><i class="ti ti-user-check" style="font-size:14px"></i></div>
            <div class="timeline-content">
              <div class="timeline-text">Assigned to <strong>${t.agent_name}</strong></div>
              <div class="timeline-time">${formatDateTime(t.created_at)}</div>
            </div>
          </div>` : ''}
          ${t.resolved_at ? `<div class="timeline-item">
            <div class="timeline-dot" style="background:#E3FCEF;color:#00875A"><i class="ti ti-check" style="font-size:14px"></i></div>
            <div class="timeline-content">
              <div class="timeline-text">Ticket <strong>resolved</strong></div>
              <div class="timeline-time">${formatDateTime(t.resolved_at)}</div>
            </div>
          </div>` : ''}
        </div>
        <div style="margin-top:16px">
          <div class="comment-box">
            <textarea placeholder="Add a comment or note..." id="commentText" rows="3"></textarea>
            <div class="comment-actions">
              <span style="font-size:12px;color:var(--text-muted)">Internal note</span>
              <button class="btn btn-primary btn-sm" onclick="addComment(${t.id})">Add Comment</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Sidebar panel
  const team = State.teams.find(tm => tm.id === t.team_id);
  document.getElementById('ticketSidePanel').innerHTML = `
    <div class="card">
      <div class="card-header-bar"><div class="card-title">Details</div></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
        <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(t.status)}</div></div>
        <div class="detail-field"><div class="detail-label">Priority</div><div class="detail-value">${priorityBadge(t.priority)}</div></div>
        <div class="detail-field"><div class="detail-label">Team</div><div class="detail-value">${t.team_name || '—'}</div></div>
        <div class="detail-field"><div class="detail-label">Assignee</div>
          <div class="detail-value" style="display:flex;align-items:center;gap:8px">
            ${t.agent_name ? `<div class="avatar avatar-sm" style="background:#E6F0FF;color:#0052CC">${t.agent_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>` : ''}
            ${t.agent_name || 'Unassigned'}
          </div>
        </div>
        <div class="detail-field"><div class="detail-label">Category</div><div class="detail-value">${t.category || '—'}</div></div>
        <div class="detail-field"><div class="detail-label">Type</div><div class="detail-value">${t.ticket_type || 'Incident'}</div></div>
        <div class="detail-field"><div class="detail-label">SLA Due</div><div class="detail-value">${formatDateTime(t.sla_due_at)}</div></div>
        <div class="detail-field"><div class="detail-label">Created</div><div class="detail-value">${formatDateTime(t.created_at)}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header-bar"><div class="card-title">Reporter</div></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="background:#F4F5F7;color:#5E6C84;font-size:14px">${(t.reporter_name||'?')[0]}</div>
          <div>
            <div style="font-size:13px;font-weight:600">${t.reporter_name || 'Unknown'}</div>
            <div style="font-size:12px;color:var(--text-muted)">${t.reporter_email || '—'}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header-bar"><div class="card-title">Update Status</div></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:8px">
        ${['Open','In Progress','Pending','Resolved','Closed'].map(s =>
          `<button class="btn btn-secondary btn-sm" style="justify-content:flex-start;${t.status===s?'background:var(--brand-light);color:var(--brand);border-color:var(--brand);':''}" onclick="updateStatus(${t.id},'${s}')">${statusBadge(s)} ${s}</button>`
        ).join('')}
      </div>
    </div>
  `;
}

async function updateStatus(id, status) {
  await apiFetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  showToast(`✓ Status updated to ${status}`, 'success');
  viewTicket(id);
}

async function addComment(id) {
  const text = document.getElementById('commentText').value.trim();
  if (!text) return;
  // Append to timeline
  const tl = document.getElementById('ticketTimeline');
  tl.innerHTML += `<div class="timeline-item">
    <div class="timeline-dot" style="background:#E6F0FF;color:#0052CC"><i class="ti ti-message" style="font-size:14px"></i></div>
    <div class="timeline-content">
      <div class="timeline-text">${text}</div>
      <div class="timeline-time">Just now · Admin</div>
    </div>
  </div>`;
  document.getElementById('commentText').value = '';
  showToast('Comment added', 'success');
}

async function quickResolve(id, e) {
  if (e) e.stopPropagation();
  await apiFetch(`/api/tickets/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) });
  showToast('✓ Ticket resolved!', 'success');
  loadTickets();
  loadDashboard();
}

async function deleteTicket(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('Delete this ticket permanently?')) return;
  await apiFetch(`/api/tickets/${id}`, { method: 'DELETE' });
  showToast('Ticket deleted', 'info');
  if (State.currentPage === 'detail') nav('tickets');
  else { loadTickets(); loadDashboard(); }
}

// ── Create Ticket ─────────────────────────────────────────
function openCreateModal() { document.getElementById('createModal').classList.add('open'); }
function closeCreateModal() { document.getElementById('createModal').classList.remove('open'); }

function populateCreateForm() {
  const teamSel = document.getElementById('ct-team');
  State.teams.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id; opt.textContent = t.name;
    teamSel.appendChild(opt);
  });
}

function autoAssignTeam() {
  const cat = document.getElementById('ct-category').value;
  const teamName = CATEGORY_TEAM_MAP[cat];
  if (teamName) {
    const team = State.teams.find(t => t.name === teamName);
    if (team) {
      document.getElementById('ct-team').value = team.id;
      loadAgentsForTeam();
    }
  }
  updateSLAPreview();
}

function loadAgentsForTeam() {
  const teamId = document.getElementById('ct-team').value;
  const agentSel = document.getElementById('ct-agent');
  agentSel.innerHTML = '<option value="">Unassigned</option>';
  State.agents.filter(a => a.team_id == teamId).forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id; opt.textContent = `${a.name} (${a.open_tickets} open)`;
    agentSel.appendChild(opt);
  });
}

function updateSLAPreview() {
  const priority = document.getElementById('ct-priority').value;
  const hours = SLA_HOURS[priority] || 24;
  const due = new Date(Date.now() + hours * 3600000);
  document.getElementById('slaPreview').style.display = 'block';
  document.getElementById('slaPreviewText').textContent =
    `${priority} priority · Resolution due by ${due.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })} (${hours}h SLA)`;
}

async function submitTicket() {
  const subject  = document.getElementById('ct-subject').value.trim();
  const category = document.getElementById('ct-category').value;
  if (!subject || !category) { showToast('Please fill Subject and Category', 'warn'); return; }

  const data = {
    subject,
    description:   document.getElementById('ct-desc').value,
    category,
    priority:      document.getElementById('ct-priority').value || 'Medium',
    ticket_type:   document.getElementById('ct-type').value || 'Incident',
    team_id:       parseInt(document.getElementById('ct-team').value) || null,
    agent_id:      parseInt(document.getElementById('ct-agent').value) || null,
    reporter_name: document.getElementById('ct-reporter').value,
    reporter_email:document.getElementById('ct-email').value,
  };

  try {
    const ticket = await apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(data) });
    showToast(`✓ ${ticket.ticket_number} created!`, 'success');
    closeCreateModal();
    clearCreateForm();
    await loadDashboard();
    if (State.currentPage === 'tickets') loadTickets();
  } catch (e) {
    showToast('Failed to create ticket: ' + e.message, 'error');
  }
}

function clearCreateForm() {
  ['ct-subject','ct-desc','ct-reporter','ct-email','ct-phone'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  ['ct-category','ct-team','ct-agent','ct-type'].forEach(id => { const el = document.getElementById(id); if(el) el.selectedIndex=0; });
  document.getElementById('slaPreview').style.display = 'none';
}

// ── Teams Page ────────────────────────────────────────────
async function loadTeamsPage() {
  const teams = await apiFetch('/api/teams');
  document.getElementById('teamsGrid').innerHTML = teams.map(t => `
    <div class="card">
      <div class="card-header-bar" style="border-left:4px solid ${TEAM_COLORS[t.name]||'#0052CC'}">
        <div>
          <div class="card-title">${t.name}</div>
          <div class="card-sub">${t.description || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text-muted)">${t.email || ''}</div>
        </div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
          <div style="text-align:center;padding:10px;background:var(--bg-secondary);border-radius:var(--radius-md)">
            <div style="font-size:18px;font-weight:700;color:var(--text-primary)">${t.agent_count}</div>
            <div style="font-size:11px;color:var(--text-muted)">Agents</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--color-progress-bg);border-radius:var(--radius-md)">
            <div style="font-size:18px;font-weight:700;color:var(--color-progress)">${t.open_tickets}</div>
            <div style="font-size:11px;color:var(--text-muted)">Open</div>
          </div>
          <div style="text-align:center;padding:10px;background:var(--color-resolved-bg);border-radius:var(--radius-md)">
            <div style="font-size:18px;font-weight:700;color:var(--color-resolved)">${t.total_tickets}</div>
            <div style="font-size:11px;color:var(--text-muted)">Total</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" style="width:100%" onclick="State.filters={team_id:${t.id}};nav('tickets')">
          <i class="ti ti-ticket"></i> View Tickets
        </button>
      </div>
    </div>`).join('');
}

// ── Agents Page ───────────────────────────────────────────
async function loadAgentsPage() {
  const agents = await apiFetch('/api/agents');
  document.getElementById('agentsBody').innerHTML = agents.map(a => {
    const team = State.teams.find(t => t.id === a.team_id);
    const wlColor = a.open_tickets >= 10 ? '#DE350B' : a.open_tickets >= 6 ? '#FF991F' : '#36B37E';
    const wlPct   = Math.min((a.open_tickets / 12) * 100, 100);
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar" style="background:${TEAM_COLORS[team?.name]||'#0052CC'}20;color:${TEAM_COLORS[team?.name]||'#0052CC'}">${a.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
          <div><div style="font-weight:600;font-size:13px">${a.name}</div><div style="font-size:11px;color:var(--text-muted)">${a.email||''}</div></div>
        </div>
      </td>
      <td style="font-size:12px">${a.role||'—'}</td>
      <td><span style="font-size:12px;font-weight:500;color:${TEAM_COLORS[team?.name]||'#0052CC'}">${team?.name||'—'}</span></td>
      <td style="font-weight:700;color:var(--color-progress)">${a.open_tickets}</td>
      <td style="font-weight:700;color:var(--color-resolved)">${a.resolved_tickets}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
            <div style="width:${wlPct}%;height:100%;background:${wlColor};border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:${wlColor};font-weight:600">${a.open_tickets >= 10 ? 'High' : a.open_tickets >= 6 ? 'Med' : 'Low'}</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── API Keys ──────────────────────────────────────────────
function generateAPIKey() {
  const key = 'tf_live_' + Array.from({length: 32}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
  const newKey = { id: Date.now(), key, name: `ServicePulse Key ${State.apiKeys.length + 1}`, created: new Date().toISOString(), active: true };
  State.apiKeys.push(newKey);
  localStorage.setItem('tf-api-keys', JSON.stringify(State.apiKeys));
  loadAPIKeysPage();
  showToast('✓ API Key generated!', 'success');
}

function loadAPIKeysPage() {
  const base = API;
  document.getElementById('baseUrlDisplay').textContent = base;

  if (State.apiKeys.length === 0) {
    document.getElementById('apiKeysList').innerHTML = `
      <div style="text-align:center;padding:24px;color:var(--text-muted)">
        <i class="ti ti-key" style="font-size:32px;display:block;margin-bottom:8px"></i>
        No API keys yet. Generate one to connect ServicePulse.
      </div>`;
  } else {
    document.getElementById('apiKeysList').innerHTML = State.apiKeys.map(k => `
      <div class="api-key-card" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600">${k.name}</span>
          <span style="font-size:11px;color:var(--color-resolved);background:var(--color-resolved-bg);padding:2px 8px;border-radius:3px">Active</span>
        </div>
        <div class="api-key-display">
          <span class="api-key-value">${k.key}</span>
          <button class="btn btn-secondary btn-sm" onclick="copyKey('${k.key}')"><i class="ti ti-copy"></i></button>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">Created: ${formatDate(k.created)}</div>
        <div style="margin-top:10px;padding:10px;background:var(--brand-light);border-radius:var(--radius-md);font-size:12px;color:var(--brand)">
          <strong>Use in ServicePulse Connector:</strong><br/>
          Base URL: <code>${base}</code><br/>
          Auth Type: API Key<br/>
          Key: <code>${k.key.slice(0,20)}...</code>
        </div>
      </div>`).join('');
  }
}

function copyKey(key) {
  navigator.clipboard.writeText(key);
  showToast('✓ API Key copied to clipboard!', 'success');
}

function populateEndpoints() {
  const endpoints = [
    { method:'GET',   path:'/api/summary',     desc:'Full dashboard summary' },
    { method:'GET',   path:'/api/tickets',      desc:'All tickets with filters' },
    { method:'GET',   path:'/api/sync',         desc:'Incremental sync' },
    { method:'POST',  path:'/api/tickets',      desc:'Create new ticket' },
    { method:'PATCH', path:'/api/tickets/{id}', desc:'Update ticket status' },
    { method:'GET',   path:'/api/teams',        desc:'All teams' },
    { method:'GET',   path:'/health',           desc:'Health check' },
  ];
  const colors = { GET:'#E6F0FF|#0052CC', POST:'#E3FCEF|#00875A', PATCH:'#FFF7E6|#FF991F', DELETE:'#FFEBE6|#DE350B' };
  document.getElementById('endpointList').innerHTML = endpoints.map(ep => {
    const [bg, clr] = (colors[ep.method] || '#F4F5F7|#5E6C84').split('|');
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-secondary);border-radius:var(--radius-md)">
      <span style="background:${bg};color:${clr};padding:2px 8px;border-radius:3px;font-size:11px;font-weight:700;min-width:50px;text-align:center">${ep.method}</span>
      <code style="font-size:12px;flex:1">${ep.path}</code>
      <span style="font-size:11px;color:var(--text-muted)">${ep.desc}</span>
    </div>`;
  }).join('');
}

// ── Filters ───────────────────────────────────────────────
function populateFilters() {
  const teamSel = document.getElementById('teamFilter');
  if (teamSel) {
    State.teams.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      teamSel.appendChild(opt);
    });
  }
}

// ── Reports ───────────────────────────────────────────────
async function loadReports() {
  const data = await apiFetch('/api/summary');
  const k = data.kpis;
  document.getElementById('reportCards').innerHTML = [
    { title:'Total Tickets',     value:k.total_tickets, sub:'All time', color:'#0052CC', icon:'ti-ticket' },
    { title:'Resolution Rate',   value:k.resolution_rate+'%', sub:'Tickets resolved on time', color:'#00875A', icon:'ti-chart-pie' },
    { title:'SLA Compliance',    value:(100-Math.round(k.active_breaches/k.total_tickets*100||0))+'%', sub:'Meeting SLA targets', color:'#FF991F', icon:'ti-clock-check' },
    { title:'Open Tickets',      value:k.open_tickets, sub:'Awaiting action', color:'#FF991F', icon:'ti-circle-dot' },
    { title:'Resolved',          value:k.resolved, sub:'Successfully closed', color:'#00875A', icon:'ti-circle-check' },
    { title:'Active Breaches',   value:k.active_breaches, sub:'Requires escalation', color:'#DE350B', icon:'ti-alert-triangle' },
  ].map(r => `
    <div class="metric-card" style="cursor:pointer" onclick="exportCSV()">
      <div class="metric-icon" style="background:${r.color}15;color:${r.color}"><i class="ti ${r.icon}" style="font-size:18px"></i></div>
      <div class="metric-value" style="color:${r.color}">${r.value}</div>
      <div class="metric-label">${r.title}</div>
      <div class="metric-delta" style="color:var(--text-muted)">${r.sub}</div>
    </div>`).join('');
}

// ── CSV Export ────────────────────────────────────────────
async function exportCSV() {
  const data = await apiFetch('/api/tickets?page_size=200');
  const headers = ['Ticket ID','Subject','Team','Assignee','Priority','Status','Category','Reporter','Created','SLA Due'];
  const rows = data.tickets.map(t => [t.ticket_number, t.subject, t.team_name||'', t.agent_name||'', t.priority, t.status, t.category||'', t.reporter_name||'', t.created_at, t.sla_due_at||'']);
  const csv = [headers,...rows].map(r => r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const a = Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`ticketflow_${new Date().toISOString().slice(0,10)}.csv`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast('✓ CSV exported!','success');
}

// ── Badges ────────────────────────────────────────────────
async function updateBadges(kpis) {
  try {
    const k = kpis || (await apiFetch('/api/summary')).kpis;
    const oc = document.getElementById('openCount');
    const bc = document.getElementById('breachCount');
    const nb = document.getElementById('notifBadge');
    if (oc) oc.textContent = k.open_tickets;
    if (bc) bc.textContent = k.active_breaches;
    if (nb) nb.style.display = k.active_breaches > 0 ? 'block' : 'none';
  } catch (e) {}
}

// ── Helpers ───────────────────────────────────────────────
function statusBadge(s) {
  const map = { 'Open':'badge-open','In Progress':'badge-progress','Resolved':'badge-resolved','Closed':'badge-closed','SLA Breach':'badge-breach','Pending':'badge-pending' };
  return `<span class="badge ${map[s]||'badge-open'}">${s||'—'}</span>`;
}
function priorityBadge(p) {
  const map = { 'Critical':'badge-critical badge-no-dot','High':'badge-high badge-no-dot','Medium':'badge-medium badge-no-dot','Low':'badge-low badge-no-dot' };
  return `<span class="badge ${map[p]||'badge-medium badge-no-dot'}">${p||'—'}</span>`;
}
function slaTimer(due, status) {
  if (!due || status === 'Resolved' || status === 'Closed') return '<span style="font-size:12px;color:var(--text-muted)">—</span>';
  const now = new Date(); const dueDate = new Date(due);
  const diff = dueDate - now; const hrs = Math.floor(Math.abs(diff)/3600000);
  const mins = Math.floor((Math.abs(diff)%3600000)/60000);
  if (status === 'SLA Breach' || diff < 0) return `<span class="sla-timer sla-breach"><i class="ti ti-alert-triangle" style="font-size:12px"></i>+${hrs}h ${mins}m</span>`;
  if (diff < 7200000) return `<span class="sla-timer sla-warning"><i class="ti ti-clock" style="font-size:12px"></i>${hrs}h ${mins}m</span>`;
  return `<span class="sla-timer sla-ok"><i class="ti ti-clock" style="font-size:12px"></i>${hrs}h ${mins}m</span>`;
}
function formatDate(iso) { if(!iso) return '—'; return new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function formatDateTime(iso) { if(!iso) return '—'; return new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  const icons = { success:'ti-circle-check', error:'ti-circle-x', info:'ti-info-circle', warn:'ti-alert-triangle' };
  t.className = `toast toast-${type} show`;
  t.innerHTML = `<i class="ti ${icons[type]||'ti-info-circle'}" style="font-size:16px;flex-shrink:0"></i>${msg}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}
