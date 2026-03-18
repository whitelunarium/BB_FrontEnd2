// assets/js/pages/chatbot.js
// Responsibility: Chatbot orchestrator — manages chatbot state and coordinates
//                 faq-api.js workers and chatbot-ui.js workers.
// State: currentScreen, currentCategory, currentItem, currentUser

// ─── Chatbot state ────────────────────────────────────────────────────────────
let chatbotState = {
  isOpen:          false,
  currentScreen:   'screen-welcome',
  currentCategory: null,  // { id, name }
  currentItem:     null,  // { id, question, answer }
  currentUser:     null,  // logged-in user or null
  searchTimer:     null,
};

// ─── Initialization ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initChatbot);

/**
 * Purpose: Initialize the chatbot — bind UI events, load categories, get user state.
 * @returns {void}
 * Algorithm:
 * 1. Read current user from session
 * 2. Bind trigger and close buttons
 * 3. Bind back navigation buttons
 * 4. Bind search input
 * 5. Bind ask-staff form
 * 6. Load FAQ categories
 */
function initChatbot() {
  loadUserFromSession();
  bindTriggerButton();
  bindCloseButton();
  bindBackButtons();
  bindSearchInput();
  bindAskStaffForm();
  bindFeedbackButtons();
  loadCategories();
}

/**
 * Purpose: Read cached user from sessionStorage (set by navbar.js).
 * @returns {void}
 */
function loadUserFromSession() {
  try {
    const stored = sessionStorage.getItem('pnec_user');
    chatbotState.currentUser = stored ? JSON.parse(stored) : null;
  } catch {
    chatbotState.currentUser = null;
  }
}

// ─── Panel open/close ─────────────────────────────────────────────────────────

/**
 * Purpose: Bind the floating trigger button to open/close the panel.
 * @returns {void}
 */
function bindTriggerButton() {
  const triggerBtn = document.getElementById('chatbot-trigger-btn');
  if (triggerBtn) triggerBtn.addEventListener('click', toggleChatPanel);
}

/**
 * Purpose: Bind the panel close button.
 * @returns {void}
 */
function bindCloseButton() {
  const closeBtn = document.getElementById('chatbot-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeChatPanel);
}

/**
 * Purpose: Toggle chatbot panel open or closed.
 * @returns {void}
 */
function toggleChatPanel() {
  chatbotState.isOpen ? closeChatPanel() : openChatPanel();
}

/**
 * Purpose: Open the chatbot panel and update trigger button state.
 * @returns {void}
 */
function openChatPanel() {
  const panel   = document.getElementById('chatbot-panel');
  const trigger = document.getElementById('chatbot-trigger-btn');
  if (panel)   panel.classList.add('open');
  if (trigger) { trigger.classList.add('open'); trigger.setAttribute('aria-expanded', 'true'); }
  chatbotState.isOpen = true;
}

/**
 * Purpose: Close the chatbot panel.
 * @returns {void}
 */
function closeChatPanel() {
  const panel   = document.getElementById('chatbot-panel');
  const trigger = document.getElementById('chatbot-trigger-btn');
  if (panel)   panel.classList.remove('open');
  if (trigger) { trigger.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); }
  chatbotState.isOpen = false;
}

// ─── Category loading ─────────────────────────────────────────────────────────

/**
 * Purpose: Load and display FAQ categories in the welcome screen.
 * @returns {void}
 * Algorithm:
 * 1. Fetch categories from API
 * 2. Render category grid
 * 3. Bind click handlers to category buttons
 */
function loadCategories() {
  fetchFaqCategories()
    .then(categories => {
      renderCategoryGrid(categories);
      bindCategoryButtons();
    })
    .catch(() => {
      const container = document.getElementById('chatbot-categories');
      if (container) container.innerHTML = '<p style="font-size:13px;color:#c0392b;text-align:center">Could not load topics. Please try again later.</p>';
    });
}

/**
 * Purpose: Bind click events on dynamically rendered category buttons.
 * @returns {void}
 */
