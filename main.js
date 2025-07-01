import { World } from './world.js';
import { assetLibrary, itemData } from './world-data.js';

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
    let roomUserRef = null;
    let persistentUserRef = null;
    let world = null;
    let playerStats = {
        level: 1, health: 100, maxHealth: 100, energy: 50, maxEnergy: 50, xp: 0, maxXp: 100
    };
    let playerInventory = {};

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
    const menuButton = document.getElementById('menu-button');

    // Modals
    const playerMenuModal = document.getElementById('player-menu-modal');
    const groundActionModal = document.getElementById('ground-action-modal');
    const chatInputModal = document.getElementById('chat-input-modal');
    const fountainModal = document.getElementById('fountain-modal');
    const welcomeNoteModal = document.getElementById('welcome-note-modal');
    const placeObjectModal = document.getElementById('place-object-modal');
    const pineSeedModal = document.getElementById('pine-seed-modal');

    // Modal Close Buttons
    const playerMenuCloseButton = document.getElementById('player-menu-close-button');
    const groundActionCloseButton = document.getElementById('ground-action-close-button');
    const chatInputCloseButton = document.getElementById('chat-input-close-button');
    const fountainModalCloseButton = document.getElementById('fountain-modal-close-button');
    const welcomeNoteCloseButton = document.getElementById('welcome-note-close-button');
    const placeObjectCloseButton = document.getElementById('place-object-close-button');
    const pineSeedCloseButton = document.getElementById('pine-seed-close-button');
    
    // Player Menu Elements
    const playerMenuTabButtons = document.querySelectorAll('#player-menu-tabs button');
    const playerMenuContentDivs = document.querySelectorAll('#player-menu-content .tab-content');
    const profileAvatarImg = document.getElementById('profile-avatar-img');
    const profileUsername = document.getElementById('profile-username');
    const profileLevel = document.getElementById('profile-level');
    const profileHealth = document.getElementById('profile-health');
    const profileEnergy = document.getElementById('profile-energy');
    const profileXp = document.getElementById('profile-xp');
    const avatarOptionsInMenu = document.getElementById('avatar-options-in-menu');
    const inventoryItemsDiv = document.getElementById('inventory-items');

    // Action Buttons
    const actionSpeakButton = document.getElementById('action-speak-button');
    const actionPlaceObjectButton = document.getElementById('action-place-button');
    const sendChatButton = document.getElementById('send-chat-button');
    const getWaterButton = document.getElementById('action-get-water');
    const doNothingButton = document.getElementById('action-do-nothing');
    const waterSeedButton = document.getElementById('action-water-seed');

    // Inputs
    const chatMessageInput = document.getElementById('chat-message-input');

    // WebRTC Configuration
    const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    
    // --- Event Listeners ---
    loginButton.addEventListener('click', handleLogin);
    leaveRoomButton.addEventListener('click', logout);
    zoomInButton.addEventListener('click', () => world?.zoomIn());
    zoomOutButton.addEventListener('click', () => world?.zoomOut());
    menuButton.addEventListener('click', () => {
        playerMenuModal.style.display = 'flex';
        showPlayerMenuTab('profile');
    });

    userListToggle.addEventListener('click', () => {
        const isHidden = usersInRoomList.classList.toggle('hidden');
        userListToggle.innerHTML = `Usuarios en la sala: ${isHidden ? '&#x25B6;' : '&#x25BC;'}`;
    });
    usersInRoomList.classList.add('hidden');
    userListToggle.innerHTML = 'Usuarios en la sala: &#x25B6;';

    // Modal Close Handlers
    [playerMenuModal, groundActionModal, chatInputModal, fountainModal, welcomeNoteModal, placeObjectModal, pineSeedModal].forEach(modal => {
        if(modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
            const closeButton = modal.querySelector('.modal-close-button');
            if (closeButton) closeButton.addEventListener('click', () => modal.style.display = 'none');
        }
    });

    playerMenuTabButtons.forEach(button => {
        button.addEventListener('click', () => showPlayerMenuTab(button.dataset.tab));
    });
    avatarOptionsInMenu.addEventListener('click', (e) => {
        const option = e.target.closest('.avatar-option');
        if (option && persistentUserRef) {
            currentAvatar = option.dataset.avatar;
            persistentUserRef.child('gameState/avatar').set(currentAvatar);
            world?.setPlayerAvatar(currentAvatar);
            if (roomUserRef) roomUserRef.child('avatar').set(currentAvatar);
        }
    });

    // Action Button Listeners
    actionSpeakButton.addEventListener('click', () => {
        groundActionModal.style.display = 'none';
        chatInputModal.style.display = 'flex';
        chatMessageInput.focus();
    });
    actionPlaceObjectButton.addEventListener('click', showPlaceableItemsModal);
    sendChatButton.addEventListener('click', sendChatMessage);
    chatMessageInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    getWaterButton.addEventListener('click', () => {
        addItemToInventory('water_bottle', 1);
        fountainModal.style.display = 'none';
    });
    
    // Inventory Click Handler
    inventoryItemsDiv.addEventListener('click', handleInventoryClick);


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
                const userData = snapshot.val();
                if (userData.password === enteredPassword) {
                    loginSuccess(enteredUsername, userData.gameState);
                } else {
                    showError("Contraseña incorrecta.");
                }
            } else {
                // New user registration
                const initialInventory = {
                    'water_bottle': { count: 15 },
                    'pine_seed': { count: 15 },
                    'welcome_note': { count: 1 }
                };
                const initialGameState = {
                    roomId: 'lobby', avatar: 'ronin', position: { x: 0, y: 1.75, z: 0 }, 
                    inventory: initialInventory,
                    stats: { level: 1, health: 100, maxHealth: 100, energy: 50, maxEnergy: 50, xp: 0, maxXp: 100 }
                };
                persistentUserRef.set({ password: enteredPassword, gameState: initialGameState })
                    .then(() => loginSuccess(enteredUsername, initialGameState));
            }
        });
    }

    function loginSuccess(loggedInUsername, gameState) {
        username = loggedInUsername;
        userId = username; 
        currentAvatar = gameState.avatar || 'ronin';
        playerStats = gameState.stats || playerStats;
        playerInventory = gameState.inventory || {};
        
        loginView.style.display = 'none';
        mainContainer.classList.add('active');

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
            world = new World(threejsContainer, onPlayerMove, onDoorClicked, onPlayerClicked, onInteractiveObjectClick);
        }
        const roomData = world.getMapData(roomId);
        if (!roomData) return;

        roomNameEl.textContent = `Mundo: ${roomData.name}`;
        world.changeRoom(roomId, currentAvatar, username);

        setTimeout(() => {
             if (world?.player && initialPosition) {
                world.player.position.set(initialPosition.x, initialPosition.y, initialPosition.z);
            }
        }, 500);

        roomUserRef = db.ref(`rooms/${currentRoomId}/users/${userId}`);
        const presenceData = { username, avatar: currentAvatar, stats: playerStats };
        roomUserRef.set(presenceData);
        roomUserRef.onDisconnect().remove();

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
        joinRoom(newRoomId, { x: 0, y: 1.75, z: 0 });
    }

    async function logout() {
        await savePlayerState();
        await leaveCurrentRoom(true);
        mainContainer.classList.remove('active');
        loginView.style.display = 'flex';
        username = ''; userId = ''; usernameInput.value = ''; passwordInput.value = '';
    }

    async function savePlayerState() {
        if (persistentUserRef && world?.player) {
            const currentPosition = world.getPlayerPosition();
            await persistentUserRef.child('gameState').update({
                roomId: currentRoomId,
                position: {x: currentPosition.x, y: currentPosition.y, z: currentPosition.z },
                avatar: currentAvatar,
                stats: playerStats,
                inventory: playerInventory
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
            } else { 
                 if (peerData.chatMessage && world.player) {
                    world.displayChatMessage(world.player, peerData.chatMessage.text);
                    roomUserRef.child('chatMessage').remove();
                 }
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

    function onPlayerClicked() {
        groundActionModal.style.display = 'flex';
        // Enable place object button if there are placeable items
        const hasPlaceable = Object.keys(playerInventory).some(id => itemData[id]?.placeable);
        actionPlaceObjectButton.disabled = !hasPlaceable;
    }

    function onInteractiveObjectClick(objectData) {
        if (objectData.id === 'fountain') {
            fountainModal.style.display = 'flex';
        } else if (objectData.isPlacedObject && objectData.itemId === 'pine_seed') {
            // Logic for interacting with a placed pine seed
            pineSeedModal.style.display = 'flex';
            // We'll need to pass the unique ID of the clicked seed to the watering function
            waterSeedButton.onclick = () => waterPineSeed(objectData.uniqueId);
        }
    }
    
    // --- Chat Functionality ---
    function sendChatMessage() {
        const message = chatMessageInput.value.trim();
        if (message && roomUserRef) {
            const chatData = {
                text: message,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            roomUserRef.child('chatMessage').set(chatData);
            
            chatMessageInput.value = '';
            chatInputModal.style.display = 'none';
        }
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

    // --- Inventory & Item Management ---
    function getItemName(itemId) {
        return itemData[itemId]?.name || itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function addItemToInventory(itemId, quantity) {
        if (!playerInventory[itemId]) {
            playerInventory[itemId] = { count: 0 };
        }
        playerInventory[itemId].count += quantity;
        updateInventoryTab();
        savePlayerState();
    }

    function removeItemFromInventory(itemId, quantity) {
        if (playerInventory[itemId]) {
            playerInventory[itemId].count -= quantity;
            if (playerInventory[itemId].count <= 0) {
                delete playerInventory[itemId];
            }
            updateInventoryTab();
            savePlayerState();
            return true;
        }
        return false;
    }
    
    function handleInventoryClick(event) {
        const itemDiv = event.target.closest('.inventory-item');
        if (!itemDiv) return;

        const itemId = itemDiv.dataset.itemId;
        const data = itemData[itemId];

        if (data && data.action?.type === 'read') {
            const welcomeNoteText = document.getElementById('welcome-note-text');
            welcomeNoteText.textContent = data.action.content;
            welcomeNoteModal.style.display = 'flex';
        }
    }

    function showPlaceableItemsModal() {
        const placeableItemsContainer = document.getElementById('placeable-items-grid');
        placeableItemsContainer.innerHTML = '';
        
        Object.keys(playerInventory).forEach(itemId => {
            if (itemData[itemId]?.placeable) {
                const item = playerInventory[itemId];
                const itemAsset = assetLibrary[itemId];
                const itemDiv = document.createElement('div');
                itemDiv.className = 'inventory-item';
                itemDiv.dataset.itemId = itemId;
                itemDiv.innerHTML = `
                    <img src="${itemAsset}" alt="${getItemName(itemId)}" onerror="this.src='https://placehold.co/80x80/555/fff?text=?'">
                    <p class="item-name">${getItemName(itemId)}</p>
                    <div class="item-count">${item.count}</div>
                `;
                itemDiv.onclick = () => placeObject(itemId);
                placeableItemsContainer.appendChild(itemDiv);
            }
        });

        groundActionModal.style.display = 'none';
        placeObjectModal.style.display = 'flex';
    }

    function placeObject(itemId) {
        if (!world.localPlayerTargetPosition) {
            // In a real game, you'd provide feedback here
            console.log("Selecciona una ubicación en el suelo primero.");
            return;
        }

        if (removeItemFromInventory(itemId, 1)) {
            const position = {
                x: world.localPlayerTargetPosition.x,
                y: 0.5, // Place on the ground
                z: world.localPlayerTargetPosition.z
            };

            const newObjectData = {
                itemId: itemId,
                position: position,
                state: 'default' // Initial state
            };

            // Save to a new 'world_objects' node for the room
            db.ref(`rooms/${currentRoomId}/world_objects`).push(newObjectData);
            placeObjectModal.style.display = 'none';
        }
    }
    
    function waterPineSeed(placedObjectKey) {
        // Check if player has a water bottle
        if (playerInventory['water_bottle'] && playerInventory['water_bottle'].count > 0) {
            // Consume water bottle
            removeItemFromInventory('water_bottle', 1);

            // Update the placed object in Firebase
            const objectRef = db.ref(`rooms/${currentRoomId}/world_objects/${placedObjectKey}`);
            objectRef.update({
                itemId: 'pine_sprout', // Change the item type
                state: 'watered'
            });

            pineSeedModal.style.display = 'none';
        } else {
            // You can show a message to the user here
            console.log("No tienes botellas de agua.");
        }
    }


    // --- Player Menu Tab Management ---
    function showPlayerMenuTab(tabName) {
        playerMenuTabButtons.forEach(button => button.classList.remove('active'));
        playerMenuContentDivs.forEach(div => div.classList.remove('active'));

        const selectedButton = document.querySelector(`#player-menu-tabs button[data-tab="${tabName}"]`);
        const selectedContent = document.getElementById(`player-${tabName}-tab`);

        if (selectedButton) selectedButton.classList.add('active');
        if (selectedContent) selectedContent.classList.add('active');

        if (tabName === 'profile') {
            updateProfileTab();
        } else if (tabName === 'inventory') {
            updateInventoryTab();
        }
    }

    function updateProfileTab() {
        profileUsername.textContent = username;
        profileAvatarImg.src = assetLibrary[currentAvatar] || assetLibrary.ronin;
        profileAvatarImg.onerror = () => {
            profileAvatarImg.src = `https://placehold.co/120x120/333/fff?text=${currentAvatar.charAt(0).toUpperCase() + currentAvatar.slice(1)}`;
        };
        profileLevel.textContent = playerStats.level;
        profileHealth.textContent = `${playerStats.health}/${playerStats.maxHealth}`;
        profileEnergy.textContent = `${playerStats.energy}/${playerStats.maxEnergy}`;
        profileXp.textContent = `${playerStats.xp}/${playerStats.maxXp}`;
    }

    function updateInventoryTab() {
        inventoryItemsDiv.innerHTML = '';

        if (Object.keys(playerInventory).length === 0) {
            inventoryItemsDiv.innerHTML = '<p>Tu inventario está vacío. ¡Encuentra objetos en el mundo!</p>';
            return;
        }

        for (const itemId in playerInventory) {
            const item = playerInventory[itemId];
            const itemAsset = assetLibrary[itemId];
            if (itemAsset) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'inventory-item';
                itemDiv.dataset.itemId = itemId; // Store item ID
                itemDiv.innerHTML = `
                    <img src="${itemAsset}" alt="${getItemName(itemId)}" onerror="this.src='https://placehold.co/80x80/555/fff?text=?'">
                    <p class="item-name">${getItemName(itemId)}</p>
                    <div class="item-count">${item.count}</div>
                `;
                inventoryItemsDiv.appendChild(itemDiv);
            }
        }
    }
});
