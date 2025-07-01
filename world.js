import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { assetLibrary, mapData } from './world-data.js';

// The World class encapsulates all Three.js logic
export class World {
    constructor(container, onPlayerMoveCallback, onDoorClickCallback, onPlayerClickCallback, onInteractiveObjectClickCallback) {
        this.container = container;
        this.onPlayerMove = onPlayerMoveCallback;
        this.onDoorClick = onDoorClickCallback;
        this.onPlayerClick = onPlayerClickCallback;
        this.onInteractiveObjectClick = onInteractiveObjectClickCallback;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.css2dRenderer = null; // For name labels
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
        
        // The maximum distance to interact with an object.
        this.interactionRadius = 5.0; 

        this.animationFrameId = null;
        this.textureLoader = new THREE.TextureLoader();
        this.avatarTextures = {}; // Cache for avatar textures
        this.activeChatBubbles = {}; // To manage chat bubble timeouts

        this.onWindowResize = this.onWindowResize.bind(this);
        this.onCanvasClick = this.onCanvasClick.bind(this);
        this.onMouseWheel = this.onMouseWheel.bind(this);
        this.animate = this.animate.bind(this);
        
        this.preloadAvatarTextures();
    }
    
    preloadAvatarTextures() {
        Object.keys(assetLibrary).forEach(key => {
            if (['ronin', 'kunoichi', 'samurai', 'rey', 'reina', 'damisela', 'ciudadana', 'pijo', 'chamana'].includes(key)) {
                this.avatarTextures[key] = this.textureLoader.load(assetLibrary[key]);
            }
        });
    }

    init(roomId, playerAvatar, playerName) {
        const map = mapData[roomId];
        if (!map) return;
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.css2dRenderer = new CSS2DRenderer();
        this.css2dRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.css2dRenderer.domElement.style.position = 'absolute';
        this.css2dRenderer.domElement.style.top = '0px';
        this.css2dRenderer.domElement.style.pointerEvents = 'none';
        this.container.appendChild(this.css2dRenderer.domElement);

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

        this.player = this.createPlayerMesh(playerAvatar, playerName);
        this.player.position.set(0, 2, 0); 
        this.player.userData = { isLocalPlayer: true };
        this.scene.add(this.player);
        this.interactableObjects.push(this.player);

        window.addEventListener('resize', this.onWindowResize);
        this.renderer.domElement.addEventListener('click', this.onCanvasClick);
        this.renderer.domElement.addEventListener('wheel', this.onMouseWheel, { passive: false });

        this.onWindowResize();
        this.animate();
    }
    
