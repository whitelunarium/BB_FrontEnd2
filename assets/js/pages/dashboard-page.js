// assets/js/pages/dashboard-page.js
// Responsibility: Staff dashboard orchestrator — gate by role, load questions,
//                 handle claim and answer actions via modal.

let dashboardState = {
  currentUser:    null,
  currentFilter:  'all',
  selectedQuestion: null,
};

document.addEventListener('DOMContentLoaded', initDashboard);

/**
 * Purpose: Initialize the staff dashboard — verify access, load questions.
 * @returns {void}
 * Algorithm:
 * 1. Fetch current user to verify staff+ access
 * 2. If unauthorized: render access denied gate
 * 3. If authorized: show dashboard, load questions, bind controls
 */
function initDashboard() {
  fetchCurrentUser()
    .then(user => {
      if (!user || !['staff', 'admin'].includes(user.role)) {
        showAccessDeniedGate();
        return;
      }
      dashboardState.currentUser = user;
      showDashboardContent();
      loadQuestions('all');
      bindTabButtons();
      bindModal();
    })
    .catch(() => showAccessDeniedGate());
}

/**
 * Purpose: Show the access denied message in the gate container.
 * @returns {void}
 */
function showAccessDeniedGate() {
  const gate = document.getElementById('dashboard-access-gate');
  if (gate) {
    renderAccessDenied(gate, 'Staff');
  }
}

/**
 * Purpose: Make the dashboard content visible after access is confirmed.
 * @returns {void}
 */
function showDashboardContent() {
  const content = document.getElementById('dashboard-content');
  if (content) content.style.display = '';
}

/**
 * Purpose: Bind the status tab buttons to filter the questions table.
 * @returns {void}
 * Algorithm:
 * 1. Find all tab buttons
 * 2. On click: update active tab and reload questions for that status
 */
function bindTabButtons() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      dashboardState.currentFilter = btn.dataset.status || 'all';
      loadQuestions(dashboardState.currentFilter);
    });
  });
}

/**
 * Purpose: ORCHESTRATOR — fetch questions and render table rows.
 * @param {string} statusFilter - 'all', 'open', 'claimed', or 'answered'
 * @returns {void}
 * Algorithm:
 * 1. Show loading row
 * 2. Fetch questions with status filter
 * 3. Render table rows
 */
