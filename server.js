/**
 * ==============================================================================
 * TungTung Restaurant - Real-Time Multiplayer Educational Cooking & Grammar Game
 * Backend Server with Express + Socket.io
 * ==============================================================================
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);

// Enable CORS and JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json());

// Socket.io Real-time server configuration
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_URL = process.env.PUBLIC_URL || null;

// Global Rooms State Registry
// rooms[pin] = { pin, hostSocketId, stage, players: {}, dishes: [], createdAt }
const rooms = {};

// 4 Balanced Random Teams
const TEAMS = [
    { id: 'team-alpha', name: 'Team Alpha', color: '#EF4444', icon: '🔥' },
    { id: 'team-bravo', name: 'Team Bravo', color: '#3B82F6', icon: '⚡' },
    { id: 'team-charlie', name: 'Team Charlie', color: '#10B981', icon: '🌿' },
    { id: 'team-delta', name: 'Team Delta', color: '#F59E0B', icon: '👑' }
];

/**
 * Generate a unique 6-digit numeric PIN (100000 - 999999)
 */
function generatePin() {
    let pin;
    let attempts = 0;
    do {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
        attempts++;
    } while (rooms[pin] && attempts < 1000);
    return pin;
}

/**
 * Automatically assign player to a balanced random team
 */
function autoAssignTeam(room) {
    const counts = { 'team-alpha': 0, 'team-bravo': 0, 'team-charlie': 0, 'team-delta': 0 };
    if (room && room.players) {
        Object.values(room.players).forEach(p => {
            if (counts[p.teamId] !== undefined) counts[p.teamId]++;
        });
    }

    let minCount = Infinity;
    TEAMS.forEach(t => {
        if (counts[t.id] < minCount) minCount = counts[t.id];
    });

    const candidateTeams = TEAMS.filter(t => counts[t.id] === minCount);
    const chosen = candidateTeams[Math.floor(Math.random() * candidateTeams.length)];
    return chosen || TEAMS[0];
}

/**
 * Sanitize and aggregate room state for real-time broadcasting
 */
function sanitizeRoom(pin) {
    const room = rooms[pin];
    if (!room) return null;

    const playerList = Object.values(room.players || {});
    
    // Calculate team scores and member counts
    const teams = TEAMS.map(t => {
        const members = playerList.filter(p => p.teamId === t.id);
        const score = members.reduce((sum, p) => sum + (p.score || 0), 0);
        return {
            ...t,
            score,
            playerCount: members.length
        };
    });

    // Calculate classroom progress percentage
    let overallProgress = 5;
    if (room.stage === 'SHOPPING') overallProgress = 30;
    else if (room.stage === 'COOKING') overallProgress = 60;
    else if (room.stage === 'PLATING') overallProgress = 85;
    else if (room.stage === 'SHOWCASE' || room.stage === 'PODIUM') overallProgress = 100;

    return {
        pin: room.pin,
        code: room.pin,
        stage: room.stage || 'LOBBY',
        hostConnected: !!room.hostSocketId,
        totalPlayers: playerList.length,
        players: playerList,
        teams,
        dishes: room.dishes || [],
        overallProgress
    };
}

// ══════════════════════════════════════════════════════════════
// Dual-Route Architecture
// ── ROOT (/)       → Host / Teacher Dashboard (main domain)
// ── /join          → Player / Student Mobile-Friendly Entry
// ══════════════════════════════════════════════════════════════

// HOST routes (primary domain root)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'host.html'));
});
app.get('/host', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'host.html'));
});
app.get('/host.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'host.html'));
});

// PLAYER routes (mobile-friendly student entry)
app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player.html'));
});
app.get('/join/:pin', (req, res) => {
    // Deep-link: /join/1234 → player.html?pin=1234
    res.redirect(`/player.html?pin=${encodeURIComponent(req.params.pin)}`);
});
app.get('/player', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player.html'));
});
app.get('/player.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player.html'));
});
app.get('/play', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));

// REST Health Check & Server Info
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        project: 'TungTung Restaurant',
        timestamp: new Date().toISOString(),
        activeRooms: Object.keys(rooms).length
    });
});

