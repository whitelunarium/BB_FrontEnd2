// assets/js/chatbot/index.js
// PNEC Helper Bot v3 — main controller / widget entry point.
//
// Wires together:
//   • DOM (chatbot-widget.html include)
//   • store.js (state + persistence)
//   • prompt.js (system prompt builder)
//   • api.js (network)
//   • render.js (markdown + DOM building + streaming)
//   • suggestions.js (empty-state + followup chips)
//   • voice.js (Phase 3, optional — loaded lazily)
//   • emergency.js (Phase 3, optional — loaded lazily)
//   • i18n.js (Phase 4, optional — loaded lazily)
//   • image.js (Phase 4, optional — loaded lazily)
//   • export.js (Phase 4, optional — loaded lazily)

import {
  listConversations, getActiveConversation, setActiveConversation,
  createConversation, deleteConversation, clearAllConversations,
  appendMessage, updateMessage, deleteMessage, searchConversations,
  getPrefs, setPref, getCachedUser
} from './store.js';

import { buildSystemPrompt, formatHistory } from './prompt.js';
import { sendCompletion, sendCompletionStream, generateSuggestions } from './api.js';
import { buildMessageEl, buildLoadingMsgEl, streamIntoBubble, renderMarkdown, _escape } from './render.js';
import { pickEmptyStateSuggestions, renderSuggestionList, renderFollowupChips, renderAllTopics, totalTopicCount } from './suggestions.js';

// Lazy modules — created in subsequent phases. Wrapped so missing
// files just degrade gracefully (Phase 1 ships even if Phases 2–4
// haven't landed yet).
async function loadOptional(name) {
  try { return await import(`./${name}.js`); } catch (_e) { return null; }
}

const MAX_INPUT_CHARS = 4000;
const COUNTER_WARN_AT = 3500;

const $ = (id) => document.getElementById(id);

class HelperBot {
  constructor() {
    this.dom = {};
    this.activeConversationId = null;
    this.streamingState = null;          // { abort, msgId }
    this.activeImage = null;             // { dataUrl, alt } if user attached
    this.tools = null;                   // Phase 2 tool dispatcher (loaded lazily)
    this.voice = null;                   // Phase 3
    this.emergency = null;               // Phase 3
    this.i18n = null;                    // Phase 4
    this.image = null;                   // Phase 4
    this.exporter = null;                // Phase 4
    this.t = (k, ...args) => this._t(k, ...args);
  }

  async init() {
    this._collectDom();
    if (!this.dom.fab || !this.dom.panel) return;     // include not present on this page

    this._wireEvents();

    // Load optional phase modules in parallel — none of these is
    // required for the bot to work at the most basic level.
    const [tools, voice, emergency, i18n, image, exporter] = await Promise.all([
      loadOptional('tools'),
      loadOptional('voice'),
      loadOptional('emergency'),
      loadOptional('i18n'),
      loadOptional('image'),
      loadOptional('export'),
    ]);
    this.tools = tools;
    this.voice = voice;
    this.emergency = emergency;
    this.i18n = i18n;
    this.image = image;
    this.exporter = exporter;

    // Apply prefs
    const prefs = getPrefs();
    if (prefs.panelMode === 'expanded') this.dom.panel.classList.add('is-expanded');
    if (prefs.panelMode === 'modal') this.dom.panel.classList.add('is-modal');
    if (prefs.railOpen) this.dom.panel.classList.add('is-rail-open');
    this._applyLang(prefs.lang);
    if (this.dom.prefLang)   this.dom.prefLang.value   = prefs.lang;
    if (this.dom.prefVoice)  this.dom.prefVoice.checked = !!prefs.voiceReplies;
    if (this.dom.prefMotion) this.dom.prefMotion.checked = !!prefs.reducedMotion;

    // Decide active conversation
    const active = getActiveConversation();
    if (active) {
      this.activeConversationId = active.id;
      this._renderTranscript();
    } else {
      this._showEmptyState();
    }
    this._renderRail();
    this._updateGreeting();
    this._renderEmptySuggestions();

    // Voice — wire if module loaded
    if (this.voice && typeof this.voice.attach === 'function') {
      this.voice.attach(this);
    }

    // Emergency — wire detection
    if (this.emergency && typeof this.emergency.attach === 'function') {
      this.emergency.attach(this);
    }

    // Smart auto-open: only if first-ever visit OR returning after >7 days
    // and not previously dismissed in the last 24h. Phase 3 risk-aware
    // logic can later upgrade this to "open when red-flag warning."
    this._maybeAutoOpen(prefs);

    // Phase 3: register the service worker for offline cache.
    // Best-effort — most browsers, swallow failures silently.
    if ('serviceWorker' in navigator) {
      const swUrl = new URL('./sw.js', import.meta.url).href;
      try {
        navigator.serviceWorker.register(swUrl, { scope: '/assets/js/chatbot/' })
          .catch(() => { /* fine */ });
      } catch (_e) { /* fine */ }
    }
  }

