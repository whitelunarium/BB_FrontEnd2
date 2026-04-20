// GameLevelPoway.js — Poway NEC Emergency Preparedness RPG Level
// Player explores a Poway neighborhood and talks to 4 emergency preparedness NPCs.
// NPC order: Ranger (intro) → Fire Chief → Flood Warden → Heat Advisor → Community Hub

import GamEnvBackground from '../../GameEnginev1.1/essentials/GameEnvBackground.js';
import Player from '../../GameEnginev1.1/essentials/Player.js';
import Npc from '../../GameEnginev1.1/essentials/Npc.js';

// ── Shared Gemini API base ──────────────────────────────────────────────────────
const GEMINI_API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8425'
  : 'https://beasts.opencodingsociety.com';

// ── Factory: returns an interact() that shows a dialogue + live Gemini chat ─────
function makeAiInteract(systemPrompt, greeting) {
  return function () {
    // `this` = the Npc instance (called via originalInteract.call(this) in Npc.js)
    const npcName   = this.spriteData?.id || 'NPC';
    const npcAvatar = this.spriteData?.src || null;

    if (!this.dialogueSystem) return;
    if (this.dialogueSystem.isDialogueOpen()) {
      this.dialogueSystem.closeDialogue();
      return;
    }

    this.dialogueSystem.showDialogue(greeting, npcName, npcAvatar);

    // Wait one tick so the dialogue DOM is rendered before we inject the chat UI.
    requestAnimationFrame(() => {
      const safeId = this.dialogueSystem.safeId || this.dialogueSystem.id;
      const box = document.getElementById('custom-dialogue-box-' + safeId);
      if (!box) return;

      // Don't inject twice if already present
      if (box.querySelector('.pnec-npc-chat')) return;

      const chatHistory = []; // local chat memory per conversation

      // ── Chat container ──────────────────────────────────────────────────
      const chat = document.createElement('div');
      chat.className = 'pnec-npc-chat';
      Object.assign(chat.style, {
        marginTop: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      });

      // Response display area
      const responseArea = document.createElement('div');
      Object.assign(responseArea.style, {
        minHeight: '36px',
        padding: '10px 12px',
        background: 'rgba(74, 134, 232, 0.12)',
        borderLeft: '3px solid #4a86e8',
        borderRadius: '6px',
        color: '#00ffff',
        fontSize: '11px',
        lineHeight: '1.7',
        textAlign: 'left',
        display: 'none',
        fontFamily: 'system-ui, sans-serif',
        whiteSpace: 'pre-wrap',
      });
      chat.appendChild(responseArea);

      // Input row
      const inputRow = document.createElement('div');
      Object.assign(inputRow.style, { display: 'flex', gap: '8px' });

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Ask me anything…';
      Object.assign(input.style, {
        flex: '1',
        padding: '8px 12px',
        background: '#0d1f35',
        border: '1px solid #4a86e8',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '12px',
        outline: 'none',
        fontFamily: 'system-ui, sans-serif',
      });

      const sendBtn = document.createElement('button');
      sendBtn.textContent = 'Ask';
      Object.assign(sendBtn.style, {
        padding: '8px 14px',
        background: '#4a86e8',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '700',
        whiteSpace: 'nowrap',
      });

      inputRow.appendChild(input);
      inputRow.appendChild(sendBtn);
      chat.appendChild(inputRow);

      // Typewriter helper
      function typewriter(text, el, speed = 18) {
        el.textContent = '';
        el.style.display = 'block';
        let i = 0;
        function step() {
          if (i < text.length) {
            el.textContent += text.charAt(i++);
            setTimeout(step, speed);
          }
        }
        step();
      }

      // Send question to Gemini
      async function sendMessage() {
        const question = input.value.trim();
        if (!question) return;
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = '…';

        chatHistory.push({ role: 'user', content: question });

        responseArea.textContent = '⏳ Thinking…';
        responseArea.style.display = 'block';

        try {
          const res = await fetch(`${GEMINI_API_BASE}/api/gemini`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: systemPrompt,
              text: question,
              history: chatHistory.slice(-6),
            }),
          });
          const data = await res.json();
          const answer = data?.text || "I'm not sure how to answer that right now.";
          chatHistory.push({ role: 'assistant', content: answer });
          typewriter(answer, responseArea);
        } catch {
          typewriter("I'm having trouble reaching my knowledge base right now.", responseArea);
        } finally {
          input.disabled = false;
          sendBtn.disabled = false;
          sendBtn.textContent = 'Ask';
          input.focus();
        }
      }

      sendBtn.onclick = sendMessage;
      input.addEventListener('keydown', (e) => {
        e.stopPropagation(); // don't let game capture key
        if (e.key === 'Enter') { e.preventDefault(); sendMessage(); }
      });

      // Insert chat before the close button if present
      const closeBtn = box.querySelector('button');
      if (closeBtn) box.insertBefore(chat, closeBtn);
      else box.appendChild(chat);

      // Focus input
      setTimeout(() => input.focus(), 50);
    });
  };
}

