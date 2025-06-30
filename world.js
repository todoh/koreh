import * as THREE from 'three';

// Centralized library for asset URLs
const assetLibrary = {
    // Avatars
    ronin: 'https://raw.githubusercontent.com/todoh/koreh/main/ronin.png',
    kunoichi: 'https://raw.githubusercontent.com/todoh/koreh/main/kunoichi.png',
    samurai: 'https://raw.githubusercontent.com/todoh/koreh/main/samurai.png',
    rey: 'https://raw.githubusercontent.com/todoh/koreh/main/rey.png',
    reina: 'https://raw.githubusercontent.com/todoh/koreh/main/reina.png',
    damisela: 'https://raw.githubusercontent.com/todoh/koreh/main/damisela.png',
    ciudadana: 'https://raw.githubusercontent.com/todoh/koreh/main/ciudadana.png',
    pijo: 'https://raw.githubusercontent.com/todoh/koreh/main/pijo.png',
    chamana: 'https://raw.githubusercontent.com/todoh/koreh/main/chamana.png',
    
    // Environment
    grass: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/cesped.jpg',
    stone: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/roca.jpg',
    forest_floor: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/suelobosque.jpg',
    tree_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/arbol.png',
    bush_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/flor.png',
    orange_box: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/caja.png'
};

// Data defining the different maps/rooms in the world
const mapData = {
    'lobby': {
        name: 'Lobby Principal',
        groundTexture: assetLibrary.grass,
        objects: [{ type: 'image', src: assetLibrary.orange_box, position: { x: -10, y: 1.5, z: -10 }, size: { w: 3, h: 3 } }],
        doors: [
            { to: 'dungeon', position: { x: 15, y: 2, z: 0 }, label: 'Al Calabozo' },
            { to: 'forest', position: { x: -15, y: 2, z: 0 }, label: 'Al Bosque' }
        ]
    },
    'dungeon': {
        name: 'El Calabozo',
        groundTexture: assetLibrary.stone,
        objects: [
             { type: 'box', color: 0x888888, position: { x: 5, y: 1, z: 10 }, size: { w: 4, h: 2, d: 2 } },
             { type: 'box', color: 0x888888, position: { x: -5, y: 1, z: 10 }, size: { w: 4, h: 2, d: 2 } }
        ],
        doors: [{ to: 'lobby', position: { x: 0, y: 2, z: -15 }, label: 'Al Lobby' }]
    },
    'forest': {
        name: 'Bosque Encantado',
        groundTexture: assetLibrary.forest_floor,
        objects: [
            { type: 'image', src: assetLibrary.tree_1, position: { x: -10, y: 5, z: -15 }, size: { w: 10, h: 10 } },
            { type: 'image', src: assetLibrary.tree_1, position: { x: 12, y: 5, z: 8 }, size: { w: 10, h: 10 } },
            { type: 'image', src: assetLibrary.bush_1, position: { x: 8, y: 1.5, z: 10 }, size: { w: 4, h: 3 } },
        ],
        doors: [{ to: 'lobby', position: { x: 0, y: 2, z: 15 }, label: 'Al Lobby' }]
    }
};

// The World class encapsulates all Three.js logic
export class World {
    constructor(container, onPlayerMoveCallback, onDoorClickCallback) {
        this.container = container;
        this.onPlayerMove = onPlayerMoveCallback;
        this.onDoorClick = onDoorClickCallback;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.player = null;
        this.remotePlayers = {};
        this.interactableObjects = [];
        this.localPlayerTargetPosition = null;
        
        this.cameraDirection = new THREE.Vector3(0, 15, 12).normalize();
        this.zoomDistance = 10;
        this.minZoom = 4;
        this.maxZoom = 14;
        this.zoomSensitivity = 1;

        this.animationFrameId = null;
        this.textureLoader = new THREE.TextureLoader();
        this.avatarTextures = {}; // Cache for avatar textures

        this.onWindowResize = this.onWindowResize.bind(this);
        this.onCanvasClick = this.onCanvasClick.bind(this);
        this.onMouseWheel = this.onMouseWheel.bind(this);
        this.animate = this.animate.bind(this);
        
        this.preloadAvatarTextures();
    }
    
    preloadAvatarTextures() {
        this.avatarTextures.ronin = this.textureLoader.load(assetLibrary.ronin);
        this.avatarTextures.kunoichi = this.textureLoader.load(assetLibrary.kunoichi);
        this.avatarTextures.samurai = this.textureLoader.load(assetLibrary.samurai);
        this.avatarTextures.rey = this.textureLoader.load(assetLibrary.rey);
        this.avatarTextures.reina = this.textureLoader.load(assetLibrary.reina);
        this.avatarTextures.damisela = this.textureLoader.load(assetLibrary.damisela);
        this.avatarTextures.ciudadana = this.textureLoader.load(assetLibrary.ciudadana);
        this.avatarTextures.pijo = this.textureLoader.load(assetLibrary.pijo);
        this.avatarTextures.chamana = this.textureLoader.load(assetLibrary.chamana);
    }