  _collectDom() {
    this.dom = {
      fab:                 $('pnec-bot-fab'),
      fabBadge:            $('pnec-bot-fab-badge'),
      backdrop:            $('pnec-bot-backdrop'),
      panel:               $('pnec-bot-panel'),
      title:               $('pnec-bot-title'),
      statusText:          $('pnec-bot-status-text'),
      statusEl:            document.querySelector('.pnec-bot-status'),
      newChatBtn:          $('pnec-bot-new-chat'),
      railSearch:          $('pnec-bot-rail-search'),
      railList:            $('pnec-bot-rail-list'),
      railToggle:          $('pnec-bot-rail-toggle'),
      settingsBtn:         $('pnec-bot-settings'),
      expandBtn:           $('pnec-bot-expand'),
      modalBtn:            $('pnec-bot-modal'),
      closeBtn:            $('pnec-bot-close'),
      actionDrawer:        $('pnec-bot-action-drawer'),
      empty:               $('pnec-bot-empty'),
      emptyGreeting:       $('pnec-bot-empty-greeting'),
      emptySub:            $('pnec-bot-greeting'),
      emptySuggestions:    $('pnec-bot-empty-suggestions'),
      browseTopicsBtn:     $('pnec-bot-browse-topics'),
      browseCount:         $('pnec-bot-browse-count'),
      topicsPanel:         $('pnec-bot-topics-panel'),
      topicsBack:          $('pnec-bot-topics-back'),
      topicsBody:          $('pnec-bot-topics-body'),
      transcript:          $('pnec-bot-transcript'),
      followups:           $('pnec-bot-followups'),
      composer:            $('pnec-bot-composer'),
      attachments:         $('pnec-bot-attachments'),
      input:               $('pnec-bot-input'),
      attachBtn:           $('pnec-bot-attach'),
      attachInput:         $('pnec-bot-attach-input'),
      mic:                 $('pnec-bot-mic'),
      send:                $('pnec-bot-send'),
      composerHint:        $('pnec-bot-composer-hint'),
      counter:             $('pnec-bot-counter'),
      settingsDrawer:      $('pnec-bot-settings-drawer'),
      settingsClose:       $('pnec-bot-settings-close'),
      prefLang:            $('pnec-bot-pref-lang'),
      prefVoice:           $('pnec-bot-pref-voice'),
      prefMotion:          $('pnec-bot-pref-motion'),
      exportBtn:           $('pnec-bot-export'),
      clearBtn:            $('pnec-bot-clear'),
    };
  }

