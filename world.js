import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { assetLibrary, itemData } from './world-data.js';

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
        
        // NEW: Keep track of all meshes belonging to each chunk
        this.loadedChunks = new Map();

        this.onWindowResize = this.onWindowResize.bind(this);
        this.onCanvasClick = this.onCanvasClick.bind(this);
        this.onMouseWheel = this.onMouseWheel.bind(this);
        this.animate = this.animate.bind(this);
        
        this.preloadTextures();
    }
    
    preloadTextures() {
        Object.keys(assetLibrary).forEach(key => {
            const url = assetLibrary[key];
            const texture = this.textureLoader.load(url);
            if (['ronin', 'kunoichi', 'samurai', 'rey', 'reina', 'damisela', 'ciudadana', 'pijo', 'chamana'].includes(key)) {
                this.avatarTextures[key] = texture;
            } else if (itemData[key]) {
                this.itemTextures[key] = texture;
            } else {
                this.envTextures[key] = texture;
            }
        });
    }

    init(playerAvatar, playerName, initialPosition) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
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
        this.player.position.set(initialPosition.x, initialPosition.y, initialPosition.z); 
        this.player.userData = { isLocalPlayer: true };
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
                this.localPlayerTargetPosition.y = this.player.position.y;
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

        if (this.localPlayerTargetPosition) {
            const potentialNextPosition = this.player.position.clone().lerp(this.localPlayerTargetPosition, 0.05);
            
            const playerSize = new THREE.Vector3(0.8, 3.5, 0.8);
            this.playerCollider.setFromCenterAndSize(potentialNextPosition, playerSize);

            let collision = false;
            for (const obj of this.interactableObjects) {
                // **FIX**: Skip ground, the player, and the construction sign for collision checks
                if (obj.userData.isGround || obj.userData.isLocalPlayer || obj.userData.id === 'construction_sign') {
                    continue;
                }
                const objectCollider = new THREE.Box3().setFromObject(obj);
                if (this.playerCollider.intersectsBox(objectCollider)) {
                    collision = true;
                    break;
                }
            }

            if (!collision) {
                this.player.position.copy(potentialNextPosition);

                const direction = this.localPlayerTargetPosition.clone().sub(this.player.position).normalize();
                if (direction.lengthSq() > 0.001) {
                    const targetAngle = Math.atan2(direction.x, direction.z);
                    const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
                    this.player.quaternion.slerp(targetQuaternion, 0.15);
                }

                this.onPlayerMove(this.player.position, this.player.quaternion);

                if (this.player.position.distanceTo(this.localPlayerTargetPosition) < 0.1) {
                    this.localPlayerTargetPosition = null;
                }
            } else {
                this.localPlayerTargetPosition = null;
            }
        }

        for (const id in this.remotePlayers) {
            const remotePlayer = this.remotePlayers[id];
            if (remotePlayer.mesh) {
                if (remotePlayer.targetPosition) {
                    remotePlayer.mesh.position.lerp(remotePlayer.targetPosition, 0.1);
                }
                if (remotePlayer.targetQuaternion) {
                    remotePlayer.mesh.quaternion.slerp(remotePlayer.targetQuaternion, 0.15);
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
        this.camera.position.copy(this.player.position).add(offset);
        this.camera.lookAt(this.player.position);
    }
    
    // --- NEW: Chunk Loading / Unloading ---

    loadChunk(chunkId, chunkData) {
        if (this.loadedChunks.has(chunkId)) return;

        const chunkObjects = [];
        const [chunkX, chunkZ] = chunkId.split('_').map(Number);
        const offsetX = chunkX * this.CHUNK_SIZE;
        const offsetZ = chunkZ * this.CHUNK_SIZE;

        // 1. Create Ground
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

        // 2. Create Static Objects
        chunkData.objects.forEach(objData => {
            let mesh;
            const objPos = new THREE.Vector3(objData.position.x + offsetX, objData.position.y, objData.position.z + offsetZ);

            if (objData.type === 'box') {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(objData.size.w, objData.size.h, objData.size.d), new THREE.MeshStandardMaterial({ color: objData.color }));
            } else if (objData.type === 'image' && objData.srcKey) {
                const texture = this.envTextures[objData.srcKey] || new THREE.Texture();
                const imageMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
                mesh = new THREE.Mesh(new THREE.PlaneGeometry(objData.size.w, objData.size.h), imageMaterial);
            } else if (objData.type === 'interactiveObject' && objData.srcKey) {
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
                    this.interactableObjects.push(mesh); // Add for collision
                }
            }
        });

        this.loadedChunks.set(chunkId, chunkObjects);
    }

    unloadChunk(chunkId) {
        const chunkObjects = this.loadedChunks.get(chunkId);
        if (chunkObjects) {
            chunkObjects.forEach(obj => {
                // Remove from scene
                this.scene.remove(obj);

                // Remove from interactables array
                const index = this.interactableObjects.indexOf(obj);
                if (index > -1) {
                    this.interactableObjects.splice(index, 1);
                }
                
                // Dispose of geometry and materials
                obj.geometry?.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
        this.loadedChunks.delete(chunkId);
    }

    // --- Player & Object Management ---
    
    createPlayerMesh(avatarName, playerName) {
        const playerHeight = 3.5;
        const texture = this.avatarTextures[avatarName] || this.avatarTextures.ronin;
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        
        const geometry = new THREE.PlaneGeometry(2.0, playerHeight);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;

        const setAspectRatio = (tex) => {
            if (tex.image) {
                const aspectRatio = tex.image.width / tex.image.height;
                mesh.geometry.dispose();
                mesh.geometry = new THREE.PlaneGeometry(playerHeight * aspectRatio, playerHeight);
            }
        };

        if (texture.image) { setAspectRatio(texture); } 
        else { texture.onLoad = setAspectRatio; }
        
        if (playerName) {
            mesh.add(this.createNameLabel(playerName));
        }

        mesh.userData.avatarName = avatarName;
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
                 remotePlayer.avatar = peerData.avatar;
                 const newTexture = this.avatarTextures[peerData.avatar] || this.avatarTextures.ronin;
                 remotePlayer.mesh.material.map = newTexture;
                 remotePlayer.mesh.material.needsUpdate = true;
            }
            if (peerData.chatMessage && (!remotePlayer.lastMessageTimestamp || peerData.chatMessage.timestamp > remotePlayer.lastMessageTimestamp)) {
                this.displayChatMessage(remotePlayer.mesh, peerData.chatMessage.text);
                remotePlayer.lastMessageTimestamp = peerData.chatMessage.timestamp;
            }
            remotePlayer.chunkId = peerData.chunkId; // Update chunkId

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
                chunkId: peerData.chunkId
            };
        }
    }

    removeRemotePlayer(peerId) {
        if (this.remotePlayers[peerId]?.mesh && this.scene) {
            this.scene.remove(this.remotePlayers[peerId].mesh);
            this.remotePlayers[peerId].mesh.geometry.dispose();
            this.remotePlayers[peerId].mesh.material.dispose();
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
        if (!itemProps || !this.itemTextures[data.itemId]) return;

        const texture = this.itemTextures[data.itemId];
        const size = itemProps.size || { w: 1, h: 1 };

        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        const geometry = new THREE.PlaneGeometry(size.w, size.h);
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(data.position.x, size.h / 2, data.position.z);

        mesh.userData = { 
            isInteractive: true, 
            isPlacedObject: true, 
            itemId: data.itemId, 
            uniqueId: key,
            name: itemProps.name || 'Objeto',
            size: size,
            chunkId: chunkId
        };
        mesh.castShadow = true;

        this.scene.add(mesh);
        this.interactableObjects.push(mesh);
        this.dynamicObjects[key] = mesh;
    }

    updateDynamicObject(key, data) {
        const mesh = this.dynamicObjects[key];
        if (!mesh) return;

        if (mesh.userData.itemId !== data.itemId) {
            const newItemProps = itemData[data.itemId];
            if (!newItemProps || !this.itemTextures[data.itemId]) return;

            mesh.material.map = this.itemTextures[data.itemId];
            const newSize = newItemProps.size || { w: 1, h: 1 };
            mesh.geometry.dispose();
            mesh.geometry = new THREE.PlaneGeometry(newSize.w, newSize.h);
            mesh.position.y = newSize.h / 2;
            mesh.userData.itemId = data.itemId;
            mesh.userData.name = newItemProps.name || 'Objeto';
            mesh.userData.size = newSize;
        }
    }

    removeDynamicObject(key) {
        const mesh = this.dynamicObjects[key];
        if (!mesh) return;
        this.scene.remove(mesh);
        const index = this.interactableObjects.indexOf(mesh);
        if (index > -1) this.interactableObjects.splice(index, 1);
        mesh.geometry.dispose();
        mesh.material.dispose();
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
      //  this.interactableObjects.push(siteMesh);

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
        }

        if (site.houseObject && site.houseObject.door && site.houseObject.door.userData.state !== data.doorState) {
            const doorMesh = site.houseObject.door;
            const doorHinge = doorMesh.userData.hinge;
            doorMesh.userData.state = data.doorState;
            const staticIndex = this.interactableObjects.indexOf(doorMesh);

            if (data.doorState === 'open') {
                doorHinge.rotation.y = -Math.PI / 1.8;
                if (staticIndex > -1) this.interactableObjects.splice(staticIndex, 1);
            } else { // closed
                doorHinge.rotation.y = 0;
                if (staticIndex === -1) this.interactableObjects.push(doorMesh);
            }
        }
    }
    
    createHouse(siteId, data) {
        const site = this.constructionSites[siteId];
        if (site.structure) return;
        site.structure = 'house_14x7';

        if (site.signMesh) {
            this.scene.remove(site.signMesh);
            const signIndex = this.interactableObjects.indexOf(site.signMesh);
            if (signIndex > -1) this.interactableObjects.splice(signIndex, 1);
            site.signMesh.geometry.dispose();
            site.signMesh.material.dispose();
            site.signMesh = null;
        }

        const center = data.center;
        const size = data.size;
        const wallHeight = 4;
        const wallThickness = 0.5;
        const wallMaterial = new THREE.MeshStandardMaterial({ map: this.envTextures['pared'], transparent: true, opacity: 1.0 });
        const houseParts = [];

        const createWall = (w, h, d, pos) => {
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
        if (doorMesh.userData.state === 'closed') this.interactableObjects.push(doorMesh);
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
                    wall.material.opacity = targetOpacity;
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
                    mesh.geometry?.dispose();
                    mesh.material?.dispose();
                }
            });
            if (site.houseObject) {
                site.houseObject.parts.forEach(part => {
                    this.scene.remove(part);
                    const index = this.interactableObjects.indexOf(part);
                    if (index > -1) this.interactableObjects.splice(index, 1);
                    part.geometry?.dispose();
                    part.material?.dispose();
                });
                if (site.houseObject.hinge) this.scene.remove(site.houseObject.hinge);
            }
            delete this.constructionSites[key];
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
    
    // Helper methods not needing major changes
    zoomIn() { this.zoomDistance = Math.max(this.minZoom, this.zoomDistance - 2); }
    zoomOut() { this.zoomDistance = Math.min(this.maxZoom, this.zoomDistance + 2); }
    createNameLabel(text) {
        const div = document.createElement('div');
        div.className = 'player-label';
        div.textContent = text;
        const label = new CSS2DObject(div);
        label.position.set(0, 2.5, 0);
        return label;
    }
    displayChatMessage(playerMesh, message) {
        if (playerMesh.userData.chatBubble) playerMesh.remove(playerMesh.userData.chatBubble);
        if (playerMesh.userData.chatTimeout) clearTimeout(playerMesh.userData.chatTimeout);
        const div = document.createElement('div');
        div.className = 'chat-label';
        div.textContent = message;
        const chatLabel = new CSS2DObject(div);
        chatLabel.position.set(0, (playerMesh.geometry.parameters.height || 3.5) + 0.5, 0);
        playerMesh.add(chatLabel);
        playerMesh.userData.chatBubble = chatLabel;
        playerMesh.userData.chatTimeout = setTimeout(() => {
            playerMesh.remove(chatLabel);
            playerMesh.userData.chatBubble = null;
        }, 7000);
    }
    setPlayerAvatar(avatarName) {
        if (this.player && this.avatarTextures[avatarName]) {
            this.player.material.map = this.avatarTextures[avatarName];
        }
    }
    getPlayerPosition() { return this.player ? this.player.position : new THREE.Vector3(0, 1.75, 0); }
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
            this.buildPreviewMesh.geometry.dispose();
            this.buildPreviewMesh.material.dispose();
            this.buildPreviewMesh = null;
        }
    }
    setBuildPreviewColor(color) {
        if (this.buildPreviewMesh) this.buildPreviewMesh.material.color.set(color);
    }
    checkObjectsInArea(area) {
        const buildBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(area.x, 1, area.z), new THREE.Vector3(area.width, 2, area.height));
        for (const obj of this.interactableObjects) {
            if (obj.userData.isGround || obj.userData.isLocalPlayer) continue;
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
    }
}
