/**
 * TungTung restaurant - Unified Single-View Real-Time Host Dashboard
 * 4-digit PIN, Dynamic QR Code, Real-Time Scoring & Overall Progress %, Unified Live Matrix
 */

class HostDashboard {
    constructor() {
        this.socket = null;
        this.room = null;
        this.roomCode = this.generateLocalPin();
        this.currentStage = 'LOBBY';
        this.dishes = [];
        this.qrCodeObj = null;

        // Render PIN and QR Code immediately upon page load
        this.renderPin(this.roomCode);
        this.generateJoinQRCode(this.roomCode);
        this.initSocket();
        this.bindEvents();
    }

    /** Generate unique 4-digit PIN */
    generateLocalPin() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    /** Display 4-digit PIN immediately */
    renderPin(code) {
        this.roomCode = code;
        const pinEl = document.getElementById('hostRoomPin');
        if (pinEl) {
            pinEl.textContent = code;
        }
    }

    /** Generate and render QR Code — uses window.location.origin so remote players scan live public domain */
    async generateJoinQRCode(roomPin) {
        const qrContainer = document.getElementById('hostQrCodeCanvas');
        if (!qrContainer) return;
        qrContainer.innerHTML = '';

        // Default to live public origin (window.location.origin)
        let hostUrl = `${window.location.origin}/?pin=${roomPin}`;

        // When developing on localhost, attempt to fetch LAN IP or custom PUBLIC_URL from /api/server-info
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            try {
                const res = await fetch('/api/server-info');
                const info = await res.json();
                const base = info.publicUrl || info.networkUrl;
                if (base) {
                    hostUrl = `${base.replace(/\/$/, '')}/?pin=${roomPin}`;
                }
            } catch (err) {
                // Silently fallback to window.location.origin
            }
        }

        const joinUrlDisplay = document.getElementById('hostJoinUrl');
        if (joinUrlDisplay) {
            joinUrlDisplay.textContent = hostUrl;
        }

