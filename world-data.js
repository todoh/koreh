// Centralized library for asset URLs
export const assetLibrary = {
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
    
    // Environment Textures
    grass: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/cesped.jpg',
    stone: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/roca.jpg',
    forest_floor: 'https://raw.githubusercontent.com/todoh/koreh/main/bosque.jpg',
    sand: 'https://raw.githubusercontent.com/todoh/koreh/main/desierto.jpg',
    mountain: 'https://raw.githubusercontent.com/todoh/koreh/main/montana.jpg',
    savanna: 'https://raw.githubusercontent.com/todoh/koreh/main/sabana.jpg',
    snow: 'https://raw.githubusercontent.com/todoh/koreh/main/nieve.jpg',

    // Environment Objects
    tree_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/arbol.png',
    bush_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/flor.png',
    orange_box: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/caja.png',
    fountain: 'https://raw.githubusercontent.com/todoh/koreh/main/fuente.png',
    obra: 'https://raw.githubusercontent.com/todoh/koreh/main/obra.png',
    cartelobra: 'https://raw.githubusercontent.com/todoh/koreh/main/cartelobra.png',
    pared: 'https://raw.githubusercontent.com/todoh/koreh/main/pared.png',
    techo: 'https://raw.githubusercontent.com/todoh/koreh/main/techo.png',
    puerta: 'https://raw.githubusercontent.com/todoh/koreh/main/puerta.png',

    // Items
    water_bottle: 'https://raw.githubusercontent.com/todoh/koreh/main/botellaagua.png',
    pine_seed: 'https://raw.githubusercontent.com/todoh/koreh/main/semillapino.png',
    pine_sprout: 'https://raw.githubusercontent.com/todoh/koreh/main/brotepino.png',
    pine: 'https://raw.githubusercontent.com/todoh/koreh/main/pino.png',
    welcome_note: 'https://raw.githubusercontent.com/todoh/koreh/main/notabienvenida.png',
    hacha: 'https://raw.githubusercontent.com/todoh/koreh/main/hacha.png',
    tronco_pino: 'https://raw.githubusercontent.com/todoh/koreh/main/troncopino.png'
};

// Data defining the properties of items
export const itemData = {
    'water_bottle': { name: 'Botella de Agua', placeable: false },
    'pine_seed': { name: 'Semilla de Pino', placeable: true, type: 'active', size: { w: 0.5, h: 0.5 } },
    'pine_sprout': { name: 'Brote de Pino', placeable: false, type: 'passive', size: { w: 0.8, h: 1.2 } },
    'pine': { name: 'Pino', placeable: false, type: 'passive', size: { w: 4, h: 7 } },
    'welcome_note': { 
        name: 'Nota de Bienvenida', 
        placeable: false,
        action: { type: 'read', content: 'BIENVENID@ A KOREH.' }
    },
    'hacha': { name: 'Hacha', placeable: false },
    'tronco_pino': { name: 'Tronco de Pino', placeable: false }
};

// Data defining the world as a grid of chunks
export const worldGridData = {
    // --- Central Lobby ---
    "0_0": { 
        name: 'Lobby Principal',
        groundTextureKey: 'grass',
        objects: [{ type: 'image', srcKey: 'orange_box', position: { x: -10, y: 1.5, z: -10 }, size: { w: 3, h: 3 } }]
    },

    // --- Plains Biome (Grass) ---
    "0_1": { name: 'Llanuras Verdes', groundTextureKey: 'grass', objects: [] },
    "1_1": { name: 'Llanuras Verdes', groundTextureKey: 'grass', objects: [] },
    "-1_1": { name: 'Llanuras Verdes', groundTextureKey: 'grass', objects: [] },

    // --- Mountain Biome ---
    "1_0": { name: 'Faldas de la Montaña', groundTextureKey: 'mountain', objects: [] },
    "2_0": { name: 'Cima de la Montaña', groundTextureKey: 'mountain', objects: [] },
    "2_1": { name: 'Ladera de la Montaña', groundTextureKey: 'mountain', objects: [] },

    // --- Savanna Biome ---
    "-1_0": { name: 'Sabana Calurosa', groundTextureKey: 'savanna', objects: [] },
    "-2_0": { name: 'Corazón de la Sabana', groundTextureKey: 'savanna', objects: [] },
    "-2_-1": { name: 'Sabana Calurosa', groundTextureKey: 'savanna', objects: [] },

    // --- Snow Biome ---
    "0_-1": { name: 'Tundra Helada', groundTextureKey: 'snow', objects: [] },
    "1_-1": { name: 'Páramo Nevado', groundTextureKey: 'snow', objects: [] },
    "-1_-1": { name: 'Ventisquero', groundTextureKey: 'snow', objects: [] },

    // --- Desert Biome ---
    "2_-2": { name: 'Dunas de Arena', groundTextureKey: 'sand', objects: [] },
    "1_-2": { name: 'Desierto Solitario', groundTextureKey: 'sand', objects: [] },
    "0_-2": { name: 'Mar de Arena', groundTextureKey: 'sand', objects: [] },

    // --- Forest Biome ---
    "-2_1": { name: 'Bosque Profundo', groundTextureKey: 'forest_floor', objects: [] },
    "-1_2": { name: 'Claro del Bosque', groundTextureKey: 'forest_floor', objects: [] },
    "-2_2": { name: 'Espesura del Bosque', groundTextureKey: 'forest_floor', objects: [] },
};
