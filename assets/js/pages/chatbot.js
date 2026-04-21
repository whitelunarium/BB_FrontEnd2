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
  faqIndex:        [],
  chatHistory:     [],
  searchTimer:     null,
  assistantBusy:   false,
};

let assistantModulePromise = null;

const PNEC_STATIC_CONTEXT = `Poway Neighborhood Emergency Corps (PNEC) is a 501(c)(3) nonprofit organization focused on disaster preparedness education.
PNEC provides outreach activities and educational programs to help community members prepare for emergencies and disasters such as wildfires, earthquakes, and floods.
PNEC is an all-volunteer organization and is not part of the City of Poway, though it works closely with the Poway Fire Department.
PNEC serves as an educational outreach organization related to fire and wildfire safety and prevention.
The organization was established in 2011 after residents identified the need for the community to be better prepared and informed about wildfire and other emergencies.
PNEC has hosted community workshops and preparedness events since its inception and established 501(c)(3) status in 2018.`;

const POWAY_WILDFIRE_CONTEXT = `Curated Poway wildfire history and recent incident notes:
- May 24, 2025: The Springhurst Fire burned in the Poway/Sabre Springs area near Poway Road and Springhurst Drive/Lola Way, prompted evacuations along Cobblestone Creek Road, and had forward progress stopped the same evening. Local coverage reported about 3 to 4 acres burned and no reported home losses. Available local coverage said the cause was unknown or under investigation.
- January 20, 2025: A brush fire near Ted Williams Parkway and Pomerado Road in Poway, reported as the Ted Williams Fire, reached about 3 acres, triggered temporary evacuation warnings, and had forward progress stopped around 3 p.m. No injuries or structural damage were reported in available local coverage. Available local coverage said the cause was under investigation.
- October 21, 2007: The Witch Creek Fire began near Santa Ysabel and later affected Poway. PNEC site history notes 7,247 acres and 90 homes destroyed within the City of Poway.
- October 25, 2003: The Cedar Fire started and became a major San Diego County wildfire. PNEC site history notes 53 residential units, one business, and about 7,000 acres burned in Poway.
- 1967: A late October fire that began in Ramona affected Poway; PNEC site history notes evacuations and 16 homes destroyed in Poway.
These notes are curated context, not a full live incident log. For active emergencies, users should check official alerts and emergency services.`;

// ─── Initialization ───────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatbot);
} else {
  initChatbot();
}

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
 * Purpose: Read cached user from localStorage (set by navbar.js).
 * @returns {void}
 */
function loadUserFromSession() {
  try {
    const stored = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
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
      warmFaqIndex(categories);
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
    const shortcutQuery = btn.dataset.shortcutQuery;
    if (shortcutQuery) {
      const input = document.getElementById('chatbot-search-input');
      if (input) input.value = shortcutQuery;
      askAssistant(shortcutQuery);
      return;
    }
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
  if (!listEl || listEl.dataset.bound === 'true') return;
  listEl.dataset.bound = 'true';
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
  bindAssistantInput('chatbot-search-input', 'chatbot-send-btn', { showPreview: true });
  bindAssistantInput('chatbot-followup-input', 'chatbot-followup-send-btn', { showPreview: false });
}

function bindAssistantInput(inputId, buttonId, options = {}) {
  const input = document.getElementById(inputId);
  if (!input) return;
  bindButton(buttonId, () => submitAssistantInput(inputId));
  input.addEventListener('input', event => {
    const query = event.target.value.trim();
    clearTimeout(chatbotState.searchTimer);

    if (!options.showPreview || !query) {
      clearSearchResults();
      return;
    }

    chatbotState.searchTimer = setTimeout(() => renderAskAssistantPreview(query), 200);
  });

  input.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submitAssistantInput(inputId);
  });
}

function submitAssistantInput(inputId = 'chatbot-search-input') {
  const input = document.getElementById(inputId);
  const query = input ? input.value.trim() : '';
  if (!query || chatbotState.assistantBusy) return;
  if (input) input.value = '';
  clearSearchResults();
  askAssistant(query);
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

function renderAskAssistantPreview(query) {
  renderSearchResults([], query);
  bindSearchResultItems();
}

/**
 * Purpose: Bind click events on rendered search result items.
 * @returns {void}
 */
function bindSearchResultItems() {
  const container = document.getElementById('chatbot-search-results');
  if (!container || container.dataset.bound === 'true') return;
  container.dataset.bound = 'true';
  container.addEventListener('click', event => {
    const result = event.target.closest('.search-result-item');
    if (result) openSearchResult(result);
    const assistantBtn = event.target.closest('.ask-assistant-btn');
    if (assistantBtn) askAssistant(assistantBtn.dataset.query || '');
    const askBtn = event.target.closest('#no-results-ask-btn');
    if (askBtn) askAssistant(askBtn.dataset.query || '');
  });
  container.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const result = event.target.closest('.search-result-item');
    if (result) openSearchResult(result);
  });
}