function loadQuestions(statusFilter) {
  const tbody = document.querySelector('#questions-table tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="5"><div class="loading-overlay"><span class="spinner"></span> Loading questions…</div></td></tr>';

  fetchUserQuestions(statusFilter)
    .then(questions => renderQuestionsTable(tbody, questions))
    .catch(() => {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9e9e9e;padding:32px">Unable to load questions. Please refresh.</td></tr>';
    });
}

/**
 * Purpose: Render question rows in the dashboard table.
 * @param {HTMLElement} tbody     - Table body element
 * @param {Array}       questions - Array of user question objects
 * @returns {void}
 * Algorithm:
 * 1. If empty: show empty state row
 * 2. Otherwise: build a row per question with status badge and action buttons
 */
function renderQuestionsTable(tbody, questions) {
  if (questions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9e9e9e;padding:32px">No questions found for this filter.</td></tr>';
    return;
  }

  tbody.innerHTML = questions.map(q => buildQuestionRow(q)).join('');

  tbody.querySelectorAll('.claim-btn').forEach(btn => {
    btn.addEventListener('click', () => handleClaimQuestion(btn.dataset.questionId));
  });

  tbody.querySelectorAll('.answer-btn').forEach(btn => {
    btn.addEventListener('click', () => openAnswerModal(btn.dataset.questionId, btn.dataset.questionText));
  });
}

/**
 * Purpose: Build a table row HTML string for a single user question.
 * @param {Object} question - User question object
 * @returns {string} HTML table row string
 * Algorithm:
 * 1. Format date and status badge
 * 2. Build action buttons based on status
 * 3. Return assembled row HTML
 */
function buildQuestionRow(question) {
  const date = new Date(question.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const preview = (question.question_text || '').slice(0, 80) + (question.question_text?.length > 80 ? '…' : '');
  const statusBadge = buildStatusBadge(question.status);
  const actions = buildRowActions(question);

  return `<tr>
    <td>
      <div style="font-weight:600;font-size:13px">${escapeHtml(question.display_name)}</div>
      <div style="font-size:12px;color:#5a5a5a">${escapeHtml(question.email)}</div>
      <div style="font-size:13px;margin-top:4px">${escapeHtml(preview)}</div>
    </td>
    <td style="white-space:nowrap">${date}</td>
    <td>${statusBadge}</td>
    <td style="font-size:12px">${question.claimed_by_name ? escapeHtml(question.claimed_by_name) : '<span style="color:#9e9e9e">—</span>'}</td>
    <td>${actions}</td>
  </tr>`;
}

/**
 * Purpose: Build a status badge span for a question status string.
 * @param {string} status - 'open', 'claimed', or 'answered'
 * @returns {string} HTML span string
 */
function buildStatusBadge(status) {
  const classes = { open: 'badge-open', claimed: 'badge-claimed', answered: 'badge-answered' };
  return `<span class="badge ${classes[status] || ''}">${status}</span>`;
}

/**
 * Purpose: Build action button HTML for a question row.
 * @param {Object} question - Question object
 * @returns {string} HTML button string(s)
 * Algorithm:
 * 1. Open questions: show Claim button
 * 2. Claimed questions: show Answer button
 * 3. Answered questions: no actions
 */
function buildRowActions(question) {
  if (question.status === 'open') {
    return `<button class="btn btn-outline btn-sm claim-btn" data-question-id="${question.id}">Claim</button>`;
  }
  if (question.status === 'claimed') {
    return `<button class="btn btn-primary btn-sm answer-btn"
                    data-question-id="${question.id}"
                    data-question-text="${escapeHtml(question.question_text)}">Answer</button>`;
  }
  return '<span style="color:#27ae60;font-size:13px">✅ Answered</span>';
}

/**
 * Purpose: Claim an open question and refresh the table.
 * @param {string} questionId - The question's database ID
 * @returns {void}
 * Algorithm:
 * 1. Call claimUserQuestion API worker
 * 2. Reload questions table on success
 */
function handleClaimQuestion(questionId) {
  claimUserQuestion(parseInt(questionId, 10))
    .then(() => loadQuestions(dashboardState.currentFilter))
    .catch(() => alert('Unable to claim question. Please try again.'));
}

/**
 * Purpose: Open the answer modal for a claimed question.
 * @param {string} questionId   - Question's database ID
 * @param {string} questionText - Question text to show in modal
 * @returns {void}
 */
function openAnswerModal(questionId, questionText) {
  dashboardState.selectedQuestion = questionId;
  const modal     = document.getElementById('answer-modal');
  const questionEl = document.getElementById('answer-modal-question');
  const textarea  = document.getElementById('answer-textarea');

  if (questionEl) questionEl.textContent = questionText;
  if (textarea)   textarea.value = '';
  if (modal)      modal.style.display = 'flex';
}

/**
 * Purpose: Bind modal close, cancel, and submit actions.
 * @returns {void}
 * Algorithm:
 * 1. Bind close button to closeAnswerModal
 * 2. Bind cancel button to closeAnswerModal
 * 3. Bind submit button to handleAnswerSubmit
 */
function bindModal() {
  const modal     = document.getElementById('answer-modal');
  const closeBtn  = modal && modal.querySelector('.modal-close');
  const cancelBtn = modal && modal.querySelector('.modal-cancel-btn');
  const submitBtn = document.getElementById('answer-submit-btn');

  if (closeBtn)  closeBtn.addEventListener('click',  closeAnswerModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeAnswerModal);
  if (submitBtn) submitBtn.addEventListener('click', handleAnswerSubmit);
  if (modal)     modal.addEventListener('click', event => { if (event.target === modal) closeAnswerModal(); });
}

/**
 * Purpose: Close and reset the answer modal.
 * @returns {void}
 */
function closeAnswerModal() {
  const modal = document.getElementById('answer-modal');
  if (modal) modal.style.display = 'none';
  dashboardState.selectedQuestion = null;
}

/**
 * Purpose: Submit a staff answer and refresh the table.
 * @returns {void}
 * Algorithm:
 * 1. Validate that answer text is not empty
 * 2. Disable submit button
 * 3. Call answerUserQuestion API worker
 * 4. Close modal and reload table on success
 */
function handleAnswerSubmit() {
  const textarea  = document.getElementById('answer-textarea');
  const submitBtn = document.getElementById('answer-submit-btn');
  const answerText = textarea ? textarea.value.trim() : '';

  if (!answerText) {
    alert('Please write an answer before submitting.');
    return;
  }

  if (!dashboardState.selectedQuestion) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  answerUserQuestion(parseInt(dashboardState.selectedQuestion, 10), answerText)
    .then(() => {
      closeAnswerModal();
      loadQuestions(dashboardState.currentFilter);
    })
    .catch(() => {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Answer';
      alert('Unable to submit answer. Please try again.');
    });
}
