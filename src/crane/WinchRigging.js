import { THREE } from '../core/three.js';
import { G } from '../config/constants.js';

export class WinchRigging {
    constructor(scene) {
        this.scene = scene;

        this.cableLength = 12.0;
        this.isHooked = false;
        this.attachedCargo = null;

        this.swayOffset = new THREE.Vector2(0, 0);
        this.swayVelocity = new THREE.Vector2(0, 0);
        this.prevTipPos = null;
        this.tipVelocity = new THREE.Vector3(0, 0, 0);
        this.prevTipVelocity = new THREE.Vector3(0, 0, 0);

        this._buildHook();
        this._buildCables();
        this._buildContactShadow();
        this._buildGroundTarget();
    }

    _buildHook() {
        this.hookGroup = new THREE.Group();
        this.scene.add(this.hookGroup);

        const pulleyMat = new THREE.MeshStandardMaterial({ color: 0xf6c000, roughness: 0.35, metalness: 0.5 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0x24292f, roughness: 0.25, metalness: 0.85 });
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.8 });

        // Bloque de la polea calibrado (Escala realista para grúa de 110T: 0.7m ancho x 0.85m alto x 0.5m fondo)
        const pulleyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.5), pulleyMat);
        pulleyMesh.castShadow = true;
        this.hookGroup.add(pulleyMesh);

        // Franja de seguridad central
        const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.71, 0.22, 0.51), stripeMat);
        this.hookGroup.add(stripeMesh);

        // Gancho curvo de acero forjado estilizado (radio 0.32m, tubo 0.09m)
        const hookCurvMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 12, 24, Math.PI * 1.4), steelMat);
        hookCurvMesh.position.set(0, -0.72, 0);
        hookCurvMesh.rotation.z = Math.PI * 0.85;
        hookCurvMesh.castShadow = true;
        this.hookGroup.add(hookCurvMesh);
    }

    _buildCables() {
        // CABLE VOLUMÉTRICO 3D (Cilindro de acero de 3.2 cm de diámetro real)
        const cableGeo = new THREE.CylinderGeometry(0.016, 0.016, 1, 8);
        const cableMat = new THREE.MeshStandardMaterial({
            color: 0x1f242c,
            roughness: 0.32,
            metalness: 0.85
        });
        this.cableMesh = new THREE.Mesh(cableGeo, cableMat);
        this.cableMesh.castShadow = true;
        this.scene.add(this.cableMesh);

        // Eslingas cuádruples de acero brillante
        const slingMat = new THREE.LineBasicMaterial({ color: 0xd0d7de, linewidth: 2 });
        const slingGeo = new THREE.BufferGeometry();
        const slingPositions = new Float32Array(4 * 2 * 3);
        slingGeo.setAttribute('position', new THREE.BufferAttribute(slingPositions, 3));
        this.slingLines = new THREE.LineSegments(slingGeo, slingMat);
        this.slingLines.frustumCulled = false;
        this.scene.add(this.slingLines);
    }

    _buildContactShadow() {
        // Sombra de contacto suave proyectada en el suelo
        const shadowGeo = new THREE.CircleGeometry(1.2, 24);
        const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x05070a,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        });
        this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
        this.contactShadow.rotation.x = -Math.PI / 2;
        this.scene.add(this.contactShadow);
    }

    _buildGroundTarget() {
        this.groundTargetGroup = new THREE.Group();
        this.scene.add(this.groundTargetGroup);

        const targetRingGeo = new THREE.RingGeometry(1.5, 2.2, 32);
        this.targetRingMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false });
        const targetRing = new THREE.Mesh(targetRingGeo, this.targetRingMat);
        targetRing.rotation.x = -Math.PI / 2;
        this.groundTargetGroup.add(targetRing);

        const targetDotGeo = new THREE.CircleGeometry(0.4, 16);
        this.targetDotMat = new THREE.MeshBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
        const targetDot = new THREE.Mesh(targetDotGeo, this.targetDotMat);
        targetDot.rotation.x = -Math.PI / 2;
        this.groundTargetGroup.add(targetDot);
    }

    attach(cargo) {
        this.isHooked = true;
        this.attachedCargo = cargo;
        // Ajustar el slider y valor de masa UI con la masa real del objeto
        const elM = document.getElementById('m');
        if (elM && cargo.massTon) {
            elM.value = cargo.massTon;
        }
    }

    detach() {
        this.isHooked = false;
        const cargo = this.attachedCargo;
        this.attachedCargo = null;
        return cargo;
    }

    update(dt, timeNow, tipWorld, craneRotationY, speed, massTon, inputManager, environment) {
        const keys = inputManager.keys;

        // 1. Control del cabrestante (teclas Z / X)
        if (keys['z']) this.cableLength -= speed * dt * 8;
        if (keys['x']) this.cableLength += speed * dt * 8;

        const effectiveMass = this.isHooked && this.attachedCargo ? this.attachedCargo.massTon : 1.2;
        const cargoMesh = this.isHooked && this.attachedCargo ? this.attachedCargo.mesh : null;
        const cargoHalfY = cargoMesh && cargoMesh.userData.halfExtents ? cargoMesh.userData.halfExtents.y : 0.6;
        const hookOffset = this.isHooked ? cargoHalfY + 1.2 : 0.6;
        const minCableLength = hookOffset + 1.0;

        // 2. Inercia de la punta de la pluma
        const dtSafe = Math.min(Math.max(dt, 0.001), 0.08);
        if (!this.prevTipPos) this.prevTipPos = tipWorld.clone();

        const currentTipVel = new THREE.Vector3().subVectors(tipWorld, this.prevTipPos).divideScalar(dtSafe);
        this.tipVelocity.lerp(currentTipVel, Math.min(1.0, dtSafe * 7.5));

        const tipAccel = new THREE.Vector3().subVectors(this.tipVelocity, this.prevTipVelocity).divideScalar(dtSafe);
        this.prevTipVelocity.copy(this.tipVelocity);
        this.prevTipPos.copy(tipWorld);

        const INERTIA_COUPLING = this.isHooked ? 0.38 : 0.22;
        const maxAccelG = 12.0;
        const inertialAccelX = Math.max(-maxAccelG, Math.min(maxAccelG, tipAccel.x * INERTIA_COUPLING));
        const inertialAccelZ = Math.max(-maxAccelG, Math.min(maxAccelG, tipAccel.z * INERTIA_COUPLING));

        // 3. Ecuación diferencial del oscilador armónico pendular 3D
        const effL = Math.max(2.0, this.cableLength);
        const omegaSq = G / effL;
        const DAMPING = this.isHooked ? 0.45 : 0.65;

        const d2X = -omegaSq * this.swayOffset.x - DAMPING * this.swayVelocity.x - inertialAccelX;
        const d2Z = -omegaSq * this.swayOffset.y - DAMPING * this.swayVelocity.y - inertialAccelZ;

        this.swayVelocity.x += d2X * dtSafe;
        this.swayVelocity.y += d2Z * dtSafe;

        const maxSwaySpeed = 8.5;
        this.swayVelocity.clampLength(0, maxSwaySpeed);

        this.swayOffset.x += this.swayVelocity.x * dtSafe;
        this.swayOffset.y += this.swayVelocity.y * dtSafe;

        const maxOffset = effL * 0.45;
        this.swayOffset.clampLength(0, maxOffset);

        // 4. Cinemática de posición del gancho
        const currentX = tipWorld.x + this.swayOffset.x;
        const currentZ = tipWorld.z + this.swayOffset.y;
        const rHorizSq = this.swayOffset.lengthSq();
        const deltaY = Math.sqrt(Math.max(0.01, effL * effL - rHorizSq));
        let currentY = tipWorld.y - deltaY;

        // 5. Altura mínima y colisión de suelo / obstáculos
        const groundH = environment.getGroundHeightAt(currentX, currentZ);
        const minimumY = groundH + hookOffset;

        if (currentY < minimumY) {
            currentY = minimumY;
            this.cableLength = Math.max(minCableLength, tipWorld.y - minimumY);
            this.swayVelocity.multiplyScalar(0.75);
        }

        const hookPos = new THREE.Vector3(currentX, currentY, currentZ);
        this.hookGroup.position.copy(hookPos);

        // 6. Orientación del gancho siguiendo la catenaria
        const wireDir = new THREE.Vector3(this.swayOffset.x, -deltaY, this.swayOffset.y).normalize();
        this.hookGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), wireDir);

        // 7. Si hay carga enganchada: posicionar la carga
        if (this.isHooked && cargoMesh) {
            cargoMesh.position.set(currentX, currentY - 0.25, currentZ);
            cargoMesh.rotation.set((this.swayOffset.y / effL) * 0.3, craneRotationY, (-this.swayOffset.x / effL) * 0.3);
        }

        // 8. CABLE VOLUMÉTRICO 3D (Orientado desde la punta de pluma hasta la polea)
        const hookPulleyTop = hookPos.clone().addScaledVector(wireDir, 0.42);
        const cableVec = new THREE.Vector3().subVectors(tipWorld, hookPulleyTop);
        const cableDist = cableVec.length();
        const cableMid = new THREE.Vector3().addVectors(tipWorld, hookPulleyTop).multiplyScalar(0.5);

        this.cableMesh.position.copy(cableMid);
        this.cableMesh.scale.set(1, Math.max(0.1, cableDist), 1);
        this.cableMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cableVec.clone().normalize());

        // 9. Actualizar eslingas
        const hookEyeBottom = hookPos.clone().addScaledVector(wireDir, -0.75);
        const sp = this.slingLines.geometry.attributes.position.array;

        if (this.isHooked && cargoMesh && cargoMesh.userData.cornersLocal) {
            const corners = cargoMesh.userData.cornersLocal;
            for (let i = 0; i < 4; i++) {
                const worldC = corners[i].clone().applyEuler(cargoMesh.rotation).add(cargoMesh.position);
                sp[i * 6 + 0] = hookEyeBottom.x;
                sp[i * 6 + 1] = hookEyeBottom.y;
                sp[i * 6 + 2] = hookEyeBottom.z;
                sp[i * 6 + 3] = worldC.x;
                sp[i * 6 + 4] = worldC.y;
                sp[i * 6 + 5] = worldC.z;
            }
        } else {
            // Gancho vacío: eslingas cuelgan compactas hacia abajo
            const hangY = hookEyeBottom.y - 0.75;
            const spread = 0.08;
            const offsets = [
                [spread, spread],
                [spread, -spread],
                [-spread, -spread],
                [-spread, spread]
            ];
            for (let i = 0; i < 4; i++) {
                sp[i * 6 + 0] = hookEyeBottom.x;
                sp[i * 6 + 1] = hookEyeBottom.y;
                sp[i * 6 + 2] = hookEyeBottom.z;
                sp[i * 6 + 3] = hookEyeBottom.x + offsets[i][0];
                sp[i * 6 + 4] = hangY;
                sp[i * 6 + 5] = hookEyeBottom.z + offsets[i][1];
            }
        }
        this.slingLines.geometry.attributes.position.needsUpdate = true;

        // 10. Sombra suave de contacto
        const distToGround = Math.max(0.05, currentY - minimumY);
        this.contactShadow.position.set(currentX, groundH + 0.06, currentZ);
        const shadowBase = this.isHooked ? cargoHalfY * 1.5 : 0.6;
        const shadowScale = Math.min(2.5, shadowBase + (distToGround / 12.0));
        this.contactShadow.scale.set(shadowScale, shadowScale, 1);
        this.contactShadow.material.opacity = Math.max(0.08, 0.60 - (distToGround / 22.0));

        // 11. Diana de proyección en suelo
        this.groundTargetGroup.position.set(currentX, groundH + 0.04, currentZ);
        const ringAlpha = Math.max(0.12, 0.70 - (distToGround / 28.0));
        this.targetRingMat.opacity = ringAlpha;
        this.targetDotMat.opacity = ringAlpha * 0.85;

        return {
            hookPos,
            effectiveMass,
            cableLength: this.cableLength,
            swayOffset: this.swayOffset
        };
    }
}