function bindCategoryButtons() {
  const container = document.getElementById('chatbot-categories');
  if (!container) return;
  container.addEventListener('click', event => {
    const btn = event.target.closest('.chatbot-category-btn');
    if (!btn) return;
    const categoryId   = parseInt(btn.dataset.categoryId, 10);
    const categoryName = btn.dataset.categoryName;
    selectCategory(categoryId, categoryName);
  });
}

/**
 * Purpose: Select a category and navigate to its question list.
 * @param {number} categoryId - Selected category ID
 * @param {string} categoryName - Selected category display name
 * @returns {void}
 * Algorithm:
 * 1. Update chatbot state with selected category
 * 2. Show category screen
 * 3. Fetch items for the category
 * 4. Render question list
 */
function selectCategory(categoryId, categoryName) {
  chatbotState.currentCategory = { id: categoryId, name: categoryName };
  showScreen('screen-category');

  const listEl = document.getElementById('chatbot-question-list');
  if (listEl) listEl.innerHTML = '<li style="padding:16px 0;color:#9e9e9e;font-size:13px">Loading questions…</li>';

  fetchFaqItems(categoryId)
    .then(items => {
      renderQuestionList(items, categoryName);
      bindQuestionItems();
    })
    .catch(() => {
      if (listEl) listEl.innerHTML = '<li style="padding:16px 0;color:#c0392b;font-size:13px">Could not load questions.</li>';
    });
}

// ─── Question selection ────────────────────────────────────────────────────────

/**
 * Purpose: Bind click events on dynamically rendered question items.
 * @returns {void}
 */
function bindQuestionItems() {
  const listEl = document.getElementById('chatbot-question-list');
  if (!listEl) return;
  listEl.addEventListener('click', event => {
    const item = event.target.closest('.chatbot-question-item');
    if (!item) return;
    selectQuestion(parseInt(item.dataset.itemId, 10), item.textContent.trim());
  });
  // Keyboard support
  listEl.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      const item = event.target.closest('.chatbot-question-item');
      if (item) selectQuestion(parseInt(item.dataset.itemId, 10), item.textContent.trim());
    }
  });
}

/**
 * Purpose: Navigate to the answer view for a selected question.
 * @param {number} itemId - FAQ item ID
 * @param {string} questionText - Question text (for display before full load)
 * @returns {void}
 * Algorithm:
 * 1. Show answer screen with placeholder
 * 2. Fetch full item data
 * 3. Render answer view
 */
