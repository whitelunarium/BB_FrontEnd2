// assets/js/api/admin-api.js
// Responsibility: Admin API workers — all HTTP calls for admin dashboard features.
// Pure fetch functions — no DOM, no side effects.

function _admAuthHeaders() {
  const token = localStorage.getItem('pnec_token');
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

function _admFetch(url, opts) {
  const options = Object.assign({ credentials: 'include' }, opts || {});
  options.headers = Object.assign(_admAuthHeaders(), opts && opts.headers || {});
  return fetch(url, options);
}

// ─── Users ────────────────────────────────────────────────────────────────────

function adminFetchUsers() {
  return _admFetch(`${API_BASE}/api/admin/users`)
    .then(validateResponse).then(r => r.json()).then(d => d.users || []);
}

function adminUpdateUserRole(userId, role) {
  return _admFetch(`${API_BASE}/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }).then(validateResponse).then(r => r.json());
}

function adminDeactivateUser(userId) {
  return _admFetch(`${API_BASE}/api/admin/users/${userId}/deactivate`, {
    method: 'PATCH',
  }).then(validateResponse).then(r => r.json());
}

// ─── Events ──────────────────────────────────────────────────────────────────

function adminFetchEvents() {
  return _admFetch(`${API_BASE}/api/events`)
    .then(validateResponse).then(r => r.json()).then(d => d.events || []);
}

function adminCreateEvent(data) {
  return _admFetch(`${API_BASE}/api/events`, {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminUpdateEvent(eventId, data) {
  return _admFetch(`${API_BASE}/api/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminDeleteEvent(eventId) {
  return _admFetch(`${API_BASE}/api/events/${eventId}`, {
    method: 'DELETE',
  }).then(validateResponse).then(r => r.json());
}

// ─── Announcements ────────────────────────────────────────────────────────────

function adminFetchAnnouncements() {
  return _admFetch(`${API_BASE}/api/announcements/all`)
    .then(validateResponse).then(r => r.json()).then(d => d.announcements || []);
}

function adminCreateAnnouncement(data) {
  return _admFetch(`${API_BASE}/api/announcements`, {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminUpdateAnnouncement(id, data) {
  return _admFetch(`${API_BASE}/api/announcements/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminDeleteAnnouncement(id) {
  return _admFetch(`${API_BASE}/api/announcements/${id}`, {
    method: 'DELETE',
  }).then(validateResponse).then(r => r.json());
}

// ─── Site Config ─────────────────────────────────────────────────────────────

function adminFetchSiteConfig() {
  return _admFetch(`${API_BASE}/api/site-config`)
    .then(validateResponse).then(r => r.json());
}

function adminUpdateConfigEntry(key, value) {
  return _admFetch(`${API_BASE}/api/site-config/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  }).then(validateResponse).then(r => r.json());
}

function adminBulkUpdateConfig(updates) {
  return _admFetch(`${API_BASE}/api/site-config/bulk`, {
    method: 'PATCH',
    body: JSON.stringify({ updates }),
  }).then(validateResponse).then(r => r.json());
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function adminFetchFaqs() {
  return _admFetch(`${API_BASE}/api/faq`)
    .then(validateResponse).then(r => r.json()).then(d => d.faqs || d.faq || []);
}

function adminDeleteFaq(id) {
  return _admFetch(`${API_BASE}/api/faq/${id}`, {
    method: 'DELETE',
  }).then(validateResponse).then(r => r.json());
}

// ─── Media ───────────────────────────────────────────────────────────────────

function adminFetchMedia() {
  return _admFetch(`${API_BASE}/api/media?page=1`)
    .then(validateResponse).then(r => r.json());
}

function adminDeleteMedia(id) {
  return _admFetch(`${API_BASE}/api/media/${id}`, {
    method: 'DELETE',
  }).then(validateResponse).then(r => r.json());
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

function adminFetchBlogPosts() {
  return _admFetch(`${API_BASE}/api/blog?all=1`)
    .then(validateResponse).then(r => r.json()).then(d => d.posts || []);
}

function adminCreateBlogPost(data) {
  return _admFetch(`${API_BASE}/api/blog`, {
    method: 'POST',
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminUpdateBlogPost(id, data) {
  return _admFetch(`${API_BASE}/api/blog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }).then(validateResponse).then(r => r.json());
}

function adminDeleteBlogPost(id) {
  return _admFetch(`${API_BASE}/api/blog/${id}`, {
    method: 'DELETE',
  }).then(validateResponse).then(r => r.json());
}

// ─── Stats overview ──────────────────────────────────────────────────────────

function adminFetchStats() {
  const h = { credentials: 'include', headers: _admAuthHeaders() };
  return Promise.all([
    fetch(`${API_BASE}/api/admin/users`,       h).then(r => r.ok ? r.json() : { users: [] }),
    fetch(`${API_BASE}/api/events`,            h).then(r => r.ok ? r.json() : { events: [] }),
    fetch(`${API_BASE}/api/faq`,               h).then(r => r.ok ? r.json() : { faqs: [] }),
    fetch(`${API_BASE}/api/media?page=1`,      h).then(r => r.ok ? r.json() : { total: 0 }),
    fetch(`${API_BASE}/api/announcements/all`, h).then(r => r.ok ? r.json() : { announcements: [] }),
    fetch(`${API_BASE}/api/blog?all=1`,        h).then(r => r.ok ? r.json() : { posts: [] }),
  ]).then(([users, events, faqs, media, anns, blog]) => ({
    totalUsers:          (users.users || []).length,
    totalEvents:         (events.events || []).length,
    totalFaqs:           (faqs.faqs || faqs.faq || []).length,
    totalMedia:          media.total || 0,
    activeAnnouncements: (anns.announcements || []).filter(a => a.is_active).length,
    totalPosts:          (blog.posts || []).length,
    usersByRole:         _countByRole(users.users || []),
  }));
}

function _countByRole(users) {
  return users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});
}
