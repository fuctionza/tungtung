/**
 * TungTung Restaurant - Host Dashboard Controller
 * Features:
 *  - Single stable 4-Digit Room PIN with localStorage persistence
 *  - Kahoot-style real-time player join sync via Firebase onValue()
 *  - Dynamic QR Code generation for mobile entry
 *  - End Game / Reset Room controls
 */

class HostDashboard {
    constructor() {
        this.socket = null;
        this.room = null;
        this.firebaseController = null;
        this.dishes = [];
        this.currentStage = 'LOBBY';

        // 1. Retrieve or generate single stable 4-digit PIN
        this.roomCode = this.getOrInitRoomPin();

        // Render PIN and dynamic QR Code immediately
        this.renderPin(this.roomCode);
        this.generateJoinQRCode(this.roomCode);

        // 2. Initialize Firebase Realtime Listener immediately
        this.initFirebaseSync();
        this.initSocketFallback();
        this.bindEvents();
    }

    /**
     * Retrieve active 4-digit PIN from localStorage, or generate a fresh 4-digit PIN
     */
    getOrInitRoomPin() {
        let storedPin = localStorage.getItem('active_room_pin');
        if (storedPin && /^\d{4}$/.test(storedPin.trim())) {
            console.log(`📌 [Host Persistence] Restored active room PIN from localStorage: ${storedPin}`);
            return storedPin.trim();
        }

        const freshPin = Math.floor(1000 + Math.random() * 9000).toString();
        localStorage.setItem('active_room_pin', freshPin);
        console.log(`✨ [Host New Session] Generated new 4-digit PIN: ${freshPin}`);
        return freshPin;
    }

    /**
     * Reset / Kill current room session and generate a new PIN
     */
    resetRoomSession() {
        if (confirm('Are you sure you want to end this game session and reset the room?')) {
            if (this.firebaseController) {
                this.firebaseController.endGame();
            }
            localStorage.removeItem('active_room_pin');
            this.roomCode = Math.floor(1000 + Math.random() * 9000).toString();
            localStorage.setItem('active_room_pin', this.roomCode);
            this.room = null;
            this.dishes = [];
            this.currentStage = 'LOBBY';

            this.renderPin(this.roomCode);
            this.generateJoinQRCode(this.roomCode);
            this.initFirebaseSync();
            this.showNotification(`🔄 Room reset! New PIN: ${this.roomCode}`, 'info');
        }
    }

