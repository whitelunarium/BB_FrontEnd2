// assets/js/api/admin-api.js
// Responsibility: Admin API workers — all HTTP calls for admin dashboard features.
// Pure fetch functions — no DOM, no side effects.

// ─── Users ────────────────────────────────────────────────────────────────────

function adminFetchUsers() {
  return fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' })
    .then(validateResponse).then(r => r.json()).then(d => d.users || []);
}

function adminUpdateUserRole(userId, role) {
  return fetch(`${API_BASE}/api/admin/users/${userId}/role`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  }).then(validateResponse).then(r => r.json());
}

function adminDeactivateUser(userId) {
  return fetch(`${API_BASE}/api/admin/users/${userId}/deactivate`, {
    method: 'PATCH', credentials: 'include',
  }).then(validateResponse).then(r => r.json());
}

// ─── Events ──────────────────────────────────────────────────────────────────

function adminFetchEvents() {
  return fetch(`${API_BASE}/api/events`, { credentials: 'include' })
    .then(validateResponse).then(r => r.json()).then(d => d.events || []);
}

function adminCreateEvent(data) {
  return fetch(`${API_BASE}/api/events`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminUpdateEvent(eventId, data) {
  return fetch(`${API_BASE}/api/events/${eventId}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminDeleteEvent(eventId) {
  return fetch(`${API_BASE}/api/events/${eventId}`, {
    method: 'DELETE', credentials: 'include',
  }).then(validateResponse).then(r => r.json());
}

// ─── Announcements ────────────────────────────────────────────────────────────

function adminFetchAnnouncements() {
  return fetch(`${API_BASE}/api/announcements/all`, { credentials: 'include' })
    .then(validateResponse).then(r => r.json()).then(d => d.announcements || []);
}

function adminCreateAnnouncement(data) {
  return fetch(`${API_BASE}/api/announcements`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminUpdateAnnouncement(id, data) {
  return fetch(`${API_BASE}/api/announcements/${id}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminDeleteAnnouncement(id) {
  return fetch(`${API_BASE}/api/announcements/${id}`, {
    method: 'DELETE', credentials: 'include',
  }).then(validateResponse).then(r => r.json());
}

// ─── Site Config ─────────────────────────────────────────────────────────────

function adminFetchSiteConfig() {
  return fetch(`${API_BASE}/api/site-config`, { credentials: 'include' })
    .then(validateResponse).then(r => r.json());
}

function adminUpdateConfigEntry(key, value) {
  return fetch(`${API_BASE}/api/site-config/${key}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  }).then(validateResponse).then(r => r.json());
}

function adminBulkUpdateConfig(updates) {
  return fetch(`${API_BASE}/api/site-config/bulk`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  }).then(validateResponse).then(r => r.json());
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function adminFetchFaqs() {
  return fetch(`${API_BASE}/api/faq`, { credentials: 'include' })
    .then(validateResponse).then(r => r.json()).then(d => d.faqs || d.faq || []);
}

function adminDeleteFaq(id) {
  return fetch(`${API_BASE}/api/faq/${id}`, {
    method: 'DELETE', credentials: 'include',
  }).then(validateResponse).then(r => r.json());
}

// ─── Media ───────────────────────────────────────────────────────────────────

function adminFetchMedia() {
  return fetch(`${API_BASE}/api/media?page=1`, { credentials: 'include' })
    .then(validateResponse).then(r => r.json());
}

function adminDeleteMedia(id) {
  return fetch(`${API_BASE}/api/media/${id}`, {
    method: 'DELETE', credentials: 'include',
  }).then(validateResponse).then(r => r.json());
}

// ─── Stats overview ──────────────────────────────────────────────────────────

function adminFetchStats() {
  return Promise.all([
    fetch(`${API_BASE}/api/admin/users`, { credentials: 'include' }).then(r => r.ok ? r.json() : { users: [] }),
    fetch(`${API_BASE}/api/events`,      { credentials: 'include' }).then(r => r.ok ? r.json() : { events: [] }),
    fetch(`${API_BASE}/api/faq`,         { credentials: 'include' }).then(r => r.ok ? r.json() : { faqs: [] }),
    fetch(`${API_BASE}/api/media?page=1`,{ credentials: 'include' }).then(r => r.ok ? r.json() : { total: 0 }),
    fetch(`${API_BASE}/api/announcements/all`, { credentials: 'include' }).then(r => r.ok ? r.json() : { announcements: [] }),
  ]).then(([users, events, faqs, media, anns]) => ({
    totalUsers:         (users.users || []).length,
    totalEvents:        (events.events || []).length,
    totalFaqs:          (faqs.faqs || faqs.faq || []).length,
    totalMedia:         media.total || 0,
    activeAnnouncements:(anns.announcements || []).filter(a => a.is_active).length,
    usersByRole:        _countByRole(users.users || []),
  }));
}

function _countByRole(users) {
  return users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
}
