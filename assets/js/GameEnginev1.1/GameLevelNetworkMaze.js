// GameLevelNetworkMaze.js
// OSI / TCP-IP Networking Maze — Educational game for Big Idea 4 (Networking)
//
// Maze layout (5 horizontal zones, one per TCP/IP layer):
//   Layer 1  Application   y 0.00–0.20   gap on RIGHT  →
//   Layer 2  Transport      y 0.20–0.40   gap on LEFT   ←
//   Layer 3  Network        y 0.40–0.60   gap on RIGHT  →
//   Layer 4  Data Link      y 0.60–0.80   gap on LEFT   ←
//   Layer 5  Physical       y 0.80–1.00   EXIT on RIGHT 🏁

import GamEnvBackground from './essentials/GameEnvBackground.js';
import Player from './essentials/Player.js';
import Npc from './essentials/Npc.js';
import AINpc from './essentials/AiNpc.js';
import Barrier from './essentials/Barrier.js';

class GameLevelNetworkMaze {
    constructor(gameEnv) {
        this.gameEnv = gameEnv;          // required for update()/HUD methods
        const width  = gameEnv.innerWidth;
        const height = gameEnv.innerHeight;
        const path   = gameEnv.path;

        // ── Background ──────────────────────────────────────────────────────
        const bgData = {
            name: 'network-maze-bg',
            src: path + '/images/gamify/space.png',
            pixels: { height: 857, width: 1200 }
        };

        // ── Player  ("Data Packet") ──────────────────────────────────────────
        const PSCALE = 5;
        const playerData = {
            id: 'DataPacket',
            greeting: 'I am a Data Packet! Use WASD to navigate the network stack.',
            src: path + '/images/gamify/chillguy.png',
            SCALE_FACTOR: PSCALE,
            STEP_FACTOR: 1000,
            ANIMATION_RATE: 50,
            INIT_POSITION: { x: width * 0.03, y: height * 0.03 },
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

        // ── NPC factory ─────────────────────────────────────────────────────
        // interact() is called with `.call(npcInstance)` so `this` = NPC object.
        // dialogues and id are captured by closure so they're always available.
        const mkNpc = (id, greeting, px, py, dialogues) => ({
            id,
            greeting,
            src: path + '/images/gamify/r2_idle.png',
            SCALE_FACTOR: 8,
            ANIMATION_RATE: 100,
            pixels: { width: 505, height: 223 },
            INIT_POSITION: { x: width * px, y: height * py },
            orientation: { rows: 1, columns: 3 },
            down: { row: 0, start: 0, columns: 3 },
            hitbox: { widthPercentage: 0.1, heightPercentage: 0.2 },
            dialogues,
            // ── called on first collision (shows greeting via showReactionDialogue)
            reaction: function() {
                // `this` here is objectOther (plain), not the NPC instance.
                // The engine's fallback in handleCollisionReaction already calls
                // showReactionDialogue() on the NPC instance, so nothing extra needed.
            },
            // ── called each time player presses E while touching this NPC
            interact: function() {
                if (!this.dialogueSystem) return;
                if (this._eduIdx === undefined) this._eduIdx = 0;
                const text = dialogues[this._eduIdx % dialogues.length];
                this._eduIdx++;
                this.dialogueSystem.showDialogue(text, id, this.spriteData?.src || null);
            }
        });

        // ── Layer 1  APPLICATION ─────────────────────────────────────────────
        // TCP/IP L5 = OSI L7 (Application) + L6 (Presentation) + L5 (Session)
        const npcApp = mkNpc(
            'AppLayerNPC',
            'Press E — Application Layer (TCP/IP L5 = OSI L7+L6+L5)',
            0.15, 0.09,
            [
                '📚 TCP/IP has 5 layers (standard). OSI has 7 layers (guideline/academic).',
                '🌐 TCP/IP Layer 5 = APPLICATION. It combines OSI layers 7, 6, and 5.',
                '🔷 OSI L7 Application: Protocols HTTP, HTTPS, DNS, FTP, SMTP.',
                '🔷 OSI L6 Presentation: Data encoding, encryption (TLS/SSL), compression.',
                '🔷 OSI L5 Session: Managing persistent connections, cookies, sessions.',
                '📌 OUR PROJECT: fetch("https://backend.opencodingsociety.com/api/users")',
                '📌 That fetch() is an HTTP GET request — born right here, Application Layer!',
                '🔑 DNS translates "backend.opencodingsociety.com" → AWS EC2 IP address.',
                '🔐 Certbot (Let\'s Encrypt) gives our backend HTTPS — handled at OSI L6!',
                '📋 HTTP verbs in our Flask/Spring API: GET=read POST=create PUT=update DELETE=remove'
            ]
        );

        // ── Layer 2  TRANSPORT ───────────────────────────────────────────────
        // TCP/IP L4 = OSI L4 (Transport) — MTU fragmentation happens here
        const npcTransport = mkNpc(
            'TransportLayerNPC',
            'Press E — Transport Layer (TCP/IP L4 = OSI L4)',
            0.65, 0.29,
            [
                '🚚 TCP/IP Layer 4 = TRANSPORT. Same as OSI Layer 4.',
                '🤝 TCP (Transmission Control Protocol): reliable, ordered delivery.',
                '3-Way Handshake: Browser → SYN → Server → SYN-ACK → Browser → ACK',
                '⚡ UDP (User Datagram Protocol): no handshake, fast but unreliable.',
                '📌 OUR PROJECT: fetch() over HTTPS uses TCP — reliability is required!',
                '🔌 Ports: HTTPS=443  HTTP=80  SSH=22  MySQL=3306  Flask dev=8085',
                '📌 Nginx on AWS EC2 listens on TCP port 443 for our HTTPS requests.',
                '⚠️  MTU ALERT: If an HTTP response body > 1460 bytes, TCP segments it!',
                '📦 TCP segment payload max = MTU(1500) - IP header(20) - TCP header(20) = 1460 bytes.',
                '📌 A large JSON response from our API gets split into multiple TCP segments here.'
            ]
        );

        // ── Layer 3  NETWORK ─────────────────────────────────────────────────
        // TCP/IP L3 = OSI L3 (Network) — IP addressing and routing
        const npcNetwork = mkNpc(
            'NetworkLayerNPC',
            'Press E — Network Layer (TCP/IP L3 = OSI L3)',
            0.15, 0.49,
            [
                '🗺️  TCP/IP Layer 3 = NETWORK. Same as OSI Layer 3.',
                '📍 Every packet gets: Source IP + Destination IP + TTL.',
                '📌 OUR PROJECT: Source = your laptop IP, Destination = AWS EC2 public IP.',
                '🔢 IPv4: 32-bit address written as 4 octets — e.g. 3.123.201.45 (AWS example).',
                '🔢 IPv6: 128-bit — e.g. 2600:1f18::/32 (AWS us-east-1 range).',
                '🔁 Routers read the Destination IP and forward the packet hop-by-hop.',
                'A request from San Diego to AWS us-west-2 crosses ~12–18 router hops.',
                '⏱️  TTL (Time To Live): starts at 64, decrements each hop. Prevents loops.',
                '📌 AWS Elastic IP keeps our EC2 instance reachable at a fixed public IP.',
                '📌 Inside AWS, the packet hits their internal router → reaches our EC2 instance.'
            ]
        );

        // ── Layer 4  DATA LINK ───────────────────────────────────────────────
        // TCP/IP L2 = OSI L2 (Data Link) — MAC addresses + MTU = 1500 bytes
        const npcDataLink = mkNpc(
            'DataLinkLayerNPC',
            'Press E — Data Link Layer + MTU (TCP/IP L2 = OSI L2)',
            0.65, 0.69,
            [
                '🔗 TCP/IP Layer 2 = DATA LINK. Same as OSI Layer 2.',
                '🪪  MAC Address: 48-bit hardware ID burned into your NIC.',
                'Format: A4:83:E7:2B:9C:01 — first 3 bytes = manufacturer OUI.',
                '📦 MTU = Maximum Transmission Unit. Ethernet II MTU = 1500 BYTES.',
                '📌 MTU FORMATION: IP packet → wrapped in Ethernet Frame → max payload 1500 B.',
                'Frame structure: [Dest MAC 6B][Src MAC 6B][EtherType 2B][Payload ≤1500B][FCS 4B]',
                '✂️  If IP packet > 1500 bytes → IP FRAGMENTATION into multiple frames!',
                '📌 OUR PROJECT: A JSON list of users > 1500 bytes gets fragmented here.',
                '🔍 ARP (Address Resolution Protocol): broadcasts "Who has IP x.x.x.x?" → gets MAC.',
                '📌 Inside AWS VPC, Docker containers use virtual MACs on a virtual L2 network.'
            ]
        );

        // ── Layer 5  PHYSICAL (AI NPC — ask it anything!) ───────────────────
        // TCP/IP L1 = OSI L1 (Physical) — bits on the wire
        const aiNpcData = new AINpc({
            id: 'PhysicalLayerOracle',
            greeting: 'Press E — Physical Layer Oracle (TCP/IP L1 = OSI L1). Ask me anything!',
            expertise: 'TCP/IP and OSI networking models',
            sprite: path + '/images/gamify/computer.png',
            spriteWidth: 521,
            spriteHeight: 479,
            scaleFactoR: 6,
            animationRate: 100,
            randomPosition: false,
            posX: width  * 0.15,
            posY: height * 0.88,
            gameEnv,
            orientation: { rows: 1, columns: 1 },
            down: { row: 0, start: 0, columns: 1 },
            hitbox: { widthPercentage: 0.1, heightPercentage: 0.1 },
            dialogues: [
                '⚡ TCP/IP Layer 1 = PHYSICAL. Same as OSI Layer 1.',
                'All data is ultimately 0s and 1s transmitted as electrical/optical/radio signals.',
                '🔌 Ethernet (Cat5e/Cat6): copper wire, electrical signal, up to 10 Gbps.',
                '💡 Fiber Optic: light pulses, used for AWS backbone — near speed of light!',
                '📶 Wi-Fi (802.11ac/ax): radio waves at 2.4 GHz or 5 GHz.',
                '📌 OUR PROJECT: Your laptop → Wi-Fi → ISP fiber → AWS backbone → EC2 NIC.',
                'Bandwidth = bits per second. Latency = round-trip time (RTT) in ms.',
                '🎉 You traversed all 5 TCP/IP layers! (= all 7 OSI layers)',
                'TCP/IP Standard: Physical · Data Link · Network · Transport · Application',
                'OSI Guideline:   Physical · Data Link · Network · Transport · Session · Presentation · Application',
                'Type a networking question below and I will answer it!'
            ],
            knowledgeBase: {
                'TCP/IP and OSI networking models': [
                    { question: 'What is the difference between TCP/IP and OSI?',
                      answer: 'TCP/IP is a 5-layer practical standard used in real networks. OSI is a 7-layer academic guideline. TCP/IP Application layer = OSI Application + Presentation + Session.' },
                    { question: 'What are the 5 TCP/IP layers?',
                      answer: '1-Physical, 2-Data Link, 3-Network, 4-Transport, 5-Application.' },
                    { question: 'What are the 7 OSI layers?',
                      answer: '1-Physical, 2-Data Link, 3-Network, 4-Transport, 5-Session, 6-Presentation, 7-Application.' },
                    { question: 'What is MTU and how does it affect our project?',
                      answer: 'MTU (Maximum Transmission Unit) = 1500 bytes for Ethernet. When our Flask/Spring API returns a large JSON response, it is fragmented into multiple 1500-byte frames at the Data Link layer.' },
                    { question: 'How does our fetch() call travel through the stack?',
                      answer: 'fetch() creates an HTTP request (Application L5), wrapped in TCP segment (Transport L4), wrapped in IP packet (Network L3), wrapped in Ethernet frame ≤1500B (Data Link L2), sent as electrical/optical signal (Physical L1) to AWS EC2.' },
                    { question: 'What does Nginx do in our project?',
                      answer: 'Nginx runs on AWS EC2, terminates TLS (OSI L6), listens on TCP port 443 (Transport L4), and reverse-proxies requests to our Docker containers running Flask or Spring.' },
                    { question: 'What is the TCP 3-way handshake?',
                      answer: 'SYN: client asks to connect. SYN-ACK: server agrees. ACK: client confirms. This happens before any HTTP data is sent.' },
                    { question: 'Why does OSI have 7 layers but TCP/IP only 5?',
                      answer: 'OSI was designed as a theoretical reference model. TCP/IP was designed for the ARPANET and pragmatically merged Session, Presentation, and Application into one layer since those boundaries rarely matter in practice.' }
                ]
            }
        }).getData();

        // ── Maze Barriers ────────────────────────────────────────────────────
        // Colors match layer labels
        const C = {
            app:  'rgba(0,255,136,0.75)',
            tran: 'rgba(0,204,255,0.75)',
            net:  'rgba(255,170,0,0.75)',
            dl:   'rgba(255,102,0,0.75)',
            phy:  'rgba(255,51,85,0.75)',
            wall: 'rgba(180,180,255,0.80)'
        };
        const HB = { widthPercentage: 0.0, heightPercentage: 0.0 };
        const barrier = (x, y, w, h, color) => ({
            x, y, width: w, height: h,
            color: color || C.wall,
            visible: true, zIndex: 11, hitbox: HB
        });

        // Outer boundary
        const bTop    = barrier(0.00, 0.000, 1.00, 0.012, C.wall);
        const bBottom = barrier(0.00, 0.988, 1.00, 0.012, C.wall);
        const bLeft   = barrier(0.00, 0.000, 0.012, 1.00, C.wall);
        const bRight  = barrier(0.988,0.000, 0.012, 1.00, C.wall);

        // Layer dividers — horizontal walls with directional gaps
        // Layer 1→2  gap on RIGHT  (x = 0.76 → 0.988)
        const div12 = barrier(0.00, 0.197, 0.76, 0.016, C.app);
        // Layer 2→3  gap on LEFT   (x = 0.012 → 0.24)
        const div23 = barrier(0.24, 0.397, 0.748, 0.016, C.tran);
        // Layer 3→4  gap on RIGHT  (x = 0.76 → 0.988)
        const div34 = barrier(0.00, 0.597, 0.76, 0.016, C.net);
        // Layer 4→5  gap on LEFT   (x = 0.012 → 0.24)
        const div45 = barrier(0.24, 0.797, 0.748, 0.016, C.dl);

        // Internal vertical obstacles — create a zigzag path
        // Layer 1: wall blocks center, player must detour below
        const iv1 = barrier(0.44, 0.012, 0.016, 0.130, C.app);
        // Layer 2: wall blocks center, player must detour above
        const iv2 = barrier(0.50, 0.213, 0.016, 0.130, C.tran);
        // Layer 3: wall blocks center
        const iv3 = barrier(0.44, 0.413, 0.016, 0.130, C.net);
        // Layer 4: wall blocks center
        const iv4 = barrier(0.50, 0.613, 0.016, 0.130, C.dl);

        // ── Assemble level ───────────────────────────────────────────────────
        this.classes = [
            { class: GamEnvBackground, data: bgData },
            // outer walls
            { class: Barrier, data: bTop    },
            { class: Barrier, data: bBottom },
            { class: Barrier, data: bLeft   },
            { class: Barrier, data: bRight  },
            // layer dividers
            { class: Barrier, data: div12 },
            { class: Barrier, data: div23 },
            { class: Barrier, data: div34 },
            { class: Barrier, data: div45 },
            // internal obstacles
            { class: Barrier, data: iv1 },
            { class: Barrier, data: iv2 },
            { class: Barrier, data: iv3 },
            { class: Barrier, data: iv4 },
            // NPCs
            { class: Npc, data: npcApp      },
            { class: Npc, data: npcTransport },
            { class: Npc, data: npcNetwork   },
            { class: Npc, data: npcDataLink  },
            { class: Npc, data: aiNpcData    },
            // Player last so it renders above everything
            { class: Player, data: playerData },
        ];

        this._winShown = false;
    }

    // Called once by GameLevel after all objects are created
    initialize() {
        this._winShown = false;
        this._addFullscreenButton();
    }

    _addFullscreenButton() {
        const container = this.gameEnv.canvas.parentElement;
        if (!container) return;

        const btn = document.createElement('button');
        btn.id = 'network-maze-fs-btn';
        btn.textContent = '⛶ Fullscreen';
        btn.style.cssText = [
            'position:absolute',
            'bottom:8px',
            'right:8px',
            'z-index:9999',
            'padding:6px 14px',
            'background:rgba(0,255,136,0.85)',
            'color:#000',
            'border:none',
            'border-radius:5px',
            'cursor:pointer',
            'font-weight:bold',
            'font-size:12px',
            'font-family:"Courier New",monospace',
            'letter-spacing:0.5px'
        ].join(';');

        const toggle = () => {
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(() => {});
                btn.textContent = '✕ Exit Fullscreen';
            } else {
                document.exitFullscreen();
                btn.textContent = '⛶ Fullscreen';
            }
        };

        btn.addEventListener('click', toggle);
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) btn.textContent = '⛶ Fullscreen';
        });

        // Keep position relative so the absolute button is anchored correctly
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }
        container.appendChild(btn);
        this._fsBtn = btn;
    }

    // Called every frame by GameLevel (after game objects have drawn)
    update() {
        this._drawHUD();
        if (!this._winShown) this._checkWin();
    }

    _drawHUD() {
        const ctx = this.gameEnv.ctx;
        const w   = this.gameEnv.innerWidth;
        const h   = this.gameEnv.innerHeight;

        // Layer labels
        const layers = [
            { label: 'APPLICATION  TCP/IP:L5  OSI:L7+L6+L5  HTTP·DNS·TLS  [fetch() lives here]', y: 0.100, color: '#00ff88' },
            { label: 'TRANSPORT    TCP/IP:L4  OSI:L4         TCP·UDP·Ports [SYN→SYN-ACK→ACK]',   y: 0.300, color: '#00ccff' },
            { label: 'NETWORK      TCP/IP:L3  OSI:L3         IP·Routing    [GitHub→routers→AWS]', y: 0.500, color: '#ffaa00' },
            { label: 'DATA LINK    TCP/IP:L2  OSI:L2         MAC·MTU=1500B [Ethernet Frame]',     y: 0.700, color: '#ff6600' },
            { label: 'PHYSICAL     TCP/IP:L1  OSI:L1         Bits·Signals  [WiFi→Fiber→EC2] 🏁',  y: 0.900, color: '#ff3355' }
        ];

        ctx.save();
        ctx.font = 'bold 11px "Courier New", monospace';
        layers.forEach(({ label, y, color }) => {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.fillText(label, w * 0.02, h * y);
        });

        // Instruction banner (top-right)
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(w * 0.62, h * 0.005, w * 0.365, h * 0.055);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "Courier New", monospace';
        ctx.fillText('WASD: move  |  bump NPC: greeting  |  E: next lesson', w * 0.63, h * 0.030);
        ctx.fillText('Goal: learn all 5 layers → reach 🏁 EXIT (Physical)', w * 0.63, h * 0.048);

        // Exit marker
        ctx.fillStyle = '#ffff00';
        ctx.globalAlpha = 1.0;
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.fillText('🏁 EXIT', w * 0.83, h * 0.930);

        ctx.restore();
    }

    _checkWin() {
        // Find the player object by its sprite id
        const player = this.gameEnv.gameObjects.find(
            obj => obj.spriteData && obj.spriteData.id === 'DataPacket'
        );
        if (!player) return;

        const w = this.gameEnv.innerWidth;
        const h = this.gameEnv.innerHeight;

        // Win zone: right side of the Physical Layer
        if (player.position.x > w * 0.78 && player.position.y > h * 0.82) {
            this._winShown = true;
            this._showVictory();
        }
    }

    _showVictory() {
        const ctx = this.gameEnv.ctx;
        const w   = this.gameEnv.innerWidth;
        const h   = this.gameEnv.innerHeight;

        ctx.save();

        // Dim overlay
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(w * 0.10, h * 0.28, w * 0.80, h * 0.44);

        // Border
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth   = 3;
        ctx.strokeRect(w * 0.10, h * 0.28, w * 0.80, h * 0.44);

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.fillText('🎉  PACKET DELIVERED!  🎉', w * 0.50, h * 0.36);

        // Body lines
        ctx.font = '12px "Courier New", monospace';
        const lines = [
            'Your fetch() packet traversed all 5 TCP/IP layers!',
            '',
            'TCP/IP (standard) →  Physical · Data Link · Network · Transport · Application',
            'OSI    (guideline) →  Physical · Data Link · Network · Transport · Session · Presentation · Application',
            '',
            'OUR PROJECT:  fetch() → HTTPS/TLS → TCP:443 → IP → MTU frames → AWS EC2 → Nginx → Docker',
            'MTU = 1500 bytes. Large API responses get fragmented into multiple Ethernet frames.',
            'Refresh the page or press ESC to play again!'
        ];
        const colors = ['#00ff88','','#00ccff','#ffaa00','','#ffffff','#aaddff','#aaaaaa'];
        lines.forEach((line, i) => {
            ctx.fillStyle = colors[i] || '#ffffff';
            ctx.fillText(line, w * 0.50, h * 0.43 + i * h * 0.038);
        });

        ctx.restore();
    }

    destroy() {
        if (this._fsBtn) this._fsBtn.remove();
    }
}

export default GameLevelNetworkMaze;
