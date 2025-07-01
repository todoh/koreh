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
    sand: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/arena.jpg',
    tree_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/arbol.png',
    bush_1: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/flor.png',
    orange_box: 'https://raw.githubusercontent.com/todoh/koreh/refs/heads/main/caja.png',
    fountain: 'https://raw.githubusercontent.com/todoh/koreh/main/fuente.png',

    // Items
    water_bottle: 'https://raw.githubusercontent.com/todoh/koreh/main/botellaagua.png',
    pine_seed: 'https://raw.githubusercontent.com/todoh/koreh/main/semillapino.png',
    pine_sprout: 'https://raw.githubusercontent.com/todoh/koreh/main/brotepino.png',
    welcome_note: 'https://raw.githubusercontent.com/todoh/koreh/main/notabienvenida.png'
};

// Data defining the properties of items
export const itemData = {
    'water_bottle': { name: 'Botella de Agua', placeable: false },
    'pine_seed': { name: 'Semilla de Pino', placeable: true, type: 'active' },
    'pine_sprout': { name: 'Brote de Pino', placeable: false }, // No se puede colocar directamente
    'welcome_note': { 
        name: 'Nota de Bienvenida', 
        placeable: false,
        action: { type: 'read', content: 'BIENVENID@ A KOREH.' }
    }
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
            { to: 'smallRoom', position: { x: 0, y: 2, z: 15 }, label: 'A la Sala Pequeña' }
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
            { type: 'interactiveObject', id: 'fountain', name: 'Fuente', src: assetLibrary.fountain, position: { x: 0, y: 2, z: 0 }, size: { w: 4, h: 4 } }
        ],
        doors: [{ to: 'lobby', position: { x: 0, y: 2, z: 15 }, label: 'Al Lobby' }]
    },
    'smallRoom': {
        name: 'Sala Pequeña de Arena',
        groundTexture: assetLibrary.sand,
        objects: [
            { type: 'box', color: 0x555555, position: { x: 0, y: 2.5, z: -10 }, size: { w: 20, h: 5, d: 1 } },
            { type: 'box', color: 0x555555, position: { x: 0, y: 2.5, z: 10 }, size: { w: 20, h: 5, d: 1 } },
            { type: 'box', color: 0x555555, position: { x: -10, y: 2.5, z: 0 }, size: { w: 1, h: 5, d: 20 } },
            { type: 'box', color: 0x555555, position: { x: 10, y: 2.5, z: 0 }, size: { w: 1, h: 5, d: 20 } },
            { type: 'box', color: 0xaaaaaa, position: { x: 0, y: 1, z: 0 }, size: { w: 2, h: 2, d: 2 } }
        ],
        doors: [{ to: 'lobby', position: { x: 0, y: 2, z: -9 }, label: 'Volver al Lobby' }]
    }
};
