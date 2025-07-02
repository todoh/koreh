// Centralized library for asset URLs
export const assetLibrary = {
    // Avatars
    // --- MODIFICADO: Cambiado a modelos 3D generados ---
    ronin: 'GENERATED_3D_RONIN',
    kunoichi: 'GENERATED_3D_KUNOICHI',
    // ---
    samurai: 'https://raw.githubusercontent.com/todoh/koreh/main/samurai.png',
    rey: 'https://raw.githubusercontent.com/todoh/koreh/main/rey.png',
    reina: 'https://raw.githubusercontent.com/todoh/koreh/main/reina.png',
    damisela: 'https://raw.githubusercontent.com/todoh/koreh/main/damisela.png',
    ciudadana: 'https://raw.githubusercontent.com/todoh/koreh/main/ciudadana.png',
    pijo: 'https://raw.githubusercontent.com/todoh/koreh/main/pijo.png',
    chamana: 'https://raw.githubusercontent.com/todoh/koreh/main/chamana.png',
    
    // Environment Textures
    grass: 'GENERATED_GRASS', 
    stone: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/roca.jpg',
    forest_floor: 'https://raw.githubusercontent.com/todoh/koreh/main/bosque.jpg',
    sand: 'https://raw.githubusercontent.com/todoh/koreh/main/desierto.jpg',
    mountain: 'https://raw.githubusercontent.com/todoh/koreh/main/montana.jpg',
    savanna: 'https://raw.githubusercontent.com/todoh/koreh/main/sabana.jpg',
    snow: 'https://raw.githubusercontent.com/todoh/koreh/main/nieve.jpg',
    agua_animada: 'https://i.imgur.com/sZ5aA9p.gif',

    // Environment Objects
    tree_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/arbol.png',
    bush_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/flor.png',
    orange_box: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/caja.png',
    fountain: 'https://raw.githubusercontent.com/todoh/koreh/main/fuente.png',
    obra: 'GENERATED_CONSTRUCTION', 
    cartelobra: 'https://raw.githubusercontent.com/todoh/koreh/main/cartelobra.png',
    pared: 'GENERATED_BRICK',
    techo: 'https://raw.githubusercontent.com/todoh/koreh/main/techo.png',
    puerta: 'GENERATED_DOOR',

    // Items
    water_bottle: 'https://raw.githubusercontent.com/todoh/koreh/main/botellaagua.png',
    pine_seed: 'GENERATED_3D_SEED',
    pine_sprout: 'GENERATED_3D_SPROUT',
    pine: 'GENERATED_3D_PINE',
    welcome_note: 'https://raw.githubusercontent.com/todoh/koreh/main/notabienvenida.png',
    hacha: 'https://raw.githubusercontent.com/todoh/koreh/main/hacha.png',
    tronco_pino: 'https://raw.githubusercontent.com/todoh/koreh/main/troncopino.png'
};

// Data defining the properties of items
export const itemData = {
    'water_bottle': { name: 'Botella de Agua', placeable: false },
    'pine_seed': { name: 'Semilla de Pino', placeable: true, type: 'active', size: { w: 0.5, h: 0.5 }, collidable: false },
    'pine_sprout': { name: 'Brote de Pino', placeable: false, type: 'passive', size: { w: 0.8, h: 1.2 }, collidable: false },
    'pine': { name: 'Pino', placeable: false, type: 'passive', size: { w: 4, h: 7 } }, // Es colisionable por defecto
    'welcome_note': { 
        name: 'Nota de Bienvenida', 
        placeable: false,
        action: { type: 'read', content: 'BIENVENID@ A KOREH.' }
    },
    'hacha': { name: 'Hacha', placeable: false },
    'tronco_pino': { name: 'Tronco de Pino', placeable: false }
};


/**
 * Generates the world grid data procedurally based on a set of rules
 * to create a continent shape with various biomes.
 * @param {number} gridWidth - The total width of the world in chunks.
 * @param {number} gridHeight - The total height of the world in chunks.
 * @returns {object} The complete worldGridData object.
 */
