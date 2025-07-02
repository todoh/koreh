import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { assetLibrary, itemData } from './world-data.js';
import { createRoninModel, createKunoichiModel } from './modelos3d.js';

export class World {
    constructor(container, onPlayerMoveCallback, onInteractiveObjectClickCallback, onPlayerClickCallback, onGroundClickCallback, chunkSize) {
        this.container = container;
        this.onPlayerMove = onPlayerMoveCallback;
        this.onInteractiveObjectClick = onInteractiveObjectClickCallback;
        this.onPlayerClick = onPlayerClickCallback;
        this.onGroundClick = onGroundClickCallback;
        this.CHUNK_SIZE = chunkSize;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.css2dRenderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.player = null;
        this.remotePlayers = {};
        this.interactableObjects = [];
        this.dynamicObjects = {};
        this.constructionSites = {};
        this.houses = [];
        this.playerCollider = new THREE.Box3();
        this.localPlayerTargetPosition = null;
        
        this.cameraDirection = new THREE.Vector3(0, 15, 12).normalize();
        this.zoomDistance = 10;
        this.minZoom = 4;
        this.maxZoom = 14;
        this.zoomSensitivity = 1;
        
        this.interactionRadius = 5.0; 

        this.animationFrameId = null;
        this.textureLoader = new THREE.TextureLoader();
        this.avatarTextures = {};
        this.itemTextures = {}; 
        this.envTextures = {};
        this.activeChatBubbles = {};

        this.buildPreviewMesh = null;
        
        this.loadedChunks = new Map();

        this.clock = new THREE.Clock();
        this.animatedMaterials = [];

        this.onWindowResize = this.onWindowResize.bind(this);
        this.onCanvasClick = this.onCanvasClick.bind(this);
        this.onMouseWheel = this.onMouseWheel.bind(this);
        this.animate = this.animate.bind(this);
        
        this.preloadTextures();
    }
    
