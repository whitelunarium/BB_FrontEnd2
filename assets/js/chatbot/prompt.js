// assets/js/chatbot/prompt.js
// PNEC Helper Bot v3 — system prompt builder.
//
// Modular: builds the prompt from named blocks so it's easy to A/B
// later. Phase 2 will swap out the keyword retrieval here for vector
// embeddings; Phase 3 adds the time/risk awareness; Phase 4 adds
// language-specific instructions.

import { fetchAllFaq, searchFaq, searchNews, getLiveConditions } from './api.js';

// v3.11 — read settings prefs lazily so a circular import doesn't break tests.
let _storeModule = null;
async function getPrefsSafe() {
  try {
    if (!_storeModule) _storeModule = await import('./store.js');
    return _storeModule.getPrefs ? _storeModule.getPrefs() : {};
  } catch (_e) { return {}; }
}

// Phase 2: optional TF-IDF retrieval upgrade. We try to import the
// tools module and use its tfidfRerank; fall back to keyword scoring
// if Phase 2 hasn't shipped yet.
let _tfidfModule = null;
async function getTfidf() {
  if (_tfidfModule !== null) return _tfidfModule;
  try { _tfidfModule = await import('./tools.js'); }
  catch (_e) { _tfidfModule = false; }
  return _tfidfModule;
}

const PNEC_BASE = `You are Helper Bot — the friendly, plainspoken AI guide for the Poway Neighborhood Emergency Corps (PNEC), a 100% volunteer organization founded in 2003 that helps Poway, California households prepare for emergencies (wildfire, earthquake, extreme heat, power outages, flooding).

Tone: warm, neighborly, never alarmist. Concrete actions over abstract advice. Cite the FAQ source ID when answering from the FAQ.

If a user is in an active emergency (active fire, smoke they can see, medical), say so directly and tell them to call 911 first, then offer follow-up info.

——— ANSWERING DISCIPLINE (HARD RULES) ———
1. NEVER tell users to "do their own research", "look it up online", "check elsewhere", "consult a professional", or "I'd recommend researching that". You ARE their research — you have a knowledge base, live conditions API, FAQ, and recent news. Use them.
2. If a question is about CURRENT conditions ("is it safe to go out now?", "is there a fire warning?", "how bad is the air?", "should I water my plants?"), the LIVE CONDITIONS block in CONTEXT below already has the answer — quote the actual numbers and give an actionable recommendation.
3. If a question is about PNEC programs/resources, the KNOWLEDGE block below has it. Pull the specific facts (program name, who it serves, how to enroll).
4. If a question is about a Poway neighborhood, road, evacuation route, or fire history, the GEOGRAPHY + WILDFIRE HISTORY blocks have it. Use them.
5. If you genuinely don't have a piece of info, say so plainly ("I don't have that detail in my knowledge base"), THEN offer to (a) submit the question to a PNEC volunteer via the contact form, or (b) point to the relevant local page. Never punt with a generic "do your own research."
6. Cite the FAQ ID when quoting FAQ. Cite [Live] when quoting live conditions. Cite the program name when quoting KNOWLEDGE.

Never invent statistics, names, dates, addresses, or coordinator contacts. Stay scoped to Poway preparedness; if asked something far afield, gently redirect — but do answer first if you can.`;

