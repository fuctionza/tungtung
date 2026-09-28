/**
 * TungTung restaurant - Player Client Gameplay Controller
 * 100% English UI, Real-time sync, Host-controlled start, Interactive Plating with Drag/Scale/Rotate
 */

class TungTungApp {
    constructor() {
        this.socket = null;
        this.player = null;
        this.room = null;
        this.roomCode = null;
        
        // Gameplay State
        this.budget = 150; // Starting 150 THB
        this.cart = [];
        this.liveScore = 0;
        this.scoreBreakdown = {
            shopping: 0,
            quiz: 0,
            cooking: 0,
            plating: 0
        };

        this.quizQuestions = [];
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.currentCategory = 'all';
        
        // Kitchen State
        this.inventory = []; // Ingredients bought
        this.activeStation = 'cutting';
        this.cookingStations = {
            cutting: { item: null, progress: 0 },
            pan: { item: null, isCooking: false, heat: 'med', progress: 0 },
            pot: { items: [], isCooking: false, progress: 0 },
            steamer: { item: null, isCooking: false, progress: 0 },
            oven: { item: null, isCooking: false, progress: 0 },
            mortar: { items: [], isCooking: false, progress: 0 },
            grill: { item: null, isCooking: false, progress: 0 }
        };
        this.cookedItems = [];

        // Interactive Plating State
        this.selectedPlate = 'porcelain';
        this.platedItems = []; // Array of { uid, name, icon, x, y, scale, rotation, isGarnish }
        this.selectedItemUid = null;
        this.dishTitle = '';
        this.dishDescription = '';
        
        // Timer tracking
        this.startTime = Date.now();

        this.initSocket();
        this.checkUrlParams();
        this.bindEvents();
        this.renderAvatars();
    }

