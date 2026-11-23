import { THREE, GLTFLoader } from '../core/three.js';

export class CraneModel {
    constructor(scene, onProgress, onLoad, onError) {
        this.scene = scene;
        this.craneGroup = new THREE.Group();
        this.scene.add(this.craneGroup);

        this.chassisNode = null;
        this.cabinNode = null;
        this.boomNode = null;
        this.rigArms = [];
        this.cylBase = null;
        this.cylStem = null;
        this.wheels = [];
        this.flecheNode = null;
        this.isLoaded = false;

        // Vectores reutilizables y caché cinemática para evitar recalcular matrices cuando está estática
        this._posBase = new THREE.Vector3();
        this._posStem = new THREE.Vector3();
        this._tipVec = new THREE.Vector3();
        this._lastRotRad = null;
        this._lastAngRad = null;
        this._lastExt = null;

        this._loadModel(onProgress, onLoad, onError);
    }

    _loadModel(onProgress, onLoad, onError) {
        const loader = new THREE.GLTFLoader();
        loader.load(
            'Assets3D/LTM 1110 LIEBHERR.gltf',
            (gltf) => {
                const model = gltf.scene;
                model.scale.set(1, 1, 1);
                this.craneGroup.add(model);

                model.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;

                        // Calibración PBR realista según tipo de componente
                        if (node.material) {
                            if (node.name.includes('Tige_verin') || node.name.includes('Corps_verin')) {
                                // Pistones y vástagos hidráulicos: acabado cromado tipo espejo
                                node.material.metalness = 0.92;
                                node.material.roughness = 0.14;
                            } else if (node.name.startsWith('Roue_LTM')) {
                                // Neumáticos: caucho mate con bajo rebote especular
                                node.material.roughness = 0.86;
                                node.material.metalness = 0.08;
                            } else {
                                // Pintura y carrocería Liebherr: brillo automotriz satinado
                                if (node.material.roughness !== undefined) {
                                    node.material.roughness = Math.min(0.46, Math.max(0.32, node.material.roughness));
                                }
                                if (node.material.metalness !== undefined) {
                                    node.material.metalness = Math.max(0.22, node.material.metalness);
                                }
                            }
                        }
                    }

                    if (node.name === 'Chassis') this.chassisNode = node;
                    if (node.name === 'Chassis_articulation_bras_telescopique_LTM_1136') this.cabinNode = node;
                    if (node.name === '1er_Bras_LTM_1110') this.boomNode = node;

                    // Base del cilindro hidráulico
                    if (node.name === 'Corps_verin_bras_telescopique_LTM_1110') {
                        const wrapper = new THREE.Object3D();
                        node.parent.add(wrapper);
                        wrapper.add(node);
                        wrapper.position.copy(node.position);
                        node.position.set(0, 0, 0);
                        node.rotation.set(THREE.MathUtils.degToRad(3.5), THREE.MathUtils.degToRad(90), 0);
                        this.cylBase = wrapper;
                    }

                    // Vástago (Stem) del cilindro hidráulico
                    if (node.name === 'Tige_verin_bras_telescopique_LTM_1110') {
                        const wrapper = new THREE.Object3D();
                        node.parent.add(wrapper);
                        wrapper.add(node);
                        wrapper.position.copy(node.position);
                        node.position.set(0, 0, 0);
                        node.rotation.set(THREE.MathUtils.degToRad(-3.5), -THREE.MathUtils.degToRad(90), 0);
                        this.cylStem = wrapper;
                    }

                    // Brazos telescópicos
                    const exactArmNames = [
                        '2eme_Bras_LTM_1110', '3eme_Bras_LTM_1110', '4eme_Bras_LTM_1110',
                        '5eme_Bras_LTM_1110', '6eme_Bras_LTM_1110', 'Fleche_Bras_LTM_1110'
                    ];

                    if (exactArmNames.includes(node.name)) {
                        node.userData.initialPos = node.position.clone();
                        this.rigArms.push(node);

                        if (node.name === 'Fleche_Bras_LTM_1110') {
                            this.flecheNode = node;
                            const anchor = new THREE.Object3D();
                            anchor.position.set(-10.75, 0, 0);
                            node.add(anchor);
                            this.flecheNode.userData.tipAnchor = anchor;
                        }
                    }

                    if (node.name.startsWith('Roue_LTM')) {
                        this.wheels.push(node);
                    }

                    if (node.name.includes('Crochet')) node.visible = false;
                });

                this.rigArms.sort((a, b) => a.name.localeCompare(b.name));
                this.craneGroup.position.y = 0;
                this.isLoaded = true;

                if (onLoad) onLoad(this);
            },
            (xhr) => {
                if (onProgress && xhr.lengthComputable) {
                    const percent = Math.round((xhr.loaded / xhr.total) * 100);
                    onProgress(percent);
                }
            },
            (error) => {
                console.error("Error al cargar modelo GLTF:", error);
                if (onError) onError(error);
            }
        );
    }

    updateKinematics(rotRad, angRad, ext, moveDist) {
        if (!this.isLoaded) return;

        const isMovingWheels = (this.wheels.length > 0 && Math.abs(moveDist) > 0.0001);
        const kinematicsChanged = (
            this._lastRotRad !== rotRad ||
            this._lastAngRad !== angRad ||
            this._lastExt !== ext
        );

        if (!kinematicsChanged && !isMovingWheels) {
            return;
        }

        if (kinematicsChanged) {
            this._lastRotRad = rotRad;
            this._lastAngRad = angRad;
            this._lastExt = ext;

            // 1. Rotación de cabina / superestructura
            if (this.cabinNode) this.cabinNode.rotation.z = rotRad;

            // 2. Elevación / cabeceo de pluma principal
            if (this.boomNode) this.boomNode.rotation.y = -angRad;

            // 3. Cilindro hidráulico telescópico (lookAt mutuo sin alocación de vectores)
            if (this.cylBase && this.cylStem && this.boomNode && this.cabinNode) {
                this.cylBase.getWorldPosition(this._posBase);
                this.cylStem.getWorldPosition(this._posStem);
                this.cylBase.lookAt(this._posStem);
                this.cylStem.lookAt(this._posBase);
            }

            // 5. Extensión telescópica de los 6 tramos
            const extOffset = Math.max(0, ext - 10) * 0.1;
            for (let i = 0; i < this.rigArms.length; i++) {
                const arm = this.rigArms[i];
                if (arm.userData.initialPos) {
                    arm.position.x = arm.userData.initialPos.x - extOffset;
                }
            }
        }

        // 4. Giro de neumáticos con la distancia recorrida
        if (isMovingWheels) {
            const wheelRotDelta = moveDist / 1.5;
            for (let i = 0; i < this.wheels.length; i++) {
                this.wheels[i].rotation.z += wheelRotDelta;
            }
        }

        this.craneGroup.updateMatrixWorld(true);
    }

    getTipWorldPosition(targetVec = this._tipVec) {
        if (this.flecheNode && this.flecheNode.userData.tipAnchor) {
            this.flecheNode.userData.tipAnchor.getWorldPosition(targetVec);
        } else {
            targetVec.copy(this.craneGroup.position);
        }
        return targetVec;
    }
}
