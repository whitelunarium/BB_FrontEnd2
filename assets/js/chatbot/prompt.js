// assets/js/chatbot/prompt.js
// PNEC Helper Bot v3 — system prompt builder.
//
// Modular: builds the prompt from named blocks so it's easy to A/B
// later. Phase 2 will swap out the keyword retrieval here for vector
// embeddings; Phase 3 adds the time/risk awareness; Phase 4 adds
// language-specific instructions.

import { fetchAllFaq, searchFaq, searchNews } from './api.js';

const PNEC_BASE = `You are Helper Bot — the friendly, plainspoken AI guide for the Poway Neighborhood Emergency Corps (PNEC), a 100% volunteer organization founded in 2003 that helps Poway, California households prepare for emergencies (wildfire, earthquake, extreme heat, power outages, flooding).

Tone: warm, neighborly, never alarmist. Concrete actions over abstract advice. Cite the FAQ source ID when answering from the FAQ.

If a user is in an active emergency (active fire, smoke they can see, medical), say so directly and tell them to call 911 first, then offer follow-up info.

Never invent statistics, names, dates, addresses, or coordinator contacts. If asked something outside PNEC's scope (Poway preparedness, neighborhoods, programs, kit-building, drills, evacuation), gently redirect.

If you're uncertain, say "I don't have that detail — you can ask a PNEC volunteer directly" and suggest the staff contact form. Never fabricate.`;

const POWAY_FACTS = `Poway facts you can rely on:
• Poway is in north inland San Diego County, ~50,000 residents, ~17,000 households.
• Major wildfire history: 2003 Cedar Fire (most destructive in CA at the time), 2007 Witch Creek Fire (massive evacuation), 2025 Springhurst & Ted Williams incidents (recent local responses).
• Fire season: typically May–October, peak risk Sept–Oct with Santa Ana winds.
• PNEC connects households to "block coordinators" — neighborhood-level volunteers who maintain rosters of households needing assistance during outages or evacuations.
• Standard recommended kit: 72hrs water (1gal/person/day), non-perishable food, flashlight, radio (battery or hand-crank), first-aid kit, medications, cash, copies of important documents, sturdy shoes, N95 masks.`;

function userBlock(user) {
  if (!user) return '';
  const lines = [`Logged-in user context (use this to personalize but never quote it back wholesale):`];
  if (user.display_name) lines.push(`• Name: ${user.display_name}`);
  if (user.first_name && !user.display_name) lines.push(`• Name: ${user.first_name}`);
  if (user.email) lines.push(`• Email: ${user.email}`);
  if (user.neighborhood) lines.push(`• Neighborhood: ${user.neighborhood}`);
  if (user.role) lines.push(`• Role: ${user.role}`);
  if (user.member_since) lines.push(`• Member since: ${user.member_since}`);
  if (lines.length === 1) return '';
  lines.push(`Address them by first name when natural. If they ask about THEIR block/coordinator/neighborhood, use what's above.`);
  return lines.join('\n');
}