  _wireEvents() {
    const d = this.dom;

    d.fab.addEventListener('click', () => this.open());
    d.closeBtn.addEventListener('click', () => this.close());
    d.backdrop.addEventListener('click', () => this.setMode('docked'));
    d.expandBtn.addEventListener('click', () => this.setMode(d.panel.classList.contains('is-expanded') ? 'docked' : 'expanded'));
    d.modalBtn.addEventListener('click', () => this.setMode(d.panel.classList.contains('is-modal') ? 'docked' : 'modal'));
    d.railToggle.addEventListener('click', () => this._toggleRail());
    d.settingsBtn.addEventListener('click', () => this._toggleSettings());
    d.settingsClose.addEventListener('click', () => this._toggleSettings(false));

    d.newChatBtn.addEventListener('click', () => this._newChat());
    d.railSearch.addEventListener('input', (e) => this._filterRail(e.target.value));

    d.composer.addEventListener('submit', (e) => { e.preventDefault(); this._submitInput(); });
    d.input.addEventListener('input', () => this._onInputChange());
    d.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this._submitInput();
      }
    });

    d.attachBtn.addEventListener('click', () => d.attachInput.click());
    d.attachInput.addEventListener('change', (e) => this._onAttachFile(e.target.files));

    d.mic.addEventListener('click', () => this._toggleVoice());

    d.prefLang.addEventListener('change', (e) => {
      setPref('lang', e.target.value);
      this._applyLang(e.target.value);
      // v3.7 FIX: re-render visible UI so the language switch is
      // immediately visible (greeting + suggestions chips). Was silent
      // before — user had to refresh the page to see new language.
      this._updateGreeting();
      this._renderEmptySuggestions();
    });
    d.prefVoice.addEventListener('change', (e) => setPref('voiceReplies', e.target.checked));
    d.prefMotion.addEventListener('change', (e) => {
      setPref('reducedMotion', e.target.checked);
      document.documentElement.classList.toggle('pb-reduced-motion', e.target.checked);
    });

    d.exportBtn.addEventListener('click', () => this._exportConversation());
    d.clearBtn.addEventListener('click', () => this._confirmClearAll());

    // v3.6: Browse all topics expand / collapse
    if (d.browseTopicsBtn) d.browseTopicsBtn.addEventListener('click', () => this._showAllTopics());
    if (d.topicsBack)      d.topicsBack.addEventListener('click', () => this._hideAllTopics());

    // Action drawer (Phase 3 enriches this)
    d.actionDrawer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      this._runDrawerAction(btn.dataset.action);
    });

    // Delegated transcript clicks (msg actions, tool-call confirm, citations)
    d.transcript.addEventListener('click', (e) => this._onTranscriptClick(e));

    // Followup + empty suggestion containers wired via render functions.
    // Rail list is wired via _renderRail.

    // Esc closes settings, backdrop, then panel.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!d.panel || d.panel.hidden) return;
      if (d.panel.classList.contains('is-settings-open')) { this._toggleSettings(false); return; }
      if (d.panel.classList.contains('is-modal')) { this.setMode('docked'); return; }
      this.close();
    });
  }

  // ─── Open / close / mode ────────────────────────────────────────

  open() {
    this.dom.panel.hidden = false;
    this.dom.fab.setAttribute('aria-expanded', 'true');
    setTimeout(() => this.dom.input?.focus({ preventScroll: true }), 80);
    this._updateBackdrop();
  }

  close() {
    this.dom.panel.hidden = true;
    this.dom.fab.setAttribute('aria-expanded', 'false');
    this.dom.backdrop.hidden = true;
    setPref('dismissedAt', Date.now());
  }

  setMode(mode) {
    const p = this.dom.panel;
    p.classList.remove('is-expanded', 'is-modal');
    if (mode === 'expanded') p.classList.add('is-expanded');
    if (mode === 'modal') p.classList.add('is-modal');
    setPref('panelMode', mode);
    this._updateBackdrop();
  }

  _updateBackdrop() {
    const isModal = this.dom.panel.classList.contains('is-modal');
    this.dom.backdrop.hidden = !isModal;
  }

  _toggleRail() {
    const opened = this.dom.panel.classList.toggle('is-rail-open');
    setPref('railOpen', opened);
  }

  _toggleSettings(force) {
    const opened = force === undefined
      ? this.dom.panel.classList.toggle('is-settings-open')
      : this.dom.panel.classList.toggle('is-settings-open', force);
    return opened;
  }

  _maybeAutoOpen(prefs) {
    const now = Date.now();
    const lastDismiss = prefs.dismissedAt || 0;
    const lastAuto    = prefs.autoOpenedAt || 0;
    const dayMs       = 24 * 60 * 60 * 1000;
    if (now - lastDismiss < dayMs) return;
    if (now - lastAuto < 7 * dayMs && lastAuto !== 0) return;
    setTimeout(() => {
      if (!this.dom.panel.hidden) return;
      this.open();
      setPref('autoOpenedAt', now);
    }, 1200);
  }

  // ─── Greeting + status ──────────────────────────────────────────

  _updateGreeting() {
    const user = getCachedUser();
    const hour = new Date().getHours();
    const tod = hour < 12 ? this.t('greet.morning')
              : hour < 17 ? this.t('greet.afternoon')
              : hour < 22 ? this.t('greet.evening')
              :             this.t('greet.late');
    const audience = (user && user.display_name)
      ? user.display_name.split(/\s+/)[0]
      : this.t('greet.neighbor');
    if (this.dom.emptyGreeting) this.dom.emptyGreeting.textContent = `${tod}, ${audience}`;
    if (this.dom.emptySub) {
      this.dom.emptySub.textContent = (user && user.neighborhood)
        ? this.t('greet.with_neighborhood', user.neighborhood)
        : this.t('greet.default');
    }
  }

  _setStatus(kind, text) {
    if (!this.dom.statusEl) return;
    this.dom.statusEl.classList.remove('is-emergency', 'is-streaming');
    if (kind === 'emergency') this.dom.statusEl.classList.add('is-emergency');
    if (kind === 'streaming') this.dom.statusEl.classList.add('is-streaming');
    if (this.dom.statusText) this.dom.statusText.textContent = text || 'PNEC · ready';
  }

  // ─── Empty state ────────────────────────────────────────────────

  _showEmptyState() {
    this.dom.transcript.hidden = true;
    this.dom.empty.hidden = false;
    this.dom.followups.hidden = true;
  }
  _hideEmptyState() {
    this.dom.empty.hidden = true;
    this.dom.transcript.hidden = false;
  }
  _renderEmptySuggestions() {
    if (!this.dom.emptySuggestions) return;
    const cs = listConversations();
    const returning = cs.length >= 1;
    const activeIncident = false; // Phase 3 will surface this
    const items = pickEmptyStateSuggestions({ activeIncident, returning });
    renderSuggestionList(this.dom.emptySuggestions, items, (prompt) => {
      this.dom.input.value = prompt;
      this._onInputChange();
      this._submitInput();
    });
    // v3.6: populate the "Browse all topics" pill count
    if (this.dom.browseCount) this.dom.browseCount.textContent = totalTopicCount();
  }

  // v3.6: expand the curated suggestion strip into the full categorized
  // topic library. Reverse-toggle goes back to the small picker.
  _showAllTopics() {
    if (!this.dom.topicsBody || !this.dom.topicsPanel) return;
    renderAllTopics(this.dom.topicsBody, (prompt) => {
      this._hideAllTopics();
      this.dom.input.value = prompt;
      this._onInputChange();
      this._submitInput();
    });
    // Hide the curated strip + the browse link + the trust tips,
    // show the full panel
    if (this.dom.emptySuggestions) this.dom.emptySuggestions.hidden = true;
    if (this.dom.browseTopicsBtn)  this.dom.browseTopicsBtn.hidden  = true;
    const tips = this.dom.empty?.querySelector('.pnec-bot-tips');
    if (tips) tips.hidden = true;
    this.dom.topicsPanel.hidden = false;
  }
  _hideAllTopics() {
    if (this.dom.topicsPanel)      this.dom.topicsPanel.hidden = true;
    if (this.dom.emptySuggestions) this.dom.emptySuggestions.hidden = false;
    if (this.dom.browseTopicsBtn)  this.dom.browseTopicsBtn.hidden = false;
    const tips = this.dom.empty?.querySelector('.pnec-bot-tips');
    if (tips) tips.hidden = false;
  }

  // ─── Rail (conversation list) ───────────────────────────────────

  _renderRail(filter = '') {
    if (!this.dom.railList) return;
    const list = filter ? searchConversations(filter) : listConversations();
    const active = this.activeConversationId;
    if (!list.length) {
      this.dom.railList.innerHTML = `<li class="pnec-bot-rail-empty">${this.t('rail.empty')}</li>`;
      return;
    }
    this.dom.railList.innerHTML = '';
    list.forEach(c => {
      const li = document.createElement('li');
      li.className = 'pnec-bot-rail-item' + (c.id === active ? ' is-active' : '');
      li.dataset.convoId = c.id;
      li.innerHTML = `
        <span class="pnec-bot-rail-item-title">${_escape(c.title || 'Conversation')}</span>
        <span class="pnec-bot-rail-item-actions">
          <button class="pnec-bot-rail-item-delete" type="button" data-rail-action="delete" aria-label="Delete conversation">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </span>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.closest('[data-rail-action="delete"]')) {
          e.stopPropagation();
          this._deleteConversation(c.id);
        } else {
          this._switchConversation(c.id);
        }
      });
      this.dom.railList.appendChild(li);
    });
  }

  _filterRail(query) { this._renderRail(query); }

  _switchConversation(id) {
    setActiveConversation(id);
    this.activeConversationId = id;
    this._renderTranscript();
    this._renderRail();
  }

  _deleteConversation(id) {
    if (!confirm(this.t('confirm.delete_convo'))) return;
    deleteConversation(id);
    if (this.activeConversationId === id) {
      const next = listConversations()[0];
      this.activeConversationId = next?.id || null;
      if (next) setActiveConversation(next.id);
    }
    this._renderRail();
    if (this.activeConversationId) this._renderTranscript(); else this._showEmptyState();
  }

  _newChat() {
    const c = createConversation('New conversation');
    this.activeConversationId = c.id;
    this._renderRail();
    this._showEmptyState();
    this._renderEmptySuggestions();
    this.dom.input?.focus({ preventScroll: true });
  }

  // ─── Transcript ─────────────────────────────────────────────────

  _renderTranscript() {
    if (!this.dom.transcript) return;
    const convo = getActiveConversation();
    if (!convo) { this._showEmptyState(); return; }
    if (!convo.messages.length) { this._showEmptyState(); return; }
    this._hideEmptyState();
    this.dom.transcript.innerHTML = '';
    const userInitials = this._userInitials();
    convo.messages.forEach(m => {
      this.dom.transcript.appendChild(buildMessageEl(m, { userInitials }));
    });
    this._scrollToBottom();
  }

  _appendMessage(msg) {
    const userInitials = this._userInitials();
    const el = buildMessageEl(msg, { userInitials });
    this.dom.transcript.appendChild(el);
    this._hideEmptyState();
    this._scrollToBottom();
    return el;
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.dom.transcript.scrollTo({ top: this.dom.transcript.scrollHeight, behavior: 'smooth' });
    });
  }

  _userInitials() {
    const u = getCachedUser();
    if (!u) return 'YOU';
    const name = u.display_name || u.email || 'You';
    return name.trim().split(/\s+/).slice(0, 2).map(s => s[0].toUpperCase()).join('');
  }

  // ─── Composer logic ─────────────────────────────────────────────

  _onInputChange() {
    const v = this.dom.input.value;
    const len = v.length;
    if (this.dom.send) this.dom.send.disabled = !v.trim() && !this.activeImage;
    // Auto-grow
    this.dom.input.style.height = 'auto';
    this.dom.input.style.height = Math.min(160, this.dom.input.scrollHeight) + 'px';
    // Counter
    if (len >= COUNTER_WARN_AT) {
      this.dom.counter.hidden = false;
      this.dom.counter.textContent = `${len}/${MAX_INPUT_CHARS}`;
      this.dom.counter.classList.toggle('is-warn', len >= MAX_INPUT_CHARS - 50);
    } else {
      this.dom.counter.hidden = true;
    }
  }

  async _submitInput() {
    const text = (this.dom.input.value || '').trim();
    if (!text && !this.activeImage) return;
    if (text.length > MAX_INPUT_CHARS) {
      this.dom.input.value = text.slice(0, MAX_INPUT_CHARS);
      this._onInputChange();
      return;
    }
    if (this.streamingState) return; // already in flight

    // Ensure we have a conversation
    if (!this.activeConversationId) {
      const c = createConversation('New conversation');
      this.activeConversationId = c.id;
      this._renderRail();
    }

    // Build attachments array
    const attachments = [];
    if (this.activeImage) {
      attachments.push({ kind: 'image', dataUrl: this.activeImage.dataUrl, alt: this.activeImage.alt || '' });
    }

    // Save the user message
    const userMsg = appendMessage(this.activeConversationId, {
      role: 'user',
      content: text,
      attachments: attachments.length ? attachments : null
    });
    this._appendMessage(userMsg);

    // Stash the image so _runAssistantTurn can pass it to the LLM
    this.activeImageForTurn = this.activeImage ? { ...this.activeImage } : null;

    // Reset composer
    this.dom.input.value = '';
    this._clearAttachment();
    this._onInputChange();

    // Phase 3: emergency detection
    if (this.emergency && typeof this.emergency.detect === 'function') {
      const isEmergency = this.emergency.detect(text);
      if (isEmergency) {
        this.emergency.show(this);
        this._setStatus('emergency', this.t('status.emergency'));
      }
    }

    // Begin assistant turn
    await this._runAssistantTurn(text, attachments);
  }

  async _runAssistantTurn(userText, _attachments) {
    const convo = getActiveConversation();
    if (!convo) return;
    const user = getCachedUser();
    const systemPrompt = await buildSystemPrompt({ userMessage: userText, user, history: convo.messages });
    const history = formatHistory(convo.messages.slice(0, -1));   // exclude the just-added user msg

    // Insert a streaming bot bubble
    const placeholderEl = buildLoadingMsgEl();
    this.dom.transcript.appendChild(placeholderEl);
    this._scrollToBottom();
    this._setStatus('streaming', this.t('status.thinking'));

    let assistantText = '';
    const abort = new AbortController();
    this.streamingState = { abort };

    // Try the streaming endpoint first; fall back to one-shot if unsupported.
    let usedStream = false;
    try {
      const stream = sendCompletionStream({ systemPrompt, userMessage: userText, history, signal: abort.signal });
      let firstToken = true;
      for await (const ev of stream) {
        if (ev.kind === 'unsupported' || ev.kind === 'error') break;
        if (ev.kind === 'token' && ev.text) {
          if (firstToken) {
            // Replace loading placeholder with streaming bubble
            placeholderEl.classList.remove('is-loading');
            placeholderEl.classList.add('is-streaming');
            placeholderEl.querySelector('.pnec-bot-msg-bubble').innerHTML = '';
            firstToken = false;
            usedStream = true;
          }
          assistantText += ev.text;
          placeholderEl.querySelector('.pnec-bot-msg-bubble').innerHTML = renderMarkdown(assistantText);
          this._scrollToBottom();
        }
        if (ev.kind === 'done') break;
      }
    } catch (_e) {
      // Fall through to non-stream
    }

    if (!usedStream) {
      try {
        const { text } = await sendCompletion({
          systemPrompt, userMessage: userText, history,
          image: this.activeImageForTurn || null
        });
        assistantText = text;
        placeholderEl.classList.remove('is-loading');
        placeholderEl.classList.add('is-streaming');
        const bubble = placeholderEl.querySelector('.pnec-bot-msg-bubble');
        bubble.innerHTML = '';
        await streamIntoBubble(bubble, assistantText, {
          speed: 12, tickMs: 18,
          onTick: () => this._scrollToBottom()
        });
      } catch (e) {
        placeholderEl.classList.remove('is-loading', 'is-streaming');
        const bubble = placeholderEl.querySelector('.pnec-bot-msg-bubble');
        bubble.innerHTML = renderMarkdown(this._friendlyError(e));
        assistantText = '';
      }
    }

    placeholderEl.classList.remove('is-streaming');

    // Persist the assistant message
    if (assistantText) {
      // Phase 2: tool-call extraction
      let toolCalls = null, displayText = assistantText, citations = null;
      if (this.tools && typeof this.tools.parseToolCalls === 'function') {
        const parsed = this.tools.parseToolCalls(assistantText);
        toolCalls = parsed.toolCalls;
        displayText = parsed.cleanText;
      }
      if (this.tools && typeof this.tools.parseCitations === 'function') {
        citations = this.tools.parseCitations(displayText);
      }
      const saved = appendMessage(this.activeConversationId, {
        role: 'assistant',
        content: displayText,
        toolCalls,
        citations
      });
      // Replace the streaming element with the canonical rendered one
      placeholderEl.replaceWith(buildMessageEl(saved, { userInitials: this._userInitials() }));
      // Voice readback
      if (this.voice && getPrefs().voiceReplies) {
        try { this.voice.speak(displayText); } catch (_e) {}
      }
    }

    this.streamingState = null;
    this.activeImageForTurn = null;
    this._setStatus('idle', this.t('status.ready'));
    this._renderRail();

    // Followup chips (cheap parallel call, non-blocking)
    if (assistantText) {
      generateSuggestions({
        systemPrompt: 'You are a helpful PNEC assistant.',
        lastUserMessage: userText,
        lastAssistantMessage: assistantText
      }).then(chips => {
        renderFollowupChips(this.dom.followups, chips, (text) => {
          this.dom.input.value = text;
          this._onInputChange();
          this._submitInput();
        });
      });
    }
  }

  _friendlyError(err) {
    const m = String(err && err.message || err || '');
    if (/timeout/i.test(m))      return this.t('error.timeout');
    if (/network|fetch/i.test(m)) return this.t('error.network');
    if (/empty/i.test(m))        return this.t('error.empty');
    if (/api[_ ]?key/i.test(m))  return this.t('error.config');
    return this.t('error.generic');
  }

  // ─── Transcript click delegation ────────────────────────────────

  _onTranscriptClick(e) {
    const actionBtn = e.target.closest('[data-msg-action]');
    if (actionBtn) {
      const msgEl = actionBtn.closest('[data-msg-id]');
      const id = msgEl?.dataset.msgId;
      if (!id) return;
      this._handleMsgAction(id, actionBtn.dataset.msgAction, msgEl);
      return;
    }
    const toolBtn = e.target.closest('[data-tool-action]');
    if (toolBtn) {
      const card = toolBtn.closest('[data-tool-call-id]');
      this._handleToolAction(card, toolBtn.dataset.toolAction);
      return;
    }
  }

  _handleMsgAction(msgId, action, msgEl) {
    const convo = getActiveConversation();
    if (!convo) return;
    const msg = convo.messages.find(m => m.id === msgId);
    if (!msg) return;

    if (action === 'up' || action === 'down') {
      const next = msg.feedback === action ? null : action;
      updateMessage(this.activeConversationId, msgId, { feedback: next });
      msgEl.replaceWith(buildMessageEl({ ...msg, feedback: next }, { userInitials: this._userInitials() }));
    } else if (action === 'copy') {
      navigator.clipboard?.writeText(msg.content || '').catch(() => {});
    } else if (action === 'speak') {
      if (this.voice) this.voice.speak(msg.content || '');
    } else if (action === 'edit' && msg.role === 'user') {
      const newText = prompt(this.t('prompt.edit'), msg.content || '');
      if (newText && newText !== msg.content) {
        updateMessage(this.activeConversationId, msgId, { content: newText });
        // Drop everything AFTER this msg + retry
        const idx = convo.messages.findIndex(m => m.id === msgId);
        convo.messages.slice(idx + 1).forEach(m => deleteMessage(this.activeConversationId, m.id));
        this._renderTranscript();
        this._runAssistantTurn(newText, msg.attachments || []);
      }
    }
  }

  _handleToolAction(card, action) {
    if (!this.tools || typeof this.tools.executeFromCard !== 'function') return;
    this.tools.executeFromCard(this, card, action);
  }

  // ─── Drawer + image + voice ─────────────────────────────────────

  _runDrawerAction(name) {
    if (this.emergency && typeof this.emergency.runDrawer === 'function') {
      this.emergency.runDrawer(this, name);
      return;
    }
    // Phase 1 fallbacks — bot just navigates / asks
    if (name === 'alerts')   window.open('/pages/preparedness-resources.html#local-risk', '_blank');
    if (name === 'evac')     window.open('/pages/find-your-neighborhood.html', '_blank');
    if (name === 'kit')      this._sendQuick('Help me check on my emergency kit status.');
  }

  _sendQuick(text) {
    this.dom.input.value = text;
    this._onInputChange();
    this._submitInput();
  }

  _onAttachFile(files) {
    if (!files || !files.length) return;
    const file = files[0];
    if (!/^image\//.test(file.type)) return;
    if (this.image && typeof this.image.attach === 'function') {
      this.image.attach(this, file);
      return;
    }
    // Phase 1 fallback: store base64 + show a tile (the LLM call ignores
    // images in P1; Phase 4's image.js wires actual vision)
    const reader = new FileReader();
    reader.onload = () => {
      this.activeImage = { dataUrl: reader.result, alt: file.name };
      this._renderAttachmentTile();
      this._onInputChange();
    };
    reader.readAsDataURL(file);
  }

  _renderAttachmentTile() {
    if (!this.dom.attachments) return;
    if (!this.activeImage) {
      this.dom.attachments.hidden = true;
      this.dom.attachments.innerHTML = '';
      return;
    }
    this.dom.attachments.hidden = false;
    this.dom.attachments.innerHTML = `
      <div class="pnec-bot-composer-attachment">
        <img src="${this.activeImage.dataUrl}" alt="">
        <button class="pnec-bot-composer-attachment-remove" type="button" data-remove-attachment aria-label="Remove">×</button>
      </div>
    `;
    this.dom.attachments.querySelector('[data-remove-attachment]').addEventListener('click', () => this._clearAttachment());
  }
  _clearAttachment() {
    this.activeImage = null;
    if (this.dom.attachInput) this.dom.attachInput.value = '';
    this._renderAttachmentTile();
  }

  _toggleVoice() {
    if (!this.voice || typeof this.voice.toggleListen !== 'function') {
      // Phase 1 fallback — show a friendly tip
      this._setStatus('idle', this.t('status.voice_unavailable'));
      setTimeout(() => this._setStatus('idle', this.t('status.ready')), 2200);
      return;
    }
    this.voice.toggleListen(this);
  }

  // ─── Settings actions ───────────────────────────────────────────

  _exportConversation() {
    const convo = getActiveConversation();
    if (!convo || !convo.messages.length) { alert(this.t('export.empty')); return; }
    if (this.exporter && typeof this.exporter.exportConversation === 'function') {
      this.exporter.exportConversation(convo);
      return;
    }
    // Phase 1 fallback — plain text download
    const text = convo.messages.map(m => `[${new Date(m.timestamp).toISOString()}] ${m.role.toUpperCase()}:\n${m.content}\n`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pnec-helper-bot-${convo.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  _confirmClearAll() {
    if (!confirm(this.t('confirm.clear_all'))) return;
    clearAllConversations();
    this.activeConversationId = null;
    this._renderRail();
    this._showEmptyState();
    this._renderEmptySuggestions();
  }

  _applyLang(lang) {
    if (this.i18n && typeof this.i18n.setLang === 'function') this.i18n.setLang(lang);
  }

  _t(key, ...args) {
    if (this.i18n && typeof this.i18n.t === 'function') return this.i18n.t(key, ...args);
    return DEFAULT_STRINGS[key] ? (
      typeof DEFAULT_STRINGS[key] === 'function' ? DEFAULT_STRINGS[key](...args) : DEFAULT_STRINGS[key]
    ) : key;
  }
}

// English fallback strings — overridden per-language by i18n.js (Phase 4)
const DEFAULT_STRINGS = {
  'greet.morning':           'Good morning',
  'greet.afternoon':         'Good afternoon',
  'greet.evening':           'Good evening',
  'greet.late':              'Hello',
  'greet.neighbor':          'neighbor',
  'greet.default':           "Ask me anything about emergency preparedness, your block, or PNEC programs.",
  'greet.with_neighborhood': (n) => `Your block (${n}) is here. What can I help with?`,
  'status.ready':            'PNEC · ready',
  'status.thinking':         'Thinking…',
  'status.emergency':        'Emergency mode',
  'status.voice_unavailable':'Voice not available in this browser',
  'rail.empty':              'No conversations yet — start a new chat below.',
  'confirm.delete_convo':    'Delete this conversation? This can\'t be undone.',
  'confirm.clear_all':       'Permanently delete all chat history?',
  'export.empty':            'Nothing to export — start a conversation first.',
  'prompt.edit':             'Edit your message:',
  'error.timeout':           "I'm taking longer than expected to reach my brain. Could you try again?",
  'error.network':           "I can't reach the PNEC server right now. Check your connection and retry?",
  'error.empty':             "I got an empty response. Could you rephrase your question?",
  'error.config':            "Helper Bot is offline right now — a PNEC volunteer has been notified. Please use the contact form for now.",
  'error.generic':           "Something went wrong. Could you try again, or use the contact form for now?",
};

// ─── Boot ─────────────────────────────────────────────────────────

function boot() {
  const bot = new HelperBot();
  window.PNEC_HELPER_BOT = bot;
  bot.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