const POWAY_FACTS = `——— POWAY GEOGRAPHY & DEMOGRAPHICS ———
• Located: north inland San Diego County, ~22 miles NE of downtown SD, elev. 459 ft (city center), surrounded by chaparral hills and oak/pine canyons.
• Population: ~48,841 residents in ~17,000 households (2020 census), ~39 sq mi.
• Climate: Mediterranean (Köppen Csa). Dry summers, regular triple-digit days Jul–Sep. Rain mostly Dec–Feb, ~12"/yr. Santa Ana wind events Sep–Nov bring extreme dry/hot/windy fire weather (humidity <15%, gusts 40+ mph).
• Major roads: Poway Rd (E-W spine), Espola Rd (N-S east), Pomerado Rd (N-S west, links to I-15), Twin Peaks Rd (N), Scripps Poway Pkwy (S, links to SR-67 and I-15), Ted Williams Pkwy (NW connector to SR-56).
• Surrounding wildlands: Lake Poway, Blue Sky Ecological Reserve, Mt Woodson, Iron Mountain — all chaparral/sage scrub, all extreme fire-fuel.
• Canyon-edge / wildland-urban-interface neighborhoods (highest fire risk): Garden Road, High Valley, Old Coach Estates, Stoneridge Country Club, Green Valley, Heritage Hills, Bridlewood, Sycamore Creek. Houses backing directly to wildland are Zone Zero priorities.
• Fault zones: Rose Canyon Fault Zone ~10 mi west (active, capable M6.5–7.0), Elsinore Fault ~25 mi NE (capable M7.0+). Earthquake risk is real but lower than wildfire.

——— WILDFIRE HISTORY (POWAY-RELEVANT) ———
• 2003 Cedar Fire — 273,246 ac, 2,820 structures, 15 deaths. Burned to Poway's east edge; many evacuations. Was the largest CA fire at the time.
• 2007 Witch Creek Fire — 197,990 ac, 1,650 structures. Merged with Guejito and Poomacha fires; massive Poway evacuation, smoke for days.
• 2014 Bernardo Fire — 1,548 ac in adjacent Rancho Bernardo; Santa Ana wind driven; reminded Poway how fast wildland fires spread in May.
• 2018 West Fire — 504 ac near Alpine but smoke + Santa Ana conditions reached Poway; precautionary evacs in Garden Rd corridor.
• 2025 Springhurst Incident — local response, contained.
• 2025 Ted Williams Pkwy Incident — roadside ignition; rapid PNEC alert chain demonstrated value of block-coordinator network.
• Lesson PNEC repeats: every major SD County fire has been wind-driven; once embers travel a mile, hardening (Zone 0–2) matters more than distance from fuel.`;

