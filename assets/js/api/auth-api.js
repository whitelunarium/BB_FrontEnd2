// assets/js/api/auth-api.js
// Responsibility: Auth fetch workers — backend auth plus local user cache in page layer.

function _getAuthHeaders() {
  var token = localStorage.getItem('pnec_token');
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

function _storeAuthResult(data) {
  if (data && data.token) localStorage.setItem('pnec_token', data.token);
  if (data && data.user) localStorage.setItem('pnec_user', JSON.stringify(data.user));
}

function loginUser(email, password, remember) {
  return fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, remember }),
  })
    .then(validateResponse)
    .then(r => r.json())
    .then(data => { _storeAuthResult(data); return data; });
}

function registerUser(userData) {
  const payload = {
    name: userData.display_name,
    display_name: userData.display_name,
    email: userData.email,
    password: userData.password,
    neighborhood_id: userData.neighborhood_id,
  };
  return fetch(`${API_BASE}/api/user`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(validateResponse)
    .then(r => r.json())
    .then(data => { _storeAuthResult(data); return data; });
}

function logoutUser() {
  localStorage.removeItem('pnec_token');
  localStorage.removeItem('pnec_user');
  localStorage.removeItem('pnec_new_user');
  sessionStorage.removeItem('pnec_user');
  return fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: _getAuthHeaders(),
  }).catch(function() {});
}

function fetchCurrentUser() {
  return fetch(`${API_BASE}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: _getAuthHeaders(),
  })
    .then(function(response) {
      if (response.status === 401) return null;
      return response.json().then(function(data) { return data.user || null; });
    })
    .catch(function() { return null; });
}

function fetchNeighborhoodsForSelect() {
  return fetch(`${API_BASE}/api/neighborhoods`, {
    method: 'GET',
    credentials: 'include',
  })
    .then(validateResponse)
    .then(r => r.json())
    .then(data => data.neighborhoods || []);
}
