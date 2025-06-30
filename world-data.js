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