        if (typeof QRCode !== 'undefined') {
            try {
                this.qrCodeObj = new QRCode(qrContainer, {
                    text: hostUrl,
                    width: 160,
                    height: 160,
                    colorDark: '#0F172A',
                    colorLight: '#FFFFFF',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                this._renderQrFallback(qrContainer, hostUrl, roomPin);
            }
        } else {
            this._renderQrFallback(qrContainer, hostUrl, roomPin);
        }
    }

    _renderQrFallback(container, url, pin) {
        container.innerHTML = `
            <div class="w-40 h-40 bg-white p-3 rounded-xl flex flex-col items-center justify-center text-slate-900 text-center font-bold text-xs border border-slate-300">
                <span class="text-3xl mb-1">📱</span>
                <span class="text-[11px] text-slate-600">Join with PIN:</span>
                <span class="text-indigo-600 font-fun text-2xl mt-1 tracking-widest">${pin}</span>
            </div>
        `;
    }

    initSocket() {
        if (typeof io !== 'undefined' || window.socket) {
            this.socket = window.socket || io(window.location.origin);
            window.socket = this.socket;

            if (this.socket.connected) {
                console.log('Host socket already connected, creating room...');
                this.createRoom();
            } else {
                this.socket.on('connect', () => {
                    console.log('Host connected to TungTung restaurant server');
                    this.createRoom();
                });
            }

            this.socket.on('connect_error', (err) => {
                console.warn('Socket connection note (operating with local PIN):', err);
            });

            this.socket.on('room_state_updated', (roomData) => {
                this.room = roomData;
                if (roomData && roomData.code && roomData.code !== this.roomCode) {
                    this.renderPin(roomData.code);
                    this.generateJoinQRCode(roomData.code);
                }
                this.renderHostUI();
            });

            this.socket.on('update_host_lobby', (data) => {
                console.log('[Host] Real-time update_host_lobby received:', data);
                if (data) {
                    if (data.players && typeof data.players === 'object' && !Array.isArray(data.players)) {
                        // dictionary format { socketId: player }
                        const list = Object.values(data.players);
                        if (!this.room) this.room = { code: this.roomCode, teams: [], players: [] };
                        this.room.players = list;
                        this.room.totalPlayers = list.length;
                        if (data.teams) this.room.teams = data.teams;
                    } else if (Array.isArray(data.players)) {
                        // sanitized room object { players: [...] }
                        this.room = data;
                    } else if (Array.isArray(data)) {
                        // raw players array [ player1, player2 ]
                        if (!this.room) this.room = { code: this.roomCode, teams: [], players: [] };
                        this.room.players = data;
                        this.room.totalPlayers = data.length;
                    } else {
                        this.room = data;
                    }
                }
                // Instantly clear and re-render without page refresh
                this.renderHostUI();
            });

            this.socket.on('host_dashboard_update', (roomData) => {
                this.room = roomData;
                this.renderHostUI();
            });

            this.socket.on('player_list_updated', ({ pin, players, totalPlayers }) => {
                if (!this.room) this.room = { code: pin || this.roomCode, teams: [], players: [] };
                this.room.players = players || [];
                this.room.totalPlayers = totalPlayers || (players ? players.length : 0);
                this.renderHostUI();
            });

            this.socket.on('player_joined', ({ player, totalPlayers }) => {
                window.sound.playPop();
                this.showNotification(`🎉 ${player.name} joined the kitchen!`, 'success');
                if (this.room) {
                    if (!this.room.players) this.room.players = [];
                    const existing = this.room.players.find(p => p.id === player.id);
                    if (!existing) {
                        this.room.players.push(player);
                    }
                    this.room.totalPlayers = totalPlayers || this.room.players.length;
                    this.renderHostUI();
                }
            });

            this.socket.on('player_left', ({ playerId, playerName }) => {
                this.showNotification(`Chef ${playerName} left the kitchen`, 'info');
                if (this.room && this.room.players) {
                    this.room.players = this.room.players.filter(p => p.id !== playerId);
                    this.room.totalPlayers = this.room.players.length;
                    this.renderHostUI();
                }
            });

            this.socket.on('player_progress_updated', (data) => {
                if (this.room && this.room.players) {
                    const player = this.room.players.find(p => p.id === data.playerId);
                    if (player) {
                        Object.assign(player, data);
                        this.renderHostUI();
                    }
                }
            });

            this.socket.on('dish_showcase_added', (dish) => {
                window.sound.playFanfare();
                const existingIdx = this.dishes.findIndex(d => d.id === dish.id);
                if (existingIdx === -1) {
                    this.dishes.unshift(dish);
                } else {
                    this.dishes[existingIdx] = dish;
                }
                this.renderDishShowcase();
                this.showNotification(`🍽️ ${dish.playerName} plated "${dish.dishTitle}"!`, 'success');
            });

            this.socket.on('timer_tick', ({ remaining }) => {
                const timerEl = document.getElementById('hostTimerDisplay');
                if (timerEl) {
                    const mins = Math.floor(remaining / 60);
                    const secs = remaining % 60;
                    timerEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                }
            });
        }
    }

    createRoom() {
        if (!this.socket || !this.socket.connected) return;

        const handleRoomResponse = (res) => {
            if (res && res.success) {
                this.roomCode = res.pin || res.roomCode;
                this.room = res.room;
                this.renderPin(this.roomCode);
                this.generateJoinQRCode(this.roomCode);
                this.renderHostUI();
                window.sound.playSuccess();
            }
        };

        // Emit both create_room and host_create_room for maximum compatibility
        this.socket.emit('create_room', { pin: this.roomCode, customCode: this.roomCode }, handleRoomResponse);
    }

    bindEvents() {
        const startBtn = document.getElementById('hostStartGameBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.advanceStage('SHOPPING', 180);
                this.showNotification('🚀 Game Started! All players are now shopping in the supermarket!', 'success');
            });
        }

