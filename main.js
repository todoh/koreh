import { World } from './world.js';
import { assetLibrary, itemData, worldGridData } from './world-data.js';
import { Minimap } from './minimap.js'; // Importar la clase Minimap

document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration ---
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

    // --- NEW: Chunk Management Constants & State ---
    const CHUNK_SIZE = 64; // World units (meters) for the size of each chunk
    let currentChunkId = null; // Set to null to force initial load
    let activeChunks = new Set();
    let chunkUpdateInterval = null;
    let firebaseChunkListeners = {}; // Stores all active firebase listeners, keyed by chunkId

    // --- State Variables ---
    let username = '', userId = '';
    let currentAvatar = 'ronin';
    let persistentUserRef = null;
    let selfUserRef = null; // Reference to the user's own data in the global list
    let world = null;
    let minimap = null; // Variable para el minimapa
    let playerStats = {
        level: 1, health: 100, maxHealth: 100, energy: 50, maxEnergy: 50, xp: 0, maxXp: 100
    };
    let playerInventory = {};
    let passiveObjectsInterval = null;
    let selectedBuildSize = null;
    let activeConstructionSiteId = null;
    let activeHouseDoorData = null;
    let lastClickedGroundPosition = null;

    // --- DOM Elements ---
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
    const minimapContainer = document.getElementById('minimap-container'); // Contenedor del minimapa
    const zoomInButton = document.getElementById('zoom-in-button');
    const zoomOutButton = document.getElementById('zoom-out-button');
    const menuButton = document.getElementById('menu-button');
    const playerMenuModal = document.getElementById('player-menu-modal');
    const groundActionModal = document.getElementById('ground-action-modal');
    const buildAreaModal = document.getElementById('build-area-modal');
    const constructionSignModal = document.getElementById('construction-sign-modal');
    const houseDoorModal = document.getElementById('house-door-modal');
    const chatInputModal = document.getElementById('chat-input-modal');
    const fountainModal = document.getElementById('fountain-modal');
    const welcomeNoteModal = document.getElementById('welcome-note-modal');
    const placeObjectModal = document.getElementById('place-object-modal');
    const pineSeedModal = document.getElementById('pine-seed-modal');
    const pineSproutInfoModal = document.getElementById('pine-sprout-info-modal');
    const pineActionModal = document.getElementById('pine-action-modal');
    const notificationModal = document.getElementById('notification-modal');
    const notificationTitle = document.getElementById('notification-title');
    const notificationText = document.getElementById('notification-text');
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
    const actionSpeakButton = document.getElementById('action-speak-button');
    const actionPlaceObjectButton = document.getElementById('action-place-button');
    const actionBuildButton = document.getElementById('action-build-button');
    const buildAreaSizeOptions = document.querySelectorAll('input[name="build-size"]');
    const confirmBuildButton = document.getElementById('confirm-build-button');
    const buildAreaStatus = document.getElementById('build-area-status');
    const constructionOptionsDiv = document.getElementById('construction-options');
    const houseOwnerInfo = document.getElementById('house-owner-info');
    const houseDoorOptions = document.getElementById('house-door-options');
    const sendChatButton = document.getElementById('send-chat-button');
    const getWaterButton = document.getElementById('action-get-water');
    const waterSeedButton = document.getElementById('action-water-seed');
    const chopPineButton = document.getElementById('action-chop-pine');
    const leavePineButton = document.getElementById('action-leave-pine');
    const chatMessageInput = document.getElementById('chat-message-input');
    
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
        userListToggle.innerHTML = `Usuarios en la zona: ${isHidden ? '&#x25B6;' : '&#x25BC;'}`;
    });
    usersInRoomList.classList.add('hidden');
    userListToggle.innerHTML = 'Usuarios en la zona: &#x25B6;';
    
    [playerMenuModal, groundActionModal, buildAreaModal, constructionSignModal, houseDoorModal, chatInputModal, fountainModal, welcomeNoteModal, placeObjectModal, pineSeedModal, pineSproutInfoModal, pineActionModal, notificationModal].forEach(modal => {
        if(modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    if (modal === buildAreaModal) world?.clearBuildPreview();
                }
            });
            const closeButton = modal.querySelector('.modal-close-button');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    modal.style.display = 'none';
                    if (modal === buildAreaModal) world?.clearBuildPreview();
                });
            }
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
            if (selfUserRef) selfUserRef.child('avatar').set(currentAvatar);
        }
    });
    actionSpeakButton.addEventListener('click', () => {
        groundActionModal.style.display = 'none';
        chatInputModal.style.display = 'flex';
        chatMessageInput.focus();
    });
    actionPlaceObjectButton.addEventListener('click', showPlaceableItemsModal);
    actionBuildButton.addEventListener('click', () => {
        groundActionModal.style.display = 'none';
        buildAreaModal.style.display = 'flex';
        confirmBuildButton.disabled = true;
        buildAreaStatus.style.display = 'none';
        buildAreaSizeOptions.forEach(radio => radio.checked = false);
        selectedBuildSize = null;
    });
    sendChatButton.addEventListener('click', sendChatMessage);
    chatMessageInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') sendChatMessage(); });
    getWaterButton.addEventListener('click', () => {
        addItemToInventory('water_bottle', 1);
        fountainModal.style.display = 'none';
    });
    inventoryItemsDiv.addEventListener('click', handleInventoryClick);

    buildAreaSizeOptions.forEach(radio => {
        radio.addEventListener('change', handleBuildSizeSelection);
    });

    confirmBuildButton.addEventListener('click', handleConfirmBuild);

    // --- Core Functions ---

    function onGroundClicked(position) {
        lastClickedGroundPosition = position;
    }

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
            const performLogin = (gameState) => {
                document.body.classList.add('game-loading');

                setTimeout(() => {
                    loginView.style.display = 'none';
                    mainContainer.classList.add('active');
                    loginSuccess(enteredUsername, gameState);

                    setTimeout(() => {
                        document.body.classList.remove('game-loading');
                    }, 2000);

                }, 700);
            };

            if (snapshot.exists()) {
                const userData = snapshot.val();
                if (userData.password === enteredPassword) {
                    performLogin(userData.gameState);
                } else {
                    showError("Contraseña incorrecta.");
                }
            } else {
                const initialInventory = { 'welcome_note': { count: 1 }, 'hacha': { count: 1 }, 'water_bottle': { count: 1 }, 'pine_seed': { count: 5 } };
                const initialGameState = {
                    position: { x: 0, y: 0, z: 0 }, 
                    avatar: 'ronin',
                    inventory: initialInventory,
                    stats: { level: 1, health: 100, maxHealth: 100, energy: 50, maxEnergy: 50, xp: 0, maxXp: 100 }
                };
                persistentUserRef.set({ password: enteredPassword, gameState: initialGameState })
                    .then(() => performLogin(initialGameState));
            }
        });
    }

    function loginSuccess(loggedInUsername, gameState) {
        username = loggedInUsername;
        userId = username; 
        currentAvatar = gameState.avatar || 'ronin';
        playerStats = gameState.stats || playerStats;
        playerInventory = gameState.inventory || {};
        
        // Initialize the world
        world = new World(threejsContainer, onPlayerMove, onInteractiveObjectClick, onPlayerClicked, onGroundClicked, CHUNK_SIZE);
        world.init(currentAvatar, username, gameState.position);

        // Inicializar el minimapa
        minimap = new Minimap(minimapContainer, worldGridData, CHUNK_SIZE);
        minimap.updatePlayerPosition(world.getPlayerPosition());

        // Set up global user presence
        selfUserRef = db.ref('online_users/' + userId);
        const presenceData = { 
            username, 
            avatar: currentAvatar, 
            stats: playerStats,
            position: world.getPlayerPosition(),
            chunkId: getChunkIdFromPosition(world.getPlayerPosition())
        };
        selfUserRef.set(presenceData);
        selfUserRef.onDisconnect().remove();

        // Start the chunk management loop
        if (chunkUpdateInterval) clearInterval(chunkUpdateInterval);
        chunkUpdateInterval = setInterval(checkForChunkChange, 1000); // Check every second
        checkForChunkChange(); // Initial check

        // Start passive object growth check
        if (passiveObjectsInterval) clearInterval(passiveObjectsInterval);
        passiveObjectsInterval = setInterval(checkPassiveObjectsGrowth, 5000);
        
        document.getElementById('login-background').style.display = 'none';
    }
    
    function showError(message) {
        loginError.textContent = message;
        loginError.style.display = 'block';
    }

    // --- MODIFIED LOGOUT FUNCTION ---
    async function logout() {
        // 1. Get the final player state BEFORE destroying anything.
        if (persistentUserRef && world?.player) {
            const finalPosition = world.getPlayerPosition();
            // This is the save operation, now happening safely first.
            await persistentUserRef.child('gameState').update({
                position: {x: finalPosition.x, y: finalPosition.y, z: finalPosition.z },
                avatar: currentAvatar,
                stats: playerStats,
                inventory: playerInventory
            });
        }
        
        // 2. Now, proceed with cleanup.
        if (chunkUpdateInterval) clearInterval(chunkUpdateInterval);
        
        // Detach all firebase listeners and unload chunks
        activeChunks.forEach(chunkId => {
            stopListeningToChunk(chunkId);
            if(world) world.unloadChunk(chunkId);
        });
        activeChunks.clear();

        if (selfUserRef) {
            await selfUserRef.onDisconnect().cancel();
            await selfUserRef.remove();
        }

        if (passiveObjectsInterval) clearInterval(passiveObjectsInterval);

        // Destruir el minimapa
        if (minimap) {
            minimap.destroy();
            minimap = null;
        }

        world?.dispose();
        world = null;
        
        // 3. Finally, reset the UI.
        mainContainer.classList.remove('active');
        loginView.style.display = 'flex';
        document.getElementById('login-background').style.display = 'block';
        username = ''; userId = ''; usernameInput.value = ''; passwordInput.value = '';
        persistentUserRef = null;
        selfUserRef = null;
    }
    
    function onPlayerMove(position, quaternion) {
        if (selfUserRef) {
            const newChunkId = getChunkIdFromPosition(position);
            selfUserRef.update({ 
                position: { x: position.x, y: position.y, z: position.z },
                quaternion: { _x: quaternion.x, _y: quaternion.y, _z: quaternion.z, _w: quaternion.w },
                chunkId: newChunkId
            });
        }
        // Actualizar la posición del jugador en el minimapa
        if (minimap) {
            minimap.updatePlayerPosition(position);
        }
    }

    // --- Chunk Management ---

    function getChunkIdFromPosition(position) {
        const chunkX = Math.floor((position.x + CHUNK_SIZE / 2) / CHUNK_SIZE);
        const chunkZ = Math.floor((position.z + CHUNK_SIZE / 2) / CHUNK_SIZE);
        return `${chunkX}_${chunkZ}`;
    }

    function checkForChunkChange() {
        if (!world || !world.player) return;
        const playerPos = world.getPlayerPosition();
        const newChunkId = getChunkIdFromPosition(playerPos);

        if (newChunkId !== currentChunkId) {
            console.log(`Player moved from chunk ${currentChunkId} to ${newChunkId}`);
            currentChunkId = newChunkId;
            updateActiveChunks();
        }
    }

    function updateActiveChunks() {
        const [cx, cz] = currentChunkId.split('_').map(Number);
        const requiredChunks = new Set();
        
        // Create 3x3 grid of required chunks
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                requiredChunks.add(`${cx + x}_${cz + z}`);
            }
        }

        // Unload old chunks
        for (const chunkId of activeChunks) {
            if (!requiredChunks.has(chunkId)) {
                console.log(`Unloading chunk: ${chunkId}`);
                world.unloadChunk(chunkId);
                stopListeningToChunk(chunkId);
            }
        }

        // Load new chunks
        for (const chunkId of requiredChunks) {
            if (!activeChunks.has(chunkId)) {
                console.log(`Loading chunk: ${chunkId}`);
                const chunkData = worldGridData[chunkId];
                if (chunkData) {
                    world.loadChunk(chunkId, chunkData);
                    startListeningToChunk(chunkId);
                }
            }
        }

        activeChunks = requiredChunks;
        roomNameEl.textContent = `Zona: ${worldGridData[currentChunkId]?.name || 'Desconocido'}`;
        roomNameEl.style.display = 'block';
    }

    function startListeningToChunk(chunkId) {
        if (firebaseChunkListeners[chunkId]) return; // Already listening
        firebaseChunkListeners[chunkId] = [];

        listenForUsersInChunk(chunkId);
        listenForWorldObjects(chunkId);
        listenForConstructionSites(chunkId);
    }

    function stopListeningToChunk(chunkId) {
        const listeners = firebaseChunkListeners[chunkId];
        if (listeners) {
            listeners.forEach(listener => {
                listener.ref.off(listener.eventType, listener.callback);
            });
        }
        delete firebaseChunkListeners[chunkId];

        if(world) world.removeRemotePlayersFromChunk(chunkId);
    }

    function addListener(chunkId, ref, eventType, callback) {
        if (!firebaseChunkListeners[chunkId]) return;
        ref.on(eventType, callback);
        firebaseChunkListeners[chunkId].push({ ref, eventType, callback });
    }
    
    // --- Firebase Listeners (Per Chunk) ---

    function listenForUsersInChunk(chunkId) {
        const usersQuery = db.ref('online_users').orderByChild('chunkId').equalTo(chunkId);
        
        const onUserAdded = snapshot => {
            const peerId = snapshot.key;
            const peerUser = snapshot.val();
            if (peerId !== userId) {
                 world.addOrUpdateRemotePlayer(peerId, peerUser);
            }
        };
        addListener(chunkId, usersQuery, 'child_added', onUserAdded);
        
        const onUserChanged = snapshot => {
            const peerId = snapshot.key;
            const peerData = snapshot.val();
            if (peerId !== userId) {
                world.addOrUpdateRemotePlayer(peerId, peerData);
            } else { 
                 if (peerData.chatMessage && world.player) {
                    world.displayChatMessage(world.player, peerData.chatMessage.text);
                    selfUserRef.child('chatMessage').remove();
                 }
            }
        };
        addListener(chunkId, usersQuery, 'child_changed', onUserChanged);
        
        const onUserRemoved = snapshot => {
             const peerId = snapshot.key;
             world?.removeRemotePlayer(peerId);
        };
        addListener(chunkId, usersQuery, 'child_removed', onUserRemoved);

        usersQuery.once('value', snapshot => {
            usersInRoomList.innerHTML = ''; 
            snapshot.forEach(childSnapshot => {
                const user = childSnapshot.val();
                const li = document.createElement('li');
                li.textContent = `${user.username}${childSnapshot.key === userId ? ' (Tú)' : ''}`;
                usersInRoomList.appendChild(li);
            });
        });
    }

    function listenForWorldObjects(chunkId) {
        const objectsRef = db.ref(`world_data/${chunkId}/world_objects`);
        
        const onObjectAdded = snapshot => {
            world?.addDynamicObject(snapshot.key, snapshot.val(), chunkId);
        };
        addListener(chunkId, objectsRef, 'child_added', onObjectAdded);

        const onObjectChanged = snapshot => {
            world?.updateDynamicObject(snapshot.key, snapshot.val());
        };
        addListener(chunkId, objectsRef, 'child_changed', onObjectChanged);

        const onObjectRemoved = snapshot => {
            world?.removeDynamicObject(snapshot.key);
        };
        addListener(chunkId, objectsRef, 'child_removed', onObjectRemoved);
    }
    
    function listenForConstructionSites(chunkId) {
        const sitesRef = db.ref(`world_data/${chunkId}/construction_sites`);

        const onSiteAdded = snapshot => {
            world?.createConstructionSite(snapshot.key, snapshot.val(), chunkId);
        };
        addListener(chunkId, sitesRef, 'child_added', onSiteAdded);

        const onSiteChanged = snapshot => {
            world?.updateConstructionSite(snapshot.key, snapshot.val());
        };
        addListener(chunkId, sitesRef, 'child_changed', onSiteChanged);

        const onSiteRemoved = snapshot => {
            world?.removeConstructionSite(snapshot.key);
        };
        addListener(chunkId, sitesRef, 'child_removed', onSiteRemoved);
    }
    
    // --- Player Actions & UI ---

    function onPlayerClicked() {
        groundActionModal.style.display = 'flex';
        const hasPlaceable = Object.keys(playerInventory).some(id => itemData[id]?.placeable);
        actionPlaceObjectButton.disabled = !hasPlaceable;
    }

    function onInteractiveObjectClick(objectData) {
        if (objectData.id === 'fountain') {
            fountainModal.style.display = 'flex';
        } 
        else if (objectData.isPlacedObject && objectData.itemId === 'pine_seed') {
            pineSeedModal.style.display = 'flex';
            waterSeedButton.onclick = () => waterPineSeed(objectData.uniqueId, objectData.chunkId);
        }
        else if (objectData.isPlacedObject && objectData.itemId === 'pine_sprout') {
            pineSproutInfoModal.style.display = 'flex';
        }
        else if (objectData.isPlacedObject && objectData.itemId === 'pine') {
            pineActionModal.style.display = 'flex';
            chopPineButton.onclick = () => chopPine(objectData.uniqueId, objectData.chunkId);
            leavePineButton.onclick = () => pineActionModal.style.display = 'none';
        }
        else if (objectData.id === 'construction_sign') {
            showConstructionSignModal(objectData.siteId, objectData.siteSize, objectData.chunkId);
        }
        else if (objectData.id === 'house_door') {
            showHouseDoorModal(objectData);
        }
    }
    
    function sendChatMessage() {
        const message = chatMessageInput.value.trim();
        if (message && selfUserRef) {
            const chatData = {
                text: message,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            selfUserRef.child('chatMessage').set(chatData);
            
            chatMessageInput.value = '';
            chatInputModal.style.display = 'none';
        }
    }
    
    function getItemName(itemId) {
        return itemData[itemId]?.name || itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    function addItemToInventory(itemId, quantity) {
        if (!playerInventory[itemId]) {
            playerInventory[itemId] = { count: 0 };
        }
        playerInventory[itemId].count += quantity;
        updateInventoryTab();
    }

    function removeItemFromInventory(itemId, quantity) {
        if (playerInventory[itemId]) {
            playerInventory[itemId].count -= quantity;
            if (playerInventory[itemId].count <= 0) {
                delete playerInventory[itemId];
            }
            updateInventoryTab();
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
        if (!lastClickedGroundPosition) {
            showNotification("Ubicación requerida", "Primero haz clic en el suelo donde quieras colocar el objeto, y después selecciona el objeto a colocar.");
            placeObjectModal.style.display = 'none';
            return;
        }

        if (removeItemFromInventory(itemId, 1)) {
            const objectChunkId = getChunkIdFromPosition(lastClickedGroundPosition);
            
            const newObjectData = {
                itemId: itemId,
                position: { 
                    x: lastClickedGroundPosition.x,
                    z: lastClickedGroundPosition.z
                },
                state: 'default'
            };

            db.ref(`world_data/${objectChunkId}/world_objects`).push(newObjectData);
            placeObjectModal.style.display = 'none';
            
            lastClickedGroundPosition = null; 
        }
    }
    
    function waterPineSeed(placedObjectKey, chunkId) {
        if (playerInventory['water_bottle'] && playerInventory['water_bottle'].count > 0) {
            removeItemFromInventory('water_bottle', 1);

            const objectRef = db.ref(`world_data/${chunkId}/world_objects/${placedObjectKey}`);
            objectRef.update({
                itemId: 'pine_sprout',
                state: 'watered',
                growthStartTime: firebase.database.ServerValue.TIMESTAMP
            });

            pineSeedModal.style.display = 'none';
        } else {
            showNotification("Sin agua", "No tienes botellas de agua para regar la semilla.");
            pineSeedModal.style.display = 'none';
        }
    }

    function chopPine(placedObjectKey, chunkId) {
        pineActionModal.style.display = 'none';
    
        if (playerInventory['hacha'] && playerInventory['hacha'].count > 0) {
            db.ref(`world_data/${chunkId}/world_objects/${placedObjectKey}`).remove();
            addItemToInventory('tronco_pino', 3);
            showNotification("¡Has talado el pino!", "Has conseguido 3 troncos de pino.");
        } else {
            showNotification("Herramienta necesaria", "Necesitas un hacha para talar este pino.");
        }
    }

    function checkPassiveObjectsGrowth() {
        if (!activeChunks.size) return;

        const currentTime = Date.now();
        
        activeChunks.forEach(chunkId => {
            const objectsRef = db.ref(`world_data/${chunkId}/world_objects`);
            objectsRef.once('value', snapshot => {
                const objects = snapshot.val();
                if (!objects) return;

                Object.entries(objects).forEach(([key, objectData]) => {
                    if (objectData.itemId === 'pine_sprout' && objectData.growthStartTime) {
                        const growthDuration = 20000; // 20 seconds
                        if (currentTime > objectData.growthStartTime + growthDuration) {
                            const grownPineRef = db.ref(`world_data/${chunkId}/world_objects/${key}`);
                            grownPineRef.update({
                                itemId: 'pine',
                                state: 'grown',
                                growthStartTime: null
                            });
                        }
                    }
                });
            });
        });
    }

    function handleBuildSizeSelection(event) {
        if (!world) return;
        selectedBuildSize = event.target.value;
        const [width, height] = selectedBuildSize.split('x').map(Number);
        
        const playerPosition = world.getPlayerPosition();
        const areaBounds = {
            x: playerPosition.x,
            z: playerPosition.z,
            width: width,
            height: height
        };

        world.drawBuildPreview(areaBounds);
        const isAreaClear = world.checkObjectsInArea(areaBounds);
        
        if (isAreaClear) {
            world.setBuildPreviewColor(0x00ff00); // Green
            confirmBuildButton.disabled = false;
            buildAreaStatus.style.display = 'none';
        } else {
            world.setBuildPreviewColor(0xff0000); // Red
            confirmBuildButton.disabled = true;
            buildAreaStatus.textContent = "El área no está despejada. Mueve los objetos o elige otra zona.";
            buildAreaStatus.style.display = 'block';
        }
    }

    function handleConfirmBuild() {
        if (!world || !selectedBuildSize) return;

        const [width, height] = selectedBuildSize.split('x').map(Number);
        const playerPosition = world.getPlayerPosition();
        const siteChunkId = getChunkIdFromPosition(playerPosition);

        const areaData = {
            center: {
                x: playerPosition.x,
                z: playerPosition.z
            },
            size: {
                width: width,
                height: height
            },
            owner: userId,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            structure: 'none',
            doorState: 'closed'
        };

        db.ref(`world_data/${siteChunkId}/construction_sites`).push(areaData);
        
        buildAreaModal.style.display = 'none';
        world.clearBuildPreview();
        showNotification("¡Éxito!", "Has preparado una nueva zona de obras.");
    }
    
    function showConstructionSignModal(siteId, siteSize, chunkId) {
        activeConstructionSiteId = siteId;
        constructionOptionsDiv.innerHTML = '';

        if (siteSize.width === 14 && siteSize.height === 7) {
            const buildHouseButton = document.createElement('button');
            buildHouseButton.id = 'action-build-house';
            buildHouseButton.textContent = 'Construir Casa';
            buildHouseButton.onclick = () => handleBuildStructure('house_14x7', chunkId);
            constructionOptionsDiv.appendChild(buildHouseButton);
        }
        
        if (siteSize.width === 5 && siteSize.height === 5) {
            const buildPoolButton = document.createElement('button');
            buildPoolButton.id = 'action-build-pool';
            buildPoolButton.textContent = 'Construir Piscina';
            buildPoolButton.onclick = () => handleBuildStructure('pool_5x5', chunkId);
            constructionOptionsDiv.appendChild(buildPoolButton);
        }

        const doNothingButton = document.createElement('button');
        doNothingButton.textContent = 'Nada';
        doNothingButton.onclick = () => { constructionSignModal.style.display = 'none'; };
        constructionOptionsDiv.appendChild(doNothingButton);

        constructionSignModal.style.display = 'flex';
    }

    function handleBuildStructure(structureType, chunkId) {
        if (activeConstructionSiteId) {
            db.ref(`world_data/${chunkId}/construction_sites/${activeConstructionSiteId}`).update({
                structure: structureType
            });
            constructionSignModal.style.display = 'none';
            const typeText = structureType.includes('house') ? 'casa' : 'piscina';
            showNotification("Construyendo...", `Tu ${typeText} se está construyendo.`);
        }
    }

    function showHouseDoorModal(data) {
        activeHouseDoorData = data;
        houseOwnerInfo.textContent = `Esta es la casa de ${data.owner}.`;
        houseDoorOptions.innerHTML = '';

        if (data.owner === userId) {
            const toggleDoorButton = document.createElement('button');
            toggleDoorButton.textContent = 'Abrir/Cerrar Puerta';
            toggleDoorButton.onclick = toggleHouseDoor;
            houseDoorOptions.appendChild(toggleDoorButton);

            const enterStealthButton = document.createElement('button');
            enterStealthButton.textContent = 'Entrar sin abrir';
            enterStealthButton.onclick = enterHouseStealth;
            houseDoorOptions.appendChild(enterStealthButton);
        }

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Nada';
        closeButton.onclick = () => { houseDoorModal.style.display = 'none'; };
        houseDoorOptions.appendChild(closeButton);

        houseDoorModal.style.display = 'flex';
    }


    function toggleHouseDoor() {
        if (!activeHouseDoorData) return;
        const doorRef = db.ref(`world_data/${activeHouseDoorData.chunkId}/construction_sites/${activeHouseDoorData.siteId}/doorState`);
        doorRef.once('value', snapshot => {
            const currentState = snapshot.val();
            const newState = currentState === 'closed' ? 'open' : 'closed';
            doorRef.set(newState);
        });
        houseDoorModal.style.display = 'none';
    }

    function enterHouseStealth() {
        if (!activeHouseDoorData || !world) return;
        world.teleportPlayerIntoHouse(activeHouseDoorData.siteId);
        houseDoorModal.style.display = 'none';
    }

    function showNotification(title, text) {
        notificationTitle.textContent = title;
        notificationText.textContent = text;
        notificationModal.style.display = 'flex';
    }

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
                itemDiv.dataset.itemId = itemId;
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