function generateWorldData(gridWidth, gridHeight) {
    const worldGridData = {};
    const centerX = 0;
    const centerY = 0;
    const radiusX = gridWidth / 2;
    const radiusY = gridHeight / 2;

    // Inland sea "Galasa" properties (approximated from map)
    const galasaCenterX = -2;
    const galasaCenterY = 8;
    const galasaRadius = 5;

    for (let x = -Math.floor(gridWidth / 2); x <= Math.floor(gridWidth / 2); x++) {
        for (let z = -Math.floor(gridHeight / 2); z <= Math.floor(gridHeight / 2); z++) {
            const chunkId = `${x}_${z}`;

            // 1. Check if inside the main continent (ellipse formula)
            const isLand = ((x - centerX) ** 2 / radiusX ** 2) + ((z - centerY) ** 2 / radiusY ** 2) <= 1;

            if (!isLand) {
                // It's ocean, so we don't add a chunk definition
                continue;
            }

            // 2. Check if inside the inland sea "Galasa" (circle formula)
            const isGalasa = ((x - galasaCenterX) ** 2) + ((z - galasaCenterY) ** 2) <= galasaRadius ** 2;
            if (isGalasa) {
                // It's inland sea, so we also don't add a chunk definition
                continue;
            }

            // 3. Determine biome based on location (approximating the map's regions)
            let groundTextureKey = 'grass'; // Default to grass
            let name = 'Llanuras';

            // --- Biome regions (approximations based on the provided map) ---
            // LAOTA (Desert, NW)
            if (x < -10 && z > 5) {
                groundTextureKey = 'sand';
                name = 'Desierto de Laota';
            }
            // NATERRA (Plains/Forest, North)
            else if (z > 12) {
                groundTextureKey = Math.random() > 0.6 ? 'forest_floor' : 'grass';
                name = 'Tierras de Naterra';
            }
            // ESTOBE (Forest, East)
            else if (x > 20) {
                groundTextureKey = 'forest_floor';
                name = 'Bosque de Estobe';
            }
            // BIHIYA (Mountains, Central-East)
            else if (x > 5 && x < 20 && z > -5 && z < 10) {
                 groundTextureKey = Math.random() > 0.7 ? 'mountain' : 'grass';
                 name = 'Montañas de Bihiya';
            }
            // AFORA (Savanna, SE)
            else if (x > 10 && z < -8) {
                groundTextureKey = 'savanna';
                name = 'Sabana de Afora';
            }
            // GINDUM (Mountains, SW)
            else if (x < -15 && z < -5) {
                 groundTextureKey = Math.random() > 0.5 ? 'mountain' : 'grass';
                 name = 'Picos de Gindum';
            }
            // SENDOR (Plains/Forest, West)
            else if (x < -20) {
                groundTextureKey = Math.random() > 0.8 ? 'forest_floor' : 'grass';
                name = 'Campos de Sendor';
            }
            // JEMDOGA (Central plains)
            else {
                groundTextureKey = 'grass';
                name = 'Praderas de Jemgoda';
            }

            // Create the chunk object
            worldGridData[chunkId] = {
                name: name,
                groundTextureKey: groundTextureKey,
                objects: [] // No objects are procedurally generated yet to keep it simple
            };
        }
    }
    
    // Add a starting point fountain at 0,0 if it's land, otherwise find the nearest land
    const startingChunkId = "0_0";
    if (worldGridData[startingChunkId]) {
        worldGridData[startingChunkId].objects.push({ type: 'interactiveObject', srcKey: 'fountain', id: 'fountain', name: 'Fuente Mágica', position: { x: 0, y: 3, z: 0 }, size: { w: 6, h: 6 } });
    } else {
        // Fallback: place the fountain on the first available land chunk if 0,0 is water
        const firstLandChunk = Object.keys(worldGridData)[0];
        if (firstLandChunk) {
            const [fx, fz] = firstLandChunk.split('_').map(Number);
            worldGridData[firstLandChunk].objects.push({ type: 'interactiveObject', srcKey: 'fountain', id: 'fountain', name: 'Fuente Mágica', position: { x: 0, y: 3, z: 0 }, size: { w: 6, h: 6 } });
        }
    }

    return worldGridData;
}

// Data defining the world as a grid of chunks, generated procedurally
export const worldGridData = generateWorldData(60, 40); // Generates a world 60 chunks wide and 40 chunks tall
