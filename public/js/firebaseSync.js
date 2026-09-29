/**
 * TungTung Restaurant - Firebase Realtime Database Synchronization Engine
 * Handles cross-device real-time sync between Host Dashboard and Mobile Players
 * Project: tung-tung-functyion67-24246
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
                console.log('🔥 [FirebaseSync] Realtime Database initialized successfully:', FIREBASE_CONFIG.databaseURL);
            } catch (err) {
                console.error('⚠️ [FirebaseSync] Initialization error:', err);
            }
        } else {
            console.warn('⚠️ [FirebaseSync] Firebase SDK not loaded in window. Retrying in 500ms...');
            setTimeout(() => this.init(), 500);
        }
    }

    /**
     * Host: Initialize or register active room with 6-digit PIN
     */
    initHostRoom(pin, callbacks = {}) {
        if (!this.db) {
            console.warn('⚠️ [FirebaseSync] DB not ready yet for initHostRoom, queuing...');
            setTimeout(() => this.initHostRoom(pin, callbacks), 500);
            return null;
        }

        const roomRef = this.db.ref(`rooms/${pin}`);
        
        // Write initial room metadata
        roomRef.update({
            pin: pin,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            stage: 'LOBBY',
            status: 'waiting',
            overallProgress: 5,
            lastActive: firebase.database.ServerValue.TIMESTAMP
        });

        // Listen for Real-Time Player joins & updates
        const playersRef = roomRef.child('players');
        playersRef.on('value', (snapshot) => {
            const data = snapshot.val() || {};
            const playerList = Array.isArray(data) ? data : Object.values(data);
            console.log(`🔥 [FirebaseSync Host] Live Players Updated (${playerList.length}):`, playerList);
            if (callbacks.onPlayersUpdate) {
                callbacks.onPlayersUpdate(playerList);
            }
        });

        // Listen for Real-Time Dish Showcase Submissions
        const dishesRef = roomRef.child('dishes');
        dishesRef.on('value', (snapshot) => {
            const data = snapshot.val() || {};
            const dishList = Array.isArray(data) ? data : Object.values(data);
            console.log(`🔥 [FirebaseSync Host] Live Dishes Updated (${dishList.length}):`, dishList);
            if (callbacks.onDishesUpdate) {
                callbacks.onDishesUpdate(dishList);
            }
        });

        return {
            roomRef,
            updateStage: (stage) => {
                roomRef.update({ stage: stage, status: 'in_game', stageChangedAt: firebase.database.ServerValue.TIMESTAMP });
            },
            broadcast: (message) => {
                roomRef.child('broadcast').set({ message, timestamp: firebase.database.ServerValue.TIMESTAMP });
            },
            updateProgress: (progress) => {
                roomRef.update({ overallProgress: progress });
            }
        };
    }

    /**
     * Player: Register student player in active room
     */
    joinPlayerRoom(pin, playerObj, callbacks = {}) {
        if (!this.db) {
            console.warn('⚠️ [FirebaseSync] DB not ready yet for joinPlayerRoom, queuing...');
            setTimeout(() => this.joinPlayerRoom(pin, playerObj, callbacks), 500);
            return null;
        }

        const roomRef = this.db.ref(`rooms/${pin}`);
        const playerRef = roomRef.child(`players/${playerObj.id}`);

        // Write player directly to active room PIN node
        playerRef.set({
            ...playerObj,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            console.log(`🔥 [FirebaseSync Player] Successfully joined room ${pin} as ${playerObj.name}`);
        }).catch((err) => {
            console.error('⚠️ [FirebaseSync Player] Join error:', err);
        });

        // Auto remove or mark offline on disconnect
        playerRef.onDisconnect().remove();

        // Listen for stage changes from Host (LOBBY -> SHOPPING -> QUIZ -> COOKING -> PLATING -> RESULTS)
        roomRef.child('stage').on('value', (snapshot) => {
            const stage = snapshot.val();
            if (stage && callbacks.onStageChange) {
                console.log(`🔥 [FirebaseSync Player] Room stage changed to: ${stage}`);
                callbacks.onStageChange(stage);
            }
        });

        // Listen for teacher broadcasts
        roomRef.child('broadcast').on('value', (snapshot) => {
            const broadcast = snapshot.val();
            if (broadcast && callbacks.onBroadcast) {
                callbacks.onBroadcast(broadcast.message);
            }
        });

        return {
            playerRef,
            roomRef,
            updateScore: (score, scoreBreakdown) => {
                playerRef.update({
                    score: score,
                    scoreBreakdown: scoreBreakdown,
                    lastSeen: firebase.database.ServerValue.TIMESTAMP
                });
            },
            submitDish: (dishData) => {
                roomRef.child(`dishes/${playerObj.id}`).set({
                    ...dishData,
                    playerId: playerObj.id,
                    playerName: playerObj.name,
                    avatar: playerObj.avatar,
                    team: playerObj.team || playerObj.teamName,
                    submittedAt: firebase.database.ServerValue.TIMESTAMP
                });
            }
        };
    }
}

// Global instance attached to window
window.firebaseSync = new FirebaseSyncEngine();
