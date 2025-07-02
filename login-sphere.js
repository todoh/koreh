import * as THREE from 'three';

// --- Configuración de la escena ---
const scene = new THREE.Scene();
const container = document.getElementById('login-background');
if (!container) throw new Error('¡No se encontró el contenedor de fondo del login!');

// --- Cámara ---
const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
camera.position.z = 5;

// --- Renderizador ---
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.offsetWidth, container.offsetHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// --- Iluminación ---
// Luz ambiental para iluminar suavemente toda la escena
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Luz puntual para crear reflejos y brillos
const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);

// --- La Esfera ---
const geometry = new THREE.SphereGeometry(2, 64, 64); // Más segmentos para una esfera más suave
const material = new THREE.MeshStandardMaterial({
    color: 0x222222,       // Color base oscuro
    metalness: 0.9,      // Muy metálico
    roughness: 0.3,      // Un poco de rugosidad para reflejos difusos
    emissive: 0x101010,    // Un ligero brillo desde adentro
    flatShading: false,  // Sombreado suave
});
const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// --- Animación ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Escalado Arrítmico
    // Combinar múltiples ondas sinusoidales para una pulsación más compleja y orgánica
    const scale1 = Math.sin(elapsedTime * 0.5) * 0.1; // Pulso lento y grande
    const scale2 = Math.sin(elapsedTime * 1.5) * 0.05; // Ondulación más rápida y pequeña
    const baseScale = 1.0;
    const newScale = baseScale + scale1 + scale2;
    sphere.scale.set(newScale, newScale, newScale);

    // Rotación Sutil
    sphere.rotation.x += 0.001;
    sphere.rotation.y += 0.002;

    renderer.render(scene, camera);
}

// --- Manejar Redimensión de Ventana ---
window.addEventListener('resize', () => {
    // Actualizar relación de aspecto de la cámara
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();

    // Actualizar tamaño del renderizador
    renderer.setSize(container.offsetWidth, container.offsetHeight);
});

// Iniciar la animación
animate();