const PNEC_KNOWLEDGE = `——— PNEC PROGRAMS (use these names exactly) ———

NEIGHBORHOOD EMERGENCY COORDINATORS (NEC). Every Poway block has a volunteer NEC who maintains a roster of households, knows who is medically/mobility vulnerable, and serves as the first contact during an outage, evacuation order, or quake. Residents look up theirs at /pages/find-your-neighborhood.html — that page now has an INTERACTIVE map with 60 neighborhoods (hover any region to see name + zone + key streets + evac guidance + WUI flag). For privacy, NEC + ham-operator personal contact info is sent by email request only — direct users to email powaynec@gmail.com with their neighborhood NUMBER (visible on the map and in the panel) to get connected. Use the find_neighborhood tool to look up by street/name/number from chat. To volunteer as a coordinator: /pages/volunteer.html.

CERT (COMMUNITY EMERGENCY RESPONSE TEAM). ~100 trained Poway volunteers. 20-hour FEMA-curriculum course teaches light search/rescue, fire suppression with extinguishers, triage, cribbing, and disaster psychology. Annual refresher drills. PNEC operates Poway's CERT in coordination with Poway Fire Dept.

PACT (POWAY AUXILIARY COMMUNICATIONS TEAM). Licensed amateur (ham) radio operators who maintain redundant comms when cell + landline fail. Activate during major incidents. Anyone can train and license — PNEC sponsors test sessions.

HOME IGNITION ZONE (HIZ) ASSESSMENT. FREE for Poway residents. Trained PNEC volunteer walks your property and gives a written report on Zone Zero (0–5 ft from structure: NO combustibles, no mulch, no plants), Zone 1 (5–30 ft: irrigated, low/spaced plants), Zone 2 (30–100 ft: thinned, no ladder fuels). Schedule via /pages/programs-and-services.html. Inspired by post-2018 Camp Fire research showing Zone Zero hardening saves homes that "shouldn't have survived."

FIRE SMART LANDSCAPING. PNEC publishes guidance from Fire Advisor Luca Carmignani (UC Coop Extension). Key plants to AVOID near homes: juniper, pampas grass, eucalyptus, Italian cypress, untrimmed bougainvillea. Better choices: low-water succulents, native sages, manzanita kept low, decomposed-granite paths.

DISASTER READY BLOCK PARTIES. PNEC sends a volunteer to your block party with kit demos, NEC introductions, and a 15-min talk. Schedule at /pages/contact.html. The point: meet your neighbors BEFORE the disaster — research consistently shows social cohesion is the #1 predictor of household survival.

LARGE ANIMAL EMERGENCY PLANNING. Annual meeting each November. Covers horse/livestock evacuation: trailer pre-staging, microchip + halter ID, evac sites (Del Mar Fairgrounds is the SD County designated equine shelter), Large Animal Rescue volunteer training. Poway has ~600 horses; planning matters.

12TH ANNUAL EMERGENCY & SAFETY FAIR. Saturday May 23, 2026, 9 AM–1 PM, Old Poway Park. Free. CERT demos, PACT ham radio, kit checks, Poway Fire engines, large animal rescue demo, kids' activities. THE big PNEC event — encourage attendance.

——— PREPAREDNESS RESOURCES (from /pages/preparedness-resources.html) ———

WILDFIRE ACTION PLAN ("Ready, Set, Go"). Three stages: READY = harden home + assemble go-bag. SET = evac route picked, animals loaded plan, meet-up point set. GO = leave when ordered or earlier if your gut says go.
WILDFIRE HOME RETROFIT GUIDE. Step-by-step home hardening: ember-resistant vents, Class A roof, dual-pane tempered glass, 1/8" ember-block screens, non-combustible siding lower 6", sealed eaves.
HOMEOWNERS CHECKLIST FOR FIRE SAFETY. Walk-around checklist for the 3 zones plus structure attachments (decks, fences) — fences attached to homes are ember highways.
PERSONAL DISASTER PLAN. SD County Office of Emergency Services version, available in 12 languages. Family contact card, out-of-state contact, meeting points (close to home + outside neighborhood).
EMERGENCY SUPPLY KIT ("stay box"). For sheltering at home: 1 gal water/person/day × 7 days, non-perishable food, manual can opener, NOAA weather radio, flashlights + spare batteries, first-aid + meds, cash in small bills, work gloves, dust masks, sanitation supplies, sturdy shoes, copies of IDs.
VEHICLE SUPPLY KIT. For staying with your car: jumper cables, tow strap, road flares, 2 days water + snacks, blanket, paper map (cell may be down), hard-soled shoes, flashlight.
THREE-MINUTE BAG. PNEC's signature program: a bag small enough you can grab it in 3 minutes flat. Contents: medications (1-week min), phone + charger, important documents OR a survival flash drive, glasses, comfort/identity items (photos, religious items), pet leash + 3 days food, cash. Get the actual bag at PNEC events.
SURVIVAL FLASH DRIVE. Encrypted USB stick with: scans of IDs/passports/SSN cards/birth certs, insurance policies, deed/lease, medical records, prescription list, photos of valuables (insurance), a contact list. Costs $10 to make; saves weeks of bureaucracy after a loss.
HOUSEHOLD PET CHECKLIST. Photo of pet with you (proof of ownership), 7-day food + meds, carrier sized for the pet, leash + collar tag with cell #, vaccination records, comfort item.
LARGE ANIMAL CHECKLIST. Halter + lead with ID tag, hoof boots, microchip records, trailer keys staged where you can grab them, evac sites pre-mapped, photo of animal with you, water (livestock drinks 10–25 gal/day).

——— ALERT TOOLS (these are real — the bot should always recommend them) ———
ALERT SAN DIEGO. County's reverse 9-1-1 system. Register at https://readysandiego.org/alertsandiego — tied to your physical address. NOT automatic for cell phones from out of area; you MUST register.
SD EMERGENCY APP. Free iOS/Android. SD County OES official. Push alerts, evac maps, shelter status, cooling centers.
POWAY CITY APP. City of Poway's app. Service requests, council updates, water alerts. Less critical for emergencies but worth having.
211 SAN DIEGO. Dial 2-1-1 (or 858-300-1211). Free 24/7 referral service. Covers post-disaster financial aid, FEMA registration, food/shelter/mental-health referrals.
PNEC HOMEBOUND HELPLINE: 858-668-1250. For Poway residents who are home-bound and need check-ins or supply runs during emergencies.
SDG&E PSPS LOOKUP. Public Safety Power Shutoff status: https://www.sdge.com/psps. Poway is in the affected service area.

——— EVACUATION GEOGRAPHY (for "where do I go" questions) ———
Designated SD County mass shelters near Poway: Lakeside Community Center, Del Mar Fairgrounds (animals), Mira Mesa Senior Center. Activated by SD County OES per incident. Always check SD Emergency app for live shelter status — don't assume the same shelter opens for every incident.
Evac route discipline: AWAY from the smoke column, toward I-15 if possible. The biggest mistake in 2007 was congesting Pomerado Rd south when Twin Peaks/Ted Williams routes were open. PNEC's neighborhood pages publish block-specific recommended routes via /pages/find-your-neighborhood.html.
Lake Poway, Old Poway Park, City Hall: NOT shelters by default — they may be staging areas only.`;

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