    _createBrickTexture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const canvasSize = 128;
        const brickWidth = 32;
        const brickHeight = 14;
        const mortarGap = 3;
        const brickColor = '#b5651d';
        const mortarColor = '#a9a9a9';
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        ctx.fillStyle = mortarColor;
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.fillStyle = brickColor;
        let isRowOffset = false;
        for (let y = 0; y < canvasSize; y += (brickHeight + mortarGap)) {
            const rowOffset = isRowOffset ? -brickWidth / 2 : 0;
            for (let x = rowOffset; x < canvasSize; x += (brickWidth + mortarGap)) {
                ctx.fillRect(x, y, brickWidth, brickHeight);
            }
            isRowOffset = !isRowOffset;
        }
        return canvas;
    }
 _createDoorTexture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const canvasWidth = 128;
        const canvasHeight = 256; 
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // --- 1. Dibujar tablones con degradado y vetas ---
        const plankCount = 4;
        const plankWidth = canvas.width / plankCount;

        for (let i = 0; i < plankCount; i++) {
            const plankX = i * plankWidth;

            // Crear un degradado lineal para cada tablón para dar volumen
            const gradient = ctx.createLinearGradient(plankX, 0, plankX + plankWidth, 0);
            const baseColor = '#8B4513'; // SaddleBrown
            const lightColor = '#A0522D'; // Sienna
            gradient.addColorStop(0, lightColor);
            gradient.addColorStop(0.5, baseColor);
            gradient.addColorStop(1, lightColor);
            
            ctx.fillStyle = gradient;
            ctx.fillRect(plankX, 0, plankWidth, canvas.height);

            // Efecto de veta de madera mejorado por tablón
            for (let j = 0; j < 40; j++) {
                const x1 = plankX + Math.random() * plankWidth;
                const y1 = Math.random() * canvas.height;
                const length = 10 + Math.random() * 40;
                const angle = (Math.random() - 0.5) * 0.2; // Ligera inclinación

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x1 + Math.sin(angle) * length, y1 + Math.cos(angle) * length);
                
                // Variar opacidad y grosor para un look natural
                ctx.strokeStyle = `rgba(80, 40, 0, ${Math.random() * 0.1 + 0.05})`;
                ctx.lineWidth = Math.random() * 1.5;
                ctx.stroke();
            }
        }
        
        // --- 2. Dibujar las ranuras con sombras para dar profundidad ---
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#542A08'; // Un marrón muy oscuro para las ranuras

        for (let i = 1; i < plankCount; i++) {
            const lineX = i * plankWidth;
            
            // Sombra para la ranura (simula profundidad)
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = -1;
            
            ctx.beginPath();
            ctx.moveTo(lineX, 0);
            ctx.lineTo(lineX, canvas.height);
            ctx.stroke();
            
            // Restablecer sombra para el siguiente elemento
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
        }

        // --- 3. Dibujar el pomo con efecto metálico y sombra ---
        const knobRadius = 9;
        const knobX = canvas.width * 0.82;
        const knobY = canvas.height * 0.5;

        // Sombra proyectada por el pomo sobre la puerta
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Degradado radial para un efecto 3D metálico
        const knobGradient = ctx.createRadialGradient(knobX - 3, knobY - 3, 1, knobX, knobY, knobRadius);
        knobGradient.addColorStop(0, '#FFFDE4');   // Brillo especular
        knobGradient.addColorStop(0.7, '#FFD700'); // Color dorado principal
        knobGradient.addColorStop(1, '#DAA520');   // Sombra en el borde del pomo
        
        ctx.fillStyle = knobGradient;
        
        ctx.beginPath();
        ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
        ctx.fill();

        // Borde sutil para definir el pomo
        ctx.shadowColor = 'transparent'; // Desactivar sombra para el borde
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        return canvas;
    }
    _createGrassTexture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const canvasSize = 256;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        ctx.fillStyle = '#5a8c33';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        for (let i = 0; i < 4000; i++) {
            const x = Math.random() * canvasSize;
            const y = Math.random() * canvasSize;
            const radius = Math.random() * 1.5;
            ctx.fillStyle = Math.random() > 0.5 ? '#6b9c43' : '#4a7b23';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        return canvas;
    }

    _createConstructionTexture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const canvasSize = 256;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        ctx.fillStyle = '#8a7f70';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * canvasSize;
            const y = Math.random() * canvasSize;
            const radius = Math.random() * 2;
            const colorChance = Math.random();
            if (colorChance > 0.66) {
                ctx.fillStyle = '#6b6257';
            } else if (colorChance > 0.33) {
                ctx.fillStyle = '#a89d8e';
            } else {
                ctx.fillStyle = '#5a5249';
            }
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        return canvas;
    }

    _createPineTreeMesh() {
        const pineGroup = new THREE.Group();
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x66402D });
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.7, 4, 8);
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        pineGroup.add(trunk);
        const leavesGeometry = new THREE.ConeGeometry(2.5, 8, 12);
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 6;
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        pineGroup.add(leaves);
        return pineGroup;
    }

    _createPineSproutMesh() {
        const sproutMaterial = new THREE.MeshStandardMaterial({ color: 0x55DD33 });
        const sproutGeometry = new THREE.ConeGeometry(0.4, 1.2, 8);
        const sprout = new THREE.Mesh(sproutGeometry, sproutMaterial);
        sprout.castShadow = true;
        sprout.receiveShadow = true;
        return sprout;
    }

    _createPineSeedMesh() {
        const seedMaterial = new THREE.MeshStandardMaterial({ color: 0x966939 });
        const seedGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const seed = new THREE.Mesh(seedGeometry, seedMaterial);
        seed.castShadow = true;
        seed.receiveShadow = true;
        return seed;
    }

    preloadTextures() {
        Object.keys(assetLibrary).forEach(key => {
            const urlOrKeyword = assetLibrary[key];
            if (urlOrKeyword.startsWith('GENERATED_3D_')) {
                return;
            }
            let generatedTexture = false;
            let canvas;
            if (urlOrKeyword === 'GENERATED_BRICK') {
                canvas = this._createBrickTexture();
                generatedTexture = true;
            } else if (urlOrKeyword === 'GENERATED_GRASS') {
                canvas = this._createGrassTexture();
                generatedTexture = true;
                
            } else if (urlOrKeyword === 'GENERATED_CONSTRUCTION') {
                canvas = this._createConstructionTexture();
                generatedTexture = true;
            

  } else if (urlOrKeyword === 'GENERATED_DOOR') {
                canvas = this._createDoorTexture();
                generatedTexture = true;
            }

            if (generatedTexture) {
                const texture = new THREE.CanvasTexture(canvas);
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                this.envTextures[key] = texture;
            } else {
                const texture = this.textureLoader.load(urlOrKeyword);
                if (['samurai', 'rey', 'reina', 'damisela', 'ciudadana', 'pijo', 'chamana'].includes(key)) {
                    this.avatarTextures[key] = texture;
                } else if (itemData[key]) {
                    this.itemTextures[key] = texture;
                } else {
                    this.envTextures[key] = texture;
                }
            }
        });
    }

    init(playerAvatar, playerName, initialPosition) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 150);
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        this.css2dRenderer = new CSS2DRenderer();
        this.css2dRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.css2dRenderer.domElement.style.position = 'absolute';
        this.css2dRenderer.domElement.style.top = '0px';
        this.css2dRenderer.domElement.style.pointerEvents = 'none';
        this.container.appendChild(this.css2dRenderer.domElement);
        this.scene.add(new THREE.AmbientLight(0x666666));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(20, 50, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        this.player = this.createPlayerMesh(playerAvatar, playerName);
        this.player.position.set(initialPosition.x, 0, initialPosition.z); 
        this.player.userData = { ...this.player.userData, isLocalPlayer: true, username: playerName };
        this.scene.add(this.player);
        this.interactableObjects.push(this.player);
        window.addEventListener('resize', this.onWindowResize);
        this.renderer.domElement.addEventListener('click', this.onCanvasClick);
        this.renderer.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });
        this.onWindowResize();
        this.animate();
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.css2dRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        }
    }
    
    onCanvasClick(event) {
        if (!this.camera || !this.renderer || !this.player) return;
        const canvasBounds = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
        this.mouse.y = -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
        if (intersects.length > 0) {
            const intersection = intersects[0];
            let clickedObject = intersection.object;
            while (clickedObject.parent && !clickedObject.userData.isInteractive && !clickedObject.userData.isLocalPlayer && !clickedObject.userData.isGround) {
                clickedObject = clickedObject.parent;
            }
            const distance = this.player.position.distanceTo(intersection.point);
            if (clickedObject.userData.isInteractive) {
                if (distance <= this.interactionRadius) {
                    this.onInteractiveObjectClick(clickedObject.userData);
                }
            } else if (clickedObject.userData.isLocalPlayer) {
                this.onPlayerClick();
            } else if (clickedObject.userData.isGround) {
                this.localPlayerTargetPosition = intersection.point.clone();
                this.localPlayerTargetPosition.y = 0;
                if (this.onGroundClick) {
                    this.onGroundClick(intersection.point);
                }
            }
        }
    }

    onMouseWheel(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 1 : -1;
        this.zoomDistance += delta * this.zoomSensitivity;
        this.zoomDistance = THREE.MathUtils.clamp(this.zoomDistance, this.minZoom, this.maxZoom);
    }
    
      animate() {
        this.animationFrameId = requestAnimationFrame(this.animate);
        if (!this.renderer || !this.scene || !this.camera || !this.player) return;
        
        const deltaTime = this.clock.getDelta();

        this.animatedMaterials.forEach(material => {
            material.uniforms.time.value += deltaTime;
        });

        // --- LÓGICA DE MOVIMIENTO Y ANIMACIÓN CORREGIDA ---
        let localPlayerIsMoving = false;
        if (this.localPlayerTargetPosition) {
            const playerSpeed = 10.0; // Unidades del mundo por segundo
            const rotationSpeed = 10.0; // Velocidad de la rotación

            const direction = this.localPlayerTargetPosition.clone().sub(this.player.position);
            direction.y = 0; // Nos aseguramos de que el movimiento sea en el plano XZ

            const distanceToTarget = direction.length();

            if (distanceToTarget > 0.1) {
                localPlayerIsMoving = true;
                
                // --- Movimiento ---
                const moveDistance = playerSpeed * deltaTime;
                const moveVector = direction.normalize().multiplyScalar(Math.min(moveDistance, distanceToTarget));
                
                // Aquí podrías añadir tu lógica de colisión antes de aplicar la posición
                this.player.position.add(moveVector);

                // --- Orientación ---
                const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.normalize());
                this.player.quaternion.slerp(targetQuaternion, rotationSpeed * deltaTime);

                this.onPlayerMove(this.player.position, this.player.quaternion);

            } else {
                // El jugador ha llegado a su destino
                this.localPlayerTargetPosition = null;
            }
        }

        // Control de la animación del jugador local
        if (this.player.userData.isMoving !== localPlayerIsMoving) {
            this.player.userData.isMoving = localPlayerIsMoving;
            const action = this.player.userData.walkAction;
            if (action) {
                if (localPlayerIsMoving) {
                    action.reset().fadeIn(0.3).play();
                } else {
                    action.fadeOut(0.3);
                }
            }
        }
        
        this.player.userData.mixer?.update(deltaTime);
        // --- FIN DE LA LÓGICA CORREGIDA ---


        // --- Lógica para jugadores remotos (sin cambios) ---
        for (const id in this.remotePlayers) {
            const remotePlayer = this.remotePlayers[id];
            if (remotePlayer.mesh) {
                if (remotePlayer.targetPosition) {
                    remotePlayer.mesh.position.lerp(remotePlayer.targetPosition, 0.1);
                }
                if (remotePlayer.targetQuaternion) {
                    remotePlayer.mesh.quaternion.slerp(remotePlayer.targetQuaternion, 0.15);
                }
                
                if(remotePlayer.mesh.userData.mixer) {
                    const lastPos = remotePlayer.lastPosition || remotePlayer.mesh.position.clone();
                    const isMoving = remotePlayer.mesh.position.distanceTo(lastPos) > 0.01;
                    const action = remotePlayer.mesh.userData.walkAction;
                    
                    if (remotePlayer.mesh.userData.isMoving !== isMoving) {
                        remotePlayer.mesh.userData.isMoving = isMoving;
                        if (action) {
                            if(isMoving) {
                                action.reset().fadeIn(0.3).play();
                            } else {
                                action.fadeOut(0.3);
                            }
                        }
                    }
                    remotePlayer.mesh.userData.mixer.update(deltaTime);
                    remotePlayer.lastPosition = remotePlayer.mesh.position.clone();
                }
            }
        }

        this.updateHouseOpacity();
        this.updateCameraPosition();
        this.renderer.render(this.scene, this.camera);
        this.css2dRenderer.render(this.scene, this.camera);
    }

    updateCameraPosition() {
        if (!this.player || !this.camera) return;
        const offset = this.cameraDirection.clone().multiplyScalar(this.zoomDistance);
        this.camera.position.copy(this.player.position).add(new THREE.Vector3(0, 1.5, 0)).add(offset);
        this.camera.lookAt(this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    }
    
    loadChunk(chunkId, chunkData) {
        if (this.loadedChunks.has(chunkId)) return;
        const chunkObjects = [];
        const [chunkX, chunkZ] = chunkId.split('_').map(Number);
        const offsetX = chunkX * this.CHUNK_SIZE;
        const offsetZ = chunkZ * this.CHUNK_SIZE;
        const groundTextureKey = chunkData.groundTextureKey || 'grass';
        const groundTexture = this.envTextures[groundTextureKey] || new THREE.Texture();
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(this.CHUNK_SIZE / 8, this.CHUNK_SIZE / 8);
        const planeMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
        const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(this.CHUNK_SIZE, this.CHUNK_SIZE), planeMaterial);
        groundPlane.rotation.x = -Math.PI / 2;
        groundPlane.position.set(offsetX, 0, offsetZ);
        groundPlane.userData = { isGround: true, chunkId: chunkId };
        groundPlane.receiveShadow = true;
        this.scene.add(groundPlane);
        this.interactableObjects.push(groundPlane);
        chunkObjects.push(groundPlane);
        chunkData.objects.forEach(objData => {
            let mesh;
            const objPos = new THREE.Vector3(objData.position.x + offsetX, objData.position.y, objData.position.z + offsetZ);
            if (objData.type === 'interactiveObject' && objData.srcKey) {
                const texture = this.envTextures[objData.srcKey] || new THREE.Texture();
                const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
                mesh = new THREE.Mesh(new THREE.PlaneGeometry(objData.size.w, objData.size.h), material);
                mesh.userData = { isInteractive: true, id: objData.id, name: objData.name, chunkId: chunkId };
                this.interactableObjects.push(mesh);
            }
            if (mesh) {
                mesh.position.copy(objPos);
                mesh.castShadow = true;
                mesh.userData.chunkId = chunkId;
                this.scene.add(mesh);
                chunkObjects.push(mesh);
                if (!mesh.userData.isInteractive) {
                    this.interactableObjects.push(mesh);
                }
            }
        });
        this.loadedChunks.set(chunkId, chunkObjects);
    }

    unloadChunk(chunkId) {
        const chunkObjects = this.loadedChunks.get(chunkId);
        if (chunkObjects) {
            chunkObjects.forEach(obj => {
                this.scene.remove(obj);
                const index = this.interactableObjects.indexOf(obj);
                if (index > -1) this.interactableObjects.splice(index, 1);
                this.disposeOf(obj);
            });
        }
        this.loadedChunks.delete(chunkId);
    }
    
    createPlayerMesh(avatarName, playerName) {
        let mesh;
        let mixer = null;
        let animations = {};

        switch (avatarName) {
            case 'ronin':
                ({ model: mesh, mixer, animations } = createRoninModel());
                break;
            case 'kunoichi':
                ({ model: mesh, mixer, animations } = createKunoichiModel());
                break;
            default:
                const playerHeight = 3.5;
                const texture = this.avatarTextures[avatarName] || this.avatarTextures.samurai;
                const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
                const geometry = new THREE.PlaneGeometry(2.0, playerHeight);
                mesh = new THREE.Mesh(geometry, material);
                const setAspectRatio = (tex) => {
                     if (tex.image) {
                        const aspectRatio = tex.image.width / tex.image.height;
                        mesh.geometry.dispose();
                        mesh.geometry = new THREE.PlaneGeometry(playerHeight * aspectRatio, playerHeight);
                    }
                };
                if (texture && texture.image) { setAspectRatio(texture); } 
                else if (texture) { texture.onLoad = setAspectRatio; }
                mesh.position.y = playerHeight / 2;
        }

        if (playerName) {
            const labelHeight = 3.2; 
            mesh.add(this.createNameLabel(playerName, labelHeight));
        }

        mesh.userData.avatarName = avatarName;
        mesh.userData.mixer = mixer;
        mesh.userData.walkAction = animations.walk ? mixer.clipAction(animations.walk) : null;
        mesh.userData.isMoving = false;

        return mesh;
    }

    addOrUpdateRemotePlayer(peerId, peerData) {
        if (!this.scene || !peerData || !peerData.position) return;
        let remotePlayer = this.remotePlayers[peerId];

        if (remotePlayer) {
            remotePlayer.targetPosition = new THREE.Vector3(peerData.position.x, peerData.position.y, peerData.position.z);
            if (peerData.quaternion) {
                remotePlayer.targetQuaternion = new THREE.Quaternion(peerData.quaternion._x, peerData.quaternion._y, peerData.quaternion._z, peerData.quaternion._w);
            }
            if (remotePlayer.avatar !== peerData.avatar) {
                 const oldMesh = remotePlayer.mesh;
                 const newMesh = this.createPlayerMesh(peerData.avatar, peerData.username);
                 newMesh.position.copy(oldMesh.position);
                 newMesh.quaternion.copy(oldMesh.quaternion);
                 this.scene.remove(oldMesh);
                 this.disposeOf(oldMesh);
                 this.scene.add(newMesh);
                 remotePlayer.mesh = newMesh;
                 remotePlayer.avatar = peerData.avatar;
            }
            if (peerData.chatMessage && (!remotePlayer.lastMessageTimestamp || peerData.chatMessage.timestamp > remotePlayer.lastMessageTimestamp)) {
                this.displayChatMessage(remotePlayer.mesh, peerData.chatMessage.text);
                remotePlayer.lastMessageTimestamp = peerData.chatMessage.timestamp;
            }
            remotePlayer.chunkId = peerData.chunkId;
        } else {
            const mesh = this.createPlayerMesh(peerData.avatar, peerData.username);
            mesh.position.set(peerData.position.x, peerData.position.y, peerData.position.z);
            this.scene.add(mesh);
            this.remotePlayers[peerId] = { 
                mesh: mesh,
                avatar: peerData.avatar,
                username: peerData.username,
                targetPosition: mesh.position.clone(),
                targetQuaternion: mesh.quaternion.clone(),
                lastMessageTimestamp: 0,
                chunkId: peerData.chunkId,
                lastPosition: mesh.position.clone() // Initialize last position
            };
        }
    }

    removeRemotePlayer(peerId) {
        const remotePlayer = this.remotePlayers[peerId];
        if (remotePlayer?.mesh && this.scene) {
            this.scene.remove(remotePlayer.mesh);
            this.disposeOf(remotePlayer.mesh);
            delete this.remotePlayers[peerId];
        }
    }

    removeRemotePlayersFromChunk(chunkId) {
        for (const peerId in this.remotePlayers) {
            if (this.remotePlayers[peerId].chunkId === chunkId) {
                this.removeRemotePlayer(peerId);
            }
        }
    }

    addDynamicObject(key, data, chunkId) {
        if (!this.scene || this.dynamicObjects[key]) return;
        const itemProps = itemData[data.itemId];
        if (!itemProps) return;
        let mesh;
        const size = itemProps.size || { w: 1, h: 1 };
        switch (data.itemId) {
            case 'pine':
                mesh = this._createPineTreeMesh();
                mesh.position.set(data.position.x, 0, data.position.z);
                break;
            case 'pine_sprout':
                mesh = this._createPineSproutMesh();
                mesh.position.set(data.position.x, size.h / 2, data.position.z);
                break;
            case 'pine_seed':
                mesh = this._createPineSeedMesh();
                mesh.position.set(data.position.x, size.h / 2, data.position.z);
                break;
            default:
                const texture = this.itemTextures[data.itemId];
                if (!texture) return;
                const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
                const geometry = new THREE.PlaneGeometry(size.w, size.h);
                mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(data.position.x, size.h / 2, data.position.z);
                break;
        }
        mesh.userData = { 
            isInteractive: true, 
            isPlacedObject: true, 
            itemId: data.itemId, 
            uniqueId: key,
            name: itemProps.name || 'Objeto',
            size: size,
            chunkId: chunkId,
            collidable: itemProps.collidable !== false
        };
        if (mesh.isGroup) {
            mesh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        } else {
             mesh.castShadow = true;
        }
        this.scene.add(mesh);
        this.interactableObjects.push(mesh);
        this.dynamicObjects[key] = mesh;
    }

    updateDynamicObject(key, data) {
        const oldMesh = this.dynamicObjects[key];
        if (!oldMesh) return;
        if (oldMesh.userData.itemId !== data.itemId) {
            const chunkId = oldMesh.userData.chunkId;
            const position = oldMesh.position.clone(); 
            this.removeDynamicObject(key);
            const newData = { ...data, position: { x: position.x, z: position.z } };
            this.addDynamicObject(key, newData, chunkId);
        }
    }

    removeDynamicObject(key) {
        const mesh = this.dynamicObjects[key];
        if (!mesh) return;
        this.scene.remove(mesh);
        const index = this.interactableObjects.indexOf(mesh);
        if (index > -1) this.interactableObjects.splice(index, 1);
        this.disposeOf(mesh);
        delete this.dynamicObjects[key];
    }
    
    createConstructionSite(key, data, chunkId) {
        if (this.constructionSites[key]) return;
        const texture = this.envTextures['obra'] || new THREE.Texture();
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(data.size.width / 2, data.size.height / 2);
        const geometry = new THREE.PlaneGeometry(data.size.width, data.size.height);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const siteMesh = new THREE.Mesh(geometry, material);
        siteMesh.rotation.x = -Math.PI / 2;
        siteMesh.position.set(data.center.x, 0.01, data.center.z);
        siteMesh.userData.chunkId = chunkId;
        this.scene.add(siteMesh);
        this.constructionSites[key] = { siteMesh, signMesh: null, structure: null, houseObject: null, chunkId };
        if (data.structure && data.structure !== 'none') {
            this.updateConstructionSite(key, data);
        } else {
            const signTexture = this.envTextures['cartelobra'] || new THREE.Texture();
            const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true });
            const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), signMaterial);
            signMesh.position.set(data.center.x, 1, data.center.z);
            signMesh.userData = {
                isInteractive: true,
                id: 'construction_sign',
                name: 'Cartel de Obra',
                siteId: key,
                siteSize: data.size,
                chunkId: chunkId
            };
            this.scene.add(signMesh);
            this.interactableObjects.push(signMesh);
            this.constructionSites[key].signMesh = signMesh;
        }
    }
    
    updateConstructionSite(key, data) {
        const site = this.constructionSites[key];
        if (!site) return;
        if (data.structure === 'house_14x7' && !site.structure) {
            this.createHouse(key, data);
        } else if (data.structure === 'pool_5x5' && !site.structure) {
            this.createPool(key, data);
        }
        if (site.houseObject && site.houseObject.door && site.houseObject.door.userData.state !== data.doorState) {
            const doorMesh = site.houseObject.door;
            const doorHinge = doorMesh.userData.hinge;
            doorMesh.userData.state = data.doorState;
            const staticIndex = this.interactableObjects.indexOf(doorMesh);
            if (data.doorState === 'open') {
                doorHinge.rotation.y = -Math.PI / 1.8;
                if (staticIndex > -1) this.interactableObjects.splice(staticIndex, 1);
            } else {
                doorHinge.rotation.y = 0;
                if (staticIndex === -1) this.interactableObjects.push(doorMesh);
            }
        }
    }
    
    createPool(siteId, data) {
        const site = this.constructionSites[siteId];
        if (site.structure) return;
        site.structure = 'pool_5x5';
        if (site.signMesh) {
            this.scene.remove(site.signMesh);
            const signIndex = this.interactableObjects.indexOf(site.signMesh);
            if (signIndex > -1) this.interactableObjects.splice(signIndex, 1);
            this.disposeOf(site.signMesh);
            site.signMesh = null;
        }
        const center = data.center;
        const size = data.size;
        const borderThickness = 0.4;
        const borderHeight = 0.5;
        const borderMaterial = new THREE.MeshStandardMaterial({ map: this.envTextures['obra'] });
        const poolParts = [];
        const createBorderWall = (w, d, pos) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, borderHeight, d), borderMaterial);
            wall.position.copy(pos);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.userData.chunkId = site.chunkId;
            this.scene.add(wall);
            this.interactableObjects.push(wall);
            poolParts.push(wall);
        };
        createBorderWall(size.width, borderThickness, new THREE.Vector3(center.x, borderHeight / 2, center.z - size.height / 2 + borderThickness / 2));
        createBorderWall(borderThickness, size.height - (borderThickness * 2), new THREE.Vector3(center.x - size.width / 2 + borderThickness / 2, borderHeight / 2, center.z));
        createBorderWall(borderThickness, size.height - (borderThickness * 2), new THREE.Vector3(center.x + size.width / 2 - borderThickness / 2, borderHeight / 2, center.z));
        const entranceWidth = 1.5;
        const frontWallSideWidth = (size.width - entranceWidth) / 2;
        const leftFrontWallCenter = center.x - (size.width / 2) + (frontWallSideWidth / 2);
        createBorderWall(frontWallSideWidth, borderThickness, new THREE.Vector3(leftFrontWallCenter, borderHeight / 2, center.z + size.height / 2 - borderThickness / 2));
        const rightFrontWallCenter = center.x + (size.width / 2) - (frontWallSideWidth / 2);
        createBorderWall(frontWallSideWidth, borderThickness, new THREE.Vector3(rightFrontWallCenter, borderHeight / 2, center.z + size.height / 2 - borderThickness / 2));
        const waterSize = { w: size.width - (borderThickness * 2), h: size.height - (borderThickness * 2) };
        const waterGeometry = new THREE.PlaneGeometry(waterSize.w, waterSize.h);
        const waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 1.0 },
                color: { value: new THREE.Color(0x3399ff) }
            },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `uniform float time; uniform vec3 color; varying vec2 vUv; void main() { vec2 p = vUv; float sx = sin(p.x * 20.0 + time * 2.0) * 0.03; float sy = cos(p.y * 20.0 + time * 2.2) * 0.03; vec2 distortedUv = vec2(p.x + sx, p.y + sy); float wave = sin(distortedUv.y * 30.0 + time * 3.0) * 0.5 + 0.5; gl_FragColor = vec4(color * (0.8 + wave * 0.2), 0.85); }`,
            transparent: true
        });
        this.animatedMaterials.push(waterMaterial);
        const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        waterMesh.rotation.x = -Math.PI / 2;
        waterMesh.position.set(center.x, borderHeight - 0.1, center.z);
        waterMesh.userData = { collidable: false, chunkId: site.chunkId };
        this.scene.add(waterMesh);
        poolParts.push(waterMesh);
        site.houseObject = { parts: poolParts };
    }

    createHouse(siteId, data) {
        const site = this.constructionSites[siteId];
        if (site.structure) return;
        site.structure = 'house_14x7';
        const houseParts = [];
        if (site.signMesh) {
            this.scene.remove(site.signMesh);
            const signIndex = this.interactableObjects.indexOf(site.signMesh);
            if (signIndex > -1) this.interactableObjects.splice(signIndex, 1);
            this.disposeOf(site.signMesh);
            site.signMesh = null;
        }
        const center = data.center;
        const size = data.size;
        const wallHeight = 4;
        const wallThickness = 0.5;
        const baseWallMaterial = new THREE.MeshStandardMaterial({
            map: this.envTextures['pared'],
            transparent: true,
            opacity: 1.0
        });
        const createWall = (w, h, d, pos) => {
            const wallMaterial = baseWallMaterial.clone();
            if (w === wallThickness) {
                wallMaterial.map.repeat.set(d, h);
            } else {
                wallMaterial.map.repeat.set(w, h);
            }
            wallMaterial.map.needsUpdate = true;
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMaterial);
            wall.position.copy(pos);
            wall.castShadow = true;
            wall.receiveShadow = true;
            wall.userData.chunkId = site.chunkId;
            this.scene.add(wall);
            this.interactableObjects.push(wall);
            houseParts.push(wall);
        };
        const backWallPos = new THREE.Vector3(center.x, wallHeight / 2, center.z - size.height / 2 + wallThickness / 2);
        createWall(size.width, wallHeight, wallThickness, backWallPos);
        const doorWidth = 3;
        const doorHeight = 3.6;
        const frontWallSideWidth = (size.width - doorWidth) / 2;
        const frontWallLeftPos = new THREE.Vector3(center.x - doorWidth / 2 - frontWallSideWidth / 2, wallHeight / 2, center.z + size.height / 2 - wallThickness / 2);
        createWall(frontWallSideWidth, wallHeight, wallThickness, frontWallLeftPos);
        const frontWallRightPos = new THREE.Vector3(center.x + doorWidth / 2 + frontWallSideWidth / 2, wallHeight / 2, center.z + size.height / 2 - wallThickness / 2);
        createWall(frontWallSideWidth, wallHeight, wallThickness, frontWallRightPos);
        const frontWallTopPos = new THREE.Vector3(center.x, doorHeight + (wallHeight - doorHeight) / 2, center.z + size.height / 2 - wallThickness / 2);
        createWall(doorWidth, wallHeight - doorHeight, wallThickness, frontWallTopPos);
        const leftWallPos = new THREE.Vector3(center.x - size.width / 2 + wallThickness / 2, wallHeight / 2, center.z);
        createWall(wallThickness, wallHeight, size.height, leftWallPos);
        const rightWallPos = new THREE.Vector3(center.x + size.width / 2 - wallThickness / 2, wallHeight / 2, center.z);
        createWall(wallThickness, wallHeight, size.height, rightWallPos);
        const doorMaterial = new THREE.MeshStandardMaterial({ map: this.envTextures['puerta'], transparent: true });
        const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.2), doorMaterial);
        const doorHinge = new THREE.Group();
        doorHinge.position.set(center.x - doorWidth / 2, 0, center.z + size.height / 2 - wallThickness / 2);
        this.scene.add(doorHinge);
        doorMesh.position.set(doorWidth / 2, doorHeight / 2, 0);
        doorHinge.add(doorMesh);
        doorMesh.userData = { isInteractive: true, id: 'house_door', name: 'Puerta', siteId: siteId, owner: data.owner, state: data.doorState || 'closed', hinge: doorHinge, chunkId: site.chunkId };
        this.interactableObjects.push(doorMesh);
        houseParts.push(doorMesh);
        site.houseObject = { parts: houseParts, door: doorMesh, hinge: doorHinge };
        const houseBounds = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(center.x, wallHeight / 2, center.z), new THREE.Vector3(size.width, wallHeight, size.height));
        this.houses.push({ walls: houseParts, bounds: houseBounds });
    }

    updateHouseOpacity() {
        if (!this.player) return;
        const playerPosition = this.player.position;
        this.houses.forEach(house => {
            const isInside = house.bounds.containsPoint(playerPosition);
            const targetOpacity = isInside ? 0.1 : 1.0;
            if (house.walls.length > 0 && house.walls[0].material.opacity !== targetOpacity) {
                house.walls.forEach(wall => {
                    if(wall.material.isMaterial) {
                        wall.material.opacity = targetOpacity;
                    }
                });
            }
        });
    }

    removeConstructionSite(key) {
        const site = this.constructionSites[key];
        if (site) {
            [site.siteMesh, site.signMesh].forEach(mesh => {
                if (mesh) {
                    this.scene.remove(mesh);
                    const index = this.interactableObjects.indexOf(mesh);
                    if (index > -1) this.interactableObjects.splice(index, 1);
                    this.disposeOf(mesh);
                }
            });
            if (site.houseObject) {
                site.houseObject.parts.forEach(part => {
                    this.scene.remove(part);
                    const index = this.interactableObjects.indexOf(part);
                    if (index > -1) this.interactableObjects.splice(index, 1);
                    this.disposeOf(part);
                });
                if (site.houseObject.hinge) this.scene.remove(site.houseObject.hinge);
            }
            delete this.constructionSites[key];
        }
    }

    disposeOf(object) {
        if (!object) return;
        if (object.isGroup) {
            object.traverse(child => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    if(child.material.isMaterial) {
                        child.material.dispose();
                    }
                }
            });
        } else if (object.isMesh) {
            object.geometry?.dispose();
            if(object.material.isMaterial) {
                object.material.dispose();
            }
        }
    }

    dispose() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        window.removeEventListener('resize', this.onWindowResize);
        if (this.renderer) {
            this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
            this.renderer.domElement.removeEventListener('wheel', this.onMouseWheel);
            this.renderer.dispose();
            if (this.renderer.domElement.parentElement) {
                this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
            }
        }
        if (this.css2dRenderer?.domElement.parentElement) {
            this.css2dRenderer.domElement.parentElement.removeChild(this.css2dRenderer.domElement);
        }
        this.loadedChunks.forEach((_, chunkId) => this.unloadChunk(chunkId));
        this.scene = null; this.camera = null; this.renderer = null; this.css2dRenderer = null;
        this.player = null; this.localPlayerTargetPosition = null;
        this.remotePlayers = {}; this.interactableObjects = []; this.dynamicObjects = {};
        this.constructionSites = {}; this.houses = [];
        this.animationFrameId = null;
    }
    
    zoomIn() { this.zoomDistance = Math.max(this.minZoom, this.zoomDistance - 2); }
    zoomOut() { this.zoomDistance = Math.min(this.maxZoom, this.zoomDistance + 2); }

    createNameLabel(text, yOffset = 2.5) {
        const div = document.createElement('div');
        div.className = 'player-label';
        div.textContent = text;
        const label = new CSS2DObject(div);
        label.position.set(0, yOffset, 0);
        return label;
    }

    displayChatMessage(playerMesh, message) {
        if (playerMesh.userData.chatBubble) playerMesh.remove(playerMesh.userData.chatBubble);
        if (playerMesh.userData.chatTimeout) clearTimeout(playerMesh.userData.chatTimeout);
        const div = document.createElement('div');
        div.className = 'chat-label';
        div.textContent = message;
        const chatLabel = new CSS2DObject(div);
        const bubbleHeight = 3.5;
        chatLabel.position.set(0, bubbleHeight, 0);
        playerMesh.add(chatLabel);
        playerMesh.userData.chatBubble = chatLabel;
        playerMesh.userData.chatTimeout = setTimeout(() => {
            if(playerMesh.userData.chatBubble) playerMesh.remove(playerMesh.userData.chatBubble);
            playerMesh.userData.chatBubble = null;
        }, 7000);
    }

    setPlayerAvatar(avatarName) {
        if (!this.player || this.player.userData.avatarName === avatarName) return;

        const oldPlayer = this.player;
        const position = oldPlayer.position.clone();
        const username = oldPlayer.userData.username;

        this.scene.remove(oldPlayer);
        const index = this.interactableObjects.indexOf(oldPlayer);
        if (index > -1) this.interactableObjects.splice(index, 1);
        this.disposeOf(oldPlayer);

        this.player = this.createPlayerMesh(avatarName, username);
        this.player.position.copy(position);
        this.player.userData.isLocalPlayer = true;
        this.player.userData.username = username;
        
        this.scene.add(this.player);
        this.interactableObjects.push(this.player);
    }

    getPlayerPosition() { return this.player ? this.player.position : new THREE.Vector3(0, 0, 0); }

    drawBuildPreview(area) {
        this.clearBuildPreview();
        const geometry = new THREE.PlaneGeometry(area.width, area.height);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.buildPreviewMesh = new THREE.Mesh(geometry, material);
        this.buildPreviewMesh.rotation.x = -Math.PI / 2;
        this.buildPreviewMesh.position.set(area.x, 0.01, area.z);
        this.scene.add(this.buildPreviewMesh);
    }

    clearBuildPreview() {
        if (this.buildPreviewMesh) {
            this.scene.remove(this.buildPreviewMesh);
            this.disposeOf(this.buildPreviewMesh);
            this.buildPreviewMesh = null;
        }
    }

    setBuildPreviewColor(color) {
        if (this.buildPreviewMesh) this.buildPreviewMesh.material.color.set(color);
    }

    checkObjectsInArea(area) {
        const buildBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(area.x, 1, area.z), new THREE.Vector3(area.width, 2, area.height));
        for (const obj of this.interactableObjects) {
            if (obj.userData.isGround || obj.userData.isLocalPlayer || obj.userData.collidable === false) continue;
            if (buildBox.intersectsBox(new THREE.Box3().setFromObject(obj))) return false;
        }
        return true;
    }

    teleportPlayerIntoHouse(siteId) {
        const site = this.constructionSites[siteId];
        if (site && this.player && site.siteMesh) {
            const center = site.siteMesh.position;
            this.player.position.set(center.x, this.player.position.y, center.z + site.siteMesh.geometry.parameters.height / 2 - 2);
            this.localPlayerTargetPosition = null;
        }
    }}