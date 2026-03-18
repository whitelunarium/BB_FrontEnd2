// assets/js/api/faq-api.js
// Responsibility: FAQ fetch workers — all HTTP calls related to the FAQ chatbot feature.
// These are WORKERS: they fetch and return data, no DOM manipulation.

/**
 * Purpose: Fetch all FAQ categories from the API.
 * @returns {Promise<Array>} Array of { id, name, icon, display_order } objects
 * Algorithm:
 * 1. GET /api/faq/categories
 * 2. Validate response
 * 3. Return categories array
 */
function fetchFaqCategories() {
  return fetch(`${API_BASE}/api/faq/categories`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.categories || []);
}

/**
 * Purpose: Fetch all FAQ items for a given category.
 * @param {number} categoryId - The category's database ID
 * @returns {Promise<Array>} Array of { id, question, answer, helpful_count } objects
 * Algorithm:
 * 1. GET /api/faq/items?category_id={categoryId}
 * 2. Validate response
 * 3. Return items array
 */
function fetchFaqItems(categoryId) {
  return fetch(`${API_BASE}/api/faq/items?category_id=${categoryId}`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.items || []);
}

/**
 * Purpose: Search FAQ items by keyword.
 * @param {string} query - Search string (3+ characters recommended)
 * @returns {Promise<Array>} Array of matching { id, question, answer, category_name } objects
 * Algorithm:
 * 1. Validate that query is not empty
 * 2. GET /api/faq/search?q={encoded query}
 * 3. Validate response
 * 4. Return results array
 */
function searchFaqItems(query) {
  if (!query || !query.trim()) return Promise.resolve([]);
  return fetch(`${API_BASE}/api/faq/search?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.results || []);
}

/**
 * Purpose: Submit a helpful/not-helpful vote for a FAQ item.
 * @param {number} itemId - FAQ item's database ID
 * @param {boolean} isHelpful - True for thumbs up, false for thumbs down
 * @returns {Promise<Object>} Updated helpful_count
 * Algorithm:
 * 1. POST to /api/faq/helpful/{itemId} with vote payload
 * 2. Validate response
 * 3. Return updated count object
 */
function submitFaqHelpfulVote(itemId, isHelpful) {
  return fetch(`${API_BASE}/api/faq/helpful/${itemId}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ helpful: isHelpful }),
  })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: Submit a question to PNEC staff.
 * @param {Object} questionData - { display_name, email, question_text }
 * @returns {Promise<Object>} Confirmation with question ID
 * Algorithm:
 * 1. POST question payload to /api/questions/submit
 * 2. Validate response
 * 3. Return confirmation object
 */
function submitUserQuestion(questionData) {
  return fetch(`${API_BASE}/api/questions/submit`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(questionData),
  })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: Fetch all open user questions (staff+ only).
 * @param {string} statusFilter - 'all', 'open', 'claimed', or 'answered'
 * @returns {Promise<Array>} Array of user question objects
 * Algorithm:
 * 1. GET /api/questions with optional status query param
 * 2. Validate response (will throw FORBIDDEN if not staff+)
 * 3. Return questions array
 */
function fetchUserQuestions(statusFilter) {
  const query = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
  return fetch(`${API_BASE}/api/questions${query}`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.questions || []);
}

/**
 * Purpose: Claim a user question for answering (staff+ only).
 * @param {number} questionId - Question's database ID
 * @returns {Promise<Object>} Updated question object
 * Algorithm:
 * 1. PATCH /api/questions/{questionId}/claim
 * 2. Validate response
 * 3. Return updated question
 */
function claimUserQuestion(questionId) {
  return fetch(`${API_BASE}/api/questions/${questionId}/claim`, {
    method: 'PATCH',
    credentials: 'include',
  })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: Submit an answer to a user question (staff+ only).
 * @param {number} questionId - Question's database ID
 * @param {string} answerText - Staff's answer text
 * @returns {Promise<Object>} Updated question object with answer
 * Algorithm:
 * 1. PATCH /api/questions/{questionId}/answer with answer payload
 * 2. Validate response
 * 3. Return updated question
 */
function answerUserQuestion(questionId, answerText) {
  return fetch(`${API_BASE}/api/questions/${questionId}/answer`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer_text: answerText }),
  })
    .then(validateResponse)
    .then(response => response.json());
}