        const muteBtn = document.getElementById('hostMuteBtn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const isMuted = window.sound.toggleMute();
                muteBtn.innerHTML = isMuted ? '<i class="fas fa-volume-mute text-rose-400"></i>' : '<i class="fas fa-volume-up text-white"></i>';
            });
        }

        const nextStageBtn = document.getElementById('hostNextStageBtn');
        if (nextStageBtn) {
            nextStageBtn.addEventListener('click', () => {
                this.advanceToNextLogicalStage();
            });
        }

        const rebalanceBtn = document.getElementById('hostRebalanceBtn');
        if (rebalanceBtn) {
            rebalanceBtn.addEventListener('click', () => {
                if (this.socket) this.socket.emit('host_rebalance_teams');
                window.sound.playClick();
                this.showNotification('⚖️ Teams rebalanced equally!', 'info');
            });
        }

        const broadcastBtn = document.getElementById('hostBroadcastBtn');
        if (broadcastBtn) {
            broadcastBtn.addEventListener('click', () => {
                const msgInput = document.getElementById('hostBroadcastInput');
                const message = msgInput ? msgInput.value.trim() : '';
                if (message && this.socket) {
                    this.socket.emit('host_broadcast', { message, type: 'info' });
                    msgInput.value = '';
                    window.sound.playSuccess();
                    this.showNotification('📢 Announcement sent to all student chefs!', 'success');
                }
            });
        }

        // Enter key to broadcast
        const msgInput = document.getElementById('hostBroadcastInput');
        if (msgInput) {
            msgInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (broadcastBtn) broadcastBtn.click();
                }
            });
        }
    }

    advanceToNextLogicalStage() {
        const stageOrder = ['LOBBY', 'SHOPPING', 'COOKING', 'PLATING', 'SHOWCASE', 'PODIUM'];
        const currentIdx = stageOrder.indexOf(this.currentStage);
        const nextStage = stageOrder[Math.min(stageOrder.length - 1, currentIdx + 1)];
        this.advanceStage(nextStage, 180);
    }

    advanceStage(stageName, durationSeconds = 180) {
        this.currentStage = stageName;
        window.sound.playFanfare();
        if (this.socket && this.socket.connected) {
            this.socket.emit('host_start_game', { pin: this.roomCode, stage: stageName, duration: durationSeconds });
            this.socket.emit('host_set_stage', { pin: this.roomCode, stage: stageName, duration: durationSeconds });
        }
        this.updateActiveStageBadges();
    }

    updateActiveStageBadges() {
        document.querySelectorAll('.stage-pill-btn').forEach(btn => {
            btn.classList.remove('bg-indigo-600', 'ring-2', 'ring-indigo-400');
            if (btn.dataset.stage === this.currentStage) {
                btn.classList.add('bg-indigo-600', 'ring-2', 'ring-indigo-400');
            }
        });
    }

    renderHostUI() {
        if (!this.room) return;

        // Room PIN Display
        this.renderPin(this.room.code || this.room.pin || this.roomCode);

        const playerList = Array.isArray(this.room.players) ? this.room.players : Object.values(this.room.players || {});
        const totalChefs = playerList.length;

        const playerCount = document.getElementById('hostTotalPlayers');
        if (playerCount) playerCount.textContent = `${totalChefs} Chefs`;

        // Start Game Button readiness state
        const startBtn = document.getElementById('hostStartGameBtn');
        if (startBtn) {
            if (totalChefs >= 1) {
                startBtn.classList.remove('opacity-60');
                startBtn.classList.add('animate-pulse', 'ring-2', 'ring-emerald-400');
                startBtn.innerHTML = `<i class="fas fa-play"></i><span>Start Game (${totalChefs} Chef${totalChefs > 1 ? 's' : ''} Ready)</span>`;
            } else {
                startBtn.classList.remove('ring-2', 'ring-emerald-400', 'animate-pulse');
                startBtn.innerHTML = `<i class="fas fa-play"></i><span>Start Game (Waiting for Chefs...)</span>`;
            }
        }

        // Overall Classroom Progress Percentage %
        const progressPct = this.room.overallProgress || (totalChefs > 0 ? 10 : 5);
        const progressPctText = document.getElementById('hostProgressPctText');
        const progressBar = document.getElementById('hostOverallProgressBar');
        
        if (progressPctText) progressPctText.textContent = `${progressPct}%`;
        if (progressBar) progressBar.style.width = `${progressPct}%`;

        // Current Stage Name Display
        const stageNameDisplay = document.getElementById('hostCurrentStageName');
        if (stageNameDisplay) stageNameDisplay.textContent = this.room.stage || this.currentStage;

        // Default teams if not populated
        const defaultTeams = [
            { id: 'team-alpha', name: 'Team Alpha', color: '#EF4444', icon: '🔥', score: 0, playerCount: 0 },
            { id: 'team-bravo', name: 'Team Bravo', color: '#3B82F6', icon: '⚡', score: 0, playerCount: 0 },
            { id: 'team-charlie', name: 'Team Charlie', color: '#10B981', icon: '🌿', score: 0, playerCount: 0 },
            { id: 'team-delta', name: 'Team Delta', color: '#F59E0B', icon: '👑', score: 0, playerCount: 0 }
        ];

        const activeTeams = (this.room.teams && this.room.teams.length) ? this.room.teams : defaultTeams;

        // Render Teams Score progression
        const teamsContainer = document.getElementById('hostTeamsGrid');
        if (teamsContainer) {
            teamsContainer.innerHTML = '';
            activeTeams.forEach(team => {
                const teamMembers = playerList.filter(p => p.teamId === team.id);
                const teamScore = teamMembers.reduce((sum, p) => sum + (p.score || 0), 0);
                const teamCard = document.createElement('div');
                teamCard.className = `glass-panel p-4 rounded-2xl border-2 flex flex-col justify-between ${team.id}`;
                teamCard.innerHTML = `
                    <div>
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center space-x-2">
                                <span class="text-2xl">${team.icon}</span>
                                <div>
                                    <h3 class="font-bold text-sm text-white font-fun">${team.name}</h3>
                                    <span class="text-[11px] text-slate-300">${teamMembers.length} Member(s)</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xl font-bold font-fun text-amber-400">${team.score !== undefined ? team.score : teamScore}</div>
                                <span class="text-[9px] text-slate-400 uppercase tracking-wider">PTS</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1.5 min-h-[60px] bg-slate-900/60 p-2 rounded-xl">
                            ${this.renderTeamPlayerPills(team.id, playerList)}
                        </div>
                    </div>
                `;
                teamsContainer.appendChild(teamCard);
            });
        }

        // Render Unified Live Player Matrix
        this.renderLivePlayerMatrix();

        // Render Live Dish Showcase
        this.renderDishShowcase();
    }

    renderTeamPlayerPills(teamId, explicitPlayerList) {
        const playerList = explicitPlayerList || (Array.isArray(this.room?.players) ? this.room.players : Object.values(this.room?.players || {}));
        const teamPlayers = playerList.filter(p => p.teamId === teamId);
        if (teamPlayers.length === 0) {
            return '<span class="text-[11px] text-slate-500 italic m-auto">Waiting to join...</span>';
        }

        return teamPlayers.map(p => {
            const av = window.GAME_DATA.AVATARS.find(a => a.id === p.avatar) || { emoji: '🐼' };
            return `
                <div class="glass-pill px-2.5 py-1 flex items-center space-x-1.5 border border-slate-600 animate-pop">
                    <span class="text-sm">${av.emoji}</span>
                    <span class="text-[11px] font-bold text-white">${p.name}</span>
                </div>
            `;
        }).join('');
    }

    renderLivePlayerMatrix() {
        const matrixContainer = document.getElementById('hostPlayerMatrix');
        if (!matrixContainer || !this.room) return;

        matrixContainer.innerHTML = '';
        const playerList = Array.isArray(this.room.players) ? this.room.players : Object.values(this.room.players || {});
        if (playerList.length === 0) {
            matrixContainer.innerHTML = '<div class="col-span-full text-center text-slate-500 italic py-6">Waiting for students to join with PIN: <strong class="text-amber-400 font-fun text-base">' + (this.room.code || this.room.pin || this.roomCode) + '</strong></div>';
            return;
        }

        const teams = this.room.teams || [
            { id: 'team-alpha', name: 'Team Alpha', icon: '🔥', color: '#EF4444' },
            { id: 'team-bravo', name: 'Team Bravo', icon: '⚡', color: '#3B82F6' },
            { id: 'team-charlie', name: 'Team Charlie', icon: '🌿', color: '#10B981' },
            { id: 'team-delta', name: 'Team Delta', color: '#F59E0B', icon: '👑' }
        ];

        playerList.forEach(p => {
            const av = window.GAME_DATA.AVATARS.find(a => a.id === p.avatar) || { emoji: '🐼' };
            const team = teams.find(t => t.id === p.teamId) || { name: 'Team Alpha', icon: '🍳', color: '#EF4444' };

            const row = document.createElement('div');
            row.className = 'glass-panel p-3.5 rounded-2xl flex items-center justify-between text-sm border border-slate-700/70 hover:border-indigo-400 transition-all';
            row.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="relative">
                        <span class="text-3xl">${av.emoji}</span>
                        <span class="absolute -bottom-1 -right-1 text-xs">${team.icon}</span>
                    </div>
                    <div>
                        <div class="font-bold text-white text-sm flex items-center space-x-2">
                            <span>${p.name}</span>
                            <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold" style="background: ${team.color}25; color: ${team.color}">
                                ${team.name}
                            </span>
                        </div>
                        <div class="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                            <span>💰 ${p.budgetRemaining !== undefined ? p.budgetRemaining : 150} THB left</span>
                            <span>•</span>
                            <span>🛒 ${p.cartCount || 0} items</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center space-x-3">
                    <div class="text-right">
                        <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            ${p.status || 'In Lobby'}
                        </span>
                        <div class="text-[10px] text-slate-400 mt-1">Stage: <strong class="text-slate-200">${p.stage || p.currentStage || 'LOBBY'}</strong></div>
                    </div>
                    <div class="text-right min-w-[50px]">
                        <div class="text-base font-bold font-fun text-amber-400">${p.score || 0}</div>
                        <span class="text-[9px] text-slate-400 uppercase font-bold">PTS</span>
                    </div>
                </div>
            `;
            matrixContainer.appendChild(row);
        });
    }

    renderDishShowcase() {
        const container = document.getElementById('hostShowcaseGrid');
        if (!container) return;

        container.innerHTML = '';
        if (this.dishes.length === 0) {
            container.innerHTML = '<div class="col-span-full text-slate-500 text-center italic py-4">Submitted dishes will appear here in real-time as chefs finish plating.</div>';
            return;
        }

        this.dishes.forEach(dish => {
            const card = document.createElement('div');
            card.className = 'glass-panel p-4 rounded-3xl border border-slate-700 flex flex-col justify-between hover:border-amber-400 transition-all';
            const av = window.GAME_DATA.AVATARS.find(a => a.id === dish.playerAvatar) || { emoji: '🐼' };
            
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center space-x-2">
                            <span class="text-2xl">${av.emoji}</span>
                            <span class="font-bold text-white text-xs">${dish.playerName}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ${dish.evaluation ? dish.evaluation.grade : 'Master Chef'}
                        </span>
                    </div>

                    <!-- Plated Dish Visual -->
                    <div class="plate-base plate-${dish.plateType || 'porcelain'} w-40 h-40 mx-auto my-2 relative rounded-full flex items-center justify-center shadow-lg">
                        ${(dish.platingItems || []).map(it => `
                            <div class="plated-food-item text-2xl absolute" style="left: ${it.x}%; top: ${it.y}%; transform: translate(-50%, -50%) rotate(${it.rotation || 0}deg) scale(${it.scale || 1.0})">
                                ${it.icon}
                            </div>
                        `).join('')}
                    </div>

                    <h4 class="font-bold text-amber-300 text-center font-fun text-sm mt-1">${dish.dishTitle}</h4>
                    <p class="text-[11px] text-slate-300 text-center italic mt-1 bg-slate-900/50 p-2 rounded-xl border border-slate-800 line-clamp-2">
                        "${dish.description}"
                    </p>
                </div>

                <div class="mt-3 pt-2.5 border-t border-slate-700 flex items-center justify-between">
                    <span class="text-xs text-slate-400">Score: <strong class="text-amber-400 font-fun text-sm">${dish.evaluation ? dish.evaluation.totalScore : 90}</strong> pts</span>
                    <button class="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] btn-bounce flex items-center space-x-1" onclick="host.awardBonus('${dish.id}')">
                        <span>⭐ Bonus +5</span>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }

    awardBonus(dishId) {
        window.sound.playCashRegister();
        this.showNotification('⭐ +5 Bonus points awarded to chef!', 'success');
    }

    showNotification(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl glass-panel text-sm font-bold shadow-2xl flex items-center space-x-3 animate-bounce ${type === 'error' ? 'border-red-500 text-red-200' : 'border-indigo-500 text-indigo-200'}`;
        toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✨'}</span><span>${msg}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

function initHost() {
    if (!window.host) {
        window.host = new HostDashboard();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHost);
} else {
    initHost();
}
