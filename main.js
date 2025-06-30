import { World } from './world.js';

document.addEventListener('DOMContentLoaded', () => {
    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyB-F4x3YXyGv_awn72H3cDMXmL4_lrrXKY",
        authDomain: "koreh-9048b.firebaseapp.com",
        databaseURL: "https://koreh-9048b-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "koreh-9048b",
        storageBucket: "koreh-9048b.appspot.com",
        messagingSenderId: "568351512590",
        appId: "1:568351512590:web:0d81edf8edb6831f24445f"
    };

    if (firebaseConfig.apiKey.includes("YOUR")) {
        document.body.innerHTML = '<h1>Error: Configura tus credenciales de Firebase en main.js</h1>';
        return;
    }

    // Initialize Firebase and Database
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // Application State Variables
    let username = '', userId = '', currentRoomId = null, currentAvatar = 'ronin';
    let peerConnections = {}, dataChannels = {}, firebaseListeners = {};
    let roomUserRef = null; // Reference to the user's data in the current room
    let persistentUserRef = null; // Reference to the user's persistent data
    let world = null;

    // DOM Elements
    const loginView = document.getElementById('login-view');
    const mainContainer = document.querySelector('.container');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');
    const loginError = document.getElementById('login-error');
    const roomNameEl = document.getElementById('room-name');
    const usersInRoomList = document.getElementById('users-in-room');
    const userListToggle = document.getElementById('user-list-toggle');
    const leaveRoomButton = document.getElementById('leave-room-button');
    const threejsContainer = document.getElementById('threejs-container');
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const avatarButton = document.getElementById('avatar-button');
    const avatarModal = document.getElementById('avatar-modal');
    const avatarOptions = document.getElementById('avatar-options');
    const modalCloseButton = document.querySelector('.modal-close-button');

    // WebRTC Configuration
    const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    
    // --- Event Listeners ---
    loginButton.addEventListener('click', handleLogin);
    leaveRoomButton.addEventListener('click', logout);
    zoomInButton.addEventListener('click', () => world?.zoomIn());
    zoomOutButton.addEventListener('click', () => world?.zoomOut());
    avatarButton.addEventListener('click', () => avatarModal.style.display = 'flex');
    modalCloseButton.addEventListener('click', () => avatarModal.style.display = 'none');
    avatarModal.addEventListener('click', (e) => {
        if (e.target === avatarModal) avatarModal.style.display = 'none';
    });
    avatarOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.avatar-option');
        if (option && persistentUserRef) {
            const newAvatar = option.dataset.avatar;
            currentAvatar = newAvatar;
            persistentUserRef.child('gameState/avatar').set(newAvatar); // Save to persistent data
            if (world) world.setPlayerAvatar(newAvatar);
            avatarModal.style.display = 'none';
        }
    });

    userListToggle.addEventListener('click', () => {
        const isHidden = usersInRoomList.classList.toggle('hidden');
        userListToggle.innerHTML = `Usuarios en la sala: ${isHidden ? '&#x25B6;' : '&#x25BC;'}`; // Toggle arrow icon
    });

    // Initialize user list as hidden
    usersInRoomList.classList.add('hidden');
    userListToggle.innerHTML = 'Usuarios en la sala: &#x25B6;';


    // --- Core Functions ---

    function handleLogin() {
        const enteredUsername = usernameInput.value.trim();
        const enteredPassword = passwordInput.value.trim();
        loginError.style.display = 'none';

        if (!enteredUsername || !enteredPassword) {
            showError("Por favor, introduce usuario y contraseña.");
            return;
        }

        persistentUserRef = db.ref('users/' + enteredUsername);
        
        persistentUserRef.once('value', snapshot => {
            if (snapshot.exists()) {
                // User exists, check password
                const userData = snapshot.val();
                if (userData.password === enteredPassword) {
                    // Password correct, proceed to login
                    loginSuccess(enteredUsername, userData.gameState);
                } else {
                    // Incorrect password
                    showError("Contraseña incorrecta.");
                }
            } else {
                // User does not exist, register new user
                const initialGameState = {
                    roomId: 'lobby',
                    avatar: 'ronin',
                    position: { x: 0, y: 1.75, z: 0 },
                    inventory: {},
                    stats: {}
                };

                persistentUserRef.set({
                    password: enteredPassword,
                    gameState: initialGameState
                }).then(() => {
                    loginSuccess(enteredUsername, initialGameState);
                });
            }
        });
    }

    function loginSuccess(loggedInUsername, gameState) {
        username = loggedInUsername;
        userId = username; 
        currentAvatar = gameState.avatar || 'ronin';
        
        loginView.style.display = 'none';
        mainContainer.classList.add('active');

        // Join the room the user was last in, passing the username for the label
        joinRoom(gameState.roomId || 'lobby', gameState.position);
    }
    
    function showError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }

    function joinRoom(roomId, initialPosition) {
        if (currentRoomId === roomId && !initialPosition) return;
        currentRoomId = roomId;

        if (!world) {
            world = new World(threejsContainer, onPlayerMove, onDoorClicked);
        }
        const roomData = world.getMapData(roomId);
        if (!roomData) return;

        roomNameEl.textContent = `Mundo: ${roomData.name}`;
        // Pass the username to the world for the local player's name label
        world.changeRoom(roomId, currentAvatar, username);

        // Wait for world to be ready, then set position
        setTimeout(() => {
             if (world && world.player && initialPosition) {
                world.player.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
            }
        }, 500); // Small delay to ensure the world is initialized

        // Reference to the user's presence in the specific room
        roomUserRef = db.ref(`rooms/${currentRoomId}/users/${userId}`);
        
        const presenceData = {
            username: username,
            avatar: currentAvatar
        };

        roomUserRef.set(presenceData);
        roomUserRef.onDisconnect().remove();

        // Listen for other users and signaling
        listenForUsers();
        listenForSignaling();

        db.ref(`rooms/${currentRoomId}/users`).once('value', snapshot => {
            const existingUsers = snapshot.val() || {};
            for (const peerId in existingUsers) {
                if (peerId !== userId) {
                    const pos = world.getPlayerPosition();
                    roomUserRef.child('position').set({x: pos.x, y: pos.y, z: pos.z});
                    initPeerConnection(peerId, true);
                }
            }
        });
    }
    
    function listenForSignaling() {
         db.ref(`signaling/${userId}`).onDisconnect().remove();
    }


    async function changeRoom(newRoomId) {
        if (currentRoomId === newRoomId || !currentRoomId) return;
        
        await savePlayerState();
        
        await leaveCurrentRoom(false);
        joinRoom(newRoomId, { x: 0, y: 1.75, z: 0 }); // Enter new room at default position
    }

    async function logout() {
        await savePlayerState();
        await leaveCurrentRoom(true);
        mainContainer.classList.remove('active');
        loginView.style.display = 'flex';
        username = ''; userId = ''; usernameInput.value = ''; passwordInput.value = '';
    }

    async function savePlayerState() {
        if (persistentUserRef && world && world.player) {
            const currentPosition = world.getPlayerPosition();
            await persistentUserRef.child('gameState').update({
                roomId: currentRoomId,
                position: {x: currentPosition.x, y: currentPosition.y, z: currentPosition.z },
                avatar: currentAvatar
            });
        }
    }
    
    async function leaveCurrentRoom(isLoggingOut) {
        if (!currentRoomId) return;

        if (roomUserRef) {
            if (isLoggingOut) await roomUserRef.onDisconnect().cancel();
            await roomUserRef.remove();
        }
        
        db.ref(`rooms/${currentRoomId}/users`).off();

        Object.keys(peerConnections).forEach(peerId => {
            peerConnections[peerId]?.close();
            if (firebaseListeners[peerId]) {
                firebaseListeners[peerId].forEach(l => l.ref.off(l.eventType, l.callback));
            }
        });

        if (isLoggingOut && userId) {
            await db.ref(`signaling/${userId}`).remove();
        }
        
        world?.dispose();
        world = null;
        
        peerConnections = {}; dataChannels = {}; firebaseListeners = {};
        currentRoomId = null; roomUserRef = null;
        usersInRoomList.innerHTML = '';
    }

    function listenForUsers() {
        const usersRef = db.ref(`rooms/${currentRoomId}/users`);
        usersRef.off();

        usersRef.on('value', snapshot => {
            const users = snapshot.val() || {};
            usersInRoomList.innerHTML = '';
            Object.entries(users).forEach(([id, user]) => {
                const li = document.createElement('li');
                li.textContent = `${user.username}${id === userId ? ' (Tú)' : ''}`;
                usersInRoomList.appendChild(li);
            });
        });

        usersRef.on('child_added', snapshot => {
            const peerId = snapshot.key;
            const peerUser = snapshot.val();
            if (peerId !== userId) {
                 world.addOrUpdateRemotePlayer(peerId, peerUser);
                 initPeerConnection(peerId, false);
            }
        });
        
        usersRef.on('child_changed', snapshot => {
            const peerId = snapshot.key;
            const peerData = snapshot.val();
            if (peerId !== userId) {
                world.addOrUpdateRemotePlayer(peerId, peerData);
            }
        });
        
        usersRef.on('child_removed', snapshot => {
             const peerId = snapshot.key;
             world?.removeRemotePlayer(peerId);
             if (peerConnections[peerId]) {
                peerConnections[peerId].close();
                delete peerConnections[peerId];
            }
            if(dataChannels[peerId]) delete dataChannels[peerId];
             if (firebaseListeners[peerId]) {
                firebaseListeners[peerId].forEach(l => l.ref.off(l.eventType, l.callback));
                delete firebaseListeners[peerId];
            }
        });
    }

    // --- World Callbacks ---
    function onPlayerMove(position, quaternion) {
        if (roomUserRef) {
            roomUserRef.update({ 
                position: { x: position.x, y: position.y, z: position.z },
                quaternion: { _x: quaternion.x, _y: quaternion.y, _z: quaternion.z, _w: quaternion.w }
            });
        }
    }

    function onDoorClicked(doorData) {
        changeRoom(doorData.to);
    }
            
    // --- WebRTC Signaling ---
    function initPeerConnection(peerId, isInitiator) {
        if (peerConnections[peerId] || peerId === userId) return;
        const pc = new RTCPeerConnection(rtcConfig);
        peerConnections[peerId] = pc;
        setupPeerSignalingListeners(peerId);
        
        pc.onicecandidate = e => {
            if (e.candidate) db.ref(`signaling/${peerId}/${userId}/iceCandidates`).push(e.candidate.toJSON());
        };
        
        if (isInitiator) {
            const channel = pc.createDataChannel('data');
            setupDataChannel(peerId, channel);
            pc.createOffer()
                .then(offer => pc.setLocalDescription(offer))
                .then(() => db.ref(`signaling/${peerId}/${userId}/offer`).set(pc.localDescription.toJSON()));
        } else {
            pc.ondatachannel = e => setupDataChannel(peerId, e.channel);
        }
    }

    function setupDataChannel(peerId, channel) {
        dataChannels[peerId] = channel;
    }

    function setupPeerSignalingListeners(peerId) {
        if(firebaseListeners[peerId]) return;
        firebaseListeners[peerId] = [];
        const offerRef = db.ref(`signaling/${userId}/${peerId}/offer`);
        const answerRef = db.ref(`signaling/${userId}/${peerId}/answer`);
        const iceRef = db.ref(`signaling/${userId}/${peerId}/iceCandidates`);

        const offerCallback = async snapshot => {
            if (!snapshot.val()) return;
            const pc = peerConnections[peerId];
            if (!pc || pc.signalingState !== 'stable') return;
            await pc.setRemoteDescription(new RTCSessionDescription(snapshot.val()));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            db.ref(`signaling/${peerId}/${userId}/answer`).set(pc.localDescription.toJSON());
        };
        offerRef.on('value', offerCallback);
        firebaseListeners[peerId].push({ref: offerRef, eventType: 'value', callback: offerCallback});

        const answerCallback = async snapshot => {
            if (!snapshot.val()) return;
            const pc = peerConnections[peerId];
            if (pc && pc.signalingState !== 'stable') {
               await pc.setRemoteDescription(new RTCSessionDescription(snapshot.val()));
            }
        };
        answerRef.on('value', answerCallback);
        firebaseListeners[peerId].push({ref: answerRef, eventType: 'value', callback: answerCallback});

        const iceCallback = snapshot => {
            if (!snapshot.val()) return;
            snapshot.ref.remove(); 
            peerConnections[peerId]?.addIceCandidate(new RTCIceCandidate(snapshot.val()));
        };
        iceRef.on('child_added', iceCallback);
        firebaseListeners[peerId].push({ref: iceRef, eventType: 'child_added', callback: iceCallback});
    }
});
