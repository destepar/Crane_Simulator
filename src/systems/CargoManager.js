import { THREE, GLTFLoader } from '../core/three.js';

export class CargoManager {
    constructor(scene) {
        this.scene = scene;
        this.activeCargo = null;
        this.cargoList = [];

        this._create3DMissionCargos();
    }

    _create3DMissionCargos() {
        const loader = new THREE.GLTFLoader();
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x22272e, metalness: 0.85, roughness: 0.25 });
        const slingMat = new THREE.MeshStandardMaterial({ color: 0xeb9800, roughness: 0.5, metalness: 0.1 });

        // -------------------------------------------------------------
        // CARGA 1: SUPERDEPORTIVO PORSCHE 911 GT3 RS (MATERIALES NATIVOS DE BLENDER)
        // -------------------------------------------------------------
        const carGroup = new THREE.Group();
        carGroup.userData = {
            type: 'REAL_CAR_CARGO',
            massTon: 1.5,
            halfExtents: new THREE.Vector3(1.0, 0.7, 2.3),
            cornersLocal: [
                new THREE.Vector3(0.95, 0.4, 1.45),
                new THREE.Vector3(-0.95, 0.4, 1.45),
                new THREE.Vector3(-0.95, 0.4, -1.45),
                new THREE.Vector3(0.95, 0.4, -1.45)
            ],
            hookTargetY: 2.25
        };

        // Grupo del artefacto de izado (balancín + anilla + eslingas)
        // Inicialmente oculto para no tapar el coche hasta que el gancho esté próximo
        const carRigGroup = new THREE.Group();
        carRigGroup.visible = false;

        const spreaderMat = new THREE.MeshStandardMaterial({ color: 0xf5a623, metalness: 0.7, roughness: 0.3 });
        const spreaderBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 3.2), spreaderMat);
        spreaderBar.position.y = 1.95;
        spreaderBar.castShadow = true;
        carRigGroup.add(spreaderBar);

        const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), eyeMat);
        topRing.position.y = 2.12;
        topRing.rotation.x = Math.PI / 2;
        carRigGroup.add(topRing);

        const slingCorners = [
            { top: [0.95, 1.95, 1.55], bot: [0.95, 0.4, 1.45] },
            { top: [-0.95, 1.95, 1.55], bot: [-0.95, 0.4, 1.45] },
            { top: [-0.95, 1.95, -1.55], bot: [-0.95, 0.4, -1.45] },
            { top: [0.95, 1.95, -1.55], bot: [0.95, 0.4, -1.45] }
        ];

        slingCorners.forEach(sc => {
            const vStart = new THREE.Vector3(...sc.top);
            const vEnd = new THREE.Vector3(...sc.bot);
            const dir = new THREE.Vector3().subVectors(vEnd, vStart);
            const len = dir.length();
            const slingMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), slingMat);
            slingMesh.position.copy(vStart).addScaledVector(dir, 0.5);
            slingMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            slingMesh.castShadow = true;
            carRigGroup.add(slingMesh);
        });

        carGroup.add(carRigGroup);
        carGroup.userData.rigGroup = carRigGroup;

        // Carga respetando 100% los materiales, texturas y colores originales exportados desde Blender
        loader.load('Assets3D/Porsche.glb', (gltf) => {
            const porsche = gltf.scene;
            porsche.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            carGroup.add(porsche);
            console.log("[CARGO MANAGER] Modelo 3D Porsche 911 GT3 RS cargado con materiales originales de Blender.");
        });

        // -------------------------------------------------------------
        // CARGA 2: BARRERA NEW JERSEY DE HORMIGÓN (concrete_road_barrier_02_1k.glb)
        // -------------------------------------------------------------
        const barrierGroup = new THREE.Group();
        barrierGroup.userData = {
            type: 'REAL_BARRIER_CARGO',
            massTon: 2.8,
            halfExtents: new THREE.Vector3(0.8, 0.55, 0.2),
            cornersLocal: [
                new THREE.Vector3(0.55, 1.12, 0.08),
                new THREE.Vector3(0.55, 1.12, -0.08),
                new THREE.Vector3(-0.55, 1.12, -0.08),
                new THREE.Vector3(-0.55, 1.12, 0.08)
            ],
            hookTargetY: 1.25
        };

        const barrierRigGroup = new THREE.Group();
        barrierRigGroup.visible = false;
        [-0.5, 0.5].forEach(bx => {
            const eye = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 8, 16), eyeMat);
            eye.position.set(bx, 1.14, 0);
            eye.rotation.x = Math.PI / 2;
            barrierRigGroup.add(eye);
        });
        barrierGroup.add(barrierRigGroup);
        barrierGroup.userData.rigGroup = barrierRigGroup;

        loader.load('Assets3D/concrete_road_barrier_02_1k.glb', (gltf) => {
            const barr = gltf.scene;
            barr.traverse(node => {
                if (node.isMesh) {
                    if (node.name.includes('LOD') && !node.name.includes('LOD0')) {
                        node.visible = false;
                    } else {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                }
            });
            barrierGroup.add(barr);
        });

        // -------------------------------------------------------------
        // CARGA 3: ARMARIO TÉCNICO HVAC DE AZOTEA (utility_box_02_1k.glb)
        // -------------------------------------------------------------
        const hvacGroup = new THREE.Group();
        hvacGroup.userData = {
            type: 'REAL_HVAC_CARGO',
            massTon: 4.5,
            halfExtents: new THREE.Vector3(0.46, 0.56, 0.23),
            cornersLocal: [
                new THREE.Vector3(0.38, 1.12, 0.16),
                new THREE.Vector3(0.38, 1.12, -0.16),
                new THREE.Vector3(-0.38, 1.12, -0.16),
                new THREE.Vector3(-0.38, 1.12, 0.16)
            ],
            hookTargetY: 1.25
        };

        const hvacRigGroup = new THREE.Group();
        hvacRigGroup.visible = false;
        [
            [0.36, 0.15], [0.36, -0.15], [-0.36, -0.15], [-0.36, 0.15]
        ].forEach(([ex, ez]) => {
            const eye = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), eyeMat);
            eye.position.set(ex, 1.15, ez);
            eye.rotation.x = Math.PI / 2;
            hvacRigGroup.add(eye);
        });
        hvacGroup.add(hvacRigGroup);
        hvacGroup.userData.rigGroup = hvacRigGroup;

        loader.load('Assets3D/utility_box_02_1k.glb', (gltf) => {
            const box = gltf.scene;
            box.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            hvacGroup.add(box);
        });

        // -------------------------------------------------------------
        // CARGA 4: ARMARIO DE SUBESTACIÓN ELÉCTRICA (utility_box_01_1k.glb)
        // -------------------------------------------------------------
        const subBoxGroup = new THREE.Group();
        subBoxGroup.userData = {
            type: 'REAL_SUBSTATION_CARGO',
            massTon: 3.6,
            halfExtents: new THREE.Vector3(0.28, 0.56, 0.23),
            cornersLocal: [
                new THREE.Vector3(0.22, 1.12, 0.16),
                new THREE.Vector3(0.22, 1.12, -0.16),
                new THREE.Vector3(-0.22, 1.12, -0.16),
                new THREE.Vector3(-0.22, 1.12, 0.16)
            ],
            hookTargetY: 1.25
        };

        const subBoxRigGroup = new THREE.Group();
        subBoxRigGroup.visible = false;
        [
            [0.20, 0.15], [0.20, -0.15], [-0.20, -0.15], [-0.20, 0.15]
        ].forEach(([ex, ez]) => {
            const eye = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 16), eyeMat);
            eye.position.set(ex, 1.15, ez);
            eye.rotation.x = Math.PI / 2;
            subBoxRigGroup.add(eye);
        });
        subBoxGroup.add(subBoxRigGroup);
        subBoxGroup.userData.rigGroup = subBoxRigGroup;

        loader.load('Assets3D/utility_box_01_1k.glb', (gltf) => {
            const box = gltf.scene;
            box.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            subBoxGroup.add(box);
        });

        // =============================================================
        // REGISTRO DE LAS 4 MISIONES REALISTAS
        // =============================================================
        this.cargoList = [
            {
                id: 1,
                name: 'SUPERDEPORTIVO PORSCHE 911 GT3 RS (1.5 T)',
                type: 'REAL_CAR_CARGO',
                massTon: 1.5,
                mesh: carGroup,
                pickupPos: new THREE.Vector3(18.0, 0.0, 6.0),
                dropTarget: {
                    x: -16.5,
                    y: 0.1,
                    z: -12.0,
                    radius: 3.8,
                    name: 'BAHÍA VIP DE ENTREGA (PARKING OESTE)'
                }
            },
            {
                id: 2,
                name: 'BARRERA NEW JERSEY DE HORMIGÓN (2.8 T)',
                type: 'REAL_BARRIER_CARGO',
                massTon: 2.8,
                mesh: barrierGroup,
                pickupPos: new THREE.Vector3(18.0, 0.0, -10.0),
                dropTarget: {
                    x: 24.0,
                    y: 0.1,
                    z: 10.0,
                    radius: 3.0,
                    name: 'PERÍMETRO DE VÍA (HUECO RESERVADO)'
                }
            },
            {
                id: 3,
                name: 'ARMARIO CLIMATIZADOR HVAC (4.5 T)',
                type: 'REAL_HVAC_CARGO',
                massTon: 4.5,
                mesh: hvacGroup,
                pickupPos: new THREE.Vector3(16.0, 0.0, -20.0),
                dropTarget: {
                    x: 28.0,
                    y: 18.5,
                    z: -20.0,
                    radius: 3.8,
                    name: 'AZOTEA EDIFICIO RESIDENCIAL 001 (18.4 M)'
                }
            },
            {
                id: 4,
                name: 'ARMARIO DE SUBESTACIÓN ELÉCTRICA (3.6 T)',
                type: 'REAL_SUBSTATION_CARGO',
                massTon: 3.6,
                mesh: subBoxGroup,
                pickupPos: new THREE.Vector3(12.0, 0.0, -2.0),
                dropTarget: {
                    x: 15.0,
                    y: 0.15,
                    z: 33.5,
                    radius: 3.2,
                    name: 'LOSA DE SUBESTACIÓN ELÉCTRICA DE OBRA'
                }
            }
        ];

        this.cargoList.forEach(c => {
            const m = c.mesh;
            m.position.copy(c.pickupPos);
            this.scene.add(m);
        });

        this.activeCargo = this.cargoList[0];
    }

    updateRiggingProximity(hookPos, isHooked) {
        if (!hookPos) return;
        this.cargoList.forEach(c => {
            const rig = c.mesh.userData.rigGroup;
            if (!rig) return;

            if (isHooked && this.activeCargo === c) {
                rig.visible = true;
            } else {
                const cargoPos = c.mesh.position;
                const hookYTarget = cargoPos.y + (c.mesh.userData.hookTargetY || 1.25);
                const dist = Math.hypot(hookPos.x - cargoPos.x, hookPos.y - hookYTarget, hookPos.z - cargoPos.z);
                // El artefacto de izado solo aparece cuando el gancho está cerca (< 4.2m)
                rig.visible = (dist < 4.2);
            }
        });
    }

    setRooftopTarget(rooftopTarget) {
        const hvacCargo = this.cargoList.find(c => c.type === 'REAL_HVAC_CARGO');
        if (hvacCargo && rooftopTarget) {
            hvacCargo.dropTarget = {
                x: rooftopTarget.x,
                y: rooftopTarget.y + 0.1,
                z: rooftopTarget.z,
                radius: 3.8,
                name: 'AZOTEA EDIFICIO RESIDENCIAL 001 (18.4 M)'
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
        const hookYTarget = cargoPos.y + (this.activeCargo.mesh.userData.hookTargetY || 1.25);
        return Math.hypot(hookPos.x - cargoPos.x, hookPos.y - hookYTarget, hookPos.z - cargoPos.z);
    }
}
