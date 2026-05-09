// assets/js/chatbot/emergency.js
// PNEC Helper Bot v3 — Phase 3 emergency awareness.
//
// Two layers:
//   1. Detection — keyword + pattern match on user messages. When the
//      user mentions evacuation, smoke they can see, fire on/near
//      property, etc., we immediately surface the action drawer at
//      the top of the panel and switch the status indicator to
//      emergency-red. This happens BEFORE the model responds, so the
//      user never has to wait for the LLM to think before seeing the
//      911 button.
//
//   2. Drawer actions — the four pinned shortcuts (Call 911 / Active
//      alerts / Evac route / Kit) execute from this module so a Phase
//      3 deploy can light up the drawer without having to touch
//      index.js.

import { searchNews, getRiskNow } from './api.js';
import { renderMarkdown, _escape } from './render.js';
import { appendMessage, getActiveConversation } from './store.js';

// Conservative list — a false positive is annoying; a false negative
// could be dangerous in the use case we care about (real emergencies).
const EMERGENCY_PATTERNS = [
  /\b911\b/,
  /\b(active|nearby|approaching)\s+fire\b/i,
  /\bsmoke\s+(in|near|outside|coming\s+from)\b/i,
  /\b(can|i)\s+see\s+(the\s+)?(smoke|flames|fire)\b/i,
  /\bevacuat(e|ing)\s+(now|right now|already)\b/i,
  /\b(told|asked)\s+to\s+evacuate\b/i,
  /\b(red.flag|red flag)\s+(warning|alert)\s+(today|now|in effect|active)\b/i,
  /\b(trapped|stuck)\b.*\b(fire|smoke|house|home)\b/i,
  /\b(power|electricity)\s+(is\s+)?(out|off|down)\s+(and|right now|in my)\b/i,
  /\b(fire|smoke)\s+(on|in|next to|by)\s+my\s+(yard|house|street|block|property)\b/i,
];

export function attach(bot) {
  // Watch for user-typed emergency words on every input change so the
  // drawer can pop instantly — not just after submit.
  if (!bot.dom.input) return;
  let lastFlag = false;
  bot.dom.input.addEventListener('input', () => {
    const flag = detect(bot.dom.input.value || '');
    if (flag && !lastFlag) {
      show(bot, { silent: true });
      lastFlag = true;
    } else if (!flag && lastFlag && (bot.dom.input.value || '').trim().length === 0) {
      hide(bot);
      lastFlag = false;
    }
  });
}

export function detect(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 3) return false;
  return EMERGENCY_PATTERNS.some(re => re.test(t));
}

export function show(bot, opts = {}) {
  if (!bot || !bot.dom.actionDrawer) return;
  bot.dom.actionDrawer.hidden = false;
  if (!opts.silent) {
    bot._setStatus('emergency', 'Emergency mode');
  }
}

export function hide(bot) {
  if (!bot || !bot.dom.actionDrawer) return;
  bot.dom.actionDrawer.hidden = true;
  bot._setStatus('idle', 'PNEC · ready');
}

// Drawer button click handlers
export async function runDrawer(bot, action) {
  if (action === 'alerts')   return showAlerts(bot);
  if (action === 'evac')     return showEvac(bot);
  if (action === 'kit')      return showKit(bot);
}

async function showAlerts(bot) {
  // Inject a synthetic assistant message with current risk + news cards.
  const [risk, news] = await Promise.all([
    getRiskNow().catch(() => null),
    searchNews('Poway fire emergency alert').catch(() => []),
  ]);
  const parts = [];
  if (risk) {
    const lvl = risk.level || risk.risk_level || risk.label || 'Unknown';
    parts.push(`**Today's Poway risk:** ${lvl}${risk.description ? ' — ' + risk.description : ''}`);
  }
  if (Array.isArray(news) && news.length) {
    parts.push('**Recent local news:**');
    news.slice(0, 4).forEach(a => {
      const title = (a.title || a.headline || '').trim();
      const url = a.url || a.link;
      const src = a.source || a.publisher || 'news';
      if (title) parts.push(`- [${title}](${url || '#'}) — ${src}`);
    });
  }
  if (!parts.length) parts.push('_Live alerts not available right now. Try the [Preparedness page](/pages/preparedness-resources.html#local-risk) directly._');

  injectAssistant(bot, parts.join('\n\n'));
}

async function showEvac(bot) {
  const text = `**Find your evacuation route**\n\nPNEC publishes neighborhood-specific evacuation guidance. Open the neighborhood lookup, enter your address, and your block coordinator's recommended evac path will appear.\n\n[Open neighborhood finder →](/pages/find-your-neighborhood.html)\n\nIf an evacuation order is **active right now**, follow San Diego County's official orders at **alertsandiego.org** or call **211**.`;
  injectAssistant(bot, text);
}

async function showKit(bot) {
  const text = `**Your 72-hour kit checklist**\n\n- 1 gallon of water per person, per day (3 days minimum)\n- Non-perishable food (canned, shelf-stable)\n- Flashlight + extra batteries\n- Battery or hand-crank radio\n- First-aid kit + 7-day medication supply\n- N95 masks (smoke + dust)\n- Sturdy shoes + change of clothes\n- Cash (small bills) + copies of ID, insurance, deed\n- Phone charger + power bank\n- Whistle + dust mask\n\n[Full kit guide on Preparedness page →](/pages/preparedness-resources.html)`;
  injectAssistant(bot, text);
}

function injectAssistant(bot, text) {
  if (!bot.activeConversationId) {
    // Empty state — just open a new conversation
    bot._newChat();
  }
  const msg = appendMessage(bot.activeConversationId, {
    role: 'assistant',
    content: text,
  });
  // Re-render
  import('./render.js').then(({ buildMessageEl }) => {
    bot.dom.transcript.appendChild(buildMessageEl(msg, { userInitials: bot._userInitials() }));
    bot._hideEmptyState();
    bot._scrollToBottom();
  });
}