function timeBlock() {
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const hour = now.getHours();
  const month = now.getMonth() + 1;
  const seasonNote = (month >= 5 && month <= 10)
    ? 'It is fire season in San Diego County right now — fire-prep questions are time-sensitive.'
    : 'It is the off-season for wildfire — focus on year-round prep, storm prep, drills.';
  const tod = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Today is ${dateStr} (${tod}, ${tz}). ${seasonNote}`;
}

function citationsInstructions() {
  return `When you draw a fact from a specific FAQ, add a citation marker like [FAQ#42] right after that fact. Do not invent FAQ IDs — only cite IDs that appear in the CONTEXT block.

When you draw from a news article in CONTEXT, cite as [News: <publisher>] after the fact.

For tools (Phase 2+): when the user wants to do something (navigate, search, look up risk, contact staff), respond with a JSON tool block on its OWN line, in the form:
{"tool":"<name>","args":{...},"reason":"why"}
Then a short user-facing note. Available tools: navigate_to(slug), search_news(query), get_risk_now, submit_to_staff(question), find_event(when, type).`;
}

// ─── Cheap keyword retrieval (Phase 1; replaced by embeddings in P2)

let _faqIndexPromise = null;
async function getFaqIndex() {
  if (!_faqIndexPromise) {
    _faqIndexPromise = (async () => {
      const items = await fetchAllFaq();
      return Array.isArray(items) ? items : [];
    })();
  }
  return _faqIndexPromise;
}

function tokenize(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter(t => t.length >= 3);
}

function scoreFaqItem(tokens, item) {
  const hay = `${item.question || item.title || ''} ${item.answer || item.body || ''}`.toLowerCase();
  let s = 0;
  tokens.forEach(t => { if (hay.includes(t)) s += 1; });
  return s;
}

export async function retrieveFaqContext(query, limit = 6) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const all = await getFaqIndex();
  const scored = all
    .map(it => ({ item: it, score: scoreFaqItem(tokens, it) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.item);

  // Augment with API-side search (it may know synonyms)
  let extra = [];
  try { extra = await searchFaq(query); } catch (_e) { extra = []; }
  const merged = [...scored];
  extra.slice(0, 4).forEach(e => {
    if (!merged.find(m => (m.id || m.faq_id) === (e.id || e.faq_id))) merged.push(e);
  });
  return merged;
}

function shouldFetchNews(query) {
  const q = query.toLowerCase();
  const recency = /(latest|recent|current|today|happening|now|why|cause|status|update)/.test(q);
  const incident = /(fire|smoke|outage|evacuat|alert|earthquake|flood|storm|wind|incident|burn|red flag)/.test(q);
  return recency && incident;
}

function buildNewsQuery(message) {
  const m = message.toLowerCase();
  if (m.includes('springhurst')) return 'Springhurst Poway fire';
  if (m.includes('ted williams') || m.includes('williams parkway')) return 'Ted Williams Parkway Poway';
  if (m.includes('witch creek') || m.includes('witch fire')) return 'Witch Creek Fire Poway';
  if (m.includes('cedar fire') || m.includes('2003')) return 'Cedar Fire Poway 2003';
  if (m.includes('santa ana')) return 'Santa Ana wind Poway';
  return 'Poway fire emergency';
}

// ─── Public: build a complete system prompt for a given user msg ──

export async function buildSystemPrompt({ userMessage, user, history }) {
  const blocks = [PNEC_BASE, POWAY_FACTS, timeBlock()];

  const userBlk = userBlock(user);
  if (userBlk) blocks.push(userBlk);

  // Retrieval block — cap at ~3500 chars to keep prompts cheap
  const faq = await retrieveFaqContext(userMessage, 6);
  if (faq.length) {
    const lines = ['CONTEXT — relevant PNEC FAQs (cite IDs as [FAQ#<id>]):'];
    let totalLen = 0;
    faq.forEach(item => {
      const id = item.id || item.faq_id;
      const q  = (item.question || item.title || '').trim();
      const a  = (item.answer || item.body || '').trim();
      const block = `[FAQ#${id}] Q: ${q}\nA: ${a}`;
      if (totalLen + block.length > 3500) return;
      lines.push(block);
      totalLen += block.length;
    });
    blocks.push(lines.join('\n\n'));
  }

  // News block — only if the user is asking about a current incident
  if (shouldFetchNews(userMessage)) {
    try {
      const articles = await searchNews(buildNewsQuery(userMessage));
      if (articles.length) {
        const lines = ['CONTEXT — recent news (cite as [News: <publisher>]):'];
        articles.slice(0, 5).forEach(a => {
          const title = (a.title || a.headline || '').trim();
          const desc  = (a.description || a.summary || a.snippet || '').trim();
          const src   = a.source || a.publisher || a.site || 'news';
          if (title) lines.push(`• ${src}: ${title}\n  ${desc.slice(0, 220)}`);
        });
        blocks.push(lines.join('\n\n'));
      }
    } catch (_e) { /* news is best-effort */ }
  }

  blocks.push(citationsInstructions());

  return blocks.join('\n\n────────────────\n\n');
}

// ─── History formatting for the API ──────────────────────────────

export function formatHistory(messages, maxTurns = 8) {
  // Keep the last N turns — pair them by role.
  const tail = messages.slice(-maxTurns * 2);
  return tail.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.content }));
}
