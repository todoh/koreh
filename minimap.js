/**
 * Clase para gestionar el minimapa del juego.
 * Dibuja los chunks del mundo y la posición del jugador en un canvas.
 */
export class Minimap {
    /**
     * @param {HTMLElement} container - El elemento contenedor para el minimapa.
     * @param {object} worldGridData - Los datos de la parrilla del mundo con todos los chunks.
     * @param {number} chunkSize - El tamaño de cada chunk en unidades del mundo.
     */
    constructor(container, worldGridData, chunkSize) {
        this.container = container;
        this.worldGridData = worldGridData;
        this.chunkSize = chunkSize;

        // --- Propiedades para el zoom ---
        this.isZoomed = false;
        this.defaultScale = 3; // Píxeles por chunk en estado normal (reducido de 12)
        this.zoomedScale = 24;  // Píxeles por chunk en estado ampliado (reducido de 36)
        this.scale = this.defaultScale;
        this.lastPlayerPosition = null; // Guardar la última posición del jugador

        // Determinar los límites del mundo basándose en los chunk IDs
        this.minX = Infinity;
        this.maxX = -Infinity;
        this.minZ = Infinity;
        this.maxZ = -Infinity;

        // Si no hay chunks, establecer límites por defecto para evitar errores
        if (Object.keys(this.worldGridData).length === 0) {
            this.minX = -10; this.maxX = 10;
            this.minZ = -10; this.maxZ = 10;
        } else {
            Object.keys(this.worldGridData).forEach(chunkId => {
                const [x, z] = chunkId.split('_').map(Number);
                if (x < this.minX) this.minX = x;
                if (x > this.maxX) this.maxX = x;
                if (z < this.minZ) this.minZ = z;
                if (z > this.maxZ) this.maxZ = z;
            });
        }


        // Calcular el tamaño del mundo en chunks
        this.worldWidthInChunks = this.maxX - this.minX + 1;
        this.worldHeightInChunks = this.maxZ - this.minZ + 1;

        // Crear el elemento canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Añadir listener para el clic
        this.container.addEventListener('click', () => this.toggleZoom());

        // Limpiar el contenedor y añadir el nuevo canvas
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);

        // Dibujar el mapa base con el tamaño inicial
        this.updateCanvasSizeAndRedraw();
    }
    
    /**
     * Cambia entre el estado de zoom normal y ampliado del minimapa.
     */
    toggleZoom() {
        this.isZoomed = !this.isZoomed;
        this.container.classList.toggle('zoomed', this.isZoomed);
        this.updateCanvasSizeAndRedraw();
    }

    /**
     * Actualiza el tamaño del canvas según la escala de zoom y redibuja todo.
     */
    updateCanvasSizeAndRedraw() {
        this.scale = this.isZoomed ? this.zoomedScale : this.defaultScale;

        this.canvas.width = this.worldWidthInChunks * this.scale;
        this.canvas.height = this.worldHeightInChunks * this.scale;

        this.drawMap(); // Dibuja el fondo del mapa

        // Si ya conocemos la posición del jugador, la redibujamos inmediatamente
        if (this.lastPlayerPosition) {
            this.updatePlayerPosition(this.lastPlayerPosition);
        }
    }


    /**
     * Devuelve un color hexadecimal basado en la textura del suelo del chunk.
     * @param {object} chunkData - Los datos del chunk.
     * @returns {string} Un color en formato string.
     */
    getChunkColor(chunkData) {
        // Colores ajustados para parecerse más al mapa de referencia
        switch (chunkData.groundTextureKey) {
            case 'grass': return '#7C9C4A';
            case 'mountain': return '#615953';
            case 'savanna': return '#D2B48C';
            case 'snow': return '#F0F8FF';
            case 'sand': return '#EDC9AF';
            case 'forest_floor': return '#3E7C4F';
            default: return '#9E9E9E';
        }
    }

    /**
     * Dibuja el estado base del mapa con todos los chunks y el agua.
     * Guarda el resultado como una imagen para no tener que redibujar todo en cada frame.
     */
    drawMap() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const waterColor = '#3B698B'; // Un color de agua más oscuro y profundo

        // Iterar sobre toda la parrilla del minimapa, no solo los chunks existentes
        for (let x = this.minX; x <= this.maxX; x++) {
            for (let z = this.minZ; z <= this.maxZ; z++) {
                const chunkId = `${x}_${z}`;
                const chunkData = this.worldGridData[chunkId];

                const mapX = (x - this.minX) * this.scale;
                const mapY = (z - this.minZ) * this.scale;

                if (chunkData) {
                    // Si el chunk existe, usa su color de bioma
                    this.ctx.fillStyle = this.getChunkColor(chunkData);
                } else {
                    // Si no existe, es agua
                    this.ctx.fillStyle = waterColor;
                }
                this.ctx.fillRect(mapX, mapY, this.scale, this.scale);
            }
        }
        
        // Guardar la imagen del mapa base para optimizar las actualizaciones
        this.baseMapImage = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Actualiza la posición del jugador en el minimapa.
     * @param {THREE.Vector3} playerPosition - La posición actual del jugador en el mundo.
     */
    updatePlayerPosition(playerPosition) {
        this.lastPlayerPosition = playerPosition;
        if (!this.ctx || !this.baseMapImage) return;

        // Restaurar el fondo del mapa limpio
        this.ctx.putImageData(this.baseMapImage, 0, 0);

        // Convertir la posición del mundo a la posición del minimapa
        const playerMapX = ((playerPosition.x / this.chunkSize) - this.minX) * this.scale;
        const playerMapY = ((playerPosition.z / this.chunkSize) - this.minZ) * this.scale;
        
        const playerDotRadius = this.isZoomed ? 5 : 3;
        
        // Dibujar el punto del jugador
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 1.5;
        
        this.ctx.beginPath();
        this.ctx.arc(playerMapX, playerMapY, playerDotRadius, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.stroke();
    }

    /**
     * Limpia el contenedor del minimapa.
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
