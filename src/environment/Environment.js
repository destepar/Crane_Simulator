import { THREE, GLTFLoader } from '../core/three.js';

export class Environment {
    constructor(scene, onAssetsLoaded) {
        this.scene = scene;
        this.onAssetsLoaded = onAssetsLoaded;
        this.obstacles = [];

        // Zona objetivo de azotea para izado HVAC calibrada a la losa real de azotea del Edificio 001 (12.15m; 18.4m era la punta de la antena)
        this.rooftopTarget = { x: 28, y: 12.15, z: -20, width: 12.6, depth: 23.1 };
        this.isAssetsLoaded = false;
        this.heliController = null;
        this.heliRawScene = null;

        this._buildGround();
        this._buildHelipadStructure();
        this._buildLuxuryShowcase();
        this._buildUrbanDecorativeLife();
        this._loadReal3DAssets();
    }

    _createBuildingFacadeMaterial(palette) {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');

        // Fondo base arquitectónico (ladrillo / piedra / panel prefabricado)
        ctx.fillStyle = palette.base;
        ctx.fillRect(0, 0, 512, 512);

        // Variación orgánica de bloques o ladrillos vistos
        const rows = 16;
        const cols = 8;
        const rowH = 512 / rows;
        const colW = 512 / cols;

        for (let r = 0; r < rows; r++) {
            const offset = (r % 2) * (colW * 0.5);
            for (let col = -1; col <= cols; col++) {
                const bx = col * colW + offset;
                const by = r * rowH;
                // Alternar sutilmente tonos de bloque
                ctx.fillStyle = ((r + col) % 2 === 0) ? palette.alt1 : palette.alt2;
                ctx.fillRect(bx + 2, by + 2, colW - 4, rowH - 4);
            }
        }

        // Juntas horizontales de mortero / paneles arquitectónicos
        ctx.strokeStyle = palette.mortar;
        ctx.lineWidth = 2;
        for (let r = 0; r <= rows; r++) {
            const y = r * rowH;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(512, y);
            ctx.stroke();
        }

        // Forjados de planta (cornisas horizontales de hormigón cada piso = 512px en V)
        ctx.fillStyle = palette.trim;
        ctx.fillRect(0, 0, 512, 34);
        ctx.fillRect(0, 488, 512, 24);

        // Sombra bajo cornisa para dar relieve 3D
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.fillRect(0, 34, 512, 10);

        // Pilastras verticales arquitectónicas
        ctx.fillStyle = palette.pilaster;
        ctx.fillRect(0, 0, 22, 512);
        ctx.fillRect(245, 0, 22, 512);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;

        return new THREE.MeshStandardMaterial({
            map: tex,
            bumpMap: tex,
            bumpScale: 0.04,
            roughness: palette.roughness || 0.72,
            metalness: palette.metalness || 0.12
        });
    }

    _createBuildingGlassMaterial(tintHex, warmGlowHex) {
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 256;
        const ctx = c.getContext('2d');

        // Degradado de reflejo de cielo e interior arquitectónico
        const grad = ctx.createLinearGradient(0, 0, 256, 256);
        grad.addColorStop(0, tintHex);
        grad.addColorStop(0.5, '#2b4c66');
        grad.addColorStop(0.85, warmGlowHex);
        grad.addColorStop(1, '#152536');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);

        // Perfiles de carpintería metálica y estores interiores sutiles
        ctx.fillStyle = 'rgba(255, 248, 225, 0.14)';
        ctx.fillRect(16, 18, 96, 85);
        ctx.fillRect(140, 135, 96, 95);