    init(roomId, playerAvatar) {
        const map = mapData[roomId];
        if (!map) return;
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        
        this.scene.add(new THREE.AmbientLight(0xaaaaaa));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);
        
        const groundTexture = this.textureLoader.load(map.groundTexture);
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(20, 20);
        const planeMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.userData.isGround = true;
        this.scene.add(plane);
        this.interactableObjects.push(plane);
        
        this.createObjectsFromMap(map);

        this.player = this.createPlayerMesh(playerAvatar);
        this.player.position.set(0, 1.75, 0); 
        this.scene.add(this.player);

        window.addEventListener('resize', this.onWindowResize);
        this.renderer.domElement.addEventListener('click', this.onCanvasClick);
        this.renderer.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });

        this.onWindowResize();
        this.animate();
    }
    
    createObjectsFromMap(map) {
        map.objects.forEach(objData => {
            if (objData.type === 'box') {
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(objData.size.w, objData.size.h, objData.size.d), new THREE.MeshStandardMaterial({ color: objData.color }));
                mesh.position.set(objData.position.x, objData.position.y, objData.position.z);
                this.scene.add(mesh);
            } else if (objData.type === 'image' && objData.src) {
                const imageMaterial = new THREE.MeshBasicMaterial({ map: this.textureLoader.load(objData.src), transparent: true, side: THREE.DoubleSide });
                const imageMesh = new THREE.Mesh(new THREE.PlaneGeometry(objData.size.w, objData.size.h), imageMaterial);
                imageMesh.position.set(objData.position.x, objData.position.y, objData.position.z); 
                this.scene.add(imageMesh);
            }
        });

        map.doors.forEach(doorData => {
            const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 0.5), new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.7 }));
            doorMesh.position.set(doorData.position.x, doorData.position.y, doorData.position.z);
            doorMesh.userData = { isDoor: true, to: doorData.to };
            this.scene.add(doorMesh);
            this.interactableObjects.push(doorMesh);
        });
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        }
    }
    
    onCanvasClick(event) {
        if (!this.camera || !this.renderer) return;
        const canvasBounds = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
        this.mouse.y = - ((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
        if (intersects.length > 0) {
            const firstHit = intersects[0].object;
            if (firstHit.userData.isDoor) {
                this.onDoorClick(firstHit.userData);
                return;
            }
            if (firstHit.userData.isGround) {
                this.localPlayerTargetPosition = intersects[0].point;
                this.localPlayerTargetPosition.y = this.player.position.y;
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

        // Animate local player movement and rotation
        if (this.localPlayerTargetPosition) {
            const distance = this.player.position.distanceTo(this.localPlayerTargetPosition);

            if (distance > 0.1) {
                // Move player
                const moveSpeed = 0.04;
                this.player.position.lerp(this.localPlayerTargetPosition, moveSpeed);

                // Rotate player to face target
                const direction = this.localPlayerTargetPosition.clone().sub(this.player.position).normalize();
                if (direction.lengthSq() > 0.001) {
                    const targetAngle = Math.atan2(direction.x, direction.z);
                    const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
                    this.player.quaternion.slerp(targetQuaternion, 0.15); // Use slerp for smooth rotation
                }

                // Send data to other players
                this.onPlayerMove(this.player.position, this.player.quaternion);
            }
        }

        // Animate remote players
        for (const id in this.remotePlayers) {
            const remotePlayer = this.remotePlayers[id];
            if (remotePlayer.mesh) {
                // Smoothly move remote player to their target position
                if (remotePlayer.targetPosition) {
                    remotePlayer.mesh.position.lerp(remotePlayer.targetPosition, 0.1);
                }
                // Smoothly rotate remote player to their target rotation
                if (remotePlayer.targetQuaternion) {
                    remotePlayer.mesh.quaternion.slerp(remotePlayer.targetQuaternion, 0.15);
                }
            }
        }
        
        this.updateCameraPosition();
        this.renderer.render(this.scene, this.camera);
    }

    updateCameraPosition() {
        if (!this.player || !this.camera) return;
        const offset = this.cameraDirection.clone().multiplyScalar(this.zoomDistance);
        this.camera.position.copy(this.player.position).add(offset);
        this.camera.lookAt(this.player.position);
    }
    
    zoomIn() {
        this.zoomDistance -= 2;
        this.zoomDistance = THREE.MathUtils.clamp(this.zoomDistance, this.minZoom, this.maxZoom);
    }

    zoomOut() {
        this.zoomDistance += 2;
        this.zoomDistance = THREE.MathUtils.clamp(this.zoomDistance, this.minZoom, this.maxZoom);
    }
    
    createPlayerMesh(avatarName) {
        const playerHeight = 3.5;
        const texture = this.avatarTextures[avatarName] || this.avatarTextures.ronin;
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        
        let playerWidth = 2.0; // Default width
        const geometry = new THREE.PlaneGeometry(playerWidth, playerHeight);
        
        // ** Apply a fixed vertical tilt to the geometry itself **
        geometry.rotateX(-0.05); 

        const mesh = new THREE.Mesh(geometry, material);

        const setAspectRatio = (tex) => {
            if (tex.image) {
                const aspectRatio = tex.image.width / tex.image.height;
                mesh.geometry.dispose(); // Dispose old geometry
                mesh.geometry = new THREE.PlaneGeometry(playerHeight * aspectRatio, playerHeight);
                geometry.rotateX(-0.15); // Re-apply tilt to new geometry
            }
        };

        if (texture.image) {
            setAspectRatio(texture);
        } else {
            texture.onLoad = setAspectRatio;
        }
        
        mesh.userData.avatarName = avatarName;
        return mesh;
    }
    
    setPlayerAvatar(avatarName) {
        if (this.player && this.avatarTextures[avatarName]) {
            const newTexture = this.avatarTextures[avatarName];
            this.player.material.map = newTexture;
            this.player.material.needsUpdate = true;
            this.player.userData.avatarName = avatarName;
            
            const playerHeight = 3.5;
            const setAspectRatio = (tex) => {
                if(tex.image) {
                    const aspectRatio = tex.image.width / tex.image.height;
                    this.player.geometry.dispose();
                    const newGeometry = new THREE.PlaneGeometry(playerHeight * aspectRatio, playerHeight);
                    newGeometry.rotateX(-0.15); // Apply tilt
                    this.player.geometry = newGeometry;
                }
            };

            if (newTexture.image) {
                setAspectRatio(newTexture);
            } else {
                 newTexture.onLoad = setAspectRatio;
            }
        }
    }

    changeRoom(roomId, playerAvatar) {
        this.dispose();
        this.init(roomId, playerAvatar);
    }

    addOrUpdateRemotePlayer(peerId, peerData) {
        if (!this.scene || !peerData || !peerData.position) return;
        
        if (this.remotePlayers[peerId]) {
            const remotePlayer = this.remotePlayers[peerId];
            remotePlayer.targetPosition = new THREE.Vector3(peerData.position.x, peerData.position.y, peerData.position.z);
            
            if (peerData.quaternion) {
                remotePlayer.targetQuaternion = new THREE.Quaternion(
                    peerData.quaternion._x,
                    peerData.quaternion._y,
                    peerData.quaternion._z,
                    peerData.quaternion._w
                );
            }

            if (remotePlayer.avatar !== peerData.avatar) {
                 remotePlayer.avatar = peerData.avatar;
                 const newTexture = this.avatarTextures[peerData.avatar] || this.avatarTextures.ronin;
                 remotePlayer.mesh.material.map = newTexture;
                 remotePlayer.mesh.material.needsUpdate = true;
                 remotePlayer.mesh.userData.avatarName = peerData.avatar;
                 
                 const playerHeight = 2.5;
                 const setAspectRatio = (tex) => {
                    if (tex.image) {
                        const aspectRatio = tex.image.width / tex.image.height;
                        remotePlayer.mesh.geometry.dispose();
                        const newGeometry = new THREE.PlaneGeometry(playerHeight * aspectRatio, playerHeight);
                        newGeometry.rotateX(-0.15); // Apply tilt
                        remotePlayer.mesh.geometry = newGeometry;
                    }
                 };

                 if (newTexture.image) {
                    setAspectRatio(newTexture);
                 } else {
                    newTexture.onLoad = setAspectRatio;
                 }
            }
        } else {
            const mesh = this.createPlayerMesh(peerData.avatar);
            mesh.position.set(peerData.position.x, peerData.position.y, peerData.position.z);
            this.scene.add(mesh);

            this.remotePlayers[peerId] = { 
                mesh: mesh,
                avatar: peerData.avatar,
                targetPosition: mesh.position.clone(),
                targetQuaternion: mesh.quaternion.clone()
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

    getPlayerPosition() {
        return this.player ? this.player.position : new THREE.Vector3(0, 1.25, 0);
    }

    getMapData(roomId) {
        return mapData[roomId];
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
        
        if (this.scene) {
            this.scene.traverse(object => {
                if (object.isMesh || object.isSprite) {
                    object.geometry?.dispose();
                    if (object.material) {
                         if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
        }
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.localPlayerTargetPosition = null;
        this.remotePlayers = {};
        this.interactableObjects = [];
        this.animationFrameId = null;
    }
}
