(function () {
  var ASSET_BASE = '/assets';

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function moveFullNavToTop() {
    var innerHeader = document.querySelector('header[data-elementor-type="header"]');
    var navSection = document.querySelector('.elementor-element-c8c3c8c');
    if (!innerHeader || !navSection) return;

    navSection.classList.add('pnec-top-green-nav');
    if (document.body.firstElementChild !== navSection) {
      document.body.insertBefore(navSection, document.body.firstElementChild);
    }
  }

  /* Put the REAL white PNEC logo inside the green nav bar (left side).
     Because the bar is position:absolute, embedding the logo IN it
     means the nav can never overlap the logo — they are the same
     element. Runs on every enhanced page → consistent branding site-
     wide. White logo on the green bar is high-contrast + on-brand. */
  function ensureNavLogo() {
    var nav = document.querySelector('.pnec-top-green-nav');
    if (!nav || nav.querySelector('.pnec-nav-logo')) return;
    var container = nav.querySelector('.elementor-container') || nav;
    var logo = document.createElement('a');
    logo.className = 'pnec-nav-logo';
    logo.href = '/';
    logo.setAttribute('aria-label', 'Poway Neighborhood Emergency Corps — home');
    var img = document.createElement('img');
    img.src = '/assets/images/poway-nec-logo-white.png';
    img.alt = 'Poway Neighborhood Emergency Corps';
    img.width = 768;
    img.height = 307;
    img.decoding = 'async';
    logo.appendChild(img);
    container.insertBefore(logo, container.firstChild);
  }

  /* Give interior pages the same rotating photo hero the home page
     has. The first <section> inside .jupiterx-post-content is the
     page-title band; we turn it into a photo hero (4 local Poway
     images cycling) with the page title overlaid in white. The home
     page already ships its own .hero-slider so it is left untouched. */
  function ensureHeroGallery() {
    if (/register\.html|login|profile\.html|onboarding\.html/.test(window.location.pathname)) return;
    var content = document.querySelector('.jupiterx-post-content');
    if (!content) return;
    if (document.querySelector('.hero-slider')) return;          // home already has one
    var band = content.querySelector('.elementor-section');
    if (!band || band.querySelector('.pnec-hero-gallery')) return;
    band.classList.add('pnec-hero-band');
    var g = document.createElement('div');
    g.className = 'pnec-hero-gallery';
    g.setAttribute('aria-hidden', 'true');
    var imgs = [
      '/assets/images/Poway_Lake.webp',
      '/assets/images/Poway_Fire.webp',
      '/assets/images/Poway_Flood.webp',
      '/assets/images/Poway_Image.webp'
    ];
    g.innerHTML = imgs.map(function (s, i) {
      return '<div class="pnec-hero-slide' + (i === 0 ? ' is-active' : '') +
             '" style="background-image:url(' + s + ')"></div>';
    }).join('') + '<div class="pnec-hero-overlay"></div>';
    band.insertBefore(g, band.firstChild);
    var slides = g.querySelectorAll('.pnec-hero-slide');
    var idx = 0;
    setInterval(function () {
      slides[idx].classList.remove('is-active');
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add('is-active');
    }, 4500);
  }

  function ensureChatbotMarkup() {
    if (document.getElementById('chatbot-trigger-btn')) return;

    var wrapper = document.createElement('div');
    wrapper.innerHTML = [
      '<button class="chatbot-trigger" id="chatbot-trigger-btn" aria-label="Open Helper Bot" aria-expanded="false">',
      '  <span class="chatbot-trigger-icon" aria-hidden="true">💬</span>',
      '  <span class="chatbot-trigger-label">Help</span>',
      '</button>',
      '<div class="chatbot-backdrop" id="chatbot-backdrop" hidden></div>',
      '<div class="chatbot-panel" id="chatbot-panel" role="dialog" aria-modal="true" aria-label="Helper Bot">',
      '  <div class="chatbot-header">',
      '    <div class="chatbot-header-logo" aria-hidden="true">💬</div>',
      '    <div class="chatbot-header-title">',
      '      <div class="chatbot-name">Helper Bot</div>',
      '      <div class="chatbot-subtitle">Questions about the site or PNEC</div>',
      '    </div>',
      '    <button class="chatbot-expand" id="chatbot-expand-btn" aria-label="Expand assistant" aria-pressed="false">⤢</button>',
      '    <button class="chatbot-modal-toggle" id="chatbot-modal-btn" aria-label="Open assistant in overlay" aria-pressed="false" hidden>▣</button>',
      '    <button class="chatbot-close" id="chatbot-close-btn" aria-label="Close assistant">✕</button>',
      '  </div>',
      '  <div class="chatbot-body" id="chatbot-body">',
      '    <div class="chatbot-screen active" id="screen-welcome">',
      '      <div class="chatbot-welcome">',
      '        <div class="chatbot-greeting">',
      '          <span class="greeting-emoji" aria-hidden="true">👋</span>',
      '          <h3>How can I help?</h3>',
      '          <p>Ask about the website, local preparedness topics, or who to contact at PNEC.</p>',
      '        </div>',
      '        <div class="chatbot-search-bar">',
      '          <input type="text" id="chatbot-search-input" placeholder="Ask a question..." aria-label="Ask Helper Bot a question" autocomplete="off">',
      '          <button type="button" class="chatbot-send-btn" id="chatbot-send-btn" aria-label="Send question">➤</button>',
      '        </div>',
      '        <div class="chatbot-search-results" id="chatbot-search-results" aria-live="polite" style="display:none"></div>',
      '        <div class="chatbot-categories" id="chatbot-categories" aria-label="Question categories">',
      '          <button class="chatbot-category-btn chatbot-shortcut-btn" data-shortcut-query="What does PNEC do?"><span class="cat-icon" aria-hidden="true">🏠</span><span class="cat-name">About PNEC</span></button>',
      '          <button class="chatbot-category-btn chatbot-shortcut-btn" data-shortcut-query="How do I find my neighborhood coordinator?"><span class="cat-icon" aria-hidden="true">📍</span><span class="cat-name">Neighborhood help</span></button>',
      '          <button class="chatbot-category-btn chatbot-shortcut-btn" data-shortcut-query="What should I prepare before a wildfire or evacuation?"><span class="cat-icon" aria-hidden="true">📦</span><span class="cat-name">Preparedness checklist</span></button>',
      '          <button class="chatbot-category-btn chatbot-shortcut-btn" data-shortcut-query="How do I volunteer or contact PNEC?"><span class="cat-icon" aria-hidden="true">🤝</span><span class="cat-name">Volunteer or contact</span></button>',
      '          <div class="loading-overlay"><span class="spinner"></span> Loading topics...</div>',
      '        </div>',
      '        <div class="chatbot-utility-links"><a class="chatbot-utility-link" href="/pages/find-your-neighborhood.html">Find Your Neighborhood</a><a class="chatbot-utility-link" href="/pages/contact.html">Contact PNEC</a></div>',
      '      </div>',
      '    </div>',
      '    <div class="chatbot-screen" id="screen-category">',
      '      <div class="chatbot-category-header"><button class="back-btn" id="back-to-welcome" aria-label="Back to categories">‹</button><h4 id="category-screen-title">Category</h4></div>',
      '      <ul class="chatbot-question-list" id="chatbot-question-list" aria-label="Questions in this category"></ul>',
      '    </div>',
      '    <div class="chatbot-screen" id="screen-answer">',
      '      <div class="chatbot-answer-header"><button class="back-btn" id="back-to-category" aria-label="Back to questions">‹</button><h4 id="answer-question-text"></h4></div>',
      '      <div class="chatbot-answer-text" id="answer-body" aria-live="polite"></div>',
      '      <div class="chatbot-conversation-input"><input type="text" id="chatbot-followup-input" placeholder="Ask a follow-up..." aria-label="Ask Helper Bot a follow-up question" autocomplete="off"><button type="button" class="chatbot-send-btn" id="chatbot-followup-send-btn" aria-label="Send follow-up">➤</button></div>',
      '      <div class="chatbot-feedback"><span>Was this helpful?</span><button class="feedback-btn" id="feedback-yes-btn" aria-label="Yes, this was helpful">👍 Yes</button><button class="feedback-btn" id="feedback-no-btn" aria-label="No, this was not helpful">👎 No</button></div>',
      '      <div class="chatbot-ask-staff"><button class="btn btn-outline-red btn-sm btn-ask-staff" id="show-ask-form-btn">Ask a Staff Member</button></div>',
      '    </div>',
      '    <div class="chatbot-screen" id="screen-ask-staff">',
      '      <div class="chatbot-category-header"><button class="back-btn" id="back-from-ask-form" aria-label="Back">‹</button><h4>Ask a Staff Member</h4></div>',
      '      <div class="chatbot-ask-form"><p style="font-size:13px;color:#5a5a5a;margin-bottom:16px;">Our volunteer staff typically respond within 1-2 business days.</p>',
      '        <form id="ask-staff-form" novalidate>',
      '          <div class="form-group"><label class="form-label" for="ask-name">Your Name</label><input type="text" class="form-input" id="ask-name" name="name" placeholder="Jane Smith" required></div>',
      '          <div class="form-group"><label class="form-label" for="ask-email">Email Address</label><input type="email" class="form-input" id="ask-email" name="email" placeholder="you@example.com" required></div>',
      '          <div class="form-group"><label class="form-label" for="ask-question">Your Question</label><textarea class="form-textarea" id="ask-question" name="question_text" placeholder="Describe your question in detail..." required></textarea></div>',
      '          <div id="ask-form-error" class="form-error" aria-live="polite" style="display:none"></div>',
      '          <button type="submit" class="btn btn-primary btn-block btn-sm" id="ask-form-submit">Send Question</button>',
      '        </form>',
      '      </div>',
      '    </div>',
      '    <div class="chatbot-screen" id="screen-success">',
      '      <div class="chatbot-success"><div class="success-icon" aria-hidden="true">✅</div><h4>Question Received!</h4><p>A PNEC staff member will respond to your question at the email you provided, typically within 1-2 business days.</p><button class="btn btn-secondary btn-sm" id="success-back-btn" style="margin-top:16px">Back to Topics</button></div>',
      '    </div>',
      '  </div>',
      '  <div class="chatbot-footer"><p><a href="/pages/contact.html">Need a person? Contact PNEC directly.</a></p></div>',
      '</div>'
    ].join('');

    document.body.appendChild(wrapper);
  }

  function ensureChatbotConfig() {
    var pnecApiBase = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';

    window.PNEC_CHATBOT_CONFIG = window.PNEC_CHATBOT_CONFIG || {
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-2.5-flash',
      apiBase: '',
      endpoint: pnecApiBase + '/api/gemini',
      newsEndpoint: pnecApiBase + '/api/news/search',
      llmModuleUrl: ASSET_BASE + '/js/api/llm-chat.js'
    };
  }

  function ensureChatbot() {
    ensureChatbotMarkup();
    ensureChatbotConfig();

    if (window.__pnecChatbotLoading) return;
    window.__pnecChatbotLoading = true;

    loadScript(ASSET_BASE + '/js/utils/errors.js')
      .then(function () { return loadScript(ASSET_BASE + '/js/api/auth-api.js'); })
      .then(function () { return loadScript(ASSET_BASE + '/js/api/faq-api.js'); })
      .then(function () { return loadScript(ASSET_BASE + '/js/ui/chatbot-ui.js'); })
      .then(function () { return loadScript(ASSET_BASE + '/js/pages/chatbot.js'); })
      .catch(function () {
        window.__pnecChatbotLoading = false;
      });
  }

  function ensurePreparednessActionBand() {
    if (document.querySelector('.pnec-preparedness-band')) return;
    if (/register\.html|login|profile\.html|onboarding\.html/.test(window.location.pathname)) return;

    var content = document.querySelector('.jupiterx-post-content');
    if (!content) return;

    var firstSection = content.querySelector('.elementor-section');
    var band = document.createElement('section');
    band.className = 'pnec-preparedness-band';
    band.innerHTML = [
      '<div class="pnec-preparedness-band-inner">',
      '  <div class="pnec-preparedness-band-copy">',
      '    <span class="pnec-preparedness-kicker">Preparedness first</span>',
      '    <h2>Take one practical step before the next emergency.</h2>',
      '    <p>Find your neighborhood, build a household kit, review evacuation readiness, or contact PNEC about volunteering and local resources.</p>',
      '  </div>',
      '  <div class="pnec-preparedness-band-actions">',
      '    <a href="/pages/find-your-neighborhood.html">Find Your Neighborhood</a>',
      '    <a href="/pages/preparedness-resources.html">Preparedness Resources</a>',
      '    <a href="/pages/programs-and-services.html">Volunteer Programs</a>',
      '    <a href="/pages/contact.html">Contact PNEC</a>',
      '  </div>',
      '</div>'
    ].join('');

    // firstSection may be nested (not a direct child of `content`), so
    // insert relative to its REAL parent — using content.insertBefore
    // with firstSection.nextSibling threw NotFoundError when the section
    // wasn't a direct child of content.
    if (firstSection && firstSection.parentNode) {
      firstSection.parentNode.insertBefore(band, firstSection.nextSibling);
    } else {
      content.appendChild(band);
    }
  }

  /* Add "Poway Statistics & Information" to the footer Quick Links on
     these raw cloned pages. Their footers are baked per-file with both
     a desktop UL (#menu-1-55465df) and a mobile dropdown UL
     (#menu-2-55465df), so a single static edit can't cover them DRY.
     This appends one <li> (cloned from the last footer item so classes
     / tabindex match the surrounding markup) to every footer Quick
     Links list that doesn't already have it. Idempotent. The link
     points at the stats page's own declared canonical so there's no
     redirect flash. */
  var STATS_HREF = '/pages/preparedness-resources.html#poway-risk-context';
  var STATS_LABEL = 'Poway Statistics & Information';
  function ensureFooterStatsLink() {
    var lists = document.querySelectorAll('.jupiterx-footer ul.elementor-nav-menu');
    lists.forEach(function (ul) {
      var links = ul.querySelectorAll('a');
      var already = false;
      for (var i = 0; i < links.length; i++) {
        var h = links[i].getAttribute('href') || '';
        if (h.indexOf('poway-risk-context') !== -1 ||
            h.indexOf('poway-statistics-and-information') !== -1 ||
            (links[i].textContent || '').trim().toLowerCase().indexOf('poway statistics') === 0) {
          already = true;
          break;
        }
      }
      if (already) return;
      var lastLi = ul.querySelector('li:last-child');
      var li = document.createElement('li');
      li.className = lastLi ? lastLi.className.replace(/\bcurrent[-_a-z]*\b/g, '').replace(/\s+/g, ' ').trim()
                            : 'menu-item menu-item-type-post_type menu-item-object-page';
      var a = document.createElement('a');
      a.href = STATS_HREF;
      a.className = 'elementor-item';
      a.textContent = STATS_LABEL;
      var lastA = lastLi && lastLi.querySelector('a');
      if (lastA && lastA.getAttribute('tabindex') === '-1') a.setAttribute('tabindex', '-1');
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  onReady(function () {
    document.body.classList.add('pnec-enhanced-raw-page');
    // Run each enhancement in isolation: a failure in one (e.g. a DOM
    // edge case in ensurePreparednessActionBand) must NOT abort the
    // others — that previously stopped ensureFooterStatsLink/ensureChatbot
    // from ever running on pages where an earlier step threw.
    [
      moveFullNavToTop,
      ensureNavLogo,
      ensureHeroGallery,
      ensurePreparednessActionBand,
      ensureFooterStatsLink
      // NOTE: ensureChatbot() is intentionally NOT called. It injects a
      // legacy chatbot widget (#chatbot-trigger-btn / .chatbot-panel)
      // whose CSS no longer exists anywhere, so it rendered as raw
      // unstyled markup dumped below the footer. The real chatbot is the
      // Helper Bot injected independently by chatbot-inject.js on every
      // page that loads this script. Previously this never surfaced only
      // because an upstream throw in ensurePreparednessActionBand aborted
      // the chain before it; now that each step is isolated we must drop
      // the dead call explicitly. (Functions kept for git-history clarity.)
    ].forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console && console.warn) console.warn('[pnec-enhance] ' + fn.name + ' failed:', e); }
    });
  });
}());
