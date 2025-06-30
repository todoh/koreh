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
    let username = '', userId = '', currentRoomId = null, currentAvatar = 'ronin'; // Default avatar set to 'ronin'
    let peerConnections = {}, dataChannels = {}, firebaseListeners = {};
    let userRef = null, usersInRoomRefListener = null;
    let world = null;

    // DOM Elements
    const loginView = document.getElementById('login-view');
    const mainContainer = document.querySelector('.container');
    const usernameInput = document.getElementById('username-input');
    const loginButton = document.getElementById('login-button');
    const roomNameEl = document.getElementById('room-name');
    const usersInRoomList = document.getElementById('users-in-room');
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
    loginButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (name) {
            username = name;
            userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            loginView.style.display = 'none';
            mainContainer.classList.add('active');
            joinRoom('lobby');
        }
    });

    leaveRoomButton.addEventListener('click', logout);
    
    zoomInButton.addEventListener('click', () => world?.zoomIn());
    zoomOutButton.addEventListener('click', () => world?.zoomOut());

    // Avatar Modal Listeners
    avatarButton.addEventListener('click', () => {
        avatarModal.style.display = 'flex';
    });
    modalCloseButton.addEventListener('click', () => {
        avatarModal.style.display = 'none';
    });
    avatarModal.addEventListener('click', (e) => { // Close on overlay click
        if (e.target === avatarModal) {
            avatarModal.style.display = 'none';
        }
    });
    avatarOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.avatar-option');
        if (option && userRef) {
            const newAvatar = option.dataset.avatar;
            currentAvatar = newAvatar;
            userRef.child('avatar').set(newAvatar);
            if (world) {
                world.setPlayerAvatar(newAvatar);
            }
            avatarModal.style.display = 'none';
        }
    });


    // --- Core Functions ---
    function joinRoom(roomId) {
        if (currentRoomId === roomId) return;
        currentRoomId = roomId;

        if (!world) {
            world = new World(threejsContainer, onPlayerMove, onDoorClicked);
        }
        const roomData = world.getMapData(roomId);
        if (!roomData) return;

        roomNameEl.textContent = `Mundo: ${roomData.name}`;

        world.changeRoom(roomId, currentAvatar);
        
        userRef = db.ref(`rooms/${currentRoomId}/users/${userId}`);
        const initialPosition = world.getPlayerPosition();
        userRef.set({ 
            username: username, 
            position: { x: initialPosition.x, y: initialPosition.y, z: initialPosition.z },
            avatar: currentAvatar
        });
        userRef.onDisconnect().remove();
        db.ref(`signaling/${userId}`).onDisconnect().remove();

        listenForUsers();

        db.ref(`rooms/${currentRoomId}/users`).once('value', snapshot => {
            const existingUsers = snapshot.val() || {};
            for (const peerId in existingUsers) {
                if (peerId !== userId) {
                    initPeerConnection(peerId, true);
                    if (world) {
                        world.addOrUpdateRemotePlayer(peerId, existingUsers[peerId]);
                    }
                }
            }
        });
    }

    async function changeRoom(newRoomId) {
        if (currentRoomId === newRoomId || !currentRoomId) return;
        await leaveCurrentRoom(false);
        joinRoom(newRoomId);
    }

    async function logout() {
        await leaveCurrentRoom(true);
        mainContainer.classList.remove('active');
        loginView.style.display = 'flex';
        username = ''; userId = ''; usernameInput.value = '';
    }
    
    async function leaveCurrentRoom(isLoggingOut) {
        if (!currentRoomId) return;

        if (userRef) {
            if (isLoggingOut) await userRef.onDisconnect().cancel();
            await userRef.remove();
        }
        if (usersInRoomRefListener) usersInRoomRefListener.off();

        Object.keys(peerConnections).forEach(peerId => {
            peerConnections[peerId]?.close();
            firebaseListeners[peerId]?.forEach(l => l.ref.off(l.eventType, l.callback));
        });

        if (userId) await db.ref(`signaling/${userId}`).remove();
        
        world?.dispose();
        world = null;
        
        peerConnections = {}; dataChannels = {}; firebaseListeners = {};
        currentRoomId = null; userRef = null; usersInRoomRefListener = null;
        usersInRoomList.innerHTML = '';
    }

    function listenForUsers() {
        if (usersInRoomRefListener) usersInRoomRefListener.off();
        const usersRef = db.ref(`rooms/${currentRoomId}/users`);

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
            if (peerId !== userId && world) {
                world.addOrUpdateRemotePlayer(peerId, peerUser);
                initPeerConnection(peerId, false);
            }
        });
        
        usersRef.on('child_changed', snapshot => {
            const peerId = snapshot.key;
            const peerData = snapshot.val();
            if (peerId !== userId && world) {
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
    function onPlayerMove(newPosition) {
        if (userRef) {
            userRef.child('position').set({ x: newPosition.x, y: newPosition.y, z: newPosition.z });
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

        const answerCallback = snapshot => {
            if (!snapshot.val()) return;
            const pc = peerConnections[peerId];
            if (pc && pc.signalingState !== 'stable') {
               pc.setRemoteDescription(new RTCSessionDescription(snapshot.val()));
            }
        };
        answerRef.on('value', answerCallback);
        firebaseListeners[peerId].push({ref: answerRef, eventType: 'value', callback: answerCallback});

        const iceCallback = snapshot => {
            if (!snapshot.val()) return;
            peerConnections[peerId]?.addIceCandidate(new RTCIceCandidate(snapshot.val()));
        };
        iceRef.on('child_added', iceCallback);
        firebaseListeners[peerId].push({ref: iceRef, eventType: 'child_added', callback: iceCallback});
    }
});
