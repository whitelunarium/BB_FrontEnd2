// assets/js/ui/chatbot-ui.js
// Responsibility: Chatbot DOM workers — all panel rendering and screen transition logic.
// These are WORKERS: they update the DOM, no fetch calls.

/**
 * Purpose: Render the category grid on the welcome screen.
 * @param {Array} categories - Array of { id, name, icon } category objects
 * @returns {void}
 * Algorithm:
 * 1. Find the categories container
 * 2. Clear the loading spinner
 * 3. Build a button for each category
 * 4. Insert all buttons into the DOM
 */
function renderCategoryGrid(categories) {
  const container = document.getElementById('chatbot-categories');
  if (!container) return;

  if (!categories.length) {
    container.innerHTML = '<p style="font-size:13px;color:#9e9e9e;text-align:center">No topics available.</p>';
    return;
  }

  container.innerHTML = categories.map(category => `
    <button class="chatbot-category-btn"
            data-category-id="${category.id}"
            data-category-name="${escapeHtml(category.name)}"
            aria-label="Browse ${escapeHtml(category.name)} questions">
      <span class="cat-icon" aria-hidden="true">${escapeHtml(category.icon || '📋')}</span>
      <span class="cat-name">${escapeHtml(category.name)}</span>
    </button>`
  ).join('');
}

/**
 * Purpose: Render the question list for a selected category.
 * @param {Array} items - Array of { id, question } FAQ items
 * @param {string} categoryName - Display name of the category
 * @returns {void}
 * Algorithm:
 * 1. Update the category screen title
 * 2. Clear and populate the question list
 * 3. Show empty state if no items
 */
function renderQuestionList(items, categoryName) {
  const titleEl = document.getElementById('category-screen-title');
  const listEl  = document.getElementById('chatbot-question-list');
  if (!listEl) return;

  if (titleEl) titleEl.textContent = categoryName;

  if (!items.length) {
    listEl.innerHTML = '<li style="padding:16px 0;color:#9e9e9e;font-size:13px">No questions in this category yet.</li>';
    return;
  }

  listEl.innerHTML = items.map(item => `
    <li class="chatbot-question-item"
        data-item-id="${item.id}"
        role="button"
        tabindex="0"
        aria-label="${escapeHtml(item.question)}">
      ${escapeHtml(item.question)}
    </li>`
  ).join('');
}

/**
 * Purpose: Render the answer view for a selected FAQ item.
 * @param {Object} item - { id, question, answer }
 * @returns {void}
 * Algorithm:
 * 1. Set the question text in the answer header
 * 2. Render the answer with basic markdown (bold, paragraphs, lists)
 * 3. Reset feedback buttons to neutral state
 */
function renderAnswerView(item) {
  const questionEl = document.getElementById('answer-question-text');
  const answerEl   = document.getElementById('answer-body');
  if (!questionEl || !answerEl) return;

  questionEl.textContent = item.question;
  answerEl.innerHTML = renderMarkdown(item.answer);

  // Store item ID for feedback submission
  answerEl.dataset.itemId = item.id;

  resetFeedbackButtons();
}

/**
 * Purpose: Render search results in the welcome screen.
 * @param {Array} results - Array of { id, question, category_name } objects
 * @param {string} query - The search query that produced these results
 * @returns {void}
 * Algorithm:
 * 1. If no results: show empty state with "Ask a staff member" CTA
 * 2. Otherwise: render each result as a clickable row with category label
 */
function renderSearchResults(results, query) {
  const container   = document.getElementById('chatbot-search-results');
  const categoriesEl = document.getElementById('chatbot-categories');
  if (!container) return;

  if (categoriesEl) categoriesEl.style.display = 'none';
  container.style.display = 'block';

  if (!results.length) {
    container.innerHTML = `
      <div class="no-results">
        <p>No results for "<strong>${escapeHtml(query)}</strong>"</p>
        <p>Can't find what you need?</p>
        <button class="btn btn-outline-red btn-sm" id="no-results-ask-btn">
          Ask a Staff Member
        </button>
      </div>`;
    return;
  }

  container.innerHTML = results.map(result => `
    <div class="search-result-item"
         data-item-id="${result.id}"
         role="button"
         tabindex="0"
         aria-label="${escapeHtml(result.question)}">
      <div class="result-question">${escapeHtml(result.question)}</div>
      <div class="result-category">${escapeHtml(result.category_name || '')}</div>
    </div>`
  ).join('');
}

/**
 * Purpose: Hide search results and restore the category grid.
 * @returns {void}
 */