app.get('/api/server-info', (req, res) => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    const primaryIp = addresses[0] || '127.0.0.1';
    const networkUrl = `http://${primaryIp}:${PORT}`;
    const publicUrl = PUBLIC_URL || networkUrl;

    res.json({
        port: PORT,
        primaryIp,
        networkUrl,
        publicUrl,
        isCloud: !!PUBLIC_URL,
        addresses
    });
});

app.get('/api/room/:pin', (req, res) => {
    const pin = (req.params.pin || '').trim();
    const room = rooms[pin];
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(sanitizeRoom(pin));
});

// Server-Side QR Code Generation API
// Returns a QR code as a data URL for the host dashboard
const QRCode = require('qrcode');
app.get('/api/qrcode/:pin', async (req, res) => {
    const pin = (req.params.pin || '').trim();
    const baseUrl = PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const joinUrl = `${baseUrl}/join?pin=${pin}`;
    try {
        const qrDataUrl = await QRCode.toDataURL(joinUrl, {
            width: 320,
            margin: 2,
            color: { dark: '#0F172A', light: '#FFFFFF' },
            errorCorrectionLevel: 'M'
        });
        res.json({ qrDataUrl, joinUrl, pin });
    } catch (err) {
        res.status(500).json({ error: 'QR generation failed', message: err.message });
    }
});

