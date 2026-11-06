import { THREE } from '../core/three.js';

export class CargoManager {
    constructor(scene) {
        this.scene = scene;
        this.activeCargo = null;
        this.cargoList = [];

        this._createCargoTemplates();
    }

    _createContainerTexture(colorHex, label) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 256;
        const ctx = c.getContext('2d');

        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 0, 512, 256);

        // Chapa corrugada
        for (let x = 12; x < 500; x += 16) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(x, 8, 6, 240);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillRect(x + 6, 8, 6, 240);
        }

        ctx.lineWidth = 14;
        ctx.strokeStyle = 'rgba(10, 14, 20, 0.9)';
        ctx.strokeRect(6, 6, 500, 244);

        ctx.font = 'bold 24px Roboto Mono, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label || 'CARGO-20FT', 40, 55);

        return new THREE.CanvasTexture(c);
    }

    _buildContainer20ft(colorHex = '#0e5f96', label = 'MAERSK 20FT') {
        const group = new THREE.Group();
        const tex = this._createContainerTexture(colorHex, label);

        const wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.35 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x181d24, roughness: 0.8 });

        const length = 6.2;
        const height = 2.6;
        const width = 2.4;

        const boxGeo = new THREE.BoxGeometry(length, height, width);
        const mesh = new THREE.Mesh(boxGeo, [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 4 Cantoneras de esquina superiores reforzadas con cáncamos de izado
        const cornerMat = new THREE.MeshStandardMaterial({ color: 0xf6c000, metalness: 0.8, roughness: 0.25 });
        const halfL = length * 0.5 - 0.15;
        const halfW = width * 0.5 - 0.15;
        const topY = height * 0.5;

        [
            [halfL, topY, halfW],
            [halfL, topY, -halfW],
            [-halfL, topY, -halfW],
            [-halfL, topY, halfW]
        ].forEach(([cx, cy, cz]) => {
            const eyeGeo = new THREE.TorusGeometry(0.18, 0.05, 8, 16);
            const eyeMesh = new THREE.Mesh(eyeGeo, cornerMat);
            eyeMesh.position.set(cx, cy + 0.18, cz);
            eyeMesh.rotation.x = Math.PI / 2;
            group.add(eyeMesh);
        });

        group.userData = {
            type: 'CONTAINER_20FT',
            massTon: 18.0,
            halfExtents: new THREE.Vector3(length * 0.5, height * 0.5, width * 0.5),
            cornersLocal: [
                new THREE.Vector3(halfL, topY + 0.2, halfW),
                new THREE.Vector3(halfL, topY + 0.2, -halfW),
                new THREE.Vector3(-halfL, topY + 0.2, -halfW),
                new THREE.Vector3(-halfL, topY + 0.2, halfW)
            ],
            hookTargetY: topY + 0.3
        };

        return group;
    }

    _buildHeavyTransformer() {
        const group = new THREE.Group();

        // Cuerpo principal de acero grafito
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x272c35, roughness: 0.35, metalness: 0.75 });
        const bodyGeo = new THREE.BoxGeometry(3.6, 2.8, 2.6);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // Aletas de refrigeración laterales
        const finMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.5, metalness: 0.8 });
        for (let x = -1.5; x <= 1.5; x += 0.35) {
            const finGeo = new THREE.BoxGeometry(0.08, 2.2, 3.2);
            const fin = new THREE.Mesh(finGeo, finMat);
            fin.position.set(x, 0, 0);
            fin.castShadow = true;
            group.add(fin);
        }

        // 3 Aisladores cerámicos de alta tensión superiores
        const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xc85a17, roughness: 0.2, metalness: 0.1 });
        const capMat = new THREE.MeshStandardMaterial({ color: 0xd0d7de, metalness: 0.9, roughness: 0.15 });

        [-1.0, 0, 1.0].forEach((bx) => {
            const colGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.1, 12);
            const col = new THREE.Mesh(colGeo, ceramicMat);
            col.position.set(bx, 1.4 + 0.55, 0);
            col.castShadow = true;
            group.add(col);

            const capGeo = new THREE.SphereGeometry(0.16, 12, 12);
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.set(bx, 1.4 + 1.1, 0);
            group.add(cap);
        });

        // 4 Cáncamos de izado reforzados
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf6c000, metalness: 0.85, roughness: 0.2 });
        const halfX = 1.6;
        const halfZ = 1.1;
        const topY = 1.4;

        [
            [halfX, topY, halfZ],
            [halfX, topY, -halfZ],
            [-halfX, topY, -halfZ],
            [-halfX, topY, halfZ]
        ].forEach(([cx, cy, cz]) => {
            const eyeGeo = new THREE.TorusGeometry(0.20, 0.06, 8, 16);
            const eye = new THREE.Mesh(eyeGeo, eyeMat);
            eye.position.set(cx, cy + 0.2, cz);
            eye.rotation.x = Math.PI / 2;
            group.add(eye);
        });

        group.userData = {
            type: 'TRANSFORMER_HEAVY',
            massTon: 28.0,
            halfExtents: new THREE.Vector3(1.8, 1.4, 1.3),
            cornersLocal: [
                new THREE.Vector3(halfX, topY + 0.2, halfZ),
                new THREE.Vector3(halfX, topY + 0.2, -halfZ),
                new THREE.Vector3(-halfX, topY + 0.2, -halfZ),
                new THREE.Vector3(-halfX, topY + 0.2, halfZ)
            ],
            hookTargetY: topY + 0.3
        };

        return group;
    }

    _buildHeavyConcretePipe() {
        const group = new THREE.Group();

        // Cilindro de hormigón armado de gran diámetro (orientado horizontalmente)
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x6e7681, roughness: 0.88, metalness: 0.1 });
        const pipeGeo = new THREE.CylinderGeometry(1.3, 1.3, 7.5, 24, 1, true);
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.rotation.z = Math.PI / 2;
        pipe.castShadow = true;
        pipe.receiveShadow = true;
        group.add(pipe);

        // Tapa/núcleo interno hueco oscuro
        const innerMat = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.95 });
        const innerGeo = new THREE.CylinderGeometry(1.05, 1.05, 7.55, 24, 1, true);
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.rotation.z = Math.PI / 2;
        group.add(inner);

        // Bandas tensoras de izado de nylon amarillo alrededor del tubo
        const strapMat = new THREE.MeshStandardMaterial({ color: 0xe6a100, roughness: 0.4 });
        [-2.4, 2.4].forEach(sx => {
            const sGeo = new THREE.CylinderGeometry(1.34, 1.34, 0.4, 24, 1, true);
            const s = new THREE.Mesh(sGeo, strapMat);
            s.rotation.z = Math.PI / 2;
            s.position.x = sx;
            group.add(s);
        });

        // Cunas de apoyo de madera en el suelo
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
        [-2.4, 2.4].forEach(sx => {
            const cradleGeo = new THREE.BoxGeometry(0.6, 0.5, 2.8);
            const cradle = new THREE.Mesh(cradleGeo, woodMat);
            cradle.position.set(sx, -1.3 + 0.25, 0);
            cradle.castShadow = true;
            group.add(cradle);
        });

        group.userData = {
            type: 'CONCRETE_PIPE',
            massTon: 14.0,
            halfExtents: new THREE.Vector3(3.75, 1.3, 1.3),
            cornersLocal: [
                new THREE.Vector3(2.4, 1.35, 0.9),
                new THREE.Vector3(2.4, 1.35, -0.9),
                new THREE.Vector3(-2.4, 1.35, -0.9),
                new THREE.Vector3(-2.4, 1.35, 0.9)
            ],
            hookTargetY: 1.45
        };

        return group;
    }

    _buildHVACUnit() {
        const group = new THREE.Group();

        const hvacMat = new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.4, metalness: 0.45 });
        const hvacGeo = new THREE.BoxGeometry(4.2, 2.0, 2.2);
        const hvac = new THREE.Mesh(hvacGeo, hvacMat);
        hvac.castShadow = true;
        hvac.receiveShadow = true;
        group.add(hvac);

        // Rejillas circulares superiores de los ventiladores axiales
        const grillMat = new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.7 });
        [-1.1, 1.1].forEach(gx => {
            const gGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.12, 16);
            const g = new THREE.Mesh(gGeo, grillMat);
            g.position.set(gx, 1.0 + 0.06, 0);
            group.add(g);
        });

        const halfX = 1.9;
        const halfZ = 0.95;
        const topY = 1.0;

        group.userData = {
            type: 'HVAC_ROOF_UNIT',
            massTon: 8.5,
            halfExtents: new THREE.Vector3(2.1, 1.0, 1.1),
            cornersLocal: [
                new THREE.Vector3(halfX, topY + 0.15, halfZ),
                new THREE.Vector3(halfX, topY + 0.15, -halfZ),
                new THREE.Vector3(-halfX, topY + 0.15, -halfZ),
                new THREE.Vector3(-halfX, topY + 0.15, halfZ)
            ],
            hookTargetY: topY + 0.25
        };

        return group;
    }

    _createCargoTemplates() {
        // Cargas de obra civil calibradas con las plataformas del edificio en construcción
        this.cargoList = [
            {
                id: 1,
                name: 'CONTENEDOR 20FT MAERSK (18 T)',
                type: 'CONTAINER_20FT',
                massTon: 18.0,
                mesh: this._buildContainer20ft('#0e5f96', 'MAERSK 20FT'),
                pickupPos: new THREE.Vector3(-16, 1.3, 22),
                dropTarget: { x: 6, y: 0.1, z: 18, radius: 3.8, name: 'BAHÍA DE DESCARGA EN SOLERA (COTA 0)' }
            },
            {
                id: 2,
                name: 'TUBERÍA DE HORMIGÓN ARMADO (14 T)',
                type: 'CONCRETE_PIPE',
                massTon: 14.0,
                mesh: this._buildHeavyConcretePipe(),
                pickupPos: new THREE.Vector3(-20, 1.3, -12),
                dropTarget: { x: 23.5, y: 5.2, z: -3.6, radius: 3.6, name: 'PLATAFORMA VOLADA PLANTA 1 (+5m)' }
            },
            {
                id: 3,
                name: 'CLIMATIZADOR INDUSTRIAL HVAC (8.5 T)',
                type: 'HVAC_ROOF_UNIT',
                massTon: 8.5,
                mesh: this._buildHVACUnit(),
                pickupPos: new THREE.Vector3(-26, 1.0, 8),
                dropTarget: { x: 32, y: 20.4, z: -18, radius: 4.5, name: 'AZOTEA EN CONSTRUCCIÓN (+20m)' }
            },
            {
                id: 4,
                name: 'TRANSFORMADOR ELÉCTRICO 28T',
                type: 'TRANSFORMER_HEAVY',
                massTon: 28.0,
                mesh: this._buildHeavyTransformer(),
                pickupPos: new THREE.Vector3(8, 1.4, 28),
                dropTarget: { x: 40.5, y: 10.2, z: -3.6, radius: 3.6, name: 'PLATAFORMA VOLADA PLANTA 2 (+10m)' }
            }
        ];

        // Añadir las mallas iniciales al escenario
        this.cargoList.forEach((c) => {
            const m = c.mesh;
            m.position.copy(c.pickupPos);
            // Ajustar altura inicial al suelo
            if (c.type === 'CONTAINER_20FT') m.position.y = 1.3;
            else if (c.type === 'CONCRETE_PIPE') m.position.y = 1.3;
            else if (c.type === 'HVAC_ROOF_UNIT') m.position.y = 1.0;
            else if (c.type === 'TRANSFORMER_HEAVY') m.position.y = 1.4;

            this.scene.add(m);
        });

        this.activeCargo = this.cargoList[0];
    }

    setRooftopTarget(rooftopTarget) {
        const hvacCargo = this.cargoList.find(c => c.type === 'HVAC_ROOF_UNIT');
        if (hvacCargo && rooftopTarget) {
            hvacCargo.dropTarget = {
                x: rooftopTarget.x,
                y: rooftopTarget.y,
                z: rooftopTarget.z,
                radius: 4.5,
                name: 'AZOTEA EN CONSTRUCCIÓN (+20m)'
            };
        }
    }

    getActiveCargo() {
        return this.activeCargo;
    }

    setActiveCargoByIndex(idx) {
        const safeIdx = idx % this.cargoList.length;
        this.activeCargo = this.cargoList[safeIdx];
        return this.activeCargo;
    }

    getDistanceToHook(hookPos) {
        if (!this.activeCargo) return Infinity;
        const cargoPos = this.activeCargo.mesh.position;
        const hookYTarget = cargoPos.y + (this.activeCargo.mesh.userData.hookTargetY || 1.2);
        return Math.hypot(hookPos.x - cargoPos.x, hookPos.y - hookYTarget, hookPos.z - cargoPos.z);
    }
}