function selectQuestion(itemId, questionText) {
  chatbotState.currentItem = { id: itemId, question: questionText, answer: '' };
  showScreen('screen-answer');

  const questionEl = document.getElementById('answer-question-text');
  const answerEl   = document.getElementById('answer-body');
  if (questionEl) questionEl.textContent = questionText;
  if (answerEl)   answerEl.innerHTML = '<div class="loading-overlay"><span class="spinner"></span></div>';

  // Fetch items for the current category and find this one
  const catId = chatbotState.currentCategory ? chatbotState.currentCategory.id : null;
  if (catId) {
    fetchFaqItems(catId)
      .then(items => {
        const found = items.find(i => i.id === itemId);
        if (found) {
          chatbotState.currentItem = found;
          renderAnswerView(found);
        }
      })
      .catch(() => {
        if (answerEl) answerEl.innerHTML = '<p style="color:#c0392b">Could not load answer.</p>';
      });
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Purpose: Bind debounced search input to live FAQ search.
 * @returns {void}
 * Algorithm:
 * 1. Listen for input events on search field
 * 2. Debounce 300ms
 * 3. If empty: clear results and show categories
 * 4. Otherwise: fetch and render search results
 */
function bindSearchInput() {
  const input = document.getElementById('chatbot-search-input');
  if (!input) return;

  input.addEventListener('input', event => {
    const query = event.target.value.trim();
    clearTimeout(chatbotState.searchTimer);

    if (!query) {
      clearSearchResults();
      return;
    }

    chatbotState.searchTimer = setTimeout(() => runSearch(query), 300);
  });
}

/**
 * Purpose: Execute search and render results.
 * @param {string} query - Search string
 * @returns {void}
 */
function runSearch(query) {
  searchFaqItems(query)
    .then(results => {
      renderSearchResults(results, query);
      bindSearchResultItems();
    })
    .catch(() => {/* Silently fail search */});
}

/**
 * Purpose: Bind click events on rendered search result items.
 * @returns {void}
 */
function bindSearchResultItems() {
  const container = document.getElementById('chatbot-search-results');
  if (!container) return;
  container.addEventListener('click', event => {
    const result = event.target.closest('.search-result-item');
    if (result) selectQuestion(parseInt(result.dataset.itemId, 10), result.querySelector('.result-question').textContent);
    const askBtn = event.target.closest('#no-results-ask-btn');
    if (askBtn) navigateToAskStaff();
  });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

/**
 * Purpose: Bind all "back" navigation buttons in the chatbot.
 * @returns {void}
 */
function bindBackButtons() {
  bindButton('back-to-welcome',    navigateToWelcome);
  bindButton('back-to-category',   navigateToCategory);
  bindButton('back-from-ask-form', navigateBackFromAskForm);
  bindButton('show-ask-form-btn',  navigateToAskStaff);
  bindButton('success-back-btn',   navigateToWelcome);
}

function navigateToWelcome() {
  clearSearchResults();
  const input = document.getElementById('chatbot-search-input');
  if (input) input.value = '';
  showScreen('screen-welcome');
}

function navigateToCategory() {
  if (chatbotState.currentCategory) showScreen('screen-category');
  else navigateToWelcome();
}

function navigateBackFromAskForm() {
  if (chatbotState.currentItem && chatbotState.currentItem.answer) showScreen('screen-answer');
  else if (chatbotState.currentCategory) showScreen('screen-category');
  else navigateToWelcome();
}

function navigateToAskStaff() {
  prefillAskStaffForm(chatbotState.currentUser);
  clearAskFormError();
  showScreen('screen-ask-staff');
}

// ─── Ask staff form ───────────────────────────────────────────────────────────

/**
 * Purpose: Bind the ask-staff form submission.
 * @returns {void}
 * Algorithm:
 * 1. Listen for form submit event
 * 2. Validate required fields
 * 3. Submit to API via worker
 * 4. Show success or error state
 */
function bindAskStaffForm() {
  const form = document.getElementById('ask-staff-form');
  if (!form) return;
  form.addEventListener('submit', handleAskFormSubmit);
}

function handleAskFormSubmit(event) {
  event.preventDefault();
  clearAskFormError();

  const name     = document.getElementById('ask-name').value.trim();
  const email    = document.getElementById('ask-email').value.trim();
  const question = document.getElementById('ask-question').value.trim();

  if (!name || !email || !question) {
    showAskFormError('Please fill in all fields.');
    return;
  }

  setAskFormLoading(true);

  submitUserQuestion({ display_name: name, email, question_text: question })
    .then(() => {
      event.target.reset();
      showScreen('screen-success');
    })
    .catch(error => {
      showAskFormError(getErrorMessage(error.type));
    })
    .finally(() => setAskFormLoading(false));
}

// ─── Feedback buttons ─────────────────────────────────────────────────────────

/**
 * Purpose: Bind helpful/not-helpful vote buttons on the answer screen.
 * @returns {void}
 */
function bindFeedbackButtons() {
  bindButton('feedback-yes-btn', () => submitFeedback(true));
  bindButton('feedback-no-btn',  () => submitFeedback(false));
}

/**
 * Purpose: Submit a helpful vote and update button state.
 * @param {boolean} isHelpful - True = helpful, false = not helpful
 * @returns {void}
 */
function submitFeedback(isHelpful) {
  if (!chatbotState.currentItem) return;
  isHelpful ? markFeedbackYes() : markFeedbackNo();
  submitFaqHelpfulVote(chatbotState.currentItem.id, isHelpful)
    .catch(() => {/* Silently fail — vote is cosmetic */});
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Purpose: Find an element by ID and attach a click event listener.
 * @param {string} id - Element ID
 * @param {Function} handler - Click handler
 * @returns {void}
 */
function bindButton(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', handler);
}
