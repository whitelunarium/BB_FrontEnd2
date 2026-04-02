// game-data/npcs.js
// Responsibility: Define all NPCs, their positions, and dialogue trees.
// WORKER — pure data definitions only.

const NPC_DEFS = [
  {
    id: 'terri',
    name: 'Terri (PNEC Coordinator)',
    color: '#8e44ad',
    col: 35, row: 3,
    dialogue: {
      1: {
        prepare: [
          "Welcome! I'm Terri from the PNEC.",
          "Before disaster strikes, grab your Go-Bag, water supply, and important documents.",
          "Your Go-Bag should always be by the front door — ready to grab in 90 seconds."
        ],
        disaster: [
          "Evacuation order is in effect for Zone B!",
          "Take Oak Street — avoid the hills. The fire is moving east.",
          "Get to Town Square — it's our designated safe zone."
        ],
        post: ["You made it! You followed the plan and got out safely. Great job!"]
      },
      2: {
        prepare: [
          "Earthquake season is here. Is your kit ready?",
          "Remember: Drop, Cover, Hold On. Get under a sturdy table.",
          "Know where your gas shutoff valve is — a wrench taped to it helps."
        ],
        disaster: [
          "Magnitude 6.4 — Drop, Cover, Hold On!",
          "There's a gas leak near your house. Shut it off at the valve!",
          "Make your way to the Community Center when it's safe."
        ],
        post: ["Excellent work navigating the aftermath. Gas shutoff was critical!"]
      },
      3: {
        prepare: [
          "Flash floods can happen in minutes here in Poway.",
          "Stay away from the creek if rain is forecast.",
          "High ground is your friend — the fire station hill is our muster point.",
          { text: "Do you want the life vest?", choices: ["Yes please", "I'll be fine"] }
        ],
        disaster: [
          "Flash flood warning! Water is rising from the south.",
          "Do NOT try to walk through moving water — even 6 inches can knock you down.",
          "Get to high ground — fire station hill — NOW!"
        ],
        post: ["You reached high ground and helped Margaret. True community spirit!"]
      }
    }
  },
  {
    id: 'chief',
    name: 'Fire Chief Rodriguez',
    color: '#c0392b',
    col: 34, row: 14,
    dialogue: {
      1: {
        prepare: [
          "Chief Rodriguez here. Wildfire risk is HIGH today.",
          "Zone B evacuation route: take Oak Street north, then west on Main.",
          "Avoid the hills — that's where the fire spreads fastest."
        ],
        disaster: [
          "The fire jumped the line! Zone B is mandatory evacuation.",
          "Do NOT go through the hills — take Oak Street only.",
          "Town Square is the staging area. Go!"
        ],
        post: ["Good call taking Oak Street. That route stayed clear."]
      },
      2: {
        prepare: [
          "Earthquake kit check: first aid, flashlight, emergency radio.",
          "Your gas shutoff valve is on the west side of the house.",
          "A pipe wrench taped to the valve will help you shut it fast."
        ],
        disaster: [
          "6.4 magnitude — structural damage expected.",
          "Gas leaks are the biggest secondary hazard. Shut yours off!",
          "Community Center is reinforced — safest place to shelter."
        ],
        post: ["You handled the gas shutoff correctly. That prevents fires and explosions."]
      },
      3: {
        prepare: [
          "Poway creek floods fast when it rains upstream.",
          "We've pre-positioned sandbags at the station — grab some.",
          "Fire station hill is your high ground evacuation point."
        ],
        disaster: [
          "Flash flood confirmed. Creek is over its banks.",
          "All units at the hill. Get here ASAP.",
          "Do NOT drive through water — turn around, don't drown."
        ],
        post: ["Hill is secure. You made the right call on the route timing."]
      }
    }
  },
  {
    id: 'margaret',
    name: 'Margaret (Neighbor)',
    color: '#e67e22',
    col: 19, row: 24,
    dialogue: {
      1: {
        prepare: [
          "Oh hello dear! My son says there might be a fire warning.",
          "I have trouble moving quickly — I worry about evacuating.",
          { text: "Can I count on you to help if needed?", choices: ["Of course!", "I'll try my best"] }
        ],
        disaster: [
          "The alarm went off! I can't find my cane!",
          { text: "Will you help me to Town Square?", choices: ["Yes, let's go!", "I'll come back for you"] }
        ],
        post: ["Thank you so much. I wouldn't have made it without you."]
      },
      2: {
        prepare: ["I felt a small tremor this morning. Should I be worried?", "I keep my documents in the kitchen drawer."],
        disaster: ["That was terrible! Is it over? I'm trapped behind some rubble!"],
        post:    ["You cleared the way for me. God bless you."]
      },
      3: {
        prepare: ["The creek looks high today. I do love the sound of rain though.", "My house is close to the water — I worry sometimes."],
        disaster: ["The water is coming! I can't make it uphill on my own!"],
        post:    ["You saved my life today. Thank you from the bottom of my heart."]
      }
    }
  },
  {
    id: 'clerk',
    name: 'Store Clerk',
    color: '#27ae60',
    col: 5, row: 13,
    dialogue: {
      1: {
        prepare: [
          "Hey! Stocking up for emergencies?",
          "FEMA recommends at least 72 hours of water — 1 gallon per person per day.",
          "Grab the water on aisle 2 and the documents folder on the counter."
        ],
        disaster: ["Store is closed — evacuation order! Please leave!"],
        post:    ["Glad you grabbed the water. Come back when things calm down."]
      },
      2: {
        prepare: [
          "Earthquake kit essentials: first aid, non-perishable food, flashlight.",
          "I keep a radio under the counter — great for emergencies.",
          "Non-perishable food lasts years — stock up while you can."
        ],
        disaster: ["Major damage to the store — please don't come in, it's not safe!"],
        post:    ["Thanks for your patience. We'll reopen as soon as we can."]
      },
      3: {
        prepare: [
          "Waterproof bags are in aisle 3 — great for protecting documents.",
          "Sandbags work best with the right technique — pack them tight.",
          "We got a shipment of emergency supplies — check the back."
        ],
        disaster: ["Flooding in the parking lot! We're closed — head for high ground!"],
        post:    ["Great thinking grabbing the waterproof bag. Saved your documents!"]
      }
    }
  },
  {
    id: 'ham_operator',
    name: 'Ham Radio Op (Dave)',
    color: '#2c3e50',
    col: 16, row: 11,
    dialogue: {
      1: { prepare: [], disaster: [], post: [] }, // Not present in act 1
      2: {
        prepare: [
          "Dave here — ham radio operator. I monitor emergency frequencies.",
          "In a grid-down situation, ham radio is how we coordinate.",
          "The PNEC has repeaters on Rattlesnake Mountain — good coverage."
        ],
        disaster: [
          "Magnitude 6.4 confirmed. Hospital is on backup power.",
          "Main roads: Oak St is clear, Highway 78 has bridge damage.",
          "Check in at Community Center — they need headcount."
        ],
        post: ["Good intel from the field helped everyone. Stay radio-ready!"]
      },
      3: {
        prepare: [
          "Listening on 146.52 — national simplex calling frequency.",
          "Flash flood watch is up. Creek gauges are rising fast.",
          "I'll relay status updates from the EOC. Stay tuned."
        ],
        disaster: [
          "EOC reports: creek at 8.4 feet — flood stage is 6 feet.",
          "North routes to fire station are still open — use them now.",
          "South route will be cut off in about 60 seconds."
        ],
        post: ["Good coordination out there. Radio comms made the difference."]
      }
    }
  }
];

// Build live NPC list for a given act (filter to NPCs present in that act)
function buildActNPCs(act) {
  return NPC_DEFS
    .filter(def => {
      // ham_operator not present in act 1
      if (def.id === 'ham_operator' && act === 1) return false;
      return true;
    })
    .map(def => ({
      ...def,
      x: def.col * TILE_SIZE + TILE_SIZE / 2,
      y: def.row * TILE_SIZE + TILE_SIZE / 2,
      dialoguePhase: 'prepare',
      dialogueIndex: 0,
      talking: false
    }));
}