        ctx.strokeStyle = '#0d131a';
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, 256, 256);
        ctx.beginPath();
        ctx.moveTo(128, 0); ctx.lineTo(128, 256);
        ctx.moveTo(0, 128); ctx.lineTo(256, 128);
        ctx.stroke();

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;

        return new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.12,
            metalness: 0.82
        });
    }

    _applyArchitecturalBoxUVs(mesh) {
        const geo = mesh.geometry;
        if (!geo || !geo.attributes.position) return;
        const pos = geo.attributes.position;
        const norm = geo.attributes.normal;
        const uvArray = new Float32Array(pos.count * 2);

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const nx = norm ? Math.abs(norm.getX(i)) : 0;
            const ny = norm ? Math.abs(norm.getY(i)) : 0;
            const nz = norm ? Math.abs(norm.getZ(i)) : 1;

            let u, v;
            if (ny > 0.6) {
                // Azotea / superficies horizontales
                u = x / 6.0;
                v = z / 6.0;
            } else if (nx > nz) {
                // Fachadas Este / Oeste
                u = z / 6.0;
                v = y / 3.6;
            } else {
                // Fachadas Norte / Sur
                u = x / 6.0;
                v = y / 3.6;
            }
            uvArray[i * 2] = u;
            uvArray[i * 2 + 1] = v;
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    }

    _buildUrbanDecorativeLife() {
        // 1. Contenedores marítimos intermodales de colores vivos en la zona logística
        const createContainerTex = (baseColor, stripeColor, labelText) => {
            const c = document.createElement('canvas');
            c.width = 512;
            c.height = 256;
            const ctx = c.getContext('2d');

            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, 512, 256);

            // Chapa trapezoidal corrugada vertical
            for (let x = 0; x < 512; x += 16) {
                ctx.fillStyle = (x % 32 === 0) ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.14)';
                ctx.fillRect(x, 14, 8, 228);
            }

            // Marcos estructurales ISO y esquineros
            ctx.strokeStyle = stripeColor;
            ctx.lineWidth = 12;
            ctx.strokeRect(4, 4, 504, 248);

            // Banda y logotipo naviero
            ctx.fillStyle = 'rgba(13, 17, 23, 0.72)';
            ctx.fillRect(60, 88, 260, 62);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 34px Arial, sans-serif';
            ctx.fillText(labelText, 82, 130);

            return new THREE.CanvasTexture(c);
        };

        const containerSpecs = [
            { x: -24, y: 1.3, z: -34, rotY: 0, color: '#1b6ca8', stripe: '#58a6ff', label: 'MAERSK LOG' },
            { x: -24, y: 3.9, z: -34, rotY: 0, color: '#d96b27', stripe: '#f5a623', label: 'HAPAG-LLOYD' },
            { x: -24, y: 1.3, z: -37.2, rotY: 0, color: '#1f7a4c', stripe: '#3fb950', label: 'EVERGREEN' },
            { x: 34, y: 1.3, z: 38, rotY: Math.PI / 2, color: '#a82828', stripe: '#ff6b6b', label: 'CMA CGM' },
            { x: 34, y: 3.9, z: 38, rotY: Math.PI / 2, color: '#1b6ca8', stripe: '#58a6ff', label: 'LIEB-CARGO' }
        ];

        const contGeo = new THREE.BoxGeometry(6.1, 2.6, 2.45);
        containerSpecs.forEach(cs => {
            const mat = new THREE.MeshStandardMaterial({
                map: createContainerTex(cs.color, cs.stripe, cs.label),
                roughness: 0.55,
                metalness: 0.35
            });
            const mesh = new THREE.Mesh(contGeo, mat);
            mesh.position.set(cs.x, cs.y, cs.z);
            mesh.rotation.y = cs.rotY;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        });
    }

    _createLogisticsGroundTexture() {
        const c = document.createElement('canvas');
        c.width = 2048; c.height = 2048;
        const ctx = c.getContext('2d');

        // Asfalto base industrial
        ctx.fillStyle = '#23272d';
        ctx.fillRect(0, 0, 2048, 2048);

        // Grano y motas de desgaste
        for (let i = 0; i < 26000; i++) {
            const rx = Math.random() * 2048;
            const ry = Math.random() * 2048;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(rx, ry, 2, 2);
        }

        // Juntas de dilatación de hormigón
        ctx.strokeStyle = '#15181e';
        ctx.lineWidth = 4;
        for (let x = 0; x <= 2048; x += 256) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2048); ctx.stroke();
        }
        for (let y = 0; y <= 2048; y += 256) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
        }

        // Líneas viales de tráfico pesado (avenida central y carriles)
        ctx.strokeStyle = '#e5a500';
        ctx.lineWidth = 8;
        ctx.setLineDash([36, 22]);
        ctx.beginPath(); ctx.moveTo(0, 1024); ctx.lineTo(2048, 1024); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1024, 0); ctx.lineTo(1024, 2048); ctx.stroke();
        ctx.setLineDash([]);

        // Bahías de aparcamiento y señalización de carga
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        for (let py = 120; py <= 360; py += 70) {
            ctx.strokeRect(100, py, 180, 52);
        }

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

        // Placas de acero de apoyo para los estabilizadores de la grúa (4 patas)
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

    _buildHelipadStructure() {
        // Helipuerto táctico y VIP para el UH-60L Blackhawk en Sector Suroeste X: -22, Z: 42
        const hCanvas = document.createElement('canvas');
        hCanvas.width = 1024; hCanvas.height = 1024;
        const hCtx = hCanvas.getContext('2d');

        // Fondo asfalto helipuerto
        hCtx.fillStyle = '#1c2127';
        hCtx.fillRect(0, 0, 1024, 1024);

        // Borde exterior de seguridad con franjas diagonales amarillas y negras
        hCtx.strokeStyle = '#f5a623';
        hCtx.lineWidth = 28;
        hCtx.strokeRect(36, 36, 952, 952);

        // Círculo de aterrizaje amarillo
        hCtx.beginPath();
        hCtx.arc(512, 512, 400, 0, Math.PI * 2);
        hCtx.strokeStyle = '#f5a623';
        hCtx.lineWidth = 22;
        hCtx.stroke();

        // Letra 'H' oficial aeronáutica
        hCtx.fillStyle = '#ffffff';
        hCtx.font = 'bold 360px Arial, sans-serif';
        hCtx.textAlign = 'center';
        hCtx.textBaseline = 'middle';
        hCtx.fillText('H', 512, 512);

        // Identificador y límites de carga
        hCtx.fillStyle = '#f5a623';
        hCtx.font = 'bold 54px Arial, sans-serif';
        hCtx.fillText('VIP HELIPORT - MAX 12T', 512, 850);
        hCtx.fillText('UH-60 AIR CORPS', 512, 170);

        const heliTex = new THREE.CanvasTexture(hCanvas);
        const padMesh = new THREE.Mesh(
            new THREE.BoxGeometry(22, 0.18, 22),
            new THREE.MeshStandardMaterial({
                map: heliTex,
                roughness: 0.72,
                metalness: 0.15
            })
        );
        padMesh.position.set(-22, 0.09, 42);
        padMesh.receiveShadow = true;
        this.scene.add(padMesh);

        // Balizas luminosas perimetrales del helipuerto
        const beaconMat = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00cc44,
            emissiveIntensity: 0.8
        });
        const beaconGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.35, 8);
        [
            [-32.5, 31.5], [-32.5, 52.5], [-11.5, 31.5], [-11.5, 52.5],
            [-22, 31.5], [-22, 52.5], [-32.5, 42], [-11.5, 42]
        ].forEach(([bx, bz]) => {
            const beacon = new THREE.Mesh(beaconGeo, beaconMat);
            beacon.position.set(bx, 0.18, bz);
            beacon.castShadow = true;
            this.scene.add(beacon);
        });

        this.obstacles.push({
            minX: -33.0, maxX: -11.0,
            minZ: 31.0, maxZ: 53.0,
            height: 0.18,
            name: 'Zona Operativa Helipuerto VIP UH-60'
        });
    }

    _buildLuxuryShowcase() {
        // Podio de exhibición de lujo para el Lamborghini Huracán en X: -18.0, Z: 6.0
        const podGeo = new THREE.BoxGeometry(7.2, 0.25, 5.4);
        const podMat = new THREE.MeshStandardMaterial({
            color: 0x181c22,
            roughness: 0.22,
            metalness: 0.82
        });
        const podium = new THREE.Mesh(podGeo, podMat);
        podium.position.set(-18.0, 0.125, 6.0);
        podium.receiveShadow = true;
        this.scene.add(podium);

        // Marco LED perimetral brillante en azul cian
        const ledMat = new THREE.MeshStandardMaterial({
            color: 0x00e5ff,
            emissive: 0x00b4d8,
            emissiveIntensity: 1.2
        });
        const ledBorder = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.06, 5.6), ledMat);
        ledBorder.position.set(-18.0, 0.04, 6.0);
        this.scene.add(ledBorder);

        this.obstacles.push({
            minX: -21.8, maxX: -14.2,
            minZ: 3.2, maxZ: 8.8,
            height: 1.4,
            name: 'Plaza de Exposicion Superdeportivo VIP'
        });
    }

    _loadReal3DAssets() {
        const loader = new THREE.GLTFLoader();

        let pendingLoads = 7;
        const markLoaded = () => {
            pendingLoads--;
            if (pendingLoads <= 0) {
                this.isAssetsLoaded = true;
                console.log(`[ASSETS 3D REALES] Entorno completado con exito. Total obstaculos fisicos: ${this.obstacles.length}`);
                if (typeof this.onAssetsLoaded === 'function') {
                    this.onAssetsLoaded();
                }
            }
        };

        // =========================================================================
        // 1. MANZANA URBANA CON TEXTURAS ARQUITECTÓNICAS Y PALETAS VIVAS (ESTE Y OESTE)
        // =========================================================================
        loader.load(
            'Assets3D/residential_buildings_set.glb',
            (gltf) => {
                const root = gltf.scene;

                // 5 Paletas arquitectónicas realistas con textura de ladrillo/piedra/forjados y relieve bump
                const facadeMaterials = {
                    terracotta: this._createBuildingFacadeMaterial({
                        base: '#9e4737', alt1: '#ad5240', alt2: '#8c3d2e',
                        mortar: '#cbbba8', trim: '#ded6c8', pilaster: '#dfd8cc', roughness: 0.78
                    }),
                    slate: this._createBuildingFacadeMaterial({
                        base: '#394656', alt1: '#425163', alt2: '#313d4b',
                        mortar: '#222a35', trim: '#9aa8b8', pilaster: '#55667a', roughness: 0.55, metalness: 0.25
                    }),
                    sandstone: this._createBuildingFacadeMaterial({
                        base: '#c9ae86', alt1: '#d4ba94', alt2: '#bca078',
                        mortar: '#99805c', trim: '#eee3d3', pilaster: '#dfd1bc', roughness: 0.74
                    }),
                    tealNordic: this._createBuildingFacadeMaterial({
                        base: '#3b647d', alt1: '#45718c', alt2: '#33586e',
                        mortar: '#274457', trim: '#d5e1eb', pilaster: '#abc0d1', roughness: 0.62, metalness: 0.18
                    }),
                    ochreAmber: this._createBuildingFacadeMaterial({
                        base: '#c28346', alt1: '#cf8f50', alt2: '#b0743a',
                        mortar: '#8c5a2b', trim: '#e8dccb', pilaster: '#d9c8b2', roughness: 0.75
                    })
                };

                const glassMaterials = {
                    skyBlue: this._createBuildingGlassMaterial('#1b3b5c', '#58a6ff'),
                    warmAmber: this._createBuildingGlassMaterial('#1e3347', '#f6e05e'),
                    emerald: this._createBuildingGlassMaterial('#163840', '#79c0ff')
                };

                const setupBuilding = (name, x, z, rotY = 0, height = 20, facadeKey = 'terracotta', glassKey = 'skyBlue') => {
                    const cleanName = name.split(' ').join('_');
                    const bld = root.getObjectByName(name) || root.getObjectByName(cleanName);
                    if (bld) {
                        const fMat = facadeMaterials[facadeKey] || facadeMaterials.terracotta;
                        const gMat = glassMaterials[glassKey] || glassMaterials.skyBlue;

                        bld.traverse((node) => {
                            node.visible = true;
                            if (node.isMesh) {
                                node.castShadow = true;
                                node.receiveShadow = true;
                                this._applyArchitecturalBoxUVs(node);
                                if (node.material && node.material.name === 'glass') {
                                    node.material = gMat;
                                } else {
                                    node.material = fMat;
                                }
                            }
                        });
                        bld.position.set(x, 0, z);
                        bld.rotation.y = rotY;
                        this.scene.add(bld);

                        const isRotated90 = Math.abs(Math.sin(rotY)) > 0.5;
                        const halfX = isRotated90 ? 11.5 : 6.5;
                        const halfZ = isRotated90 ? 6.5 : 11.5;

                        this.obstacles.push({
                            minX: x - halfX, maxX: x + halfX,
                            minZ: z - halfZ, maxZ: z + halfZ,
                            height: height,
                            name: name
                        });

                        return bld;
                    }
                    console.warn(`[ASSETS 3D] No se encontro el nodo ${name} en el set de edificios.`);
                    return null;
                };

                // --- DISTRITO OESTE (Alturas de forjado de azotea reales, descontando los 6.2m del pararrayos) ---
                setupBuilding('Residential_Buildings_002', -34, -28, Math.PI / 2, 15.8, 'slate', 'skyBlue');
                setupBuilding('Residential_Buildings_004', -42, -4, 0, 30.2, 'tealNordic', 'warmAmber');
                setupBuilding('Residential_Buildings_006', -38, 24, -Math.PI / 2, 41.0, 'terracotta', 'warmAmber');

                // --- DISTRITO ESTE (Edificio 001 con forjado de azotea real en y = 12.15m para Misión 3) ---
                setupBuilding('Residential_Buildings_001', 28, -20, 0, 12.15, 'terracotta', 'skyBlue');
                this.rooftopTarget = { x: 28, y: 12.15, z: -20, width: 12.6, depth: 23.1 };

                // Bancada técnica de hormigón apoyada directamente sobre el forjado real de la azotea (y = 12.12m)
                const roofPad = new THREE.Mesh(
                    new THREE.BoxGeometry(5.8, 0.14, 5.8),
                    new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.78, metalness: 0.22 })
                );
                roofPad.position.set(28, 12.14, -20);
                roofPad.receiveShadow = true;
                this.scene.add(roofPad);

                setupBuilding('Residential_Buildings_003', 48, -20, Math.PI, 23.0, 'sandstone', 'warmAmber');
                setupBuilding('Residential_Buildings_005', 32, 24, Math.PI / 2, 33.8, 'ochreAmber', 'emerald');
                setupBuilding('Residential_Buildings_007', 50, 52, 0, 62.6, 'slate', 'skyBlue');
                setupBuilding('Residential_Buildings_008', 65, 0, -Math.PI / 2, 66.2, 'sandstone', 'emerald');

                console.log("[ASSETS 3D REALES] Manzana urbana texturizada con 5 estilos arquitectonicos y acristalamiento reflectante.");
                markLoaded();
            },
            undefined,
            (err) => {
                console.error("[ERROR GLTF] Error cargando edificios residenciales:", err);
                markLoaded();
            }
        );

        // =========================================================================
        // 2. TENDIDO ELÉCTRICO MODULAR Y CABLES PASANDO POR LOS AISLADORES
        // =========================================================================
        const pole1Promise = new Promise(res => loader.load('Assets3D/modular_electricity_poles_1k_1.glb', gltf => res(gltf.scene), undefined, () => res(null)));
        const pole2Promise = new Promise(res => loader.load('Assets3D/modular_electricity_poles_1k_2.glb', gltf => res(gltf.scene), undefined, () => res(null)));

        Promise.all([pole1Promise, pole2Promise]).then(([poleWithTrans, poleStandard]) => {
            if (poleWithTrans || poleStandard) {
                [poleWithTrans, poleStandard].forEach(m => {
                    if (m) {
                        m.traverse(node => {
                            if (node.isMesh) {
                                node.castShadow = true;
                                node.receiveShadow = true;
                            }
                        });
                    }
                });

                // Corredor de torres eléctricas a lo largo de X = 14 (orientadas con rotY = 0)
                const poleConfigs = [
                    { x: 14, z: -35, rotY: 0, model: poleWithTrans || poleStandard },
                    { x: 14, z: -15, rotY: 0, model: poleStandard || poleWithTrans },
                    { x: 14, z: 5, rotY: 0, model: poleStandard || poleWithTrans },
                    { x: 14, z: 25, rotY: 0, model: poleWithTrans || poleStandard },
                    { x: 14, z: 42, rotY: 0, model: poleStandard || poleWithTrans }
                ];

                const placedPoles = [];
                poleConfigs.forEach((cfg, idx) => {
                    if (cfg.model) {
                        const pole = cfg.model.clone();
                        pole.position.set(cfg.x, 0, cfg.z);
                        pole.rotation.y = cfg.rotY;
                        this.scene.add(pole);
                        placedPoles.push({ x: cfg.x, z: cfg.z });

                        this.obstacles.push({
                            minX: cfg.x - 0.7, maxX: cfg.x + 0.7,
                            minZ: cfg.z - 0.7, maxZ: cfg.z + 0.7,
                            height: 6.4,
                            name: `Poste Electrico 0${idx + 1}`
                        });
                    }
                });

                // Material de cable trenzado de alta tensión
                const cableMat = new THREE.MeshStandardMaterial({
                    color: 0x11161d,
                    roughness: 0.8,
                    metalness: 0.25
                });

                // Los aisladores en la cruceta superior están exactamente en:
                // Izquierdo: (X - 0.52, Y: 5.75), Central: (X, Y: 5.82), Derecho: (X + 0.52, Y: 5.75)
                const wireOffsets = [
                    { dx: -0.52, y: 5.75 },
                    { dx: 0.00, y: 5.82 },
                    { dx: 0.52, y: 5.75 }
                ];

                for (let i = 0; i < placedPoles.length - 1; i++) {
                    const pA = placedPoles[i];
                    const pB = placedPoles[i + 1];

                    wireOffsets.forEach((wo) => {
                        const start = new THREE.Vector3(pA.x + wo.dx, wo.y, pA.z);
                        const end = new THREE.Vector3(pB.x + wo.dx, wo.y, pB.z);
                        const mid = new THREE.Vector3(
                            (start.x + end.x) * 0.5,
                            (start.y + end.y) * 0.5 - 0.28, // Cataria con flecha realista de 28cm
                            (start.z + end.z) * 0.5
                        );

                        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
                        const cableGeo = new THREE.TubeGeometry(curve, 18, 0.02, 6, false);
                        const cableMesh = new THREE.Mesh(cableGeo, cableMat);
                        cableMesh.castShadow = true;
                        this.scene.add(cableMesh);
                    });
                }
                console.log("[ASSETS 3D REALES] Tendido de cables acoplado con precision milimetrica a los aisladores de las torres.");
            }
            markLoaded();
        });

        // =========================================================================
        // 3. BARRERAS DE HORMIGÓN NEW JERSEY (Assets3D/concrete_road_barrier)
        // =========================================================================
        const barrier1Promise = new Promise(res => loader.load('Assets3D/concrete_road_barrier_1k.glb', gltf => res(gltf.scene), undefined, () => res(null)));
        const barrier2Promise = new Promise(res => loader.load('Assets3D/concrete_road_barrier_02_1k.glb', gltf => res(gltf.scene), undefined, () => res(null)));

        Promise.all([barrier1Promise, barrier2Promise]).then(([barr1, barr2]) => {
            const cleanBarrier = (model) => {
                if (!model) return null;
                model.traverse(node => {
                    if (node.isMesh) {
                        if (node.name.includes('LOD') && !node.name.includes('LOD0')) {
                            node.visible = false;
                        } else {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    }
                });
                return model;
            };

            const b1 = cleanBarrier(barr1);
            const b2 = cleanBarrier(barr2);
            const barrierModels = [b1, b2].filter(Boolean);

            if (barrierModels.length > 0) {
                let bIdx = 0;

                // 1. Perímetro frontal del carril pesado (X: 12 a 56, Z: 8.0, dejando hueco en X: 24 para Misión 2)
                for (let x = 12; x <= 56; x += 1.55) {
                    if (x >= 22.5 && x <= 25.5) {
                        continue;
                    }
                    const template = barrierModels[bIdx % barrierModels.length];
                    const clone = template.clone();
                    clone.position.set(x, 0, 8.0);
                    this.scene.add(clone);
                    bIdx++;
                }
                this.obstacles.push({
                    minX: 11.5, maxX: 56.5,
                    minZ: 7.6, maxZ: 8.4,
                    height: 0.9,
                    name: 'Barreras New Jersey Perimetro Via'
                });

                // 2. Perímetro del aparcamiento oeste (X: -12.5, Z: -2 a -24)
                for (let z = -2; z >= -24; z -= 1.55) {
                    const template = barrierModels[bIdx % barrierModels.length];
                    const clone = template.clone();
                    clone.position.set(-12.5, 0, z);
                    clone.rotation.y = Math.PI / 2;
                    this.scene.add(clone);
                    bIdx++;
                }
                this.obstacles.push({
                    minX: -12.9, maxX: -12.1,
                    minZ: -24.5, maxZ: -1.5,
                    height: 0.9,
                    name: 'Barreras New Jersey Parking'
                });

                // 3. Perímetro de seguridad de la Subestación Eléctrica
                for (let z = 27; z <= 37; z += 1.55) {
                    const template = barrierModels[bIdx % barrierModels.length];
                    const clone = template.clone();
                    clone.position.set(10.5, 0, z);
                    clone.rotation.y = Math.PI / 2;
                    this.scene.add(clone);
                    bIdx++;
                }
                this.obstacles.push({
                    minX: 10.1, maxX: 10.9,
                    minZ: 26.5, maxZ: 37.5,
                    height: 0.9,
                    name: 'Barreras Subestacion Electrica'
                });

                console.log("[ASSETS 3D REALES] Barreras New Jersey instaladas.");
            }
            markLoaded();
        });

        // =========================================================================
        // 4. VEHÍCULO DE FLOTA CUBIERTO (Assets3D/covered_car_1k.glb)
        // =========================================================================
        loader.load(
            'Assets3D/covered_car_1k.glb',
            (gltf) => {
                const car = gltf.scene;
                car.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });

                car.position.set(-18.0, 0, -20.0);
                car.rotation.y = Math.PI / 2;
                this.scene.add(car);

                this.obstacles.push({
                    minX: -20.5, maxX: -15.5,
                    minZ: -22.0, maxZ: -18.0,
                    height: 1.55,
                    name: 'Vehiculo Flota Parking'
                });

                console.log("[ASSETS 3D REALES] Vehiculo de flota ubicado en aparcamiento.");
                markLoaded();
            },
            undefined,
            () => markLoaded()
        );

        // =========================================================================
        // 5. CASETAS Y SUBESTACIÓN ELÉCTRICA (Assets3D/utility_box_02_1k.glb)
        // =========================================================================
        loader.load('Assets3D/utility_box_02_1k.glb', (gltf) => {
            const box2 = gltf.scene;
            const subPadGeo = new THREE.BoxGeometry(10, 0.15, 12);
            const subPadMat = new THREE.MeshStandardMaterial({ color: 0x3d444d, roughness: 0.9, metalness: 0.1 });
            const subPad = new THREE.Mesh(subPadGeo, subPadMat);
            subPad.position.set(15, 0.075, 32);
            subPad.receiveShadow = true;
            this.scene.add(subPad);

            if (box2) {
                box2.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
                box2.position.set(12.2, 0.15, 30.0);
                this.scene.add(box2);
                this.obstacles.push({
                    minX: 11.6, maxX: 12.8, minZ: 29.5, maxZ: 30.5, height: 1.3,
                    name: 'Armario Electrico Estatico Subestacion'
                });
            }

            console.log("[ASSETS 3D REALES] Subestacion de obra configurada.");
            markLoaded();
        }, undefined, () => markLoaded());

        // =========================================================================
        // 6. LAMBORGHINI HURACÁN LIBERTY WALK (MATERIALES NATIVOS DE BLENDER)
        // =========================================================================
        loader.load(
            'Assets3D/Lambo.glb',
            (gltf) => {
                const lambo = gltf.scene;
                // Respeta al 100% los materiales originales; optimizamos el shadow pass evitando
                // rasterizar 805k triángulos decorativos en el shadow map y usando sombra de contacto suave
                lambo.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = false;
                        node.receiveShadow = true;
                    }
                });

                // Sombra de contacto realista sobre el podio VIP
                const contactShadow = new THREE.Mesh(
                    new THREE.PlaneGeometry(4.6, 2.2),
                    new THREE.MeshBasicMaterial({
                        color: 0x05070a,
                        transparent: true,
                        opacity: 0.65,
                        depthWrite: false
                    })
                );
                contactShadow.rotation.x = -Math.PI / 2;
                contactShadow.rotation.z = Math.PI / 4;
                contactShadow.position.set(-18.0, 0.255, 6.0);
                this.scene.add(contactShadow);

                // Exhibido en el podio VIP con orientación diagonal atractiva
                lambo.position.set(-18.0, 0.25, 6.0);
                lambo.rotation.y = Math.PI / 4;
                this.scene.add(lambo);

                console.log("[ASSETS 3D REALES] Lamborghini Huracan integrado con materiales originales de Blender.");
                markLoaded();
            },
            undefined,
            (err) => {
                console.error("[ERROR GLTF] Error cargando Lambo.glb:", err);
                markLoaded();
            }
        );

        // =========================================================================
        // 7. HELICÓPTERO TÁCTICO UH-60L BLACKHAWK (MATERIALES NATIVOS DE BLENDER)
        // =========================================================================
        loader.load(
            'Assets3D/Helicopter.glb',
            (gltf) => {
                const heli = gltf.scene;
                this.heliRawScene = heli;

                if (this.heliController) {
                    this.heliController.setupModel(heli);
                } else {
                    heli.traverse(node => {
                        if (node.isMesh) {
                            node.castShadow = true;
                            node.receiveShadow = true;
                        }
                    });
                    heli.position.set(-22.0, 0.18, 42.0);
                    heli.rotation.y = -Math.PI / 6;
                    this.scene.add(heli);
                }

                console.log("[ASSETS 3D REALES] Helicoptero Blackhawk integrado con animacion de rotores y materiales originales.");
                markLoaded();
            },
            undefined,
            (err) => {
                console.error("[ERROR GLTF] Error cargando Helicopter.glb:", err);
                markLoaded();
            }
        );
    }

    setHelicopterController(controller) {
        this.heliController = controller;
        if (this.heliRawScene && !controller.isLoaded) {
            controller.setupModel(this.heliRawScene);
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