class GameLevelPoway {
  constructor(gameEnv) {
    const width  = gameEnv.innerWidth;
    const height = gameEnv.innerHeight;
    const path   = gameEnv.path;

    // ── Background ──────────────────────────────────────────────────────────────
    const image_src_poway = path + "/assets/images/Poway_Image.webp";
    const image_data_poway = {
      name: 'poway-neighborhood',
      greeting: "Welcome to Poway! Explore the neighborhood and talk to the emergency preparedness experts.",
      src: image_src_poway,
      pixels: { height: 580, width: 1038 }
    };

    // ── Player ───────────────────────────────────────────────────────────────────
    const sprite_src_player = path + "/images/gamify/chillguy.png";
    const sprite_data_player = {
      id: 'Resident',
      greeting: "Hi! I'm a Poway resident learning how to be prepared for emergencies.",
      src: sprite_src_player,
      SCALE_FACTOR: 5,
      STEP_FACTOR: 1000,
      ANIMATION_RATE: 50,
      INIT_POSITION: { x: 0.1, y: 0.8 },
      pixels: { height: 384, width: 512 },
      orientation: { rows: 3, columns: 4 },
      down:      { row: 0, start: 0, columns: 3 },
      downRight: { row: 1, start: 0, columns: 3, rotate:  Math.PI / 16 },
      downLeft:  { row: 2, start: 0, columns: 3, rotate: -Math.PI / 16 },
      left:      { row: 2, start: 0, columns: 3 },
      right:     { row: 1, start: 0, columns: 3 },
      up:        { row: 3, start: 0, columns: 3 },
      upLeft:    { row: 2, start: 0, columns: 3, rotate:  Math.PI / 16 },
      upRight:   { row: 1, start: 0, columns: 3, rotate: -Math.PI / 16 },
      hitbox: { widthPercentage: 0.45, heightPercentage: 0.2 },
      keypress: { up: 87, left: 65, down: 83, right: 68 }
    };

    // ── NPC 1: Park Ranger (intro) ───────────────────────────────────────────────
    const sprite_data_ranger = {
      id: 'Park Ranger',
      greeting: "Welcome to Poway! I'm the Park Ranger. This town faces real hazards — fire, floods, and extreme heat. Talk to the experts around town to build your emergency plan!",
      src: path + "/images/gamify/npc1.png",
      SCALE_FACTOR: 8,
      ANIMATION_RATE: 50,
      pixels: { height: 678, width: 342 },
      INIT_POSITION: { x: 0.25, y: 0.6 },
      orientation: { rows: 1, columns: 1 },
      down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: [
        "Poway is a beautiful community, but it sits in a fire-prone region of San Diego County.",
        "Did you know Poway has a Neighborhood Emergency Corps (NEC) with trained volunteers in every neighborhood?",
        "The first step in preparedness: know your neighborhood's risks. Head northeast to meet the Fire Chief!",
        "PNEC was founded in 1995. Neighbors helping neighbors since day one.",
        "Your neighborhood coordinator can connect you with local emergency resources. Have you registered?",
        "In an emergency, 72 hours of self-sufficiency is the goal. Do you have your kit ready?"
      ],
      reaction: function() {
        if (this.dialogueSystem) this.showReactionDialogue();
      },
      interact: makeAiInteract(
        `You are a friendly Park Ranger in the Poway neighborhood, California. You are part of PNEC (Poway Neighborhood Emergency Corps), a nonprofit focused on disaster preparedness.
Greet the player warmly and answer questions about Poway's emergency preparedness, local hazards (wildfire, flood, earthquake, heat), PNEC programs, and the game world.
You know all four other NPCs: the Fire Chief (fire safety expert), Flood Warden (flooding expert), Heat Advisor (heat safety expert), and PNEC Volunteer (community programs).
Keep answers concise (2-4 sentences). Stay in character as a knowledgeable, friendly Park Ranger.
Do not mention being an AI. If you don't know something specific, say so and refer them to the right NPC.`,
        "Welcome to Poway! I'm the Park Ranger. This town faces real hazards — fire, floods, and extreme heat. What would you like to know? 🌲"
      )
    };

    // ── NPC 2: Fire Chief ────────────────────────────────────────────────────────
    const sprite_data_firechief = {
      id: 'Fire Chief',
      greeting: "I'm the Poway Fire Chief. Fire is our biggest threat — especially in summer. Ask me anything about fire safety!",
      src: path + "/images/gamify/npc2.png",
      SCALE_FACTOR: 8,
      ANIMATION_RATE: 50,
      pixels: { height: 254, width: 261 },
      INIT_POSITION: { x: 0.55, y: 0.35 },
      orientation: { rows: 1, columns: 1 },
      down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: [
        "🔥 Fire Risk rises when temp > 90°F, humidity < 15%, and wind speeds exceed 25 mph. Check the Risk Watch on the homepage daily!",
        "Create a defensible space around your home: clear 100 feet of dry vegetation.",
        "Have an evacuation bag ready: water, medications, documents, phone charger, 3 days of food.",
        "Know your evacuation zone (A, B, or C) and TWO routes out of your neighborhood.",
        "Sign up for SD Emergency Alerts at sdeoc.com to get fire warnings on your phone.",
        "Never leave a fire unattended — Santa Ana winds can spread flames faster than you can run.",
        "Check in on elderly neighbors during fire conditions. They may need help evacuating."
      ],
      reaction: function() {
        if (this.dialogueSystem) this.showReactionDialogue();
      },
      interact: makeAiInteract(
        `You are the Poway Fire Chief, an expert in wildfire safety and home fire prevention for Poway, California.
You know: the 2007 Witch Creek Fire (7,247 acres, 90 homes destroyed in Poway), the 2003 Cedar Fire, the 2025 Springhurst Fire (~3-4 acres), the 2025 Ted Williams Fire (~3 acres).
You advise on: creating defensible space (100-foot clearance), evacuation bags (water, medications, documents, 3 days food), evacuation zones (A/B/C), how fire risk is scored (temperature, humidity, wind speed), signing up for SD Emergency Alerts at sdeoc.com, and Cal Fire fire hazard severity zones.
Keep answers concise (2-4 sentences). Stay in character as a serious but approachable Fire Chief.
Current date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`,
        "I'm the Poway Fire Chief. Fire is our biggest threat — especially during Santa Ana wind season. Ask me anything about fire safety, evacuation, or how to protect your home! 🔥"
      )
    };

    // ── NPC 3: Flood Warden ──────────────────────────────────────────────────────
    const sprite_data_floodwarden = {
      id: 'Flood Warden',
      greeting: "Hey there! I'm the Flood Warden. Winter storms in Poway can cause flash flooding faster than you think. Got questions?",
      src: path + "/images/gamify/npc3.png",
      SCALE_FACTOR: 8,
      ANIMATION_RATE: 50,
      pixels: { height: 378, width: 149 },
      INIT_POSITION: { x: 0.75, y: 0.6 },
      orientation: { rows: 1, columns: 1 },
      down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: [
        "🌊 Flood Risk spikes when rainfall exceeds 1 inch/hour or 2 inches in 48 hours. Watch the Risk Watch widget!",
        "Never drive through flooded roads. 'Turn Around, Don't Drown' — 6 inches of water can knock you over.",
        "Keep sandbags handy if you live near a drainage channel or low-lying area.",
        "Know your flood zone: check FEMA's Flood Map at msc.fema.gov to see your property's risk.",
        "After a flood, don't enter floodwaters — they may contain sewage, chemicals, or live electrical wires.",
        "Poway Creek can rise 10 feet in under an hour during heavy rain. Know the difference between a Watch and a Warning.",
        "Document your valuables with photos for insurance purposes. Store documents in a waterproof container."
      ],
      reaction: function() {
        if (this.dialogueSystem) this.showReactionDialogue();
      },
      interact: makeAiInteract(
        `You are the Poway Flood Warden, an expert in flood safety and storm preparedness for Poway, California.
You advise on: flash flood warnings (flood risk rises when rainfall exceeds 1 inch/hour or 2 inches in 48 hours), "Turn Around, Don't Drown" — 6 inches of water can knock a person down, sandbags and drainage channels, FEMA Flood Map at msc.fema.gov, flood zone designations (Zone X is most of Poway), Poway Creek flash flood risk, post-flood safety (sewage, chemicals, live wires), and waterproofing documents.
Keep answers concise (2-4 sentences). Stay in character as a practical, safety-focused Flood Warden.`,
        "Hey there! I'm the Flood Warden. Winter storms in Poway can cause flash flooding faster than you think. Ask me anything about flood safety or how to prepare! 🌊"
      )
    };

    // ── NPC 4: Heat Advisor ──────────────────────────────────────────────────────
    const sprite_data_heatadvisor = {
      id: 'Heat Advisor',
      greeting: "I'm the Heat Advisor. Extreme heat kills more Americans each year than any other weather event. What would you like to know?",
      src: path + "/images/gamify/npc4.png",
      SCALE_FACTOR: 8,
      ANIMATION_RATE: 50,
      pixels: { height: 222, width: 147 },
      INIT_POSITION: { x: 0.4, y: 0.7 },
      orientation: { rows: 1, columns: 1 },
      down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: [
        "🌡️ Extreme Heat Risk is high when temp > 100°F or heat index > 103°F. Check the Risk Watch before heading outside!",
        "Drink water every 15-20 minutes during outdoor activity — don't wait until you're thirsty.",
        "Check on elderly neighbors, young children, and pets during heat waves. They are most vulnerable.",
        "Poway's cooling centers open when the heat index exceeds 95°F. Know your nearest one at poway.org.",
        "Shade and timing matter: avoid outdoor exertion between 10am-4pm on extreme heat days.",
        "Heat stroke is a medical emergency: call 911 if someone is confused, has hot/dry skin, or stops sweating.",
        "Cars heat up to 160°F inside on a 100°F day. Never leave children or pets in a parked car."
      ],
      reaction: function() {
        if (this.dialogueSystem) this.showReactionDialogue();
      },
      interact: makeAiInteract(
        `You are the Poway Heat Advisor, an expert in extreme heat safety for Poway, California.
You advise on: heat risk thresholds (temp > 100°F or heat index > 103°F), hydration (drink water every 15-20 minutes), the most vulnerable populations (elderly, young children, pets), Poway cooling centers (open when heat index > 95°F at poway.org), avoiding outdoor exertion between 10am-4pm, heat stroke signs (confusion, hot/dry skin, stops sweating — call 911), and never leaving children or pets in cars (cars reach 160°F on a 100°F day).
Keep answers concise (2-4 sentences). Stay in character as a caring, evidence-based Heat Advisor.`,
        "I'm the Heat Advisor. Extreme heat kills more Americans each year than any other weather event. Ask me anything about staying safe in the heat! 🌡️"
      )
    };

    // ── NPC 5: Community Hub (PNEC volunteer) ────────────────────────────────────
    const sprite_data_community = {
      id: 'PNEC Volunteer',
      greeting: "Welcome to the PNEC Community Hub! I'm a neighborhood volunteer. Ready to get involved?",
      src: path + "/images/gamify/npc5.png",
      SCALE_FACTOR: 8,
      ANIMATION_RATE: 50,
      pixels: { height: 632, width: 395 },
      INIT_POSITION: { x: 0.85, y: 0.2 },
      orientation: { rows: 1, columns: 1 },
      down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: [
        "PNEC has over 300 trained volunteers across Poway's neighborhoods. Join us at powaynec.com!",
        "The 3 pillars of PNEC: Preparedness, Response, and Recovery. We train for all three.",
        "Attend a free CERT (Community Emergency Response Team) training to learn first aid and triage.",
        "Your PNEC neighborhood coordinator is your first call when disaster strikes — before 911.",
        "🧭 Not sure where you fit in PNEC? Take our role quiz at /role-quiz/ — discover if you're a Fire Specialist, Flood Coordinator, or Community Organizer!",
        "Share what you've learned today with two neighbors. Preparedness is contagious!",
        "Visit our leaderboard to see how your neighborhood ranks on preparedness. Top neighborhoods get recognition!"
      ],
      reaction: function() {
        if (this.dialogueSystem) this.showReactionDialogue();
      },
      interact: makeAiInteract(
        `You are a PNEC Community Hub Volunteer for Poway Neighborhood Emergency Corps (PNEC).
You know: PNEC is a 501(c)(3) nonprofit founded in 1995, achieved nonprofit status in 2018, has 500+ trained volunteers across 60+ Poway neighborhoods, is all-volunteer.
You advise on: CERT (Community Emergency Response Team) training (free, teaches first aid/triage), the PACT ham radio team for backup communications, PNEC's 3 pillars (Preparedness, Response, Recovery), role quiz at /role-quiz/ to find your specialty, how to find your neighborhood coordinator, volunteering opportunities, and connecting with the website's tools (risk widget, chatbot, games, leaderboard).
Keep answers concise (2-4 sentences). Be enthusiastic and community-focused. Stay in character as a dedicated PNEC volunteer.`,
        "Welcome to the PNEC Community Hub! I'm a neighborhood volunteer here to connect you with preparedness programs, volunteer opportunities, and community resources. Ask me anything! 🤝"
      )
    };

    // ── Classes array (order = render order) ─────────────────────────────────────
    this.classes = [
      { class: GamEnvBackground, data: image_data_poway },
      { class: Player,           data: sprite_data_player },
      { class: Npc,              data: sprite_data_ranger },
      { class: Npc,              data: sprite_data_firechief },
      { class: Npc,              data: sprite_data_floodwarden },
      { class: Npc,              data: sprite_data_heatadvisor },
      { class: Npc,              data: sprite_data_community },
    ];
  }
}

export default GameLevelPoway;