function clearSearchResults() {
  const container    = document.getElementById('chatbot-search-results');
  const categoriesEl = document.getElementById('chatbot-categories');
  if (container)    { container.style.display = 'none'; container.innerHTML = ''; }
  if (categoriesEl)  categoriesEl.style.display = 'grid';
}

/**
 * Purpose: Pre-fill the ask-staff form with data from the logged-in user.
 * @param {Object|null} user - { display_name, email } or null if not logged in
 * @returns {void}
 * Algorithm:
 * 1. If no user: clear form fields (guest mode)
 * 2. Otherwise: populate name and email, make them read-only
 */
function prefillAskStaffForm(user) {
  const nameInput  = document.getElementById('ask-name');
  const emailInput = document.getElementById('ask-email');
  if (!nameInput || !emailInput) return;

  if (user) {
    nameInput.value    = user.display_name;
    emailInput.value   = user.email;
    nameInput.readOnly  = true;
    emailInput.readOnly = true;
  } else {
    nameInput.value    = '';
    emailInput.value   = '';
    nameInput.readOnly  = false;
    emailInput.readOnly = false;
  }
}

/**
 * Purpose: Transition the chatbot to a named screen.
 * @param {string} screenId - ID of the screen div to activate
 * @returns {void}
 * Algorithm:
 * 1. Find all chatbot screen elements
 * 2. Remove 'active' class from all
 * 3. Add 'active' to the target screen
 */
function showScreen(screenId) {
  document.querySelectorAll('.chatbot-screen').forEach(screen => {
    screen.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

/**
 * Purpose: Show a submit error in the ask-staff form.
 * @param {string} message - Error message to display
 * @returns {void}
 */
function showAskFormError(message) {
  const errorEl = document.getElementById('ask-form-error');
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/**
 * Purpose: Clear any submit error in the ask-staff form.
 * @returns {void}
 */
function clearAskFormError() {
  const errorEl = document.getElementById('ask-form-error');
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.style.display = 'none';
}

/**
 * Purpose: Set the ask-staff submit button loading state.
 * @param {boolean} loading - True to show spinner and disable, false to restore
 * @returns {void}
 */
function setAskFormLoading(loading) {
  const btn = document.getElementById('ask-form-submit');
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Sending…' : 'Send Question';
}

/**
 * Purpose: Reset helpful/unhelpful feedback buttons to neutral state.
 * @returns {void}
 * Algorithm:
 * 1. Find both feedback buttons
 * 2. Remove active state classes from each
 */
function resetFeedbackButtons() {
  const yesBtn = document.getElementById('feedback-yes-btn');
  const noBtn  = document.getElementById('feedback-no-btn');
  if (yesBtn) yesBtn.classList.remove('active-yes');
  if (noBtn)  noBtn.classList.remove('active-no');
}

/**
 * Purpose: Mark the yes feedback button as active (helpful confirmed).
 * @returns {void}
 */
function markFeedbackYes() {
  const yesBtn = document.getElementById('feedback-yes-btn');
  const noBtn  = document.getElementById('feedback-no-btn');
  if (yesBtn) yesBtn.classList.add('active-yes');
  if (noBtn)  noBtn.classList.remove('active-no');
}

/**
 * Purpose: Mark the no feedback button as active (not helpful).
 * @returns {void}
 */
function markFeedbackNo() {
  const yesBtn = document.getElementById('feedback-yes-btn');
  const noBtn  = document.getElementById('feedback-no-btn');
  if (yesBtn) yesBtn.classList.remove('active-yes');
  if (noBtn)  noBtn.classList.add('active-no');
}

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Purpose: Convert basic markdown to safe HTML for answer display.
 * @param {string} text - Markdown text (bold, paragraphs, bullets)
 * @returns {string} Safe HTML string
 * Algorithm:
 * 1. Escape raw HTML to prevent XSS
 * 2. Convert **bold** → <strong>
 * 3. Convert lines starting with - to list items
 * 4. Wrap double newlines as paragraph breaks
 */
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Bullet lists (lines starting with - or *)
  html = html.replace(/(^|\n)(- .+)/g, (match, newline, item) => `${newline}<li>${item.slice(2)}</li>`);
  // Wrap list items in ul
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, '<ul>$&</ul>');
  // Paragraphs
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = `<p>${html}</p>`;
  return html;
}

/**
 * Purpose: Escape HTML special characters to prevent XSS injection.
 * @param {string} str - Raw string to escape
 * @returns {string} HTML-safe string
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
