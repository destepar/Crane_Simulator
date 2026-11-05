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

        // Bloque de la polea
        const pulleyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.9), pulleyMat);
        pulleyMesh.castShadow = true;
        this.hookGroup.add(pulleyMesh);

        // Franja de seguridad central
        const stripeMesh = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.35, 0.92), stripeMat);
        this.hookGroup.add(stripeMesh);

        // Gancho curvo de acero
        const hookCurvMesh = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 12, 24, Math.PI * 1.4), steelMat);
        hookCurvMesh.position.set(0, -1.2, 0);
        hookCurvMesh.rotation.z = Math.PI * 0.85;
        hookCurvMesh.castShadow = true;
        this.hookGroup.add(hookCurvMesh);
    }

    _buildCables() {
        // CABLE VOLUMÉTRICO 3D (Cilindro de acero de 9 cm de diámetro)
        const cableGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 8);
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
        const shadowGeo = new THREE.CircleGeometry(1.4, 24);
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
        const cargoHalfY = cargoMesh && cargoMesh.userData.halfExtents ? cargoMesh.userData.halfExtents.y : 0.8;
        const hookOffset = this.isHooked ? cargoHalfY + 2.2 : 0.8;
        const minCableLength = hookOffset + 1.2;

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
        const omega = Math.sqrt(omegaSq);

        const dampingRatio = 0.045 + 0.065 / (1.0 + effectiveMass * 0.08);
        const dampingCoeff = 2.0 * dampingRatio * omega;

        const swaySpeed = this.swayVelocity.length();
        const dragFactor = 0.12 * swaySpeed;

        const accelSwayX = -omegaSq * this.swayOffset.x - inertialAccelX - (dampingCoeff + dragFactor) * this.swayVelocity.x;
        const accelSwayZ = -omegaSq * this.swayOffset.y - inertialAccelZ - (dampingCoeff + dragFactor) * this.swayVelocity.y;

        this.swayVelocity.x += accelSwayX * dtSafe;
        this.swayVelocity.y += accelSwayZ * dtSafe;

        this.swayOffset.x += this.swayVelocity.x * dtSafe;
        this.swayOffset.y += this.swayVelocity.y * dtSafe;

        // Zona muerta de reposo
        if (tipAccel.lengthSq() < 0.05 && this.swayOffset.length() < 0.035 && swaySpeed < 0.025) {
            this.swayOffset.multiplyScalar(Math.max(0, 1.0 - dtSafe * 5.0));
            this.swayVelocity.multiplyScalar(Math.max(0, 1.0 - dtSafe * 6.0));
        }

        const maxSwayDist = effL * 0.707;
        const currentSwayDist = this.swayOffset.length();
        if (currentSwayDist > maxSwayDist) {
            this.swayOffset.multiplyScalar(maxSwayDist / currentSwayDist);
            this.swayVelocity.multiplyScalar(0.85);
        }

        // 4. Altura vertical en el arco del péndulo
        const horizDistSq = this.swayOffset.x * this.swayOffset.x + this.swayOffset.y * this.swayOffset.y;
        const verticalDrop = Math.sqrt(Math.max(0.1, effL * effL - horizDistSq));

        let currentX = tipWorld.x + this.swayOffset.x;
        let currentZ = tipWorld.z + this.swayOffset.y;
        let currentY = tipWorld.y - verticalDrop;

        // 5. Suelo y obstáculos
        const groundH = environment.getGroundHeightAt(currentX, currentZ);
        const minimumY = groundH + (this.isHooked ? cargoHalfY : 0.6);

        const maxCableLength = Math.max(minCableLength, tipWorld.y - minimumY);
        if (this.cableLength < minCableLength) this.cableLength = minCableLength;
        if (this.cableLength > maxCableLength) this.cableLength = maxCableLength;

        let isGrounded = false;
        if (currentY <= minimumY) {
            currentY = minimumY;
            isGrounded = true;
            const groundFriction = Math.max(0, 1.0 - dtSafe * 12.0);
            this.swayVelocity.multiplyScalar(groundFriction);
            this.swayOffset.multiplyScalar(groundFriction);
        }

        // 6. Aparejo de Gancho: posición y orientación
        const wireVec = new THREE.Vector3().subVectors(tipWorld, new THREE.Vector3(currentX, currentY, currentZ));
        const wireDir = wireVec.clone().normalize();

        const hookY = this.isHooked ? currentY + hookOffset : currentY;
        const hookPos = new THREE.Vector3(currentX, hookY, currentZ);
        this.hookGroup.position.copy(hookPos);
        this.hookGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wireDir);
        this.hookGroup.rotateY(craneRotationY);

        // 7. Si hay carga enganchada: posicionar la carga
        if (this.isHooked && cargoMesh) {
            cargoMesh.position.set(currentX, currentY, currentZ);
            cargoMesh.rotation.set((this.swayOffset.y / effL) * 0.3, craneRotationY, (-this.swayOffset.x / effL) * 0.3);
        }

        // 8. CABLE VOLUMÉTRICO 3D (Cilindro orientado y escalado con precisión)
        const hookPulleyTop = hookPos.clone().addScaledVector(wireDir, 0.7);
        const cableVec = new THREE.Vector3().subVectors(tipWorld, hookPulleyTop);
        const cableDist = cableVec.length();
        const cableMid = new THREE.Vector3().addVectors(tipWorld, hookPulleyTop).multiplyScalar(0.5);

        this.cableMesh.position.copy(cableMid);
        this.cableMesh.scale.set(1, Math.max(0.1, cableDist), 1);
        this.cableMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cableVec.clone().normalize());

        // 9. Actualizar eslingas
        const hookEyeBottom = hookPos.clone().addScaledVector(wireDir, -1.25);
        const sp = this.slingLines.geometry.attributes.position.array;

        if (this.isHooked && cargoMesh && cargoMesh.userData.cornersLocal) {
            // Eslingas tensadas hacia los 4 cáncamos de la carga activa
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
            // Gancho vacío: las eslingas cuelgan juntas hacia abajo
            const hangY = hookEyeBottom.y - 1.2;
            const spread = 0.15;
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
        const shadowBase = this.isHooked ? cargoHalfY * 1.5 : 0.8;
        const shadowScale = Math.min(3.0, shadowBase + (distToGround / 12.0));
        this.contactShadow.scale.set(shadowScale, shadowScale, 1);
        this.contactShadow.material.opacity = Math.max(0.08, 0.60 - (distToGround / 22.0));

        // 11. Retícula holográfica en suelo
        this.groundTargetGroup.position.set(currentX, groundH + 0.12, currentZ);
        const pulse = 0.5 + 0.5 * Math.sin(timeNow * 0.006);
        const scaleTarget = Math.min(2.2, 0.9 + (distToGround / 25));
        this.groundTargetGroup.scale.set(scaleTarget, 1, scaleTarget);

        if (distToGround < 2.5) {
            this.targetRingMat.color.setHex(0xf6e05e);
            this.targetRingMat.opacity = 0.75 + 0.25 * pulse;
        } else {
            this.targetRingMat.color.setHex(0x00f3ff);
            this.targetRingMat.opacity = Math.max(0.25, 0.65 - (distToGround / 60));
        }

        return {
            currentX, currentY, currentZ,
            hookPos,
            isGrounded,
            effectiveMass,
            effL
        };
    }
}