    createObjectsFromMap(map) {
        map.objects.forEach(objData => {
            let mesh;
            if (objData.type === 'box') {
                mesh = new THREE.Mesh(new THREE.BoxGeometry(objData.size.w, objData.size.h, objData.size.d), new THREE.MeshStandardMaterial({ color: objData.color }));
                mesh.position.set(objData.position.x, objData.position.y, objData.position.z);
                this.scene.add(mesh);
            } else if (objData.type === 'image' && objData.src) {
                const imageMaterial = new THREE.MeshBasicMaterial({ map: this.textureLoader.load(objData.src), transparent: true, side: THREE.DoubleSide });
                mesh = new THREE.Mesh(new THREE.PlaneGeometry(objData.size.w, objData.size.h), imageMaterial);
                mesh.position.set(objData.position.x, objData.position.y, objData.position.z); 
                this.scene.add(mesh);
            } else if (objData.type === 'interactiveObject' && objData.src) {
                const material = new THREE.MeshBasicMaterial({ map: this.textureLoader.load(objData.src), transparent: true, side: THREE.DoubleSide });
                mesh = new THREE.Mesh(new THREE.PlaneGeometry(objData.size.w, objData.size.h), material);
                mesh.position.set(objData.position.x, objData.position.y, objData.position.z);
                mesh.userData = { isInteractive: true, id: objData.id, name: objData.name };
                this.scene.add(mesh);
                this.interactableObjects.push(mesh);
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
            this.css2dRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
        }
    }
    
    onCanvasClick(event) {
        if (!this.camera || !this.renderer || !this.player) return;
        const canvasBounds = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
        this.mouse.y = - ((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.interactableObjects, true);
        if (intersects.length > 0) {
            const firstHit = intersects[0].object;
            const hitPoint = intersects[0].point;

            // Calculate distance from player to the clicked object's center
            const distance = this.player.position.distanceTo(firstHit.position);

            if (firstHit.userData.isInteractive && this.onInteractiveObjectClick) {
                if (distance <= this.interactionRadius) {
                    this.onInteractiveObjectClick(firstHit.userData);
                } else {
                    console.log("Estás demasiado lejos para interactuar con " + firstHit.userData.name);
                    // Aquí podrías mostrar un mensaje al usuario en el futuro
                }
                return;
            }

            if (firstHit.userData.isLocalPlayer && this.onPlayerClick) {
                this.onPlayerClick();
                return;
            }

            if (firstHit.userData.isDoor) {
                if (distance <= this.interactionRadius) {
                    this.onDoorClick(firstHit.userData);
                } else {
                     console.log("Estás demasiado lejos para usar la puerta.");
                }
                return;
            }

            if (firstHit.userData.isGround) {
                this.localPlayerTargetPosition = hitPoint;
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

        if (this.localPlayerTargetPosition) {
            const distance = this.player.position.distanceTo(this.localPlayerTargetPosition);

            if (distance > 0.1) {
                const moveSpeed = 0.04;
                this.player.position.lerp(this.localPlayerTargetPosition, moveSpeed);

                const direction = this.localPlayerTargetPosition.clone().sub(this.player.position).normalize();
                if (direction.lengthSq() > 0.001) {
                    const targetAngle = Math.atan2(direction.x, direction.z);
                    const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);
                    this.player.quaternion.slerp(targetQuaternion, 0.15);
                }

                this.onPlayerMove(this.player.position, this.player.quaternion);
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
    
    zoomIn() {
        this.zoomDistance -= 2;
        this.zoomDistance = THREE.MathUtils.clamp(this.zoomDistance, this.minZoom, this.maxZoom);
    }

    zoomOut() {
        this.zoomDistance += 2;
        this.zoomDistance = THREE.MathUtils.clamp(this.zoomDistance, this.minZoom, this.maxZoom);
    }
    
    createNameLabel(text) {
        const div = document.createElement('div');
        div.className = 'player-label';
        div.textContent = text;
        const label = new CSS2DObject(div);
        label.position.set(0, 2.5, 0);
        return label;
    }

    createPlayerMesh(avatarName, playerName) {
        const playerHeight = 3.5;
        const texture = this.avatarTextures[avatarName] || this.avatarTextures.ronin;
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
        
        const geometry = new THREE.PlaneGeometry(2.0, playerHeight);
        geometry.rotateX(-0.05); 
        const mesh = new THREE.Mesh(geometry, material);

        const setAspectRatio = (tex) => {
            if (tex.image) {
                const aspectRatio = tex.image.width / tex.image.height;
                mesh.geometry.dispose();
                const newGeo = new THREE.PlaneGeometry(playerHeight * aspectRatio, playerHeight);
                newGeo.rotateX(-0.15);
                mesh.geometry = newGeo;
            }
        };

        if (texture.image) { setAspectRatio(texture); } 
        else { texture.onLoad = setAspectRatio; }
        
        if (playerName) {
            const nameLabel = this.createNameLabel(playerName);
            mesh.add(nameLabel);
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
                    newGeometry.rotateX(-0.15);
                    this.player.geometry = newGeometry;
                }
            };

            if (newTexture.image) { setAspectRatio(newTexture); }
            else { newTexture.onLoad = setAspectRatio; }
        }
    }

    changeRoom(roomId, playerAvatar, playerName) {
        this.dispose();
        this.init(roomId, playerAvatar, playerName);
    }

    addOrUpdateRemotePlayer(peerId, peerData) {
        if (!this.scene || !peerData || !peerData.position) return;
        
        let remotePlayer = this.remotePlayers[peerId];

        if (remotePlayer) {
            remotePlayer.targetPosition = new THREE.Vector3(peerData.position.x, peerData.position.y, peerData.position.z);
            
            if (peerData.quaternion) {
                remotePlayer.targetQuaternion = new THREE.Quaternion(
                    peerData.quaternion._x, peerData.quaternion._y,
                    peerData.quaternion._z, peerData.quaternion._w
                );
            }

            if (remotePlayer.avatar !== peerData.avatar) {
                 remotePlayer.avatar = peerData.avatar;
                 const newTexture = this.avatarTextures[peerData.avatar] || this.avatarTextures.ronin;
                 remotePlayer.mesh.material.map = newTexture;
                 remotePlayer.mesh.material.needsUpdate = true;
                 remotePlayer.mesh.userData.avatarName = peerData.avatar;
                 
                 const playerHeight = 4;
                 const setAspectRatio = (tex) => {
                    if (tex.image) {
                        const aspectRatio = tex.image.width / tex.image.height;
                        remotePlayer.mesh.geometry.dispose();
                        const newGeometry = new THREE.PlaneGeometry(playerHeight * aspectRatio, playerHeight);
                        newGeometry.rotateX(-0.15);
                        remotePlayer.mesh.geometry = newGeometry;
                    }
                 };

                 if (newTexture.image) { setAspectRatio(newTexture); }
                 else { newTexture.onLoad = setAspectRatio; }
            }
            // Check for new chat messages
            if (peerData.chatMessage && (!remotePlayer.lastMessageTimestamp || peerData.chatMessage.timestamp > remotePlayer.lastMessageTimestamp)) {
                this.displayChatMessage(remotePlayer.mesh, peerData.chatMessage.text);
                remotePlayer.lastMessageTimestamp = peerData.chatMessage.timestamp;
            }

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
                lastMessageTimestamp: 0
            };
        }
    }

    displayChatMessage(playerMesh, message) {
        // If there's an existing bubble for this player, remove it first
        if (playerMesh.userData.chatBubble) {
            playerMesh.remove(playerMesh.userData.chatBubble);
        }
        if (playerMesh.userData.chatTimeout) {
            clearTimeout(playerMesh.userData.chatTimeout);
        }

        const div = document.createElement('div');
        div.className = 'chat-label';
        div.textContent = message;
        
        const chatLabel = new CSS2DObject(div);
        const playerHeight = playerMesh.geometry.parameters.height || 3.5;
        chatLabel.position.set(0, playerHeight + 0.5, 0); // Position above the name label
        
        playerMesh.add(chatLabel);
        playerMesh.userData.chatBubble = chatLabel;

        // Remove the bubble after some time
        playerMesh.userData.chatTimeout = setTimeout(() => {
            playerMesh.remove(chatLabel);
            playerMesh.userData.chatBubble = null;
        }, 7000); // 7 seconds
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
        
        if (this.css2dRenderer?.domElement.parentElement) {
            this.css2dRenderer.domElement.parentElement.removeChild(this.css2dRenderer.domElement);
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
        this.css2dRenderer = null;
        this.player = null;
        this.localPlayerTargetPosition = null;
        this.remotePlayers = {};
        this.interactableObjects = [];
        this.animationFrameId = null;
    }
}