    /** Display 4-digit PIN immediately across all dashboard labels */
    renderPin(code) {
        if (!code) return;
        this.roomCode = code.toString();
        ['game-pin', 'pin-display', 'room-pin-display', 'hostRoomPin', 'heroPinDisplay', 'modalPinDisplay'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = this.roomCode;
            }
        });
    }

    /**
     * Kahoot-Style Instant Sync: Subscribe to rooms/{pin}/players
     */
    initFirebaseSync() {
        if (window.firebaseSync) {
            this.firebaseController = window.firebaseSync.initHostRoom(this.roomCode, {
                onPlayersUpdate: (playerList) => {
                    this.handlePlayersSync(playerList);
                },
                onDishesUpdate: (dishList) => {
                    this.dishes = dishList;
                    this.renderDishShowcase();
                }
            });
        } else {
            setTimeout(() => this.initFirebaseSync(), 300);
        }
    }

    /** Handle real-time player additions / updates */
    handlePlayersSync(playerList) {
        console.log(`🔥 [Host UI Update] ${playerList.length} player(s) rendered:`, playerList);
        if (!this.room) {
            this.room = { code: this.roomCode, pin: this.roomCode, players: playerList };
        } else {
            this.room.players = playerList;
            this.room.totalPlayers = playerList.length;
        }

        const container = document.getElementById('player-list');
        const countEl = document.getElementById('player-count');
        const hostTotal = document.getElementById('hostTotalPlayers');

        // Render joined player avatars
        if (container) {
            if (playerList.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full py-8 text-center text-slate-400">
                        <div class="text-3xl mb-2 animate-bounce">📱</div>
                        <p class="text-sm font-semibold">Waiting for students to join with PIN: <strong class="text-amber-400 font-mono text-base">${this.roomCode}</strong></p>
                        <p class="text-xs text-slate-500 mt-1">Scan the QR code or visit /join</p>
                    </div>
                `;
            } else {
                container.innerHTML = playerList.map(p => {
                    const av = (window.GAME_DATA && window.GAME_DATA.AVATARS ? window.GAME_DATA.AVATARS.find(a => a.id === p.avatar) : null) || { emoji: '👨‍🍳' };
                    const teamColor = p.teamColor || (p.teamId === 'team-bravo' ? '#3B82F6' : (p.teamId === 'team-charlie' ? '#10B981' : (p.teamId === 'team-delta' ? '#F59E0B' : '#EF4444')));
                    return `
                        <div class="p-4 bg-slate-800/90 text-slate-100 rounded-2xl shadow-xl border-2 border-indigo-500/50 hover:border-indigo-400 text-center font-bold animate-pop flex flex-col items-center justify-between transition-all">
                            <div class="text-4xl mb-1">${av.emoji || '👨‍🍳'}</div>
                            <div class="text-white font-fun text-base">${p.name || 'Anonymous'}</div>
                            <span class="inline-block mt-1.5 px-3 py-0.5 rounded-full text-xs font-bold shadow-sm" style="background: ${teamColor}30; color: ${teamColor}; border: 1px solid ${teamColor}60">
                                ${p.team || p.teamId || 'Team Alpha'}
                            </span>
                        </div>
                    `;
                }).join('');
            }
        }

        if (countEl) countEl.innerText = playerList.length;
        if (hostTotal) hostTotal.innerText = `${playerList.length} Chefs`;

        // Update Start Game Button
        const startBtn = document.getElementById('hostStartGameBtn');
        if (startBtn) {
            if (playerList.length >= 1) {
                startBtn.classList.remove('opacity-60');
                startBtn.classList.add('animate-pulse', 'ring-2', 'ring-emerald-400');
                startBtn.innerHTML = `<i class="fas fa-play"></i><span>Start Game (${playerList.length} Chef${playerList.length > 1 ? 's' : ''} Ready)</span>`;
            } else {
                startBtn.classList.remove('ring-2', 'ring-emerald-400', 'animate-pulse');
                startBtn.classList.add('opacity-60');
                startBtn.innerHTML = `<i class="fas fa-play"></i><span>Start Game (Waiting for Players...)</span>`;
            }
        }

        this.renderHostUI();
    }

    /** Generate dynamic QR Code for student onboarding */
    async generateJoinQRCode(roomPin) {
        const qrContainer = document.getElementById('hostQrCodeCanvas');
        const modalQrContainer = document.getElementById('modalQrCodeCanvas');

        let hostUrl = `${window.location.origin}/join?pin=${roomPin}`;

        ['hostJoinUrl', 'modalJoinUrl'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = hostUrl;
        });

        this._renderQR(qrContainer, hostUrl, roomPin, 180);
        this._renderQR(modalQrContainer, hostUrl, roomPin, 240);
    }

    _renderQR(container, url, pin, size) {
        if (!container) return;
        container.innerHTML = '';

        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(container, {
                    text: url,
                    width: size,
                    height: size,
                    colorDark: '#0F172A',
                    colorLight: '#FFFFFF',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                this._renderQrFallback(container, url, pin);
            }
        } else {
            this._renderQrFallback(container, url, pin);
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

    initSocketFallback() {
        if (typeof io !== 'undefined' || window.socket) {
            this.socket = window.socket || io(window.location.origin, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                timeout: 5000
            });
            window.socket = this.socket;
            if (this.socket.connected) {
                this.socket.emit('create_room', { pin: this.roomCode });
            } else {
                this.socket.on('connect', () => {
                    this.socket.emit('create_room', { pin: this.roomCode });
                });
            }
        }
    }

    bindEvents() {
        // Start Game button
        const startBtn = document.getElementById('hostStartGameBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                this.startGame();
            });
        }

        // End Game / Reset Room button
        const resetBtn = document.getElementById('hostResetRoomBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetRoomSession();
            });
        }

        // Next Stage button
        const nextStageBtn = document.getElementById('hostNextStageBtn');
        if (nextStageBtn) {
            nextStageBtn.addEventListener('click', () => {
                this.advanceToNextLogicalStage();
            });
        }

        // Audio mute toggle
        const muteBtn = document.getElementById('hostMuteBtn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const isMuted = window.sound.toggleMute();
                muteBtn.innerHTML = isMuted ? '<i class="fas fa-volume-mute text-rose-400"></i>' : '<i class="fas fa-volume-up text-white"></i>';
            });
        }

        // Broadcast button
        const broadcastBtn = document.getElementById('hostBroadcastBtn');
        if (broadcastBtn) {
            broadcastBtn.addEventListener('click', () => {
                const msgInput = document.getElementById('hostBroadcastInput');
                const message = msgInput ? msgInput.value.trim() : '';
                if (message) {
                    if (this.firebaseController) {
                        this.firebaseController.broadcast(message);
                    }
                    if (this.socket && this.socket.connected) {
                        this.socket.emit('host_broadcast', { message, type: 'info' });
                    }
                    msgInput.value = '';
                    window.sound.playSuccess();
                    this.showNotification('📢 Announcement broadcasted to student chefs!', 'success');
                }
            });
        }
    }

    startGame() {
        this.currentStage = 'SHOPPING';
        window.sound.playFanfare();
        if (this.firebaseController) {
            this.firebaseController.setPlaying();
        }
        if (this.socket && this.socket.connected) {
            this.socket.emit('host_start_game', { pin: this.roomCode, stage: 'SHOPPING', duration: 180 });
        }
        this.showNotification('🚀 Game Started! Students are now shopping in the supermarket!', 'success');
        const stageNameDisplay = document.getElementById('hostCurrentStageName');
        if (stageNameDisplay) stageNameDisplay.textContent = 'SHOPPING';
    }

    advanceToNextLogicalStage() {
        const stageOrder = ['LOBBY', 'SHOPPING', 'COOKING', 'PLATING', 'SHOWCASE', 'PODIUM'];
        const currentIdx = stageOrder.indexOf(this.currentStage);
        const nextStage = stageOrder[Math.min(stageOrder.length - 1, currentIdx + 1)];
        this.currentStage = nextStage;
        window.sound.playFanfare();

        if (this.firebaseController) {
            this.firebaseController.setStage(nextStage);
        }
        if (this.socket && this.socket.connected) {
            this.socket.emit('host_set_stage', { pin: this.roomCode, stage: nextStage, duration: 180 });
        }

        const stageNameDisplay = document.getElementById('hostCurrentStageName');
        if (stageNameDisplay) stageNameDisplay.textContent = nextStage;
        this.showNotification(`📍 Advanced to ${nextStage} stage!`, 'info');
    }

    renderHostUI() {
        if (!this.room) return;

        const playerList = Array.isArray(this.room.players) ? this.room.players : Object.values(this.room.players || {});
        const totalChefs = playerList.length;

        // Overall Classroom Progress Percentage %
        const progressPct = totalChefs > 0 ? (this.currentStage === 'LOBBY' ? 15 : this.currentStage === 'SHOPPING' ? 40 : this.currentStage === 'COOKING' ? 70 : 100) : 5;
        const progressPctText = document.getElementById('hostProgressPctText');
        const progressBar = document.getElementById('hostOverallProgressBar');
        if (progressPctText) progressPctText.textContent = `${progressPct}%`;
        if (progressBar) progressBar.style.width = `${progressPct}%`;

        // Teams Scoreboard
        const defaultTeams = [
            { id: 'team-alpha', name: 'Team Alpha', color: '#EF4444', icon: '🔥' },
            { id: 'team-bravo', name: 'Team Bravo', color: '#3B82F6', icon: '⚡' },
            { id: 'team-charlie', name: 'Team Charlie', color: '#10B981', icon: '🌿' },
            { id: 'team-delta', name: 'Team Delta', color: '#F59E0B', icon: '👑' }
        ];

        const teamsContainer = document.getElementById('hostTeamsGrid');
        if (teamsContainer) {
            teamsContainer.innerHTML = '';
            defaultTeams.forEach(team => {
                const teamMembers = playerList.filter(p => p.teamId === team.id || (p.team && p.team.includes(team.name)));
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
                                <div class="text-xl font-bold font-fun text-amber-400">${teamScore}</div>
                                <span class="text-[9px] text-slate-400 uppercase tracking-wider">PTS</span>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-1.5 min-h-[60px] bg-slate-900/60 p-2 rounded-xl">
                            ${teamMembers.length > 0 ? teamMembers.map(p => {
                                const av = (window.GAME_DATA && window.GAME_DATA.AVATARS ? window.GAME_DATA.AVATARS.find(a => a.id === p.avatar) : null) || { emoji: '🐼' };
                                return `<div class="glass-pill px-2.5 py-1 flex items-center space-x-1.5 border border-slate-600 animate-pop"><span class="text-sm">${av.emoji || '👨‍🍳'}</span><span class="text-[11px] font-bold text-white">${p.name}</span></div>`;
                            }).join('') : '<span class="text-[11px] text-slate-500 italic m-auto">Waiting to join...</span>'}
                        </div>
                    </div>
                `;
                teamsContainer.appendChild(teamCard);
            });
        }
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
            const av = (window.GAME_DATA && window.GAME_DATA.AVATARS ? window.GAME_DATA.AVATARS.find(a => a.id === dish.playerAvatar || a.id === dish.avatar) : null) || { emoji: '👨‍🍳' };
            
            card.innerHTML = `
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center space-x-2">
                            <span class="text-2xl">${av.emoji || '👨‍🍳'}</span>
                            <span class="font-bold text-white text-xs">${dish.playerName}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ${dish.evaluation ? dish.evaluation.grade : 'Master Chef'}
                        </span>
                    </div>

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
                    <span class="text-xs text-slate-400">Score: <strong class="text-amber-400 font-fun text-sm">${dish.evaluation ? dish.evaluation.totalScore : (dish.score || 90)}</strong> pts</span>
                </div>
            `;
            container.appendChild(card);
        });
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
        window.hostDashboard = window.host;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHost);
} else {
    initHost();
}
