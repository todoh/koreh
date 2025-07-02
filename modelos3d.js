import * as THREE from 'three';

/**
 * Crea un personaje 3D con una estética low-poly estilizada, esqueleto funcional y animación de caminar.
 * @param {object} colors - Un objeto con materiales de THREE.js para las partes del cuerpo.
 * @returns {object} Un objeto que contiene el modelo 3D, el mezclador de animación y los clips de animación.
 */
function createAnimatedCharacter(colors) {
    const modelGroup = new THREE.Group();

    // --- Materiales ---
    const skinMaterial = new THREE.MeshStandardMaterial({ ...colors.skin, flatShading: true });
    const torsoMaterial = new THREE.MeshStandardMaterial({ ...colors.torso, flatShading: true });
    const legsMaterial = new THREE.MeshStandardMaterial({ ...colors.legs, flatShading: true });

    // --- Jerarquía de Huesos ---
    const hip = new THREE.Bone();
    hip.position.y = 1.3;

    const spine = new THREE.Bone();
    hip.add(spine);
    spine.position.y = 0.7;

    const neck = new THREE.Bone();
    spine.add(neck);
    neck.position.y = 0.8;

    const headBone = new THREE.Bone();
    neck.add(headBone);
    headBone.position.y = 0.15;

    // Hombros
    const shoulderL = new THREE.Bone();
    spine.add(shoulderL);
    shoulderL.position.set(0.4, 0.7, 0);

    const shoulderR = new THREE.Bone();
    spine.add(shoulderR);
    shoulderR.position.set(-0.4, 0.7, 0);

    const lowerArmL = new THREE.Bone();
    shoulderL.add(lowerArmL);
    lowerArmL.position.y = -0.7;

    const lowerArmR = new THREE.Bone();
    shoulderR.add(lowerArmR);
    lowerArmR.position.y = -0.7;
    
    // Piernas
    const upperLegL = new THREE.Bone();
    hip.add(upperLegL);
    upperLegL.position.x = 0.2;

    const upperLegR = new THREE.Bone();
    hip.add(upperLegR);
    upperLegR.position.x = -0.2;

    const lowerLegL = new THREE.Bone();
    upperLegL.add(lowerLegL);
    lowerLegL.position.y = -0.8;

    const lowerLegR = new THREE.Bone();
    upperLegR.add(lowerLegR);
    lowerLegR.position.y = -0.8;

    // --- Mallas del Personaje ---

    // Cabeza Facetada
    const headMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), skinMaterial);
    headBone.add(headMesh);
    
    // Torso Esculpido con ExtrudeGeometry
    const torsoShape = new THREE.Shape();
    torsoShape.moveTo(0, -0.8); // Punto central inferior (entrepierna)
    torsoShape.lineTo(-0.2, -0.8); // Muslo interior
    torsoShape.lineTo(-0.4, -0.2); // Cadera
    torsoShape.lineTo(-0.35, 0.3); // Cintura
    torsoShape.lineTo(-0.5, 0.8); // Pecho / Axila
    torsoShape.lineTo(-0.3, 1.0); // Hombro
    torsoShape.lineTo(0.3, 1.0);
    torsoShape.lineTo(0.5, 0.8);
    torsoShape.lineTo(0.35, 0.3);
    torsoShape.lineTo(0.4, -0.2);
    torsoShape.lineTo(0.2, -0.8);
    torsoShape.lineTo(0, -0.8);

    const extrudeSettings = { depth: 0.5, bevelEnabled: false };
    const torsoGeometry = new THREE.ExtrudeGeometry(torsoShape, extrudeSettings);
    torsoGeometry.center(); // Centrar la geometría para facilitar la rotación y posición
    
    const torsoMesh = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torsoMesh.position.y = -0.1; // Ajustar la posición vertical del torso
    spine.add(torsoMesh);

    // Brazos Angulares
    const upperArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.7, 8), skinMaterial);
    upperArmMesh.position.y = -0.35;
    shoulderL.add(upperArmMesh);
    shoulderR.add(upperArmMesh.clone());

    const lowerArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.7, 8), skinMaterial);
    lowerArmMesh.position.y = -0.35;
    lowerArmL.add(lowerArmMesh);
    lowerArmR.add(lowerArmMesh.clone());

    // Piernas Angulares
    const thighMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.8, 8), legsMaterial);
    thighMesh.position.y = -0.4;
    upperLegL.add(thighMesh);
    upperLegR.add(thighMesh.clone());

    const calfMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.8, 8), legsMaterial);
    calfMesh.position.y = -0.4;
    lowerLegL.add(calfMesh);
    lowerLegR.add(calfMesh.clone());

    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.45), legsMaterial);
    footMesh.position.y = -0.85;
    footMesh.position.z = 0.1;
    lowerLegL.add(footMesh);
    lowerLegR.add(footMesh.clone());

    modelGroup.add(hip);

    // --- ANIMACIÓN ---
    const mixer = new THREE.AnimationMixer(hip);
    const animations = {};
    const walkCycleTime = 1.0;
    const times = [0, walkCycleTime / 2, walkCycleTime];
    const swingAngle = Math.PI / 6;

    const createTrack = (bone, axis, angle) => {
        const eulerStart = new THREE.Euler(0, 0, 0);
        const eulerMid = new THREE.Euler(0, 0, 0);
        const eulerEnd = new THREE.Euler(0, 0, 0);
        eulerStart[axis] = angle;
        eulerMid[axis] = -angle;
        eulerEnd[axis] = angle;
        return new THREE.QuaternionKeyframeTrack(
            bone.name + '.quaternion',
            times,
            [
                new THREE.Quaternion().setFromEuler(eulerStart),
                new THREE.Quaternion().setFromEuler(eulerMid),
                new THREE.Quaternion().setFromEuler(eulerEnd),
            ].flatMap(q => q.toArray())
        );
    };

    const walkClip = new THREE.AnimationClip('walk', -1, [
        createTrack(upperLegL, 'x', -swingAngle),
        createTrack(upperLegR, 'x', swingAngle),
        createTrack(shoulderL, 'x', swingAngle * 0.7),
        createTrack(shoulderR, 'x', -swingAngle * 0.7)
    ]);
    animations.walk = walkClip;

    modelGroup.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return { model: modelGroup, mixer, animations };
}

/**
 * Crea y exporta el modelo 3D para el avatar Ronin.
 * @returns {object}
 */
export function createRoninModel() {
    const colors = {
        skin: { color: '#E0AC69', roughness: 0.8 },
        torso: { color: '#4682B4', roughness: 0.6 },
        legs: { color: '#333333', roughness: 0.6 }
    };
    return createAnimatedCharacter(colors);
}

/**
 * Crea y exporta el modelo 3D para el avatar Kunoichi.
 * @returns {object}
 */
export function createKunoichiModel() {
    const colors = {
        skin: { color: '#E0AC69', roughness: 0.8 },
        torso: { color: '#8B0000', roughness: 0.6 },
        legs: { color: '#1C1C1C', roughness: 0.6 }
    };
    return createAnimatedCharacter(colors);
}