// ==============================================================================
// Socket.io Real-Time Event Handlers
// ==============================================================================
io.on('connection', (socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    // 1. Host creates room
    const handleCreateRoom = (data, callback) => {
        let pin = (data && (data.pin || data.customCode || data.roomCode)) 
            ? (data.pin || data.customCode || data.roomCode).toString().trim() 
            : generatePin();
        if (!pin || pin.length !== 4) pin = generatePin();

        rooms[pin] = {
            pin,
            code: pin,
            hostId: socket.id,
            hostSocketId: socket.id,
            stage: 'LOBBY',
            createdAt: Date.now(),
            players: {},
            dishes: []
        };

        socket.join(pin);
        socket.roomPin = pin;
        socket.isHost = true;

        console.log(`[Host] Created room ${pin} (Host Socket: ${socket.id})`);

        const sanitized = sanitizeRoom(pin);
        
        socket.emit('room_created', { pin, room: sanitized });
        socket.emit('show_pin', { pin });
        io.to(pin).emit('update_host_lobby', Object.values(rooms[pin].players));
        io.to(pin).emit('player_list_updated', { pin, players: [], totalPlayers: 0 });
        io.to(pin).emit('room_state_updated', sanitized);
        io.to(pin).emit('host_dashboard_update', sanitized);

        if (typeof callback === 'function') {
            callback({ success: true, pin, roomCode: pin, room: sanitized });
        }
    };

    socket.on('create_room', handleCreateRoom);
    socket.on('host_create_room', handleCreateRoom);

    // 2. Player joins room with 4-digit PIN
    const handlePlayerJoin = (data, callback) => {
        const pin = (data.pin || data.roomCode || '').toString().trim();
        const playerName = (data.name || data.teamName || data.playerName || 'Chef Panda').trim();
        const avatar = data.avatar || 'panda';

        console.log(`[Join Attempt] Player: "${playerName}", PIN: "${pin}"`);

        if (!pin || !rooms[pin]) {
            console.log(`[Join Failed] Room "${pin}" does not exist`);
            const errMsg = `Invalid Room PIN "${pin}"! Please check the Host screen.`;
            socket.emit('join_error', errMsg);
            socket.emit('join_failed', { success: false, message: errMsg });
            if (typeof callback === 'function') {
                callback({ success: false, message: errMsg });
            }
            return;
        }

        const room = rooms[pin];
        const assignedTeam = autoAssignTeam(room);

        const player = {
            id: socket.id,
            socketId: socket.id,
            name: playerName,
            team: assignedTeam.name,
            teamName: assignedTeam.name,
            teamId: assignedTeam.id,
            teamColor: assignedTeam.color,
            avatar,
            score: 0,
            progress: 0,
            stage: room.stage || 'Lobby',
            currentStage: room.stage || 'Lobby',
            status: 'In Lobby',
            budgetRemaining: 150,
            budgetSpent: 0,
            cart: [],
            cartCount: 0,
            scoreBreakdown: { shopping: 0, quiz: 0, cooking: 0, plating: 0 }
        };

        room.players[socket.id] = player;
        socket.join(pin);
        socket.roomPin = pin;
        socket.isHost = false;

        console.log(`[Player Joined] ${player.name} -> Room ${pin} (${player.team})`);

        const sanitized = sanitizeRoom(pin);
        const playerList = Object.values(room.players);

        // Immediate confirmation to the joining player
        socket.emit('join_success', {
            success: true,
            pin,
            roomCode: pin,
            player,
            room: sanitized
        });

        if (typeof callback === 'function') {
            callback({
                success: true,
                pin,
                roomCode: pin,
                player,
                room: sanitized
            });
        }

        // CRITICAL: IMMEDIATELY broadcast update_host_lobby with player array to ALL sockets in room pin
        io.in(pin).emit('update_host_lobby', Object.values(rooms[pin].players));
        io.in(pin).emit('player_list_updated', {
            pin,
            players: playerList,
            totalPlayers: playerList.length,
            newPlayer: player
        });
        io.in(pin).emit('player_joined', { player, totalPlayers: playerList.length });
        io.in(pin).emit('host_dashboard_update', sanitized);
        io.in(pin).emit('room_state_updated', sanitized);
    };

    socket.on('join_room', handlePlayerJoin);
    socket.on('player_join_room', handlePlayerJoin);
    socket.on('player_join', handlePlayerJoin);

    // 3. Host starts game
    const handleHostStartGame = (data) => {
        const pin = (data && data.pin) || socket.roomPin;
        if (!pin || !rooms[pin]) return;
        const room = rooms[pin];
        const nextStage = (data && data.stage) || 'SHOPPING';
        room.stage = nextStage;

        Object.values(room.players).forEach(p => {
            p.stage = nextStage;
            p.currentStage = nextStage;
            p.status = nextStage === 'SHOPPING' ? 'Shopping at Supermarket' : nextStage;
        });

        console.log(`[Host Start Game] Room ${pin} -> Stage: ${nextStage}`);

        const sanitized = sanitizeRoom(pin);

        io.to(pin).emit('game_started', { pin, stage: nextStage });
        io.to(pin).emit('stage_changed', { stage: nextStage, duration: data?.duration || 180 });
        io.to(pin).emit('host_dashboard_update', sanitized);
        io.to(pin).emit('room_state_updated', sanitized);
    };

    socket.on('host_start_game', handleHostStartGame);
    socket.on('start_game', handleHostStartGame);
    socket.on('host_set_stage', handleHostStartGame);

    // 4. Player updates state & progress in real time
    const handlePlayerUpdateState = (data) => {
        const pin = data.pin || socket.roomPin;
        if (!pin || !rooms[pin]) return;
        const room = rooms[pin];
        const player = room.players[socket.id];
        if (!player) return;

        if (data.score !== undefined) player.score = data.score;
        if (data.progress !== undefined) player.progress = data.progress;
        if (data.stage) { player.stage = data.stage; player.currentStage = data.stage; }
        if (data.status) player.status = data.status;
        if (data.budgetRemaining !== undefined) player.budgetRemaining = data.budgetRemaining;
        if (data.cart) {
            player.cart = data.cart;
            player.cartCount = Array.isArray(data.cart) ? data.cart.length : 0;
        }
        if (data.scoreBreakdown) player.scoreBreakdown = data.scoreBreakdown;

        const sanitized = sanitizeRoom(pin);

        // Broadcast live progress to all sockets in room
        io.to(pin).emit('host_live_update', {
            players: room.players,
            playerId: player.id,
            score: player.score,
            progress: player.progress,
            stage: player.stage
        });
        io.to(pin).emit('player_progress_updated', {
            playerId: player.id,
            player,
            ...data
        });
        io.to(pin).emit('host_dashboard_update', sanitized);
        io.to(pin).emit('room_state_updated', sanitized);
    };

    socket.on('update_player_state', handlePlayerUpdateState);
    socket.on('player_update_state', handlePlayerUpdateState);

    // 5. Dish submission
    socket.on('submit_final_dish', (data) => {
        const pin = data.pin || socket.roomPin;
        if (!pin || !rooms[pin]) return;
        const room = rooms[pin];
        const player = room.players[socket.id];

        const dishRecord = {
            id: `dish_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            playerId: socket.id,
            playerName: player ? player.name : (data.playerName || 'Chef'),
            playerAvatar: player ? player.avatar : 'panda',
            teamId: player ? player.teamId : 'team-alpha',
            dishTitle: data.dishTitle || 'Culinary Creation',
            description: data.description || '',
            plateType: data.plateType || 'porcelain',
            platingItems: data.platingItems || [],
            evaluation: data.evaluation || null,
            submittedAt: Date.now()
        };

        room.dishes.unshift(dishRecord);
        if (player) {
            player.dishSubmitted = true;
            player.dish = dishRecord;
            if (data.evaluation && data.evaluation.totalScore) {
                player.score = data.evaluation.totalScore;
            }
        }

        const sanitized = sanitizeRoom(pin);

        io.to(pin).emit('dish_showcase_added', dishRecord);
        io.to(pin).emit('host_dashboard_update', sanitized);
        io.to(pin).emit('room_state_updated', sanitized);
    });

    // 6. Host team auto-balance
    socket.on('host_rebalance_teams', () => {
        const pin = socket.roomPin;
        if (!pin || !rooms[pin]) return;
        const room = rooms[pin];

        const playerList = Object.values(room.players);
        playerList.forEach((player, index) => {
            const team = TEAMS[index % TEAMS.length];
            player.teamId = team.id;
            player.team = team.name;
            player.teamName = team.name;
            player.teamColor = team.color;
        });

        const sanitized = sanitizeRoom(pin);
        io.in(pin).emit('update_host_lobby', Object.values(room.players));
        io.in(pin).emit('host_dashboard_update', sanitized);
        io.in(pin).emit('room_state_updated', sanitized);
    });

    // 7. Host announcements
    socket.on('host_broadcast', ({ message, type }) => {
        const pin = socket.roomPin;
        if (!pin || !rooms[pin]) return;
        io.in(pin).emit('broadcast_received', { message, type: type || 'info' });
    });

    // 8. Disconnect handler
    socket.on('disconnect', () => {
        console.log(`[Socket Disconnected] ID: ${socket.id} (Room: ${socket.roomPin || 'none'})`);
        const pin = socket.roomPin;
        if (!pin || !rooms[pin]) return;

        const room = rooms[pin];

        if (socket.isHost || room.hostSocketId === socket.id) {
            console.log(`[Host Left] Room ${pin} host disconnected.`);
            io.in(pin).emit('host_disconnected');
        } else if (room.players[socket.id]) {
            const departing = room.players[socket.id];
            delete room.players[socket.id];
            console.log(`[Player Left] ${departing.name} left Room ${pin}`);

            const sanitized = sanitizeRoom(pin);
            const playerList = Object.values(room.players);

            io.in(pin).emit('update_host_lobby', Object.values(room.players));
            io.in(pin).emit('player_list_updated', {
                pin,
                players: playerList,
                totalPlayers: playerList.length
            });
            io.in(pin).emit('player_left', {
                playerId: socket.id,
                playerName: departing.name,
                totalPlayers: playerList.length
            });
            io.in(pin).emit('host_dashboard_update', sanitized);
            io.in(pin).emit('room_state_updated', sanitized);
        }
    });
});

// ==============================================================================
// Start Server
// ==============================================================================
server.listen(PORT, HOST, () => {
    console.log('════════════════════════════════════════════════════════');
    console.log(`🚀 TungTung Restaurant Server running on port ${PORT}`);
    console.log(`📺 Host Dashboard : http://localhost:${PORT}/`);
    console.log(`🧑‍🍳 Player Join   : http://localhost:${PORT}/join`);
    console.log(`🏥 Health Check   : http://localhost:${PORT}/api/health`);
    if (PUBLIC_URL) {
        console.log(`🌐 Public URL     : ${PUBLIC_URL}`);
        console.log(`📱 Student QR URL : ${PUBLIC_URL}/join`);
    }
    console.log('════════════════════════════════════════════════════════');
});
