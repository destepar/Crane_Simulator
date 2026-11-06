import { THREE } from '../core/three.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.constructionBuilding = null;
        this.rooftopTarget = { x: 30, y: 20.4, z: -15, width: 28, depth: 22 };

        this._buildGround();
        this._buildConstructionSite();
        this._buildSiteCamp();
        this._buildSafetyBarriers();
    }

    // --- 1. TEXTURA PBR DE TERRENO DE OBRA CIVIL (Zahorra compactada + Viales de hormigón) ---
    _createConstructionGroundTexture() {
        const c = document.createElement('canvas');
        c.width = 2048; c.height = 2048;
        const ctx = c.getContext('2d');

        // 1. Zahorra / Tierra seca y grava compactada base
        ctx.fillStyle = '#3a3834';
        ctx.fillRect(0, 0, 2048, 2048);

        // 2. Micrograno de áridos, gravilla y polvo de obra
        for (let i = 0; i < 25000; i++) {
            const rx = Math.random() * 2048;
            const ry = Math.random() * 2048;
            const isLight = Math.random() > 0.45;
            ctx.fillStyle = isLight ? 'rgba(215, 205, 185, 0.05)' : 'rgba(25, 20, 15, 0.08)';
            ctx.fillRect(rx, ry, 2, 2);
        }

        // 3. Plataforma principal de hormigón de limpieza y losa de cimentación (Centro-Norte)
        ctx.fillStyle = '#2f343b';
        ctx.fillRect(400, 300, 1248, 1448);

        // Textura de hormigón barrido y juntas de vertido de solera
        ctx.strokeStyle = '#1b1e24';
        ctx.lineWidth = 4;
        for (let x = 400; x <= 1648; x += 156) {
            ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x, 1748); ctx.stroke();
        }
        for (let y = 300; y <= 1748; y += 156) {
            ctx.beginPath(); ctx.moveTo(400, y); ctx.lineTo(1648, y); ctx.stroke();
        }

        // 4. Rodadas de neumáticos pesados y orugas de excavadora en el acceso de tierra
        ctx.strokeStyle = 'rgba(20, 16, 12, 0.35)';
        ctx.lineWidth = 28;
        ctx.setLineDash([12, 10]);
        // Carriles de entrada y maniobra de camiones
        for (let offset = -40; offset <= 40; offset += 80) {
            ctx.beginPath(); ctx.moveTo(200 + offset, 0); ctx.lineTo(450 + offset, 800); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(1800 + offset, 0); ctx.lineTo(1600 + offset, 700); ctx.stroke();
        }
        ctx.setLineDash([]);

        // 5. Franjas perimetrales de seguridad de obra (Líneas de peligro amarillas y negras)
        const drawHazardZone = (x1, y1, w, h) => {
            ctx.save();
            ctx.beginPath(); ctx.rect(x1, y1, w, h); ctx.clip();
            ctx.fillStyle = '#d99000'; ctx.fillRect(x1, y1, w, h);
            ctx.fillStyle = '#1c1f24';
            for (let i = -h; i < w + h; i += 28) {
                ctx.beginPath();
                ctx.moveTo(x1 + i, y1);
                ctx.lineTo(x1 + i + 14, y1);
                ctx.lineTo(x1 + i + 14 - h, y1 + h);
                ctx.lineTo(x1 + i - h, y1 + h);
                ctx.closePath(); ctx.fill();
            }
            ctx.restore();
        };

        // Perímetro de bahías de izado
        drawHazardZone(410, 310, 600, 24);
        drawHazardZone(1040, 310, 600, 24);
        drawHazardZone(410, 1714, 1228, 24);

        // 6. Plancha metálica de estacionamiento y reparto de carga para la grúa Liebherr
        ctx.fillStyle = '#22262d';
        ctx.fillRect(874, 874, 300, 300);
        ctx.strokeStyle = 'rgba(220, 160, 0, 0.85)';
        ctx.lineWidth = 8;
        ctx.strokeRect(874, 874, 300, 300);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        tex.anisotropy = 8;
        return tex;
    }

    _buildGround() {
        const groundTex = this._createConstructionGroundTexture();
        const planeGeo = new THREE.PlaneGeometry(800, 800);
        const planeMat = new THREE.MeshStandardMaterial({
            map: groundTex,
            roughness: 0.88,
            metalness: 0.12
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);

        // Placas de acero de rodadura en el suelo bajo la zona de maniobra de la grúa (Heavy Steel Road Plates)
        const plateGeo = new THREE.BoxGeometry(3.2, 0.08, 2.2);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x2e353f, roughness: 0.45, metalness: 0.82 });
        [-3.8, 0, 3.8].forEach(px => {
            [-4.5, 4.5].forEach(pz => {
                const plate = new THREE.Mesh(plateGeo, plateMat);
                plate.position.set(px, 0.04, pz);
                plate.receiveShadow = true;
                this.scene.add(plate);
            });
        });
    }

    // --- 2. EL EDIFICIO EN ESTRUCTURA DE HORMIGÓN ARMADO (SKELETAL BUILDING) ---
    _buildConstructionSite() {
        const buildingGroup = new THREE.Group();
        this.scene.add(buildingGroup);

        const bx = 32;
        const bz = -18;
        const bLength = 34; // 34m largo
        const bWidth = 24;  // 24m ancho
        const floorHeight = 5.0; // 5m por planta
        const numFloors = 4;     // PB, P1, P2, P3/Azotea
        const slabThickness = 0.45;

        // Materiales de hormigón encofrado y acero corrugado
        const concreteMat = new THREE.MeshStandardMaterial({
            color: 0x4f5661,
            roughness: 0.85,
            metalness: 0.12
        });
        const edgeWoodMat = new THREE.MeshStandardMaterial({
            color: 0xb5824c, // Madera de encofrado en los bordes de losa
            roughness: 0.75,
            metalness: 0.05
        });
        const steelRebarMat = new THREE.MeshStandardMaterial({
            color: 0x5a483e, // Acero de ferralla con pátina de óxido superficial
            roughness: 0.6,
            metalness: 0.75
        });
        const guardRailMat = new THREE.MeshStandardMaterial({
            color: 0xd92626, // Barandillas provisionales de seguridad rojas
            roughness: 0.35,
            metalness: 0.4
        });
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0xf59e0b, // Plataformas voladas amarillas
            roughness: 0.4,
            metalness: 0.6
        });

        // 1. Losas de forjado de hormigón armado
        const slabGeo = new THREE.BoxGeometry(bLength, slabThickness, bWidth);
        for (let floor = 0; floor <= numFloors; floor++) {
            const slabY = floor * floorHeight;
            const slab = new THREE.Mesh(slabGeo, [
                edgeWoodMat, edgeWoodMat, concreteMat, concreteMat, edgeWoodMat, edgeWoodMat
            ]);
            slab.position.set(bx, slabY, bz);
            slab.castShadow = true;
            slab.receiveShadow = true;
            buildingGroup.add(slab);

            // Barandillas provisionales de protección anticaída en el perímetro de cada forjado
            if (floor > 0) {
                this._buildFloorGuardrails(buildingGroup, bx, slabY, bz, bLength, bWidth, guardRailMat, floor);
            }
        }

        // 2. Matriz de pilares de hormigón armado (5 filas x 4 columnas)
        const pilarCols = 5;
        const pilarRows = 4;
        const stepX = (bLength - 4.0) / (pilarCols - 1);
        const stepZ = (bWidth - 4.0) / (pilarRows - 1);
        const pilarGeo = new THREE.BoxGeometry(0.85, floorHeight - slabThickness, 0.85);

        for (let floor = 0; floor < numFloors; floor++) {
            const pilarBaseY = floor * floorHeight + (floorHeight - slabThickness) * 0.5;

            for (let ix = 0; ix < pilarCols; ix++) {
                for (let iz = 0; iz < pilarRows; iz++) {
                    const px = bx - (bLength - 4.0) * 0.5 + ix * stepX;
                    const pz = bz - (bWidth - 4.0) * 0.5 + iz * stepZ;

                    const pilar = new THREE.Mesh(pilarGeo, concreteMat);
                    pilar.position.set(px, pilarBaseY, pz);
                    pilar.castShadow = true;
                    pilar.receiveShadow = true;
                    buildingGroup.add(pilar);

                    // En la última planta (azotea), sobresalen las armaduras de ferralla hacia el cielo
                    if (floor === numFloors - 1) {
                        this._buildRebarRebarBundle(buildingGroup, px, numFloors * floorHeight, pz, steelRebarMat);
                    }
                }
            }
        }

        // 3. Plataformas voladas de descarga de materiales (Cantilever Loading Decks)
        // Planta 1 (+5m): Plataforma saliente hacia la grúa para recepción de cargas
        const deck1 = this._buildCantileverDeck(bx - bLength * 0.25, 5.0, bz + bWidth * 0.5 + 2.4, 6.0, 4.8, platformMat, guardRailMat);
        buildingGroup.add(deck1);

        // Planta 2 (+10m): Plataforma saliente en el lateral
        const deck2 = this._buildCantileverDeck(bx + bLength * 0.25, 10.0, bz + bWidth * 0.5 + 2.4, 5.5, 4.8, platformMat, guardRailMat);
        buildingGroup.add(deck2);

        // 4. Andamiaje modular de obra en la fachada este
        this._buildScaffolding(buildingGroup, bx + bLength * 0.5 + 1.2, 0, bz, bWidth, numFloors * floorHeight);

        // 5. Acopios de obra en la azotea (palets de ladrillo y ferralla)
        this._buildRooftopMaterials(buildingGroup, bx, numFloors * floorHeight, bz);

        // Coordenadas objetivo de la azotea
        const topY = numFloors * floorHeight;
        this.rooftopTarget = {
            x: bx,
            y: topY + 0.1,
            z: bz,
            width: bLength,
            depth: bWidth
        };

        // Obstáculo para la física de colisión del camión
        this.obstacles.push({
            minX: bx - bLength * 0.5 - 2.0,
            maxX: bx + bLength * 0.5 + 2.0,
            minZ: bz - bWidth * 0.5 - 2.0,
            maxZ: bz + bWidth * 0.5 + 4.5,
            height: topY + 3.0
        });

        this.constructionBuilding = buildingGroup;
    }

    // Barandillas provisionales de seguridad con rodapié de madera
    _buildFloorGuardrails(group, bx, slabY, bz, bL, bW, railMat, floorNum) {
        const railH = 1.1;
        const halfL = bL * 0.5;
        const halfW = bW * 0.5;

        const sides = [
            { start: [-halfL, 0, halfW], end: [halfL, 0, halfW], leaveGap: (floorNum <= 2) }, // Frente con hueco para plataforma
            { start: [-halfL, 0, -halfW], end: [halfL, 0, -halfW], leaveGap: false },
            { start: [-halfL, 0, -halfW], end: [-halfL, 0, halfW], leaveGap: false },
            { start: [halfL, 0, -halfW], end: [halfL, 0, halfW], leaveGap: false }
        ];

        sides.forEach((side) => {
            const sx = side.start[0]; const sz = side.start[2];
            const ex = side.end[0]; const ez = side.end[2];
            const dist = Math.hypot(ex - sx, ez - sz);

            if (!side.leaveGap) {
                const railGeo = new THREE.BoxGeometry(0.06, 0.06, dist);
                const rail = new THREE.Mesh(railGeo, railMat);
                rail.position.set(bx + (sx + ex) * 0.5, slabY + railH, bz + (sz + ez) * 0.5);
                if (Math.abs(ex - sx) > 0.1) rail.rotation.y = Math.PI / 2;
                group.add(rail);

                // Rodapié de madera
                const kickGeo = new THREE.BoxGeometry(0.04, 0.22, dist);
                const kick = new THREE.Mesh(kickGeo, railMat);
                kick.position.set(bx + (sx + ex) * 0.5, slabY + 0.12, bz + (sz + ez) * 0.5);
                if (Math.abs(ex - sx) > 0.1) kick.rotation.y = Math.PI / 2;
                group.add(kick);
            }
        });
    }

    // Esperas de armadura de acero corrugado (ferralla) saliendo de los pilares hacia el cielo
    _buildRebarRebarBundle(group, px, topY, pz, rebarMat) {
        const rebarH = 2.8;
        const rebarRadius = 0.035;
        const rebarGeo = new THREE.CylinderGeometry(rebarRadius, rebarRadius, rebarH, 6);

        const offsets = [
            [-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28],
            [0, -0.28], [0, 0.28], [-0.28, 0], [0.28, 0]
        ];

        offsets.forEach(([ox, oz]) => {
            const rebar = new THREE.Mesh(rebarGeo, rebarMat);
            // Inclinación sutil irregular típica de las barras dobladas en obra
            const jitterX = (Math.random() - 0.5) * 0.06;
            const jitterZ = (Math.random() - 0.5) * 0.06;
            rebar.position.set(px + ox + jitterX, topY + rebarH * 0.5, pz + oz + jitterZ);
            rebar.castShadow = true;
            group.add(rebar);
        });
    }

    // Plataforma volada para descarga de cargas suspendidas
    _buildCantileverDeck(dx, dy, dz, width, depth, platMat, railMat) {
        const group = new THREE.Group();
        group.position.set(dx, dy, dz);

        // Suelo metálico amarillo con chapa de lagrimado
        const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, depth), platMat);
        floorMesh.castShadow = true;
        floorMesh.receiveShadow = true;
        group.add(floorMesh);

        // Vigas de soporte diagonal en V hacia el forjado inferior
        const strutMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5, metalness: 0.8 });
        const strutGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.2, 8);
        [-width * 0.4, width * 0.4].forEach(sx => {
            const strut = new THREE.Mesh(strutGeo, strutMat);
            strut.position.set(sx, -2.1, -depth * 0.35);
            strut.rotation.x = 0.45;
            strut.castShadow = true;
            group.add(strut);
        });

        // Barandillas laterales
        const railGeo = new THREE.BoxGeometry(0.08, 1.1, depth);
        const railLeft = new THREE.Mesh(railGeo, railMat);
        railLeft.position.set(-width * 0.5, 0.6, 0);
        group.add(railLeft);

        const railRight = new THREE.Mesh(railGeo, railMat);
        railRight.position.set(width * 0.5, 0.6, 0);
        group.add(railRight);

        return group;
    }

    // Andamiaje tubular modular de obra
    _buildScaffolding(group, sx, sy, sz, depth, height) {
        const scaffMat = new THREE.MeshStandardMaterial({ color: 0x8a9ba8, roughness: 0.4, metalness: 0.75 });
        const boardMat = new THREE.MeshStandardMaterial({ color: 0x8c6239, roughness: 0.85 });
        const netMat = new THREE.MeshStandardMaterial({
            color: 0x1f663b,
            roughness: 0.9,
            transparent: true,
            opacity: 0.75,
            side: THREE.DoubleSide
        });

        // Malla verde de protección de andamio
        const netMesh = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), netMat);
        netMesh.position.set(sx + 0.8, sy + height * 0.5, sz);
        netMesh.rotation.y = Math.PI / 2;
        group.add(netMesh);

        // Tubos verticales y tablones
        for (let y = 2.5; y < height; y += 2.5) {
            const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, depth), boardMat);
            board.position.set(sx, y, sz);
            board.castShadow = true;
            group.add(board);
        }
    }

    // Acopios de materiales en la azotea (palets, cajas de encofrado)
    _buildRooftopMaterials(group, bx, topY, bz) {
        const paletMat = new THREE.MeshStandardMaterial({ color: 0x6e5033, roughness: 0.9 });
        const blockMat = new THREE.MeshStandardMaterial({ color: 0x944933, roughness: 0.8 }); // Ladrillos cara-vista

        [-bL => bx - 8, bx + 6].forEach((mx, idx) => {
            const palet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.0), paletMat);
            palet.position.set(mx, topY + 0.15, bz + (idx === 0 ? 5 : -5));
            palet.castShadow = true;
            palet.receiveShadow = true;
            group.add(palet);

            const brickStack = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.4, 1.7), blockMat);
            brickStack.position.set(mx, topY + 0.3 + 0.7, bz + (idx === 0 ? 5 : -5));
            brickStack.castShadow = true;
            brickStack.receiveShadow = true;
            group.add(brickStack);
        });
    }

    // --- 3. CAMPAMENTO DE OBRA: CASETAS MODULARES Y OFICINAS TÉCNICAS ---
    _buildSiteCamp() {
        const campGroup = new THREE.Group();
        this.scene.add(campGroup);

        const cx = -38;
        const cz = 18;

        // Caseta de obra modular 6x2.4x2.6m
        const buildModularOffice = (x, y, z, rotY, isBlue = true) => {
            const g = new THREE.Group();
            g.position.set(x, y, z);
            g.rotation.y = rotY;

            // Paneles sándwich blancos
            const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6edf3, roughness: 0.45, metalness: 0.15 });
            const frameMat = new THREE.MeshStandardMaterial({ color: isBlue ? 0x1f5f9e : 0x2b313a, roughness: 0.35, metalness: 0.4 });
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x30363d, roughness: 0.8 });

            const body = new THREE.Mesh(new THREE.BoxGeometry(6.0, 2.6, 2.44), [
                frameMat, frameMat, roofMat, frameMat, wallMat, wallMat
            ]);
            body.castShadow = true;
            body.receiveShadow = true;
            g.add(body);

            // Ventana de oficina con marco y reja
            const winMat = new THREE.MeshStandardMaterial({ color: 0x111c28, roughness: 0.1, metalness: 0.8 });
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), winMat);
            win.position.set(0.6, 0.2, 1.23);
            g.add(win);

            // Puerta exterior
            const doorMat = new THREE.MeshStandardMaterial({ color: isBlue ? 0x174673 : 0x1f2328, roughness: 0.5 });
            const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), doorMat);
            door.position.set(-1.6, -0.25, 1.23);
            g.add(door);

            // Climatizador exterior en el lateral
            const acMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, roughness: 0.5 });
            const ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.4), acMat);
            ac.position.set(-2.6, 0.6, 0);
            ac.castShadow = true;
            g.add(ac);

            return g;
        };

        // Caseta 1: Oficina de Jefatura de Obra (Planta baja)
        const office1 = buildModularOffice(cx, 1.3, cz, Math.PI * 0.15, true);
        campGroup.add(office1);

        // Caseta 2: Vestuarios / Sala técnica
        const office2 = buildModularOffice(cx + 7.5, 1.3, cz + 2.0, Math.PI * 0.15, false);
        campGroup.add(office2);

        // Caseta 3 apilada en segunda planta (+2.6m) sobre la primera
        const office3 = buildModularOffice(cx, 1.3 + 2.6, cz, Math.PI * 0.15, true);
        campGroup.add(office3);

        // Escalera metálica de acceso a la planta alta
        const stairMat = new THREE.MeshStandardMaterial({ color: 0x484f58, metalness: 0.85, roughness: 0.35 });
        const stairMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.2, 3.8), stairMat);
        stairMesh.position.set(cx - 3.8, 1.6, cz - 0.8);
        stairMesh.rotation.y = Math.PI * 0.15;
        stairMesh.castShadow = true;
        campGroup.add(stairMesh);

        this.obstacles.push({
            minX: cx - 5.5, maxX: cx + 12.0,
            minZ: cz - 4.0, maxZ: cz + 5.0,
            height: 5.6
        });
    }

    // --- 4. BARRERAS DE SEGURIDAD NEW JERSEY (ROJO Y BLANCO) ---
    _buildSafetyBarriers() {
        const barrierGroup = new THREE.Group();
        this.scene.add(barrierGroup);

        const redMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5, metalness: 0.1 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.5, metalness: 0.1 });

        // Hilera de barreras New Jersey delimitando el radio de giro de la grúa
        const numBarriers = 14;
        const startX = -12;
        const startZ = 16;

        for (let i = 0; i < numBarriers; i++) {
            const isRed = (i % 2 === 0);
            const bGeo = new THREE.BoxGeometry(1.8, 0.95, 0.55);
            const bMesh = new THREE.Mesh(bGeo, isRed ? redMat : whiteMat);
            bMesh.position.set(startX + i * 2.0, 0.48, startZ + Math.sin(i * 0.25) * 1.5);
            bMesh.castShadow = true;
            bMesh.receiveShadow = true;
            barrierGroup.add(bMesh);

            this.obstacles.push({
                minX: bMesh.position.x - 0.9,
                maxX: bMesh.position.x + 0.9,
                minZ: bMesh.position.z - 0.3,
                maxZ: bMesh.position.z + 0.3,
                height: 1.0
            });
        }
    }

    getGroundHeightAt(x, z) {
        let maxH = 0;
        for (const obs of this.obstacles) {
            if (x >= obs.minX && x <= obs.maxX && z >= obs.minZ && z <= obs.maxZ) {
                if (obs.height > maxH) maxH = obs.height;
            }
        }
        return maxH;
    }
}