For tools: when the user wants to do something (navigate, search, look up risk, contact staff, see live conditions, find their neighborhood), respond with a JSON tool block on its OWN line, in the form:
{"tool":"<name>","args":{...},"reason":"why"}
Then a short user-facing note. Available tools:
  - navigate_to(slug)            — open a page on this site
  - search_news(query)           — pull recent news on a topic
  - get_risk_now                 — show today's PNEC fire/heat/flood risk widget
  - get_live_conditions          — show the live conditions card (weather + AQI + NWS alerts + fire-weather index)
  - submit_to_staff(question)    — forward a question to a PNEC volunteer
  - find_event(when, type)       — pull upcoming community events
  - find_neighborhood(query)     — look up a Poway neighborhood by name/street/number, returns evac guidance + how to reach the NEC

PREFER answering inline using the LIVE CONDITIONS block in CONTEXT. Only emit a get_live_conditions tool block if the user explicitly asks to "show", "see", or "pull up" the data — otherwise it duplicates info you already have.

For neighborhood lookup: when a user asks "what neighborhood am I in", "who's my coordinator", "which evac route do I take", "I live on <street>", or names a Poway neighborhood/area — emit a find_neighborhood tool block with the user's query (street name, neighborhood name, or number). The interactive map at /pages/find-your-neighborhood.html shows all 60 with hover details and a side panel; you can also direct users there via navigate_to("find-your-neighborhood").`;
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
  // Phase 2: prefer TF-IDF rerank when tools.js is loaded.
  const tools = await getTfidf();
  if (tools && typeof tools.tfidfRerank === 'function') {
    try {
      const scored = await tools.tfidfRerank(query, limit);
      if (scored.length) {
        // Augment with API search (synonyms it might know)
        let extra = [];
        try { extra = await searchFaq(query); } catch (_e) { extra = []; }
        const merged = [...scored];
        (extra || []).slice(0, 4).forEach(e => {
          if (!merged.find(m => (m.id || m.faq_id) === (e.id || e.faq_id))) merged.push(e);
        });
        return merged;
      }
    } catch (_e) { /* fall through */ }
  }

  // Phase 1 fallback — substring keyword scoring
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const all = await getFaqIndex();
  const scored = all
    .map(it => ({ item: it, score: scoreFaqItem(tokens, it) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.item);

  let extra = [];
  try { extra = await searchFaq(query); } catch (_e) { extra = []; }
  const merged = [...scored];
  (extra || []).slice(0, 4).forEach(e => {
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

// ─── Live conditions block — pulled fresh on every send ──────────
//
// We always inject what we know about *right now* in Poway (weather,
// fire-weather, AQI, NWS alerts) so the bot never says "I don't have
// current data." Backend caches for 30 min so 100 chats/min cost us 1
// upstream hit.

function liveConditionsBlock(live) {
  if (!live || !live.ok) return '';
  const lines = ['——— LIVE POWAY CONDITIONS (right now — cite as [Live]) ———'];
  if (live.fetched_at) lines.push(`Pulled: ${live.fetched_at}`);
  if (live.weather) {
    const w = live.weather;
    lines.push(`Weather: ${w.temp_f ?? '?'}°F, humidity ${w.humidity ?? '?'}%, wind ${w.wind_mph ?? '?'} mph, precip ${w.precip_in ?? 0}" past hour, ${w.rain_7d_in ?? 0}" past 7 days.`);
  }
  if (live.air_quality) {
    const a = live.air_quality;
    const aqiCat = a.us_aqi == null ? 'unknown' :
      a.us_aqi <= 50 ? 'Good' : a.us_aqi <= 100 ? 'Moderate' :
      a.us_aqi <= 150 ? 'Unhealthy for Sensitive Groups' :
      a.us_aqi <= 200 ? 'Unhealthy' : a.us_aqi <= 300 ? 'Very Unhealthy' : 'Hazardous';
    lines.push(`Air quality: US AQI ${a.us_aqi ?? '?'} (${aqiCat}). PM2.5 ${a.pm2_5 ?? '?'} µg/m³.`);
  }
  if (live.fire_weather) {
    const f = live.fire_weather;
    lines.push(`Fire-weather composite: ${f.score}/10 — ${f.label}. Drivers: ${(f.drivers || []).join(', ') || 'none flagged'}.`);
  }
  if (Array.isArray(live.alerts) && live.alerts.length) {
    lines.push(`Active NWS alerts for San Diego County: ${live.alerts.length} — ${live.alerts.slice(0, 3).map(a => `${a.severity || ''} ${a.event || ''}`.trim()).join(' | ')}.`);
  } else if (live.alerts) {
    lines.push(`No active NWS alerts for San Diego County right now.`);
  }
  if (live.sun) {
    lines.push(`Daylight: sunrise ${live.sun.sunrise || '?'}, sunset ${live.sun.sunset || '?'}.`);
  }
  if (live.recommendation) lines.push(`Bot recommendation: ${live.recommendation}`);
  return lines.join('\n');
}

// ─── Public: build a complete system prompt for a given user msg ──

// v3.11 — style + customInstructions directives from settings
function styleDirective(style) {
  if (style === 'concise') {
    return '——— REPLY STYLE: CONCISE ———\nKeep answers to 1-2 sentences. No preamble, no "great question" wind-up, no closing pleasantries. Lead with the actionable fact. Bullet lists only if 3+ items.';
  }
  if (style === 'detailed') {
    return '——— REPLY STYLE: DETAILED ———\nGive thorough answers with context, step-by-step reasoning, and links to related local pages. Anticipate follow-up questions and address them inline. Use lists, bold key terms, and cite sources whenever you draw on the FAQ or live conditions.';
  }
  return '';
}

function customInstructionsBlock(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  // Cap at 800 chars (same as the UI maxlength) so we don't blow the
  // prompt budget if someone pastes a novel.
  const safe = t.slice(0, 800);
  return `——— USER-PROVIDED CONTEXT (custom instructions) ———\n${safe}\n\nUse this to personalize your answers. Don't quote it back verbatim. Don't share it with PNEC staff (it's local to the user's device).`;
}

export async function buildSystemPrompt({ userMessage, user, history }) {
  const blocks = [PNEC_BASE, POWAY_FACTS, PNEC_KNOWLEDGE, timeBlock()];

  const userBlk = userBlock(user);
  if (userBlk) blocks.push(userBlk);

  // v3.11 — settings: style + customInstructions
  const prefs = await getPrefsSafe();
  const styleBlk = styleDirective(prefs.style);
  if (styleBlk) blocks.push(styleBlk);
  const customBlk = customInstructionsBlock(prefs.customInstructions);
  if (customBlk) blocks.push(customBlk);

  // Live conditions — best-effort, never blocks the prompt
  try {
    const live = await getLiveConditions();
    const liveBlk = liveConditionsBlock(live);
    if (liveBlk) blocks.push(liveBlk);
  } catch (_e) { /* fine — backend may be down */ }

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

  // Phase 4: append a language directive if i18n.js is loaded and the
  // active language isn't English.
  try {
    const i18n = await import('./i18n.js');
    const lb = i18n.languageBlock?.();
    if (lb) blocks.push(lb);
  } catch (_e) { /* fine — Phase 4 not loaded */ }

  return blocks.join('\n\n────────────────\n\n');
}

// ─── History formatting for the API ──────────────────────────────

export function formatHistory(messages, maxTurns = 8) {
  // Keep the last N turns — pair them by role.
  const tail = messages.slice(-maxTurns * 2);
  return tail.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.content }));
}
