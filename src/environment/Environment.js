import { THREE } from '../core/three.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        // Zona objetivo de azotea para izado HVAC (Techo de la nave logística)
        this.rooftopTarget = { x: 34, y: 11.2, z: -20, width: 22, depth: 16 };
        this.warehouseMesh = null;

        this._buildGround();
        this._buildLogisticsWarehouse();
        this._buildContainerTerminal();
        this._buildLightingTowers();
        this._buildPerimeterSecurity();
    }

    // --- 1. TEXTURA PBR DE PAVIMENTO PORTUARIO / LOGÍSTICO PESADO ---
    _createLogisticsGroundTexture() {
        const c = document.createElement('canvas');
        c.width = 2048; c.height = 2048;
        const ctx = c.getContext('2d');

        // 1. Asfalto/hormigón gris industrial base
        ctx.fillStyle = '#2c313a';
        ctx.fillRect(0, 0, 2048, 2048);

        // 2. Micro-grano mineral y desgaste de rodadura pesada
        for (let i = 0; i < 22000; i++) {
            const rx = Math.random() * 2048;
            const ry = Math.random() * 2048;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.08)';
            ctx.fillRect(rx, ry, 2, 2);
        }

        // 3. Juntas de dilatación de losas de hormigón (selladas con brea bituminosa)
        ctx.strokeStyle = '#1a1d23';
        ctx.lineWidth = 4;
        for (let x = 0; x <= 2048; x += 256) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2048); ctx.stroke();
        }
        for (let y = 0; y <= 2048; y += 256) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
        }

        // 4. Franjas de circulación y marcas viales de terminal (Tráfico pesado)
        ctx.strokeStyle = '#e0a800'; // Amarillo tráfico
        ctx.lineWidth = 8;
        ctx.setLineDash([30, 20]);
        // Carril principal longitudinal
        ctx.beginPath(); ctx.moveTo(0, 1024); ctx.lineTo(2048, 1024); ctx.stroke();
        // Carril transversal
        ctx.beginPath(); ctx.moveTo(1024, 0); ctx.lineTo(1024, 2048); ctx.stroke();
        ctx.setLineDash([]);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(8, 8);
        tex.anisotropy = 8;
        return tex;
    }

    _buildGround() {
        const groundTex = this._createLogisticsGroundTexture();
        const planeGeo = new THREE.PlaneGeometry(500, 500);
        const planeMat = new THREE.MeshStandardMaterial({
            map: groundTex,
            roughness: 0.82,
            metalness: 0.18
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);

        // Placas de acero de reparto de carga para estabilizadores de la grúa (1:1 real: 2.8m x 1.8m)
        const plateGeo = new THREE.BoxGeometry(2.8, 0.06, 1.8);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.35, metalness: 0.85 });
        [-4.2, 4.2].forEach(px => {
            [-4.8, 4.8].forEach(pz => {
                const plate = new THREE.Mesh(plateGeo, plateMat);
                plate.position.set(px, 0.03, pz);
                plate.receiveShadow = true;
                this.scene.add(plate);
            });
        });
    }

    // --- 2. NAVE INDUSTRIAL / ALMACÉN LOGÍSTICO PORTUARIO (1:1 REAL) ---
    _buildLogisticsWarehouse() {
        const warehouseGroup = new THREE.Group();
        this.scene.add(warehouseGroup);

        const wx = 34;
        const wz = -20;
        const wLength = 42; // 42 metros de largo
        const wWidth = 24;  // 24 metros de ancho
        const wHeight = 11; // 11 metros de altura libre

        // Material panel sándwich gris grafito oscuro
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x38414e,
            roughness: 0.65,
            metalness: 0.35
        });

        // Estructura principal
        const bodyGeo = new THREE.BoxGeometry(wLength, wHeight, wWidth);
        const body = new THREE.Mesh(bodyGeo, wallMat);
        body.position.set(wx, wHeight * 0.5, wz);
        body.castShadow = true;
        body.receiveShadow = true;
        warehouseGroup.add(body);
        this.warehouseMesh = body;

        // Obstáculo de colisión vehicular
        this.obstacles.push({
            minX: wx - wLength * 0.5 - 1.5,
            maxX: wx + wLength * 0.5 + 1.5,
            minZ: wz - wWidth * 0.5 - 1.5,
            maxZ: wz + wWidth * 0.5 + 1.5,
            height: wHeight
        });

        // Vigas y pilares perimetrales metálicos (H-Beams)
        const beamMat = new THREE.MeshStandardMaterial({ color: 0x1f242b, roughness: 0.5, metalness: 0.8 });
        const colGeo = new THREE.BoxGeometry(0.8, wHeight + 0.5, 0.8);
        for (let x = -wLength * 0.5; x <= wLength * 0.5; x += 10.5) {
            [-wWidth * 0.5, wWidth * 0.5].forEach(z => {
                const col = new THREE.Mesh(colGeo, beamMat);
                col.position.set(wx + x, wHeight * 0.5, wz + z);
                col.castShadow = true;
                warehouseGroup.add(col);
            });
        }

        // Cornisa y remate superior de cubierta
        const fasciaGeo = new THREE.BoxGeometry(wLength + 0.8, 0.6, wWidth + 0.8);
        const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x005596, roughness: 0.4, metalness: 0.5 }); // Franja azul corporativa
        const fascia = new THREE.Mesh(fasciaGeo, fasciaMat);
        fascia.position.set(wx, wHeight + 0.3, wz);
        warehouseGroup.add(fascia);

        // Puertas seccionales de muelle de carga con franjas de peligro (Frontal mirando al patio)
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x272c35, roughness: 0.5, metalness: 0.6 });
        const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0xd68000, roughness: 0.4, metalness: 0.3 }); // Marco amarillo seguridad

        [-12, -4, 4, 12].forEach(dx => {
            // Marco
            const frame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 5.2, 0.4), doorFrameMat);
            frame.position.set(wx + dx, 2.6, wz + wWidth * 0.5 + 0.2);
            warehouseGroup.add(frame);

            // Hoja de persiana
            const door = new THREE.Mesh(new THREE.BoxGeometry(4.8, 4.8, 0.3), doorMat);
            door.position.set(wx + dx, 2.5, wz + wWidth * 0.5 + 0.25);
            door.castShadow = true;
            warehouseGroup.add(door);

            // Muelle de goma de protección para camiones
            const bumperGeo = new THREE.BoxGeometry(0.5, 1.2, 0.4);
            const bumperMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
            [-2.2, 2.2].forEach(bx => {
                const bumper = new THREE.Mesh(bumperGeo, bumperMat);
                bumper.position.set(wx + dx + bx, 0.6, wz + wWidth * 0.5 + 0.5);
                warehouseGroup.add(bumper);
            });
        });

        // Plataforma de mantenimiento y maquinaria en cubierta (Rooftop HVAC Target)
        const roofPlatformGeo = new THREE.BoxGeometry(16, 0.3, 10);
        const roofPlatformMat = new THREE.MeshStandardMaterial({ color: 0x4a525d, roughness: 0.7, metalness: 0.4 });
        const roofPlat = new THREE.Mesh(roofPlatformGeo, roofPlatformMat);
        roofPlat.position.set(wx, wHeight + 0.15, wz);
        roofPlat.receiveShadow = true;
        warehouseGroup.add(roofPlat);

        // Barandilla de seguridad perimetral en la azotea
        const railMat = new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.5, metalness: 0.7 });
        const railGeo = new THREE.BoxGeometry(16.2, 1.1, 0.1);
        const rail1 = new THREE.Mesh(railGeo, railMat);
        rail1.position.set(wx, wHeight + 0.7, wz + 5.1);
        const rail2 = new THREE.Mesh(railGeo, railMat);
        rail2.position.set(wx, wHeight + 0.7, wz - 5.1);
        warehouseGroup.add(rail1);
        warehouseGroup.add(rail2);
    }

    // --- 3. PATIO DE CONTENEDORES MARÍTIMOS (PILAS REALISTAS 2 Y 3 ALTURAS) ---
    _buildContainerTerminal() {
        const yardGroup = new THREE.Group();
        this.scene.add(yardGroup);

        const colors = [0x0e5f96, 0xb82626, 0x1e5631, 0xd46813, 0x2b2d42];
        const containerL = 6.06; // 20ft estándar
        const containerW = 2.44;
        const containerH = 2.59;

        // Pila A: Lateral Norte-Este (x: 28, z: 22)
        const stackAConfigs = [
            { rx: 0, rz: 0, h: 2, c: 0x0e5f96 },
            { rx: 0, rz: 1, h: 3, c: 0xb82626 },
            { rx: 1, rz: 0, h: 2, c: 0x1e5631 },
            { rx: 1, rz: 1, h: 2, c: 0xd46813 },
            { rx: 2, rz: 0, h: 1, c: 0x2b2d42 }
        ];

        stackAConfigs.forEach(cfg => {
            const posX = 24 + cfg.rx * (containerL + 0.6);
            const posZ = 18 + cfg.rz * (containerW + 0.4);

            for (let floor = 0; floor < cfg.h; floor++) {
                const boxGeo = new THREE.BoxGeometry(containerL, containerH, containerW);
                const col = colors[(cfg.c + floor) % colors.length];
                const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.35 });
                const box = new THREE.Mesh(boxGeo, mat);
                box.position.set(posX, floor * containerH + containerH * 0.5, posZ);
                box.castShadow = true;
                box.receiveShadow = true;
                yardGroup.add(box);

                // Marco de cantoneras negras
                const wireGeo = new THREE.BoxGeometry(containerL + 0.05, containerH + 0.05, containerW + 0.05);
                const wireMat = new THREE.MeshBasicMaterial({ color: 0x11161d, wireframe: true });
                const wire = new THREE.Mesh(wireGeo, wireMat);
                wire.position.copy(box.position);
                yardGroup.add(wire);
            }

            // Obstáculo de colisión
            this.obstacles.push({
                minX: posX - containerL * 0.5 - 0.5,
                maxX: posX + containerL * 0.5 + 0.5,
                minZ: posZ - containerW * 0.5 - 0.5,
                maxZ: posZ + containerW * 0.5 + 0.5,
                height: cfg.h * containerH
            });
        });

        // Pila B: Lateral Oeste (x: -30, z: 12)
        const stackBConfigs = [
            { rx: 0, rz: 0, h: 2, c: 0xd46813 },
            { rx: 0, rz: 1, h: 2, c: 0x0e5f96 },
            { rx: 1, rz: 0, h: 3, c: 0x1e5631 }
        ];

        stackBConfigs.forEach(cfg => {
            const posX = -28 + cfg.rx * (containerL + 0.6);
            const posZ = 8 + cfg.rz * (containerW + 0.4);

            for (let floor = 0; floor < cfg.h; floor++) {
                const boxGeo = new THREE.BoxGeometry(containerL, containerH, containerW);
                const mat = new THREE.MeshStandardMaterial({ color: cfg.c, roughness: 0.55, metalness: 0.35 });
                const box = new THREE.Mesh(boxGeo, mat);
                box.position.set(posX, floor * containerH + containerH * 0.5, posZ);
                box.castShadow = true;
                box.receiveShadow = true;
                yardGroup.add(box);
            }

            this.obstacles.push({
                minX: posX - containerL * 0.5 - 0.5,
                maxX: posX + containerL * 0.5 + 0.5,
                minZ: posZ - containerW * 0.5 - 0.5,
                maxZ: posZ + containerW * 0.5 + 0.5,
                height: cfg.h * containerH
            });
        });
    }

    // --- 4. TORRES DE ILUMINACIÓN DE ALTA POTENCIA (PORT FLOODLIGHTS) ---
    _buildLightingTowers() {
        const towerMat = new THREE.MeshStandardMaterial({ color: 0x6e7681, roughness: 0.6, metalness: 0.7 });
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const towerPositions = [
            { x: -45, z: -45 },
            { x: 55, z: -45 },
            { x: -45, z: 45 },
            { x: 55, z: 45 }
        ];

        towerPositions.forEach(pos => {
            const mastHeight = 22;
            const mastGeo = new THREE.CylinderGeometry(0.35, 0.65, mastHeight, 8);
            const mast = new THREE.Mesh(mastGeo, towerMat);
            mast.position.set(pos.x, mastHeight * 0.5, pos.z);
            mast.castShadow = true;
            this.scene.add(mast);

            // Corona de proyectores LED
            const headGeo = new THREE.BoxGeometry(2.4, 0.4, 1.2);
            const head = new THREE.Mesh(headGeo, towerMat);
            head.position.set(pos.x, mastHeight, pos.z);
            this.scene.add(head);

            const lampGeo = new THREE.BoxGeometry(2.2, 0.2, 1.0);
            const lamp = new THREE.Mesh(lampGeo, lampMat);
            lamp.position.set(pos.x, mastHeight - 0.2, pos.z);
            this.scene.add(lamp);

            // Obstáculo de pilar
            this.obstacles.push({
                minX: pos.x - 1.0,
                maxX: pos.x + 1.0,
                minZ: pos.z - 1.0,
                maxZ: pos.z + 1.0,
                height: mastHeight
            });
        });
    }

    // --- 5. BARRERAS DE SEGURIDAD NEW JERSEY ---
    _buildPerimeterSecurity() {
        const barrierMat = new THREE.MeshStandardMaterial({ color: 0x8b949e, roughness: 0.9, metalness: 0.1 });
        const barrierGeo = new THREE.BoxGeometry(3.0, 0.85, 0.6);

        // Valla frontal del muelle
        for (let x = 12; x <= 56; x += 3.2) {
            const barrier = new THREE.Mesh(barrierGeo, barrierMat);
            barrier.position.set(x, 0.42, 6.0);
            barrier.castShadow = true;
            barrier.receiveShadow = true;
            this.scene.add(barrier);

            // Banda reflectante roja/blanca
            const stripGeo = new THREE.BoxGeometry(3.01, 0.15, 0.62);
            const stripMat = new THREE.MeshBasicMaterial({ color: 0xd73a49 });
            const strip = new THREE.Mesh(stripGeo, stripMat);
            strip.position.copy(barrier.position);
            this.scene.add(strip);
        }
    }
}
