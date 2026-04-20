// GameLevelPoway.js — Poway NEC Emergency Preparedness RPG Level
// Player explores a Poway neighborhood and talks to 4 emergency preparedness NPCs.
// NPC order: Ranger (intro) → Fire Chief → Flood Warden → Heat Advisor → Community Hub

import GamEnvBackground from '../../GameEnginev1.1/essentials/GameEnvBackground.js';
import Player from '../../GameEnginev1.1/essentials/Player.js';
import Npc from '../../GameEnginev1.1/essentials/Npc.js';

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
      interact: function() {
        if (this.dialogueSystem) this.showRandomDialogue();
      }
    };

    // ── NPC 2: Fire Chief ────────────────────────────────────────────────────────
    const sprite_data_firechief = {
      id: 'Fire Chief',
      greeting: "I'm the Poway Fire Chief. Fire is our biggest threat — especially in summer. Let me share what you need to know.",
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
      interact: function() {
        if (this.dialogueSystem) this.showRandomDialogue();
      }
    };

    // ── NPC 3: Flood Warden ──────────────────────────────────────────────────────
    const sprite_data_floodwarden = {
      id: 'Flood Warden',
      greeting: "Hey there! I'm the Flood Warden. Winter storms in Poway can cause flash flooding faster than you think.",
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
      interact: function() {
        if (this.dialogueSystem) this.showRandomDialogue();
      }
    };

    // ── NPC 4: Heat Advisor ──────────────────────────────────────────────────────
    const sprite_data_heatadvisor = {
      id: 'Heat Advisor',
      greeting: "I'm the Heat Advisor. Extreme heat kills more Americans each year than any other weather event.",
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
      interact: function() {
        if (this.dialogueSystem) this.showRandomDialogue();
      }
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
      interact: function() {
        if (this.dialogueSystem) this.showRandomDialogue();
      }
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