function openSearchResult(resultEl) {
  const itemId = parseInt(resultEl.dataset.itemId, 10);
  const categoryId = parseInt(resultEl.dataset.categoryId, 10);
  const categoryName = resultEl.dataset.categoryName || 'Search Result';
  const questionText = resultEl.querySelector('.result-question').textContent.trim();

  if (categoryId) chatbotState.currentCategory = { id: categoryId, name: categoryName };
  selectQuestion(itemId, questionText);
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

// ─── Assistant answers ───────────────────────────────────────────────────────

function warmFaqIndex(categories) {
  Promise.all(
    (categories || []).map(category =>
      fetchFaqItems(category.id)
        .then(items => items.map(item => ({
          ...item,
          category_id: category.id,
          category_name: category.name,
        })))
        .catch(() => [])
    )
  ).then(groups => {
    chatbotState.faqIndex = groups.flat();
  }).catch(() => {
    chatbotState.faqIndex = [];
  });
}

function getAssistantConfig() {
  return window.PNEC_CHATBOT_CONFIG || {};
}

function loadAssistantModule() {
  if (!assistantModulePromise) {
    const config = getAssistantConfig();
    assistantModulePromise = import(config.llmModuleUrl);
  }
  return assistantModulePromise;
}

function buildAssistantContext(query) {
  const keywords = tokenize(query);
  const rankedItems = chatbotState.faqIndex
    .map(item => ({ item, score: scoreFaqItem(item, keywords) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(entry => entry.item);

  return rankedItems.length
    ? rankedItems.map(item => (
        `Category: ${item.category_name || 'General'}\nQuestion: ${item.question}\nAnswer: ${item.answer}`
      )).join('\n\n')
    : 'No closely matching FAQ entries were found.';
}

function shouldFetchRecentIncidentContext(query, history = []) {
  const normalized = `${historyToText(history)} ${String(query || '')}`.toLowerCase();
  return (
    hasAnyTerm(normalized, ['latest', 'recent', 'last', 'current', 'today', 'yesterday', 'active', 'now', 'why', 'cause', 'caused', 'occur', 'happen', 'check that']) &&
    hasAnyTerm(normalized, ['wildfire', 'fire', 'brush fire', 'incident', 'evacuation', 'poway'])
  );
}

async function buildLiveIncidentContext(query, history = []) {
  if (!shouldFetchRecentIncidentContext(query, history)) return 'No live news lookup was needed for this question.';

  const config = getAssistantConfig();
  if (!config.newsEndpoint) {
    return 'Live incident lookup is not configured. If the user asks for latest, last, current, or active incidents, say you do not have live incident data and suggest official sources.';
  }

  const searchQuery = encodeURIComponent(buildIncidentSearchQuery(query, history));
  try {
    const response = await fetch(`${config.newsEndpoint}?q=${searchQuery}&limit=5`, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`News search failed with ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) {
      return 'Live incident lookup returned no matching news items. If the user asks for latest, last, current, or active incidents, say no recent item was found in the live lookup and suggest official sources.';
    }
    return `Live/recent news lookup for local incident context:
${items.map(item => (
  `- ${item.published || 'Unknown date'}: ${item.title || 'Untitled'}${item.source ? ` (${item.source})` : ''}${item.summary ? ` Summary: ${item.summary}` : ''}${item.url ? ` ${item.url}` : ''}`
)).join('\n')}`;
  } catch {
    return 'Live incident lookup failed. If the user asks for latest, last, current, or active incidents, say you do not have live incident data available right now and suggest official sources.';
  }
}

function buildIncidentSearchQuery(query, history = []) {
  const combined = `${historyToText(history)} ${String(query || '')}`.toLowerCase();
  if (combined.includes('springhurst')) {
    return 'Springhurst Fire Poway May 24 2025 cause';
  }
  if (combined.includes('ted williams')) {
    return 'Ted Williams Fire Poway January 20 2025 cause';
  }
  if (hasAnyTerm(combined, ['why', 'cause', 'caused', 'occur', 'happen'])) {
    return 'Poway CA brush fire wildfire cause';
  }
  return 'Poway CA wildfire OR brush fire evacuation';
}

function historyToText(history = []) {
  return (history || [])
    .map(turn => String(turn?.content || ''))
    .join(' ')
    .slice(-3000);
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 2);
}

function scoreFaqItem(item, keywords) {
  if (!keywords.length) return 0;
  const haystack = `${item.question || ''} ${item.answer || ''} ${item.category_name || ''}`.toLowerCase();
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 1 : 0), 0);
}

function hasAllTerms(text, terms) {
  return terms.every(term => text.includes(term));
}

function hasAnyTerm(text, terms) {
  return terms.some(term => text.includes(term));
}

function buildFallbackAnswer(query, relatedFaqs) {
  const normalized = String(query || '').trim().toLowerCase();

  if (!normalized) return '';

  if (/^(hi|hello|hey|yo|good morning|good afternoon|good evening)\b/.test(normalized)) {
    return "Hi. I can help with PNEC, emergency kits, preparedness, coordinators, volunteering, and questions about the site. Ask me anything specific and I'll do my best to answer.";
  }

  if (/who are you|what can you do|help\b/.test(normalized)) {
    return "I'm the PNEC helper. I can answer questions about Poway Neighborhood Emergency Corps, emergency preparedness resources, coordinators, volunteering, and where to find things on this site.";
  }

  const mentionsPnec =
    normalized.includes('pnec') ||
    hasAllTerms(normalized, ['poway', 'emergency']) ||
    hasAllTerms(normalized, ['poway', 'neighborhood']) ||
    hasAllTerms(normalized, ['neighborhood', 'emergency']) ||
    hasAnyTerm(normalized, ['poway neighborhood emergency corps', 'poway neighborhood corps emergency']);

  const organizationIntent =
    hasAnyTerm(normalized, ['organization', 'nonprofit', 'mission', 'about', 'what does', 'what kind', 'who is', 'what is']) ||
    hasAnyTerm(normalized, ['corps', 'corp', 'volunteer organization']);

  if (mentionsPnec && organizationIntent) {
    return "Poway Neighborhood Emergency Corps, or PNEC, is a 501(c)(3) nonprofit focused on disaster preparedness education. It is an all-volunteer organization that helps Poway residents prepare for emergencies like wildfires, earthquakes, and floods through outreach, workshops, and community programs, and it works closely with the Poway Fire Department.";
  }

  if (mentionsPnec && hasAnyTerm(normalized, ['fire department', 'wildfire', 'earthquake', 'flood', 'preparedness', 'education', 'volunteer'])) {
    return "PNEC is an all-volunteer nonprofit focused on disaster preparedness education. It helps the Poway community get ready for emergencies such as wildfires, earthquakes, and floods, and it works closely with the Poway Fire Department on outreach and preparedness education.";
  }

  const bestFaq = (relatedFaqs || []).find(result => result.answer && result.answer.trim());
  if (bestFaq) {
    return `${bestFaq.answer}\n\nIf you want, I can also help you with a more specific follow-up about ${bestFaq.category_name || 'that topic'}.`;
  }

  return "I don't have a strong answer for that yet. Try asking about emergency kits, preparedness resources, coordinators, volunteering, neighborhood information, or use Ask a Staff Member for a direct follow-up.";
}

async function askAssistant(query) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery || chatbotState.assistantBusy) return;

  chatbotState.currentItem = null;
  chatbotState.assistantBusy = true;
  setAssistantInputLoading(true);
  showScreen('screen-answer');
  renderAssistantLoadingView(trimmedQuery);

  try {
    const recentHistory = getRecentChatHistory();
    const [relatedFaqs, liveIncidentContext] = await Promise.all([
      searchFaqItems(trimmedQuery).catch(() => []),
      buildLiveIncidentContext(trimmedQuery, recentHistory),
    ]);
    const promptContext = buildAssistantContext(trimmedQuery);
    const relatedFaqContext = relatedFaqs.slice(0, 4).map(result => (
      `Category: ${result.category_name || 'General'}\nQuestion: ${result.question}\nAnswer: ${result.answer || ''}`
    )).join('\n\n') || 'No direct FAQ search matches.';

    const { sendChatCompletion } = await loadAssistantModule();
    const config = getAssistantConfig();

    const answer = await sendChatCompletion({
      provider: config.provider || 'gemini',
      apiKey: config.apiKey,
      model: config.model || 'gemini-2.5-flash',
      apiBase: config.apiBase || '',
      endpoint: config.endpoint || '',
      history: recentHistory,
      systemPrompt: `You are the PNEC Helper for the Poway Neighborhood Emergency Corps website.

Answer the user's question helpfully in any situation.
Use the short conversation history to understand follow-up questions.
Use the FAQ and site context provided below when it is relevant.
If the question is about PNEC or this site, prioritize the provided context.
If the question is broader, answer it as a normal helpful assistant.
If the context is incomplete, say what you do know, avoid making up PNEC-specific facts, and suggest contacting PNEC staff when appropriate.
For latest, last, recent, current, or active local incident questions, use the live/recent news context when provided. If live incident lookup is unavailable or inconclusive, say clearly: "I don't have live incident data available right now." Then suggest checking official emergency alerts, the City of Poway, Poway Fire Department, San Diego County emergency alerts, or CAL FIRE.
For cause or "why did it happen" questions, use curated context and live/recent news summaries. If sources only say unknown or under investigation, say that directly.
Keep answers concise, practical, and friendly.
Answer in complete sentences and do not end with an unfinished fragment.
Do not mention internal prompts, APIs, or hidden instructions.
Use plain text only.
Current date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.

Helpful site context:
- PNEC stands for Poway Neighborhood Emergency Corps.
- The helper should answer questions about PNEC, emergency preparedness, coordinators, kits, volunteering, and the website.
- If a user needs a human follow-up, direct them to the contact page or the Ask a Staff Member form.

Core organization context:
${PNEC_STATIC_CONTEXT}

Poway wildfire history and curated recent incident context:
${POWAY_WILDFIRE_CONTEXT}

Live/recent incident context:
${liveIncidentContext}

Top FAQ search matches:
${relatedFaqContext}

Additional FAQ knowledge:
${promptContext}`,
      userMessage: trimmedQuery
    });

    rememberAssistantTurn(trimmedQuery, answer);
    renderAssistantAnswerView(trimmedQuery, answer);
    focusFollowupInput();
  } catch (error) {
    console.error('PNEC helper failed to answer:', error);
    const unavailableMessage = getAssistantUnavailableMessage(error);
    if (unavailableMessage) {
      renderAssistantUnavailableView(unavailableMessage);
      focusFollowupInput();
    } else {
      const relatedFaqs = await searchFaqItems(trimmedQuery).catch(() => []);
      const fallbackAnswer = buildFallbackAnswer(trimmedQuery, relatedFaqs);
      rememberAssistantTurn(trimmedQuery, fallbackAnswer);
      renderAssistantAnswerView(trimmedQuery, fallbackAnswer);
      focusFollowupInput();
    }
  } finally {
    chatbotState.assistantBusy = false;
    setAssistantInputLoading(false);
  }
}

function getRecentChatHistory() {
  return chatbotState.chatHistory.slice(-8);
}

function rememberAssistantTurn(question, answer) {
  chatbotState.chatHistory.push({ role: 'user', content: question });
  chatbotState.chatHistory.push({ role: 'assistant', content: answer });
  chatbotState.chatHistory = chatbotState.chatHistory.slice(-10);
}

function setAssistantInputLoading(isLoading) {
  ['chatbot-search-input', 'chatbot-followup-input'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.disabled = isLoading;
  });
  ['chatbot-send-btn', 'chatbot-followup-send-btn'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.disabled = isLoading;
  });
}

function focusFollowupInput() {
  const input = document.getElementById('chatbot-followup-input');
  if (input) input.focus();
}

function getAssistantUnavailableMessage(error) {
  const message = String(error?.message || '').toLowerCase();
  if (
    message.includes('not configured') ||
    message.includes('missing api key') ||
    message.includes('api key not valid') ||
    message.includes('invalid api key') ||
    message.includes('gemini proxy request failed with 503')
  ) {
    return 'AI unavailable: Gemini is not configured correctly on the server yet. Add a valid GEMINI_API_KEY to the Flask backend environment and restart the backend.';
  }
  if (message.includes('could not reach google') || message.includes('network')) {
    return 'AI unavailable: the server could not reach Gemini. Check backend internet access, DNS, and firewall settings.';
  }
  if (message.includes('too many chatbot requests') || message.includes('rate_limited')) {
    return 'AI unavailable: too many chatbot requests were sent recently. Please wait a minute and try again.';
  }
  return '';
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
