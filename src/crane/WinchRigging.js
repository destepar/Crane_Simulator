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

        // Vectores reutilizables para evitar asignaciones de memoria por frame (GC-free loop)
        this._vCurrentTipVel = new THREE.Vector3();
        this._vTipAccel = new THREE.Vector3();
        this._vHookPos = new THREE.Vector3();
        this._vWireDir = new THREE.Vector3();
        this._vDown = new THREE.Vector3(0, -1, 0);
        this._vUp = new THREE.Vector3(0, 1, 0);
        this._vPulleyTop = new THREE.Vector3();
        this._vCableVec = new THREE.Vector3();
        this._vCableDir = new THREE.Vector3();
        this._vCableMid = new THREE.Vector3();
        this._vEyeBottom = new THREE.Vector3();
        this._vCornerWorld = new THREE.Vector3();
        this._qTilt = new THREE.Quaternion();
        this._qYaw = new THREE.Quaternion();

        this._buildHook();
        this._buildCables();
        this._buildContactShadow();
        this._buildGroundTarget();
    }

    _createLiebherrHazardTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Base amarillo industrial Liebherr
        ctx.fillStyle = '#e5a900';
        ctx.fillRect(0, 0, 256, 256);

        // Desgaste metálico sutil y bordes
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(0, 0, 256, 24);

        // Franjas diagonales negras de advertencia en la mitad inferior de la mufla
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 120, 256, 136);
        ctx.clip();

        ctx.fillStyle = '#14171c';
        for (let x = -256; x < 512; x += 44) {
            ctx.beginPath();
            ctx.moveTo(x, 120);
            ctx.lineTo(x + 22, 120);
            ctx.lineTo(x - 68, 256);
            ctx.lineTo(x - 90, 256);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // Línea divisoria técnica y placa negra superior con marcaje "110t"
        ctx.fillStyle = '#14171c';
        ctx.fillRect(0, 114, 256, 6);
        ctx.fillRect(36, 36, 184, 54);

        ctx.strokeStyle = '#e5a900';
        ctx.lineWidth = 3;
        ctx.strokeRect(40, 40, 176, 46);

        ctx.fillStyle = '#f4b400';
        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LIEBHERR', 128, 63);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    _buildHook() {
        this.hookGroup = new THREE.Group();
        this.scene.add(this.hookGroup);

        const hazardTex = this._createLiebherrHazardTexture();
        const cheekMat = new THREE.MeshStandardMaterial({
            map: hazardTex,
            roughness: 0.38,
            metalness: 0.45
        });
        const yellowSteelMat = new THREE.MeshStandardMaterial({
            color: 0xe5a900,
            roughness: 0.35,
            metalness: 0.55
        });
        const darkForgedMat = new THREE.MeshStandardMaterial({
            color: 0x1c2128,
            roughness: 0.32,
            metalness: 0.88
        });
        const chromeMat = new THREE.MeshStandardMaterial({
            color: 0xd8dee9,
            roughness: 0.15,
            metalness: 0.95
        });
        const redLatchMat = new THREE.MeshStandardMaterial({
            color: 0xd92626,
            roughness: 0.35,
            metalness: 0.65
        });

        // 1. Placas laterales biseladas de la mufla (Perfil octogonal ahusado real Liebherr)
        const plateShape = new THREE.Shape();
        plateShape.moveTo(-0.22, 0.44);
        plateShape.lineTo(0.22, 0.44);
        plateShape.lineTo(0.36, 0.20);
        plateShape.lineTo(0.36, -0.14);
        plateShape.lineTo(0.20, -0.38);
        plateShape.lineTo(-0.20, -0.38);
        plateShape.lineTo(-0.36, -0.14);
        plateShape.lineTo(-0.36, 0.20);
        plateShape.closePath();

        const extrudeSettings = {
            depth: 0.065,
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 0.015,
            bevelThickness: 0.015
        };
        const cheekGeo = new THREE.ExtrudeGeometry(plateShape, extrudeSettings);
        // Normalizar UVs de la placa lateral para que la textura de franjas encaje al 100%
        const posAttr = cheekGeo.attributes.position;
        const uvAttr = cheekGeo.attributes.uv;
        for (let i = 0; i < posAttr.count; i++) {
            const px = posAttr.getX(i);
            const py = posAttr.getY(i);
            uvAttr.setXY(i, (px + 0.38) / 0.76, (py + 0.40) / 0.86);
        }
        uvAttr.needsUpdate = true;

        [-0.24, 0.175].forEach(zPos => {
            const cheekMesh = new THREE.Mesh(cheekGeo, cheekMat);
            cheekMesh.position.z = zPos;
            cheekMesh.castShadow = true;
            this.hookGroup.add(cheekMesh);
        });

        // Placas separadoras y protectores superiores de entrada de cable
        const hoodGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.46, 20, 1, false, -Math.PI * 0.35, Math.PI * 0.7);
        const hoodMesh = new THREE.Mesh(hoodGeo, yellowSteelMat);
        hoodMesh.rotation.x = Math.PI / 2;
        hoodMesh.rotation.y = Math.PI / 2;
        hoodMesh.position.y = 0.06;
        hoodMesh.castShadow = true;
        this.hookGroup.add(hoodMesh);

        // 2. Tres Poleas Acanaladas Interiores (3-Sheave Block) + Eje Central Cromado
        const sheaveOuterGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.055, 24);
        const sheaveGrooveGeo = new THREE.CylinderGeometry(0.265, 0.265, 0.032, 24);
        [-0.11, 0.0, 0.11].forEach(zOffset => {
            const sheaveGroup = new THREE.Group();
            sheaveGroup.position.set(0, 0.06, zOffset);

            const rimL = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.014, 24), darkForgedMat);
            rimL.rotation.x = Math.PI / 2;
            rimL.position.z = -0.022;
            const rimR = rimL.clone();
            rimR.position.z = 0.022;

            const core = new THREE.Mesh(sheaveGrooveGeo, chromeMat);
            core.rotation.x = Math.PI / 2;

            sheaveGroup.add(rimL, rimR, core);
            this.hookGroup.add(sheaveGroup);
        });

        // Bulón / Eje principal de poleas y pernos tensores con tuercas hexagonales exteriores
        const mainAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.56, 16), chromeMat);
        mainAxle.rotation.x = Math.PI / 2;
        mainAxle.position.y = 0.06;
        this.hookGroup.add(mainAxle);

        const hexNutGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.59, 6);
        const mainNut = new THREE.Mesh(hexNutGeo, darkForgedMat);
        mainNut.rotation.x = Math.PI / 2;
        mainNut.position.y = 0.06;
        this.hookGroup.add(mainNut);

        // 4 Pernos estructurales de esquina
        const boltGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.56, 6);
        [
            [-0.17, 0.34], [0.17, 0.34],
            [-0.16, -0.28], [0.16, -0.28]
        ].forEach(([bx, by]) => {
            const bolt = new THREE.Mesh(boltGeo, darkForgedMat);
            bolt.rotation.x = Math.PI / 2;
            bolt.position.set(bx, by, 0);
            this.hookGroup.add(bolt);
        });

        // 3. Travesaño Giratorio Inferior (Crosshead Trunnion & Thrust Collar)
        const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.44, 16), darkForgedMat);
        trunnion.rotation.x = Math.PI / 2;
        trunnion.position.y = -0.34;
        this.hookGroup.add(trunnion);

        const swivelCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.14, 16), yellowSteelMat);
        swivelCollar.position.y = -0.44;
        swivelCollar.castShadow = true;
        this.hookGroup.add(swivelCollar);

        const shankNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.14, 16), darkForgedMat);
        shankNeck.position.y = -0.54;
        shankNeck.castShadow = true;
        this.hookGroup.add(shankNeck);

        // 4. Gancho de Acero Forjado de Sección Variable (Perfil DIN / Liebherr Realista)
        // Construido por anillos articulados a lo largo de la curva del gancho con grosor variable
        const hookCurvePoints = [
            { pos: new THREE.Vector3(0.00, -0.56, 0), r: 0.082 }, // Cuello superior
            { pos: new THREE.Vector3(0.07, -0.63, 0), r: 0.095 }, // Hombro derecho
            { pos: new THREE.Vector3(0.17, -0.72, 0), r: 0.112 }, // Lomo derecho
            { pos: new THREE.Vector3(0.19, -0.84, 0), r: 0.125 }, // Curva de carga
            { pos: new THREE.Vector3(0.11, -0.95, 0), r: 0.138 }, // Panza inferior (sección más gruesa de esfuerzo)
            { pos: new THREE.Vector3(-0.02, -0.98, 0), r: 0.135 }, // Asiento central inferior
            { pos: new THREE.Vector3(-0.15, -0.93, 0), r: 0.115 }, // Subida frontal
            { pos: new THREE.Vector3(-0.22, -0.82, 0), r: 0.085 }, // Garganta frontal
            { pos: new THREE.Vector3(-0.20, -0.70, 0), r: 0.055 }, // Punta ahusada
            { pos: new THREE.Vector3(-0.14, -0.63, 0), r: 0.032 }  // Extremo del pico
        ];

        const forgedHookGroup = new THREE.Group();
        for (let i = 0; i < hookCurvePoints.length - 1; i++) {
            const pA = hookCurvePoints[i];
            const pB = hookCurvePoints[i + 1];
            const dir = new THREE.Vector3().subVectors(pB.pos, pA.pos);
            const len = dir.length();

            // Tramo troncocónico aplastado lateralmente (sección elíptica de forja)
            const segGeo = new THREE.CylinderGeometry(pB.r, pA.r, len * 1.12, 16);
            segGeo.scale(1.0, 1.0, 0.72);
            const segMesh = new THREE.Mesh(segGeo, darkForgedMat);
            segMesh.position.copy(pA.pos).addScaledVector(dir, 0.5);
            segMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
            segMesh.castShadow = true;
            forgedHookGroup.add(segMesh);

            // Esfera de unión suavizada en cada nodo de la espina
            const jointGeo = new THREE.SphereGeometry(pA.r * 0.98, 14, 12);
            jointGeo.scale(1.0, 1.0, 0.72);
            const jointMesh = new THREE.Mesh(jointGeo, darkForgedMat);
            jointMesh.position.copy(pA.pos);
            forgedHookGroup.add(jointMesh);
        }
        // Remate de la punta del gancho
        const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), darkForgedMat);
        tipCap.position.copy(hookCurvePoints[hookCurvePoints.length - 1].pos);
        forgedHookGroup.add(tipCap);

        // Orejeta trasera de maniobra (handling lug en el dorso del gancho)
        const backLug = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 14), darkForgedMat);
        backLug.position.set(0.23, -0.75, 0);
        forgedHookGroup.add(backLug);

        // 5. Lengüeta de Seguridad Articulada (Safety Latch en rojo industrial)
        const latchBar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.21, 0.055), redLatchMat);
        latchBar.position.set(-0.07, -0.63, 0);
        latchBar.rotation.z = -0.62;
        forgedHookGroup.add(latchBar);

        const latchPin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 10), chromeMat);
        latchPin.rotation.x = Math.PI / 2;
        latchPin.position.set(-0.01, -0.57, 0);
        forgedHookGroup.add(latchPin);

        // 6. Grillete Maestro de Carga (Master Shackle en el asiento del gancho y = -0.75)
        const shackleRing = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.026, 10, 20), redLatchMat);
        shackleRing.position.set(-0.01, -0.82, 0);
        shackleRing.rotation.y = Math.PI / 2;
        forgedHookGroup.add(shackleRing);

        this.hookGroup.add(forgedHookGroup);
    }

    _buildCables() {
        // SISTEMA DE REENVÍO MULTICABLE (3 ramales de acero trenzado entrando a las 3 poleas de la mufla)
        this.cableMesh = new THREE.Group();
        const cableMat = new THREE.MeshStandardMaterial({
            color: 0x262c36,
            roughness: 0.28,
            metalness: 0.88
        });

        [-0.11, 0.0, 0.11].forEach((zOff) => {
            const strandGeo = new THREE.CylinderGeometry(0.015, 0.015, 1, 8);
            const strandMesh = new THREE.Mesh(strandGeo, cableMat);
            strandMesh.position.z = zOff;
            strandMesh.castShadow = true;
            this.cableMesh.add(strandMesh);
        });
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

    attach(cargo, tipWorld = null) {
        this.isHooked = true;
        this.attachedCargo = cargo;

        // Sincronizar longitud de cable al punto de enganche real para evitar saltos verticales
        if (cargo && cargo.mesh && tipWorld) {
            const hookOffset = cargo.mesh.userData.hookTargetY || 2.25;
            const desiredHookY = cargo.mesh.position.y + hookOffset;
            const rHorizSq = this.swayOffset.lengthSq();
            const dy = Math.max(2.0, tipWorld.y - desiredHookY);
            this.cableLength = Math.sqrt(dy * dy + rHorizSq);
        }

        // Ajustar el slider y valor de masa UI con la masa real del objeto
        const elM = document.getElementById('m');
        if (elM && cargo.massTon) {
            elM.value = cargo.massTon;
        }
    }

    detach(surfaceY = null) {
        this.isHooked = false;
        const cargo = this.attachedCargo;
        if (cargo && cargo.mesh) {
            if (typeof surfaceY === 'number') {
                cargo.mesh.position.y = surfaceY;
            }
            cargo.mesh.rotation.x = 0;
            cargo.mesh.rotation.z = 0;
            if (cargo.mesh.userData.rigGroup) {
                cargo.mesh.userData.rigGroup.visible = false;
            }
        }
        this.attachedCargo = null;
        return cargo;
    }

    /**
     * Estabiliza instantáneamente el gancho y anula velocidades de inercia de punta de pluma
     * (utilizado al reiniciar el simulador o posicionar la pluma en el Auto-Test E2E).
     */
    stabilizeAt(tipWorld, targetHookY) {
        const cargoMesh = this.isHooked && this.attachedCargo ? this.attachedCargo.mesh : null;
        const hookOffset = (this.isHooked && cargoMesh) ? (cargoMesh.userData.hookTargetY || 2.25) : 0.85;
        const minCableLength = hookOffset + 0.8;

        if (typeof targetHookY === 'number' && tipWorld) {
            this.cableLength = Math.max(minCableLength, tipWorld.y - targetHookY);
        }
        this.swayOffset.set(0, 0);
        this.swayVelocity.set(0, 0);
        this.tipVelocity.set(0, 0, 0);
        this.prevTipVelocity.set(0, 0, 0);
        if (tipWorld) {
            if (this.prevTipPos) {
                this.prevTipPos.copy(tipWorld);
            } else {
                this.prevTipPos = tipWorld.clone();
            }
        }
    }

    update(dt, timeNow, tipWorld, craneRotationY, speed, massTon, inputManager, environment, cabinRotationZ = 0) {
        const keys = inputManager.keys;

        // 1. Control del cabrestante (teclas Z / X)
        if (keys['z']) this.cableLength -= speed * dt * 8;
        if (keys['x']) this.cableLength += speed * dt * 8;

        const effectiveMass = this.isHooked && this.attachedCargo ? this.attachedCargo.massTon : 1.2;
        const cargoMesh = this.isHooked && this.attachedCargo ? this.attachedCargo.mesh : null;
        const cargoHalfY = cargoMesh && cargoMesh.userData.halfExtents ? cargoMesh.userData.halfExtents.y : 0.6;
        const hookOffset = (this.isHooked && cargoMesh) ? (cargoMesh.userData.hookTargetY || 2.25) : 0.85;
        const minCableLength = hookOffset + 0.8;
        if (this.cableLength < minCableLength) {
            this.cableLength = minCableLength;
        }

        // 2. Inercia de la punta de la pluma
        const dtSafe = Math.min(Math.max(dt, 0.001), 0.08);
        if (!this.prevTipPos) this.prevTipPos = tipWorld.clone();

        this._vCurrentTipVel.subVectors(tipWorld, this.prevTipPos).divideScalar(dtSafe);
        this.tipVelocity.lerp(this._vCurrentTipVel, Math.min(1.0, dtSafe * 7.5));

        this._vTipAccel.subVectors(this.tipVelocity, this.prevTipVelocity).divideScalar(dtSafe);
        this.prevTipVelocity.copy(this.tipVelocity);
        this.prevTipPos.copy(tipWorld);

        const INERTIA_COUPLING = this.isHooked ? 0.38 : 0.22;
        const maxAccelG = 12.0;
        const inertialAccelX = Math.max(-maxAccelG, Math.min(maxAccelG, this._vTipAccel.x * INERTIA_COUPLING));
        const inertialAccelZ = Math.max(-maxAccelG, Math.min(maxAccelG, this._vTipAccel.z * INERTIA_COUPLING));

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

        const hookPos = this._vHookPos.set(currentX, currentY, currentZ);
        this.hookGroup.position.copy(hookPos);

        // 6. Orientación del gancho siguiendo la catenaria y el giro de la pluma
        const wireDir = this._vWireDir.set(this.swayOffset.x, -deltaY, this.swayOffset.y).normalize();
        this._qTilt.setFromUnitVectors(this._vDown, wireDir);
        this._qYaw.setFromAxisAngle(this._vUp, craneRotationY + cabinRotationZ);
        this.hookGroup.quaternion.copy(this._qTilt).multiply(this._qYaw);

        // 7. Si hay carga enganchada: posicionar la carga exactamente a hookOffset debajo del gancho
        if (this.isHooked && cargoMesh) {
            cargoMesh.position.set(currentX, currentY - hookOffset, currentZ);
            cargoMesh.rotation.set(
                (this.swayOffset.y / effL) * 0.25,
                craneRotationY + cabinRotationZ,
                (-this.swayOffset.x / effL) * 0.25
            );
        }

        // 8. CABLE VOLUMÉTRICO 3D MULTIRAMAL (Orientado desde la punta de pluma hasta las 3 poleas)
        const hookPulleyTop = this._vPulleyTop.copy(hookPos).addScaledVector(wireDir, 0.42);
        const cableVec = this._vCableVec.subVectors(tipWorld, hookPulleyTop);
        const cableDist = cableVec.length();
        const cableMid = this._vCableMid.addVectors(tipWorld, hookPulleyTop).multiplyScalar(0.5);

        this.cableMesh.position.copy(cableMid);
        this.cableMesh.scale.set(1, Math.max(0.1, cableDist), 1);
        this._vCableDir.copy(cableVec).normalize();
        this.cableMesh.quaternion.setFromUnitVectors(this._vUp, this._vCableDir).multiply(this._qYaw);

        // 9. Actualizar eslingas
        const hookEyeBottom = this._vEyeBottom.copy(hookPos).addScaledVector(wireDir, -0.75);
        const sp = this.slingLines.geometry.attributes.position.array;

        if (this.isHooked && cargoMesh && cargoMesh.userData.cornersLocal) {
            const corners = cargoMesh.userData.cornersLocal;
            for (let i = 0; i < 4; i++) {
                const worldC = this._vCornerWorld.copy(corners[i]).applyEuler(cargoMesh.rotation).add(cargoMesh.position);
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