    // Pre-fill room code from URL param (QR scan redirect)
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const pin = urlParams.get('pin');
        if (pin && pin.trim()) {
            this.setRoomCode(pin.trim());
        }
        // Players do NOT auto-generate codes — only the Host creates the room code.
    }

    setRoomCode(code) {
        this.roomCode = code;
        const roomPinInput = document.getElementById('roomPinInput');
        if (roomPinInput) {
            roomPinInput.value = code;
        }
        // Note: lobbyPinDisplay was removed from player view — Room PIN is Host-only
    }

    initSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();

            this.socket.on('connect', () => {
                console.log('[Player Socket] Connected to TungTung Server (ID:', this.socket.id, ')');
            });

            this.socket.on('join_success', (res) => {
                console.log('[Player] join_success received:', res);
                if (res && res.player) {
                    this.player = res.player;
                    this.room = res.room;
                    this.roomCode = res.pin || res.roomCode;
                    this.showScreen('lobbyScreen');
                    this.updateLobbyUI();
                    window.sound.playSuccess();
                }
            });

            this.socket.on('join_error', (res) => {
                console.warn('[Player] join_error received:', res);
                this.showNotification(res ? res.message : 'Invalid Room PIN! Please check the Host screen.', 'error');
                window.sound.playError();
            });

            this.socket.on('room_state_updated', (roomData) => {
                this.room = roomData;
                this.updateLobbyUI();
            });

            this.socket.on('update_host_lobby', (roomData) => {
                this.room = roomData;
                this.updateLobbyUI();
            });

            // Host controls the stage transition
            this.socket.on('game_started', ({ pin, stage }) => {
                console.log('[Game Started] Host initiated game. Moving to:', stage);
                this.syncStage(stage || 'SHOPPING');
            });

            this.socket.on('stage_changed', ({ stage }) => {
                console.log('[Stage Changed] Moving to:', stage);
                this.syncStage(stage);
            });

            this.socket.on('broadcast_received', ({ message, type }) => {
                this.showNotification(message, type);
            });
        }
    }

    bindEvents() {
        // Mute toggle
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const isMuted = window.sound.toggleMute();
                muteBtn.innerHTML = isMuted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
            });
        }

        // Category filter
        document.querySelectorAll('.cat-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active', 'bg-indigo-600'));
                btn.classList.add('active', 'bg-indigo-600');
                this.currentCategory = btn.dataset.cat;
                this.renderMarketItems();
                window.sound.playClick();
            });
        });

        // Room PIN input — mirrors typed code into the join input only
        const roomPinInput = document.getElementById('roomPinInput');
        if (roomPinInput) {
            roomPinInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                // Note: lobbyPinDisplay was removed; player only types code to join
            });
        }

        // Live Description Grammar Check
        const descInput = document.getElementById('dishDescriptionInput');
        if (descInput) {
            descInput.addEventListener('input', (e) => {
                this.dishDescription = e.target.value;
                this.checkGrammarLive(this.dishDescription);
            });
        }

        // Plating Item Manipulation Controls
        const scaleSlider = document.getElementById('itemScaleSlider');
        if (scaleSlider) {
            scaleSlider.addEventListener('input', (e) => {
                this.updateSelectedItemProperty('scale', parseFloat(e.target.value));
            });
        }

        const rotSlider = document.getElementById('itemRotationSlider');
        if (rotSlider) {
            rotSlider.addEventListener('input', (e) => {
                this.updateSelectedItemProperty('rotation', parseInt(e.target.value, 10));
            });
        }
    }

    renderAvatars() {
        const container = document.getElementById('avatarGrid');
        if (!container) return;

        container.innerHTML = '';
        window.GAME_DATA.AVATARS.forEach((av, index) => {
            const card = document.createElement('div');
            card.className = `avatar-card glass-panel p-3 text-center rounded-2xl ${index === 0 ? 'selected' : ''}`;
            card.dataset.id = av.id;
            card.innerHTML = `
                <div class="text-4xl mb-1">${av.emoji}</div>
                <div class="text-xs font-bold text-slate-200">${av.name}</div>
            `;
            card.addEventListener('click', () => {
                document.querySelectorAll('.avatar-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                window.sound.playPop();
            });
            container.appendChild(card);
        });
    }

    // Player joins lobby with 4-digit PIN
    joinLobby() {
        window.sound.playClick();
        const nameInput = document.getElementById('playerNameInput');
        const roomPinInput = document.getElementById('roomPinInput');
        const selectedAvatar = document.querySelector('.avatar-card.selected');

        const name = nameInput ? nameInput.value.trim() : 'Chef Panda';
        const roomCode = roomPinInput ? roomPinInput.value.trim() : '1234';
        const avatarId = selectedAvatar ? selectedAvatar.dataset.id : 'panda';

        if (!name) {
            this.showNotification('Please enter your Chef Name!', 'error');
            return;
        }

        if (this.socket && this.socket.connected) {
            this.socket.emit('join_room', { pin: roomCode, roomCode, name, teamName: name, avatar: avatarId }, (res) => {
                if (res && res.success) {
                    this.player = res.player;
                    this.room = res.room;
                    this.roomCode = res.pin || res.roomCode;
                    this.showScreen('lobbyScreen');
                    this.updateLobbyUI();
                    window.sound.playSuccess();
                } else if (res && !res.success) {
                    this.showNotification(res.message || 'Invalid Room PIN! Please check Host screen.', 'error');
                    window.sound.playError();
                }
            });
        } else {
            // Local fallback practice
            this.setupLocalPlayer(name, avatarId, roomCode);
        }
    }

    setupLocalPlayer(name, avatarId, roomCode) {
        const teamIds = ['team-alpha', 'team-bravo', 'team-charlie', 'team-delta'];
        const randomTeam = teamIds[Math.floor(Math.random() * teamIds.length)];
        this.player = {
            id: 'local_player',
            name: name || 'Master Chef',
            avatar: avatarId,
            teamId: randomTeam,
            score: 0,
            budgetRemaining: 150
        };
        this.roomCode = roomCode || 'SOLO';
        this.showScreen('lobbyScreen');
        this.updateLobbyUI();
        window.sound.playSuccess();
    }

    updateLobbyUI() {
        // Note: lobbyPinDisplay removed from player page — PIN is Host-only
        const playerBadge = document.getElementById('myPlayerBadge');

        if (this.player && playerBadge) {
            const av = window.GAME_DATA.AVATARS.find(a => a.id === this.player.avatar) || window.GAME_DATA.AVATARS[0];
            playerBadge.innerHTML = `
                <span class="text-3xl">${av.emoji}</span>
                <div>
                    <div class="font-bold text-lg text-white">${this.player.name}</div>
                    <div class="text-xs text-amber-300 font-semibold">Ready in Lobby</div>
                </div>
            `;
        }

        // Render teams list
        const teamsContainer = document.getElementById('lobbyTeamsContainer');
        if (teamsContainer) {
            teamsContainer.innerHTML = '';
            const teamsList = [
                { id: 'team-alpha', name: 'Team Alpha', color: '#EF4444', icon: '🔥' },
                { id: 'team-bravo', name: 'Team Bravo', color: '#3B82F6', icon: '⚡' },
                { id: 'team-charlie', name: 'Team Charlie', color: '#10B981', icon: '🌿' },
                { id: 'team-delta', name: 'Team Delta', color: '#F59E0B', icon: '👑' }
            ];

            teamsList.forEach(team => {
                const isMyTeam = this.player && this.player.teamId === team.id;
                const card = document.createElement('div');
                card.className = `glass-panel p-4 rounded-2xl border-2 ${isMyTeam ? 'border-indigo-400 ring-2 ring-indigo-400/50' : 'border-slate-700'}`;
                card.innerHTML = `
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-2">
                            <span class="text-2xl">${team.icon}</span>
                            <span class="font-bold text-white text-sm">${team.name}</span>
                        </div>
                        ${isMyTeam ? '<span class="text-[10px] bg-indigo-600 px-2 py-0.5 rounded-full font-bold">YOUR TEAM</span>' : ''}
                    </div>
                    <div class="flex flex-wrap gap-2 min-h-[48px] items-center bg-slate-900/50 p-2 rounded-xl">
                        ${isMyTeam && this.player ? `
                            <div class="glass-pill px-3 py-1 flex items-center space-x-2 border border-indigo-500">
                                <span>${(window.GAME_DATA.AVATARS.find(a => a.id === this.player.avatar) || {}).emoji || '🐼'}</span>
                                <span class="text-xs font-semibold text-white">${this.player.name}</span>
                            </div>
                        ` : '<span class="text-xs text-slate-500 italic">Waiting for teammates...</span>'}
                    </div>
                `;
                teamsContainer.appendChild(card);
            });
        }
    }

    // Advance to Supermarket Shopping Phase (Triggered by Host)
    startShoppingPhase() {
        this.currentStage = 'SHOPPING';
        this.showScreen('marketScreen');
        this.renderMarketItems();
        this.updateBudgetUI();
        this.calculateRealtimeShoppingScore();
        window.sound.playSuccess();
        this.showNotification('🛒 Supermarket is now OPEN! Pick your fresh ingredients!', 'success');
        this.updateGlobalLiveScore('Shopping at Supermarket', 'SHOPPING');
    }

    renderMarketItems() {
        const grid = document.getElementById('marketGrid');
        if (!grid) return;

        grid.innerHTML = '';
        const filtered = window.GAME_DATA.INGREDIENTS.filter(item => {
            if (this.currentCategory === 'all') return true;
            return item.category === this.currentCategory;
        });

        filtered.forEach(item => {
            const inCart = this.cart.find(c => c.id === item.id);
            const qty = inCart ? inCart.qty : 0;
            const card = document.createElement('div');
            card.className = 'glass-panel p-4 rounded-2xl flex flex-col justify-between hover:border-indigo-400 transition-all';
            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-4xl">${item.rawIcon}</span>
                        <span class="text-xs font-bold px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30">
                            ${item.price} THB
                        </span>
                    </div>
                    <h4 class="font-bold text-white text-base leading-snug">${item.name}</h4>
                    <p class="text-xs text-slate-400 mt-1">
                        ${item.isUncountable ? '🌾 Uncountable ("some")' : `📦 Countable ("${item.article} ${item.name.toLowerCase()}")`}
                    </p>
                </div>
                <div class="mt-4 flex items-center justify-between pt-3 border-t border-slate-700/50">
                    <span class="text-xs font-semibold ${qty > 0 ? 'text-indigo-400' : 'text-slate-500'}">
                        ${qty > 0 ? `In Cart: ${qty}` : 'Not added'}
                    </span>
                    <div class="flex items-center space-x-2">
                        ${qty > 0 ? `
                            <button class="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/40 flex items-center justify-center font-bold" onclick="app.removeFromCart('${item.id}')">
                                -
                            </button>
                        ` : ''}
                        <button class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs btn-bounce flex items-center space-x-1" onclick="app.addToCart('${item.id}')">
                            <span>+ Add</span>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    addToCart(itemId) {
        const item = window.GAME_DATA.INGREDIENTS.find(i => i.id === itemId);
        if (!item) return;

        if (this.budget < item.price) {
            window.sound.playError();
            this.showNotification('Not enough budget! You only have ' + this.budget + ' THB remaining.', 'error');
            return;
        }

        this.budget -= item.price;
        const existing = this.cart.find(c => c.id === item.id);
        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({ ...item, qty: 1 });
        }

        window.sound.playCashRegister();
        this.updateBudgetUI();
        this.renderMarketItems();
        this.calculateRealtimeShoppingScore();
    }

    removeFromCart(itemId) {
        const idx = this.cart.findIndex(c => c.id === itemId);
        if (idx === -1) return;

        const item = this.cart[idx];
        this.budget += item.price;
        if (item.qty > 1) {
            item.qty--;
        } else {
            this.cart.splice(idx, 1);
        }

        window.sound.playClick();
        this.updateBudgetUI();
        this.renderMarketItems();
        this.calculateRealtimeShoppingScore();
    }

    calculateRealtimeShoppingScore() {
        const budgetSpent = 150 - this.budget;
        let efficiency = 0;
        if (budgetSpent >= 80 && budgetSpent <= 145) {
            efficiency = 15;
        } else if (budgetSpent < 80 && budgetSpent > 0) {
            efficiency = Math.round((budgetSpent / 80) * 12);
        } else if (budgetSpent <= 150) {
            efficiency = 14;
        }

        const uniqueCategories = new Set(this.cart.map(i => i.category)).size;
        const diversity = Math.min(10, uniqueCategories * 2.5);

        this.scoreBreakdown.shopping = Math.round(efficiency + diversity);
        this.updateGlobalLiveScore();
    }

    updateGlobalLiveScore(customStatus = null, customStage = null) {
        this.liveScore = (this.scoreBreakdown.shopping || 0) +
                         (this.scoreBreakdown.quiz || 0) +
                         (this.scoreBreakdown.cooking || 0) +
                         (this.scoreBreakdown.plating || 0);

        const liveScoreBadge = document.getElementById('playerLiveScoreBadge');
        if (liveScoreBadge) {
            liveScoreBadge.textContent = `${this.liveScore} pts`;
        }

        const stage = customStage || this.currentStage || 'LOBBY';
        let status = customStatus;
        if (!status) {
            if (stage === 'SHOPPING') status = `Shopping (${this.cart.length} in cart)`;
            else if (stage === 'QUIZ') status = `Quiz (${this.quizScore} pts)`;
            else if (stage === 'COOKING') status = `Cooking (${this.cookedItems.length} cooked)`;
            else if (stage === 'PLATING') status = `Plating (${this.platedItems.length} items on plate)`;
            else if (stage === 'SHOWCASE') status = 'Dish Submitted!';
            else status = 'Ready in Lobby';
        }

        // Real-time synchronization with server & Host screen
        if (this.socket && this.socket.connected) {
            this.socket.emit('player_update_progress', {
                status,
                currentStage: stage,
                budgetRemaining: this.budget,
                cart: this.cart,
                quizScore: this.quizScore,
                cookingScore: this.scoreBreakdown.cooking,
                platingScore: this.scoreBreakdown.plating,
                liveScore: this.liveScore
            });
        }
    }

    updateBudgetUI() {
        const budgetDisplay = document.getElementById('budgetAmount');
        const budgetBar = document.getElementById('budgetProgressBar');
        const cartCountDisplay = document.getElementById('cartTotalCount');

        if (budgetDisplay) budgetDisplay.textContent = this.budget + ' THB';
        if (budgetBar) {
            const pct = Math.max(0, (this.budget / 150) * 100);
            budgetBar.style.width = pct + '%';
            if (pct < 20) {
                budgetBar.className = 'h-full bg-red-500 transition-all duration-300';
            } else if (pct < 50) {
                budgetBar.className = 'h-full bg-amber-500 transition-all duration-300';
            } else {
                budgetBar.className = 'h-full bg-emerald-500 transition-all duration-300';
            }
        }

        const totalItems = this.cart.reduce((sum, i) => sum + i.qty, 0);
        if (cartCountDisplay) cartCountDisplay.textContent = totalItems;
    }

    // Advance to Checkout Quiz Modal
    proceedToCheckout() {
        if (this.cart.length === 0) {
            this.showNotification('Your cart is empty! Please select ingredients first.', 'error');
            window.sound.playError();
            return;
        }

        window.sound.playCashRegister();
        this.quizQuestions = window.grammarEngine.generateQuizQuestions(this.cart, 3);
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        
        const modal = document.getElementById('checkoutQuizModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            this.renderQuizQuestion();
        }
    }

    renderQuizQuestion() {
        const q = this.quizQuestions[this.currentQuizIndex];
        if (!q) {
            this.finishQuizAndCook();
            return;
        }

        const qContext = document.getElementById('quizContext');
        const qSentence = document.getElementById('quizSentence');
        const qOptions = document.getElementById('quizOptionsGrid');
        const qProgress = document.getElementById('quizProgressText');

        if (qContext) qContext.textContent = q.context;
        if (qSentence) qSentence.innerHTML = q.sentence.replace('______', '<span class="px-3 py-1 bg-indigo-500/30 border-b-2 border-indigo-400 font-bold text-amber-300">______</span>');
        if (qProgress) qProgress.textContent = `Question ${this.currentQuizIndex + 1} of ${this.quizQuestions.length}`;

        if (qOptions) {
            qOptions.innerHTML = '';
            q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'quiz-option glass-panel p-3 rounded-xl text-left font-semibold text-sm text-white flex items-center justify-between hover:border-indigo-400 transition-all';
                btn.innerHTML = `
                    <span>${opt}</span>
                    <i class="fas fa-chevron-right text-slate-500 text-xs"></i>
                `;
                btn.addEventListener('click', () => this.handleQuizAnswer(opt, q, btn));
                qOptions.appendChild(btn);
            });
        }
    }

    handleQuizAnswer(selected, question, buttonEl) {
        const isCorrect = selected.toLowerCase() === question.answer.toLowerCase();
        
        if (isCorrect) {
            buttonEl.classList.add('correct');
            window.sound.playSuccess();
            this.quizScore += 5; // 5 pts
            this.scoreBreakdown.quiz = this.quizScore;
            this.showNotification('🎉 Correct! ' + question.explanation, 'success');
        } else {
            buttonEl.classList.add('wrong');
            window.sound.playError();
            this.showNotification('❌ Incorrect. ' + question.explanation, 'error');
        }

        this.updateGlobalLiveScore();

        setTimeout(() => {
            this.currentQuizIndex++;
            this.renderQuizQuestion();
        }, 1200);
    }

    finishQuizAndCook() {
        const modal = document.getElementById('checkoutQuizModal');
        if (modal) modal.classList.add('hidden');

        // Prepare inventory
        this.inventory = [];
        this.cart.forEach(item => {
            for (let i = 0; i < item.qty; i++) {
                this.inventory.push({
                    uid: item.id + '_' + Math.random().toString(36).substr(2, 5),
                    ...item,
                    state: 'raw',
                    chopClicks: 0
                });
            }
        });

        this.showScreen('kitchenScreen');
        this.renderKitchen();
        window.sound.playFanfare();
        this.showNotification('🍳 Ready for Cooking! Prepare your ingredients!', 'success');
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('player_update_progress', {
                status: 'Cooking in Kitchen',
                currentStage: 'COOKING',
                quizScore: this.quizScore
            });
        }
    }

    // Kitchen Station Logic
    renderKitchen() {
        this.renderInventoryList();
        this.renderActiveStation();
        this.renderCookedList();
    }

    switchStation(stationName) {
        this.activeStation = stationName;
        document.querySelectorAll('.station-tab').forEach(t => {
            t.classList.remove('bg-indigo-600', 'border-indigo-400');
            if (t.dataset.station === stationName) {
                t.classList.add('bg-indigo-600', 'border-indigo-400');
            }
        });
        window.sound.playClick();
        this.renderActiveStation();
    }

    renderInventoryList() {
        const container = document.getElementById('kitchenInventory');
        if (!container) return;

        container.innerHTML = '';
        const rawOrPrepped = this.inventory.filter(i => i.state !== 'cooked');

        if (rawOrPrepped.length === 0) {
            container.innerHTML = '<div class="text-xs text-slate-500 italic p-3">All ingredients prepped and cooked! Ready for plating.</div>';
            return;
        }

        rawOrPrepped.forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass-panel p-2.5 rounded-xl flex items-center justify-between border border-slate-700/60 hover:border-indigo-400 cursor-pointer';
            card.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="text-2xl">${item.state === 'raw' ? item.rawIcon : (item.choppedIcon || item.rawIcon)}</span>
                    <div>
                        <div class="text-xs font-bold text-white">${item.state === 'raw' ? item.name : (item.choppedName || item.name)}</div>
                        <div class="text-[10px] text-emerald-400 font-semibold">${item.state.toUpperCase()} • READY TO COOK</div>
                    </div>
                </div>
                <button class="px-2.5 py-1 rounded bg-indigo-600/80 hover:bg-indigo-500 text-[10px] font-bold text-white">
                    Select
                </button>
            `;
            card.addEventListener('click', () => {
                this.loadItemToActiveStation(item);
            });
            container.appendChild(card);
        });
    }

    loadItemToActiveStation(item) {
        // UNRESTRICTED COOKING LOGIC:
        // Any ingredient can be processed in any cooking appliance of choice!
        const station = this.activeStation;

        if (station === 'cutting') {
            this.cookingStations.cutting.item = item;
            this.cookingStations.cutting.progress = 0;
            window.sound.playPop();
            this.showNotification(`🔪 Loaded ${item.name} onto Cutting Board`, 'info');
            this.renderActiveStation();
        } else if (station === 'pan') {
            this.cookingStations.pan.item = item;
            this.cookingStations.pan.progress = 0;
            item.panStirs = 0;
            window.sound.playPop();
            this.showNotification(`🍳 Placed ${item.name} in Frying Pan`, 'info');
            this.renderActiveStation();
        } else if (station === 'pot') {
            this.cookingStations.pot.items.push(item);
            window.sound.playPop();
            this.showNotification(`🍲 Added ${item.name} into Soup Pot`, 'info');
            this.renderActiveStation();
        } else if (station === 'steamer') {
            this.cookingStations.steamer.item = item;
            this.cookingStations.steamer.progress = 0;
            window.sound.playPop();
            this.showNotification(`💨 Loaded ${item.name} into Steamer`, 'info');
            this.renderActiveStation();
        } else if (station === 'oven') {
            this.cookingStations.oven.item = item;
            this.cookingStations.oven.progress = 0;
            window.sound.playPop();
            this.showNotification(`♨️ Placed ${item.name} into Oven`, 'info');
            this.renderActiveStation();
        } else if (station === 'mortar') {
            this.cookingStations.mortar.items.push(item);
            window.sound.playPop();
            this.showNotification(`🥣 Put ${item.name} into Mortar & Pestle`, 'info');
            this.renderActiveStation();
        } else if (station === 'grill') {
            this.cookingStations.grill.item = item;
            this.cookingStations.grill.progress = 0;
            item.grillFlips = 0;
            window.sound.playPop();
            this.showNotification(`🔥 Placed ${item.name} on BBQ Grill`, 'info');
            this.renderActiveStation();
        }
    }

    renderActiveStation() {
        const boardArea = document.getElementById('stationInteractiveArea');
        if (!boardArea) return;

        boardArea.innerHTML = '';

        if (this.activeStation === 'cutting') {
            const current = this.cookingStations.cutting.item;
            const card = document.createElement('div');
            card.className = 'w-full h-full flex flex-col items-center justify-center p-6 text-center';
            
            if (current) {
                card.innerHTML = `
                    <div class="cutting-board w-full max-w-md p-8 flex flex-col items-center rounded-3xl cursor-pointer select-none" onclick="app.chopCurrentItem()">
                        <div class="text-7xl mb-4 transform hover:scale-110 transition-transform animate-bounce">
                            ${current.rawIcon || current.choppedIcon || '🔪'}
                        </div>
                        <h3 class="text-xl font-bold text-amber-200 font-fun">${current.name}</h3>
                        <p class="text-xs text-amber-300/80 mt-1 mb-4">Click / Tap Knife to Slice & Dice! (${current.chopClicks || 0}/4)</p>
                        <div class="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-amber-600/50">
                            <div class="bg-amber-400 h-full transition-all duration-150" style="width: ${((current.chopClicks || 0) / 4) * 100}%"></div>
                        </div>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <div class="cutting-board w-full max-w-md p-10 flex flex-col items-center rounded-3xl opacity-80">
                        <div class="text-5xl mb-3 text-amber-300">🔪</div>
                        <h4 class="text-lg font-bold text-amber-200">Cutting Board Ready</h4>
                        <p class="text-xs text-amber-300/60 mt-1">Select ANY ingredient from the pantry to slice or chop!</p>
                    </div>
                `;
            }
            boardArea.appendChild(card);
        } else if (this.activeStation === 'pan') {
            const current = this.cookingStations.pan.item;
            const card = document.createElement('div');
            card.className = 'w-full h-full flex flex-col items-center justify-center p-6 text-center';
            
            card.innerHTML = `
                <div class="frying-pan w-72 h-72 flex flex-col items-center justify-center relative p-6 cursor-pointer select-none ${current ? 'sizzling' : ''}" onclick="app.cookPanItem()">
                    ${current ? `
                        <div class="text-6xl mb-2 animate-pulse">${current.choppedIcon || current.rawIcon}</div>
                        <div class="text-sm font-bold text-amber-300 font-fun">${current.choppedName || current.name}</div>
                        <div class="text-[11px] text-slate-300 mt-1">Click to Sizzle & Stir-Fry! (${current.panStirs || 0}/3)</div>
                        <div class="w-36 bg-black/60 h-2.5 rounded-full mt-3 overflow-hidden border border-slate-600">
                            <div class="bg-amber-500 h-full transition-all" style="width: ${((current.panStirs || 0) / 3) * 100}%"></div>
                        </div>
                    ` : `
                        <div class="text-5xl mb-2 text-slate-400">🍳</div>
                        <div class="text-sm font-bold text-slate-300">Sizzling Wok Pan</div>
                        <div class="text-[11px] text-slate-400 mt-1">Select any ingredient to stir-fry</div>
                    `}
                </div>
            `;
            boardArea.appendChild(card);
        } else if (this.activeStation === 'pot') {
            const items = this.cookingStations.pot.items;
            const card = document.createElement('div');
            card.className = 'w-full h-full flex flex-col items-center justify-center p-6 text-center';
            
            card.innerHTML = `
                <div class="pot-container w-80 p-6 flex flex-col items-center text-center">
                    <div class="text-6xl mb-3 animate-pulse">🍲</div>
                    <h4 class="font-bold text-lg text-white font-fun">Simmering Pot</h4>
                    <p class="text-xs text-slate-300 mt-1 mb-4">
                        ${items.length > 0 ? `${items.length} ingredients bubbling in broth!` : 'Add any ingredients to boil or simmer'}
                    </p>
                    ${items.length > 0 ? `
                        <button class="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold text-sm btn-bounce shadow-lg" onclick="app.finishPotCooking()">
                            ✨ Complete Boiling & Simmer
                        </button>
                    ` : ''}
                </div>
            `;
            boardArea.appendChild(card);
        } else if (this.activeStation === 'steamer') {
            const current = this.cookingStations.steamer.item;
            const card = document.createElement('div');
            card.className = 'w-full h-full flex flex-col items-center justify-center p-6 text-center';
            
            card.innerHTML = `
                <div class="pot-container w-72 p-6 flex flex-col items-center text-center">
                    <div class="text-6xl mb-3 ${current ? 'animate-bounce' : ''}">${current ? (current.rawIcon || '🫕') : '🫕'}</div>
                    <h4 class="font-bold text-lg text-white font-fun">Bamboo Steamer</h4>
                    <p class="text-xs text-slate-300 mt-1 mb-4">
                        ${current ? `Gently steaming ${current.name}...` : 'Place any ingredient to steam over hot water'}
                    </p>
                    ${current ? `
                        <button class="px-6 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-900 font-bold text-sm btn-bounce shadow-lg" onclick="app.finishSteamer()">
                            💨 Lift Lid &amp; Complete Steaming
                        </button>
                    ` : ''}
                </div>
            `;
            boardArea.appendChild(card);
        } else if (this.activeStation === 'oven') {
            const current = this.cookingStations.oven.item;
            const card = document.createElement('div');
            card.className = 'w-full h-full flex flex-col items-center justify-center p-6 text-center';
            
            card.innerHTML = `
                <div class="oven-container w-80 p-6 flex flex-col items-center text-center relative ${current ? 'oven-glow' : ''}">
                    <div class="text-6xl mb-3 ${current ? 'animate-pulse' : ''}">${current ? (current.rawIcon || '♨️') : '♨️'}</div>
                    <h4 class="font-bold text-lg text-amber-300 font-fun">Baking Oven</h4>
                    <p class="text-xs text-slate-300 mt-1 mb-4">
                        ${current ? `Roasting & Baking ${current.name} at 200°C...` : 'Place any ingredient to bake or roast'}
                    </p>
                    ${current ? `
                        <button class="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-bold text-sm btn-bounce shadow-lg shadow-orange-500/30" onclick="app.finishOvenBake()">
                            🔔 Ding! Finish Baking
                        </button>
                    ` : ''}
                </div>
            `;
            boardArea.appendChild(card);
        } else if (this.activeStation === 'mortar') {
            const items = this.cookingStations.mortar.items;
            const card = document.createElement('div');
            card.className = 'w-full h-full flex flex-col items-center justify-center p-6 text-center';
            
            card.innerHTML = `
                <div class="mortar-container w-72 h-72 flex flex-col items-center justify-center relative p-6 cursor-pointer select-none" onclick="app.poundMortarItems()">
                    <div class="text-6xl mb-2 animate-bounce">🥣</div>
                    <h4 class="font-bold text-base text-amber-200 font-fun">Mortar & Pestle</h4>
                    <p class="text-[11px] text-slate-300 mt-1">
                        ${items.length > 0 ? `${items.length} items loaded! Tap to pound!` : 'Add any ingredients to crush & pound'}
                    </p>
                    ${items.length > 0 ? `
                        <button class="mt-3 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs btn-bounce shadow-md" onclick="event.stopPropagation(); app.finishMortar()">
                            ✨ Collect Ground Paste
                        </button>
                    ` : ''}
                </div>
            `;
            boardArea.appendChild(card);
        } else if (this.activeStation === 'grill') {
            const current = this.cookingStations.grill.item;
            const card = document.createElement('div');
            card.className = 'w-full h-full flex flex-col items-center justify-center p-6 text-center';
            
            card.innerHTML = `
                <div class="grill-container w-80 h-72 flex flex-col items-center justify-center relative p-6 cursor-pointer select-none ${current ? 'grill-flames' : ''}" onclick="app.flipGrillItem()">
                    ${current ? `
                        <div class="text-6xl mb-2 animate-pulse">${current.rawIcon || current.choppedIcon || '🔥'}</div>
                        <div class="text-sm font-bold text-rose-300 font-fun">${current.name}</div>
                        <div class="text-[11px] text-slate-200 mt-1">Click to Flip on Hot Coals! (${current.grillFlips || 0}/3)</div>
                        <div class="w-36 bg-black/60 h-2.5 rounded-full mt-3 overflow-hidden border border-red-500/50">
                            <div class="bg-gradient-to-r from-orange-500 to-rose-500 h-full transition-all" style="width: ${((current.grillFlips || 0) / 3) * 100}%"></div>
                        </div>
                    ` : `
                        <div class="text-5xl mb-2 text-rose-400">🔥</div>
                        <div class="text-sm font-bold text-rose-200">BBQ Charcoal Grill</div>
                        <div class="text-[11px] text-slate-400 mt-1">Place any ingredient on BBQ rack to char & grill</div>
                    `}
                </div>
            `;
            boardArea.appendChild(card);
        }
    }

    chopCurrentItem() {
        const current = this.cookingStations.cutting.item;
        if (!current) return;

        current.chopClicks = (current.chopClicks || 0) + 1;
        window.sound.playChop();

        if (current.chopClicks >= 4) {
            current.state = 'chopped';
            const name = current.choppedName || `Chopped ${current.name}`;
            this.showNotification(`✨ Sliced & Chopped: ${name}!`, 'success');
            window.sound.playSuccess();
            this.cookingStations.cutting.item = null;
            this.scoreBreakdown.cooking = Math.min(20, this.scoreBreakdown.cooking + 4);
            this.updateGlobalLiveScore();
            this.renderInventoryList();
        }

        this.renderActiveStation();
    }

    cookPanItem() {
        const current = this.cookingStations.pan.item;
        if (!current) return;

        current.panStirs = (current.panStirs || 0) + 1;
        window.sound.playSizzle();

        if (current.panStirs >= 3) {
            current.state = 'cooked';
            const cookedName = current.cookedName || `Sautéed ${current.name}`;
            const cookedIcon = current.cookedIcon || current.choppedIcon || current.rawIcon || '🍳';
            this.cookedItems.push({
                uid: current.uid,
                name: cookedName,
                icon: cookedIcon,
                cookingTool: 'pan',
                original: current
            });
            this.cookingStations.pan.item = null;
            this.scoreBreakdown.cooking = Math.min(20, this.scoreBreakdown.cooking + 5);
            this.updateGlobalLiveScore();
            window.sound.playSuccess();
            this.showNotification(`🔥 Sautéed: ${cookedName}!`, 'success');
            this.renderInventoryList();
            this.renderCookedList();
        }

        this.renderActiveStation();
    }

    finishSteamer() {
        const current = this.cookingStations.steamer.item;
        if (!current) return;

        current.state = 'cooked';
        const cookedName = current.cookedName || `Steamed ${current.name}`;
        const cookedIcon = current.cookedIcon || current.choppedIcon || current.rawIcon || '🫕';
        this.cookedItems.push({
            uid: current.uid,
            name: cookedName,
            icon: cookedIcon,
            cookingTool: 'steamer',
            original: current
        });
        this.cookingStations.steamer.item = null;
        this.scoreBreakdown.cooking = Math.min(20, this.scoreBreakdown.cooking + 5);
        this.updateGlobalLiveScore();
        window.sound.playSuccess();
        this.showNotification(`💨 ${cookedName} is perfectly steamed!`, 'success');
        this.renderInventoryList();
        this.renderCookedList();
        this.renderActiveStation();
    }

    finishPotCooking() {
        const items = this.cookingStations.pot.items;
        if (items.length === 0) return;

        items.forEach(it => {
            it.state = 'cooked';
            this.cookedItems.push({
                uid: it.uid,
                name: `Simmered ${it.name}`,
                icon: it.cookedIcon || '🍲',
                cookingTool: 'pot',
                original: it
            });
        });

        this.cookingStations.pot.items = [];
        this.scoreBreakdown.cooking = Math.min(20, this.scoreBreakdown.cooking + 5);
        this.updateGlobalLiveScore();
        window.sound.playSuccess();
        this.showNotification('🍲 Savory Simmered Ingredients are ready!', 'success');
        this.renderInventoryList();
        this.renderCookedList();
        this.renderActiveStation();
    }

    finishOvenBake() {
        const current = this.cookingStations.oven.item;
        if (!current) return;

        current.state = 'cooked';
        const bakedName = `Golden Baked ${current.name}`;
        const bakedIcon = '♨️';
        this.cookedItems.push({
            uid: current.uid,
            name: bakedName,
            icon: bakedIcon,
            cookingTool: 'oven',
            original: current
        });
        this.cookingStations.oven.item = null;
        this.scoreBreakdown.cooking = Math.min(20, this.scoreBreakdown.cooking + 5);
        this.updateGlobalLiveScore();
        if (window.sound.playDing) window.sound.playDing();
        else window.sound.playSuccess();
        this.showNotification(`♨️ ${bakedName} roasted to perfection!`, 'success');
        this.renderInventoryList();
        this.renderCookedList();
        this.renderActiveStation();
    }

    poundMortarItems() {
        if (this.cookingStations.mortar.items.length === 0) return;
        if (window.sound.playPound) window.sound.playPound();
        else window.sound.playChop();
        this.showNotification('🔨 Pounding & Crushing aromatics...', 'info');
    }

    finishMortar() {
        const items = this.cookingStations.mortar.items;
        if (items.length === 0) return;

        items.forEach(it => {
            it.state = 'cooked';
            this.cookedItems.push({
                uid: it.uid,
                name: `Pounded ${it.name}`,
                icon: '🥣',
                cookingTool: 'mortar',
                original: it
            });
        });

        this.cookingStations.mortar.items = [];
        this.scoreBreakdown.cooking = Math.min(20, this.scoreBreakdown.cooking + 5);
        this.updateGlobalLiveScore();
        window.sound.playSuccess();
        this.showNotification('🥣 Ground aromatic paste is ready!', 'success');
        this.renderInventoryList();
        this.renderCookedList();
        this.renderActiveStation();
    }

    flipGrillItem() {
        const current = this.cookingStations.grill.item;
        if (!current) return;

        current.grillFlips = (current.grillFlips || 0) + 1;
        window.sound.playSizzle();

        if (current.grillFlips >= 3) {
            current.state = 'cooked';
            const grilledName = `Char-Grilled BBQ ${current.name}`;
            const grilledIcon = '🔥';
            this.cookedItems.push({
                uid: current.uid,
                name: grilledName,
                icon: grilledIcon,
                cookingTool: 'grill',
                original: current
            });
            this.cookingStations.grill.item = null;
            this.scoreBreakdown.cooking = Math.min(20, this.scoreBreakdown.cooking + 5);
            this.updateGlobalLiveScore();
            window.sound.playSuccess();
            this.showNotification(`🔥 ${grilledName} charred with smoky goodness!`, 'success');
            this.renderInventoryList();
            this.renderCookedList();
        }

        this.renderActiveStation();
    }

    renderCookedList() {
        const container = document.getElementById('cookedReadyList');
        if (!container) return;

        container.innerHTML = '';
        if (this.cookedItems.length === 0) {
            container.innerHTML = '<div class="text-xs text-slate-500 italic p-2">Cook ingredients to see them ready here.</div>';
            return;
        }

        this.cookedItems.forEach(item => {
            const badge = document.createElement('div');
            badge.className = 'glass-pill px-3 py-1.5 flex items-center space-x-2 border border-emerald-500/50 bg-emerald-500/10 text-emerald-300 text-xs font-bold';
            badge.innerHTML = `
                <span>${item.icon}</span>
                <span>${item.name}</span>
            `;
            container.appendChild(badge);
        });
    }

    // Advance to Plating & Naming Phase
    proceedToPlating() {
        if (this.cookedItems.length === 0) {
            this.showNotification('Please cook at least one ingredient first!', 'error');
            window.sound.playError();
            return;
        }

        window.sound.playFanfare();
        this.showScreen('platingScreen');
        this.renderPlatingStudio();
        
        if (this.socket && this.socket.connected) {
            this.socket.emit('player_update_progress', {
                status: 'Plating & Naming Dish',
                currentStage: 'PLATING'
            });
        }
    }

    renderPlatingStudio() {
        this.renderPlateTypes();
        this.renderPlatingIngredientsPool();
        this.renderGarnishesPool();
        this.updatePlateCanvas();
    }

    renderPlateTypes() {
        const container = document.getElementById('plateTypeSelector');
        if (!container) return;

        container.innerHTML = '';
        window.GAME_DATA.PLATES.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${this.selectedPlate === p.id ? 'bg-indigo-600 border-indigo-400 text-white' : 'glass-panel border-slate-700 text-slate-300'}`;
            btn.textContent = p.name;
            btn.addEventListener('click', () => {
                this.selectedPlate = p.id;
                this.renderPlateTypes();
                this.updatePlateCanvas();
                window.sound.playClick();
            });
            container.appendChild(btn);
        });
    }

    renderPlatingIngredientsPool() {
        const pool = document.getElementById('platingIngredientsPool');
        if (!pool) return;

        pool.innerHTML = '';
        this.cookedItems.forEach(item => {
            const btn = document.createElement('button');
            btn.className = 'glass-panel p-2 rounded-xl flex items-center space-x-2 text-xs font-bold text-white hover:border-indigo-400';
            btn.innerHTML = `
                <span class="text-2xl">${item.icon}</span>
                <span>${item.name}</span>
            `;
            btn.addEventListener('click', () => {
                this.addItemToPlate(item, false);
            });
            pool.appendChild(btn);
        });
    }

    renderGarnishesPool() {
        const pool = document.getElementById('garnishesPool');
        if (!pool) return;

        pool.innerHTML = '';
        window.GAME_DATA.GARNISHES.forEach(garnish => {
            const btn = document.createElement('button');
            btn.className = 'glass-panel p-2 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-300 hover:border-emerald-400';
            btn.innerHTML = `
                <span class="text-2xl">${garnish.icon}</span>
                <span>${garnish.name}</span>
            `;
            btn.addEventListener('click', () => {
                this.addItemToPlate(garnish, true);
            });
            pool.appendChild(btn);
        });
    }

    addItemToPlate(item, isGarnish = false) {
        const randX = 35 + Math.random() * 30; // % inside plate
        const randY = 35 + Math.random() * 30;
        const randRot = Math.floor(Math.random() * 40 - 20);

        const newItem = {
            uid: 'plate_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            name: item.name,
            icon: item.icon,
            x: randX,
            y: randY,
            scale: 1.0,
            rotation: randRot,
            isGarnish
        };

        this.platedItems.push(newItem);
        this.selectedItemUid = newItem.uid;
        this.updateItemControlSliders(newItem);
        window.sound.playPop();
        this.updatePlateCanvas();
    }

    selectPlatedItem(uid) {
        this.selectedItemUid = uid;
        const item = this.platedItems.find(i => i.uid === uid);
        if (item) {
            this.updateItemControlSliders(item);
        }
        this.updatePlateCanvas();
    }

    updateItemControlSliders(item) {
        const scaleSlider = document.getElementById('itemScaleSlider');
        const scaleValue = document.getElementById('scaleValueDisplay');
        const rotSlider = document.getElementById('itemRotationSlider');
        const rotValue = document.getElementById('rotValueDisplay');

        if (scaleSlider) scaleSlider.value = item.scale || 1.0;
        if (scaleValue) scaleValue.textContent = `${Math.round((item.scale || 1.0) * 100)}%`;
        if (rotSlider) rotSlider.value = item.rotation || 0;
        if (rotValue) rotValue.textContent = `${item.rotation || 0}°`;
    }

    updateSelectedItemProperty(prop, val) {
        if (!this.selectedItemUid) return;
        const item = this.platedItems.find(i => i.uid === this.selectedItemUid);
        if (item) {
            item[prop] = val;
            this.updatePlateCanvas();

            const scaleValue = document.getElementById('scaleValueDisplay');
            const rotValue = document.getElementById('rotValueDisplay');
            if (prop === 'scale' && scaleValue) scaleValue.textContent = `${Math.round(val * 100)}%`;
            if (prop === 'rotation' && rotValue) rotValue.textContent = `${val}°`;
        }
    }

    zoomSelectedItem(delta) {
        if (!this.selectedItemUid) return;
        const item = this.platedItems.find(i => i.uid === this.selectedItemUid);
        if (item) {
            item.scale = Math.max(0.5, Math.min(2.5, (item.scale || 1.0) + delta));
            this.updateItemControlSliders(item);
            this.updatePlateCanvas();
        }
    }

    rotateSelectedItem(deltaDeg) {
        if (!this.selectedItemUid) return;
        const item = this.platedItems.find(i => i.uid === this.selectedItemUid);
        if (item) {
            item.rotation = ((item.rotation || 0) + deltaDeg) % 360;
            this.updateItemControlSliders(item);
            this.updatePlateCanvas();
        }
    }

    removeSelectedItem() {
        if (!this.selectedItemUid) return;
        const idx = this.platedItems.findIndex(i => i.uid === this.selectedItemUid);
        if (idx !== -1) {
            this.platedItems.splice(idx, 1);
            this.selectedItemUid = this.platedItems.length > 0 ? this.platedItems[this.platedItems.length - 1].uid : null;
            window.sound.playPop();
            this.updatePlateCanvas();
        }
    }

    updatePlateCanvas() {
        const canvas = document.getElementById('plateCanvas');
        if (!canvas) return;

        canvas.className = `plate-base plate-${this.selectedPlate} flex items-center justify-center relative overflow-hidden`;
        canvas.innerHTML = '';

        this.platedItems.forEach((it) => {
            const isSelected = it.uid === this.selectedItemUid;
            const el = document.createElement('div');
            el.className = `plated-food-item text-4xl select-none transition-transform ${isSelected ? 'ring-2 ring-indigo-400 p-1 rounded-xl bg-indigo-500/20' : ''}`;
            el.style.left = `${it.x}%`;
            el.style.top = `${it.y}%`;
            el.style.transform = `translate(-50%, -50%) rotate(${it.rotation}deg) scale(${it.scale || 1.0})`;
            el.textContent = it.icon;
            el.title = `${it.name} (Click & Drag to position)`;

            // Drag handling
            this.makeElementDraggable(el, it, canvas);

            // Select on click
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectPlatedItem(it.uid);
            });

            canvas.appendChild(el);
        });
    }

    makeElementDraggable(el, itemData, parentCanvas) {
        let isDragging = false;
        let startX, startY;

        const onStart = (clientX, clientY) => {
            isDragging = true;
            this.selectPlatedItem(itemData.uid);
            const rect = parentCanvas.getBoundingClientRect();
            startX = clientX - (itemData.x / 100 * rect.width);
            startY = clientY - (itemData.y / 100 * rect.height);
        };

        const onMove = (clientX, clientY) => {
            if (!isDragging) return;
            const rect = parentCanvas.getBoundingClientRect();
            let newX = ((clientX - startX) / rect.width) * 100;
            let newY = ((clientY - startY) / rect.height) * 100;

            // Constrain inside plate circle (15% to 85%)
            itemData.x = Math.max(15, Math.min(85, newX));
            itemData.y = Math.max(15, Math.min(85, newY));

            el.style.left = `${itemData.x}%`;
            el.style.top = `${itemData.y}%`;
        };

        const onEnd = () => {
            isDragging = false;
        };

        // Mouse events
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            onStart(e.clientX, e.clientY);
            const onMouseMove = (ev) => onMove(ev.clientX, ev.clientY);
            const onMouseUp = () => {
                onEnd();
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
            };
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // Touch events
        el.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                onStart(touch.clientX, touch.clientY);
            }
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length === 1) {
                const touch = e.touches[0];
                onMove(touch.clientX, touch.clientY);
            }
        }, { passive: true });

        el.addEventListener('touchend', onEnd);
    }

    checkGrammarLive(text) {
        const result = window.grammarEngine.analyzeDescription(text);
        const feedbackContainer = document.getElementById('grammarFeedbackBox');
        if (!feedbackContainer) return;

        feedbackContainer.innerHTML = '';
        result.hints.forEach(hint => {
            const div = document.createElement('div');
            div.className = `text-xs p-2 rounded-lg ${result.valid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`;
            div.textContent = hint;
            feedbackContainer.appendChild(div);
        });

        // Update live plating & grammar preview score
        const creativityScore = Math.min(20, Math.max(10, this.platedItems.length * 4));
        this.scoreBreakdown.plating = (result.score || 0) + creativityScore;
        this.updateGlobalLiveScore();
    }

    // Submit Final Dish
    submitFinalDish() {
        const titleInput = document.getElementById('dishTitleInput');
        this.dishTitle = titleInput ? titleInput.value.trim() : 'Chef Special';
        
        if (!this.dishTitle) {
            this.showNotification('Please give your dish a creative title!', 'error');
            window.sound.playError();
            return;
        }

        if (!this.dishDescription || this.dishDescription.trim().length < 5) {
            this.showNotification('Please describe your dish using "There is" and "There are"!', 'error');
            window.sound.playError();
            return;
        }

        const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
        const budgetSpent = 150 - this.budget;

        const dishData = {
            dishTitle: this.dishTitle,
            description: this.dishDescription,
            platingItems: this.platedItems,
            plateType: this.selectedPlate,
            budgetSpent,
            timeSpent,
            quizScore: this.quizScore
        };

        if (this.socket && this.socket.connected) {
            this.socket.emit('player_submit_dish', dishData, (res) => {
                if (res && res.success) {
                    this.showEvaluationScreen(res.evaluation, res.dish);
                }
            });
        } else {
            const evaluation = this.calculateLocalEvaluation(dishData);
            this.showEvaluationScreen(evaluation, {
                ...dishData,
                playerName: this.player ? this.player.name : 'Master Chef',
                playerAvatar: this.player ? this.player.avatar : 'panda'
            });
        }
    }

    calculateLocalEvaluation(data) {
        let budgetScore = this.scoreBreakdown.shopping || 20;
        let timeScore = 25;
        const grammarRes = window.grammarEngine.analyzeDescription(data.description);
        const grammarTotal = Math.min(30, (this.quizScore || 10) + (grammarRes.score || 10));
        const creativityScore = Math.min(20, Math.max(10, data.platingItems.length * 4));

        const totalScore = budgetScore + timeScore + grammarTotal + creativityScore;
        let grade = 'S - Master Chef';
        if (totalScore < 80) grade = 'A - Executive Chef';

        return {
            breakdown: {
                budgetEfficiency: budgetScore,
                timeManagement: timeScore,
                grammarAccuracy: grammarTotal,
                creativity: creativityScore
            },
            totalScore,
            grade
        };
    }

    showEvaluationScreen(evaluation, dish) {
        window.sound.playFanfare();
        this.showScreen('evaluationScreen');

        const scoreVal = document.getElementById('finalTotalScore');
        const gradeVal = document.getElementById('finalGradeBadge');
        const breakdownList = document.getElementById('scoreBreakdownList');
        const dishSummary = document.getElementById('finalDishSummary');

        if (scoreVal) scoreVal.textContent = evaluation.totalScore;
        if (gradeVal) gradeVal.textContent = evaluation.grade;

        if (breakdownList) {
            const b = evaluation.breakdown;
            breakdownList.innerHTML = `
                <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                    <span class="text-slate-300 text-sm">💰 Budget Efficiency</span>
                    <span class="font-bold text-amber-400">${b.budgetEfficiency} / 25 pts</span>
                </div>
                <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                    <span class="text-slate-300 text-sm">⏱️ Time Management</span>
                    <span class="font-bold text-blue-400">${b.timeManagement} / 25 pts</span>
                </div>
                <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                    <span class="text-slate-300 text-sm">📖 Grammar Accuracy ("There is/are")</span>
                    <span class="font-bold text-emerald-400">${b.grammarAccuracy} / 30 pts</span>
                </div>
                <div class="glass-panel p-3 rounded-xl flex justify-between items-center">
                    <span class="text-slate-300 text-sm">🎨 Plating & Creativity</span>
                    <span class="font-bold text-purple-400">${b.creativity} / 20 pts</span>
                </div>
            `;
        }

        if (dishSummary) {
            dishSummary.innerHTML = `
                <div class="font-bold text-lg text-white font-fun">${dish.dishTitle}</div>
                <div class="text-xs text-slate-300 italic mt-1">"${dish.description}"</div>
            `;
        }

        this.launchConfetti();
    }

    launchConfetti() {
        const canvas = document.getElementById('confettiCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

        for (let i = 0; i < 120; i++) {
            particles.push({
                x: canvas.width / 2,
                y: canvas.height / 2,
                vx: (Math.random() - 0.5) * 16,
                vy: (Math.random() - 0.8) * 16,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 10
            });
        }

        let frame = 0;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35;
                p.rotation += p.vRot;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });

            frame++;
            if (frame < 180) {
                requestAnimationFrame(animate);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        animate();
    }

    showScreen(screenId) {
        document.querySelectorAll('.game-screen').forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(screenId);
        if (target) target.classList.remove('hidden');
    }

    syncStage(stage) {
        if (stage === 'SHOPPING') this.startShoppingPhase();
        else if (stage === 'COOKING') this.finishQuizAndCook();
        else if (stage === 'PLATING') this.proceedToPlating();
    }

    showNotification(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl glass-panel text-sm font-bold shadow-2xl flex items-center space-x-3 animate-bounce ${type === 'error' ? 'border-red-500 text-red-200' : type === 'success' ? 'border-emerald-500 text-emerald-200' : 'border-indigo-500 text-indigo-200'}`;
        toast.innerHTML = `
            <span>${type === 'error' ? '⚠️' : type === 'success' ? '✨' : 'ℹ️'}</span>
            <span>${msg}</span>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }
}

window.app = new TungTungApp();
