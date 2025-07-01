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
    
    // Environment
    grass: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/cesped.jpg',
    stone: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/roca.jpg',
    forest_floor: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/suelobosque.jpg',
    sand: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/arena.jpg', // Nueva textura de arena
    tree_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/arbol.png',
    bush_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/flor.png',
    orange_box: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/caja.png'
};

// Data defining the different maps/rooms in the world
export const mapData = {
    'lobby': {
        name: 'Lobby Principal',
        groundTexture: assetLibrary.grass,
        objects: [{ type: 'image', src: assetLibrary.orange_box, position: { x: -10, y: 1.5, z: -10 }, size: { w: 3, h: 3 } }],
        doors: [
            { to: 'dungeon', position: { x: 15, y: 2, z: 0 }, label: 'Al Calabozo' },
            { to: 'forest', position: { x: -15, y: 2, z: 0 }, label: 'Al Bosque' },
            { to: 'smallRoom', position: { x: 0, y: 2, z: 15 }, label: 'A la Sala Pequeña' } // Nueva puerta a la sala pequeña
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
    },
    'smallRoom': { // Nueva sala pequeña
        name: 'Sala Pequeña de Arena',
        groundTexture: assetLibrary.sand, // Usando la nueva textura de arena
        objects: [
            // Paredes para hacerla "pequeña" visualmente
            { type: 'box', color: 0x555555, position: { x: 0, y: 2.5, z: -10 }, size: { w: 20, h: 5, d: 1 } }, // Pared trasera
            { type: 'box', color: 0x555555, position: { x: 0, y: 2.5, z: 10 }, size: { w: 20, h: 5, d: 1 } },  // Pared delantera
            { type: 'box', color: 0x555555, position: { x: -10, y: 2.5, z: 0 }, size: { w: 1, h: 5, d: 20 } }, // Pared izquierda
            { type: 'box', color: 0x555555, position: { x: 10, y: 2.5, z: 0 }, size: { w: 1, h: 5, d: 20 } },  // Pared derecha
            { type: 'box', color: 0xaaaaaa, position: { x: 0, y: 1, z: 0 }, size: { w: 2, h: 2, d: 2 } } // Un objeto dentro de la sala
        ],
        doors: [{ to: 'lobby', position: { x: 0, y: 2, z: -9 }, label: 'Volver al Lobby' }] // Puerta de salida
    }
};
