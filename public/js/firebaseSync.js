/**
 * TungTung Restaurant - Firebase Realtime Database Synchronization Engine
 * Strictly follows:
 *   rooms/{roomPIN}/status -> "lobby" | "playing" | "ended"
 *   rooms/{roomPIN}/players/{playerId} -> { name, avatar, teamId, score }
 */

const FIREBASE_CONFIG = {
    projectId: "tung-tung-functyion67-24246",
    appId: "1:638463719942:web:9f20952341a07d77886187",
    databaseURL: "https://tung-tung-functyion67-24246-default-rtdb.asia-southeast1.firebasedatabase.app",
    storageBucket: "tung-tung-functyion67-24246.firebasestorage.app",
    apiKey: "AIzaSyAmSltJ1Xoe2tUNLjpk4vKsJOAIGKu-cRQ",
    authDomain: "tung-tung-functyion67-24246.firebaseapp.com",
    messagingSenderId: "638463719942"
};

class FirebaseSyncEngine {
    constructor() {
        this.app = null;
        this.db = null;
        this.isInitialized = false;
        this.init();
    }

    init() {
        if (typeof firebase !== 'undefined') {
            try {
                if (!firebase.apps.length) {
                    this.app = firebase.initializeApp(FIREBASE_CONFIG);
                } else {
                    this.app = firebase.app();
                }
                this.db = firebase.database();
                this.isInitialized = true;
                console.log('🔥 [FirebaseSync] Connected to Firebase Realtime Database');
            } catch (err) {
                console.error('⚠️ [FirebaseSync] Init error:', err);
            }
        } else {
            setTimeout(() => this.init(), 300);
        }
    }

    /**
     * Host: Initialize or retrieve active room with 4-digit PIN
     */
    initHostRoom(pin, callbacks = {}) {
        if (!this.db) {
            setTimeout(() => this.initHostRoom(pin, callbacks), 300);
            return null;
        }

        const roomRef = this.db.ref(`rooms/${pin}`);

        // Set or update room status to "lobby"
        roomRef.update({
            status: 'lobby',
            stage: 'LOBBY',
            pin: pin,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastActive: firebase.database.ServerValue.TIMESTAMP
        });

        // 3. Kahoot-Style Instant Sync: onValue() continuous listener on rooms/{pin}/players
        const playersRef = roomRef.child('players');
        playersRef.on('value', (snapshot) => {
            const data = snapshot.val() || {};
            const playerList = Object.entries(data).map(([id, p]) => ({
                id,
                ...p
            }));
            console.log(`🔥 [Host onValue Sync] ${playerList.length} player(s) in room ${pin}:`, playerList);
            if (callbacks.onPlayersUpdate) {
                callbacks.onPlayersUpdate(playerList);
            }
        });

        // Continuous listener for dish showcases
        const dishesRef = roomRef.child('dishes');
        dishesRef.on('value', (snapshot) => {
            const data = snapshot.val() || {};
            const dishList = Object.values(data);
            if (callbacks.onDishesUpdate) {
                callbacks.onDishesUpdate(dishList);
            }
        });

        return {
            roomRef,
            setPlaying: () => {
                roomRef.update({ status: 'playing', stage: 'SHOPPING', startedAt: firebase.database.ServerValue.TIMESTAMP });
            },
            setStage: (stage) => {
                roomRef.update({ stage: stage, status: stage === 'PODIUM' ? 'ended' : 'playing' });
            },
            broadcast: (message) => {
                roomRef.child('broadcast').set({ message, timestamp: firebase.database.ServerValue.TIMESTAMP });
            },
            endGame: () => {
                roomRef.update({ status: 'ended' });
            }
        };
    }

    /**
     * Player: Validate room existence and join with { name, avatar, teamId, score }
     */
    async joinPlayerRoom(pin, playerObj, callbacks = {}) {
        if (!this.db) {
            console.warn('⚠️ [FirebaseSync] DB not initialized for player join, retrying...');
            await new Promise(r => setTimeout(r, 400));
            return this.joinPlayerRoom(pin, playerObj, callbacks);
        }

        const roomRef = this.db.ref(`rooms/${pin}`);

        // 1. Check if rooms/{roomPIN} exists in Firebase
        const snapshot = await roomRef.once('value');
        const roomData = snapshot.val();

        if (!roomData) {
            console.warn(`⚠️ Room ${pin} not found in Firebase`);
            if (callbacks.onError) callbacks.onError('Room PIN not found! Please check the Host projector screen.');
            return null;
        }

        if (roomData.status === 'ended') {
            if (callbacks.onError) callbacks.onError('This game session has ended.');
            return null;
        }

        // 2. Push player data to rooms/{roomPIN}/players/{playerId}
        const playerRef = roomRef.child(`players/${playerObj.id}`);
        await playerRef.set({
            name: playerObj.name,
            avatar: playerObj.avatar,
            teamId: playerObj.teamId || 'team-alpha',
            team: playerObj.team || 'Team Alpha',
            score: playerObj.score || 0,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        });

        console.log(`🔥 [Player Join Success] ${playerObj.name} joined room ${pin}`);

        // 3. Listen to status & stage changes in real-time
        roomRef.on('value', (snap) => {
            const currentRoom = snap.val();
            if (!currentRoom) return;

            if (currentRoom.status === 'playing' || currentRoom.stage) {
                if (callbacks.onStageChange) {
                    callbacks.onStageChange(currentRoom.stage || 'SHOPPING');
                }
            }
            if (currentRoom.status === 'ended') {
                if (callbacks.onGameEnded) {
                    callbacks.onGameEnded();
                }
            }
        });

        // Listen for teacher broadcasts
        roomRef.child('broadcast').on('value', (snap) => {
            const b = snap.val();
            if (b && b.message && callbacks.onBroadcast) {
                callbacks.onBroadcast(b.message);
            }
        });

        return {
            playerRef,
            roomRef,
            updateScore: (score, breakdown) => {
                playerRef.update({
                    score: score,
                    scoreBreakdown: breakdown || null
                });
            },
            submitDish: (dishData) => {
                roomRef.child(`dishes/${playerObj.id}`).set({
                    ...dishData,
                    playerId: playerObj.id,
                    playerName: playerObj.name,
                    avatar: playerObj.avatar,
                    team: playerObj.team || playerObj.teamId,
                    submittedAt: firebase.database.ServerValue.TIMESTAMP
                });
            }
        };
    }
}

// Attach globally
window.firebaseSync = new FirebaseSyncEngine();
