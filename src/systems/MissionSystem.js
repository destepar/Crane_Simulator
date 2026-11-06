import { THREE } from '../core/three.js';

export class MissionSystem {
    constructor(scene, cargoManager) {
        this.scene = scene;
        this.cargoManager = cargoManager;

        this.missionStep = 'PICKUP'; // 'PICKUP' o 'DELIVERY'
        this.currentMissionIndex = 0;
        this.totalScore = 0;
        this.landingStabilityTime = 0;
        this.smoothedDiffY = 0;

        this.promptText = '';
        this.canPerformAction = false;

        this._buildVisualBeacon();
    }

    _createTargetTexture() {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');

        ctx.fillStyle = '#0f141c';
        ctx.fillRect(0, 0, 512, 512);

        ctx.fillStyle = '#ff2233';
        ctx.beginPath(); ctx.arc(256, 256, 240, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(256, 256, 185, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#ff2233';
        ctx.beginPath(); ctx.arc(256, 256, 130, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(256, 256, 75, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = '#ff0022';
        ctx.beginPath(); ctx.arc(256, 256, 30, 0, Math.PI * 2); ctx.fill();

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(256, 20); ctx.lineTo(256, 492);
        ctx.moveTo(20, 256); ctx.lineTo(492, 256);
        ctx.stroke();

        return new THREE.CanvasTexture(c);
    }

    _buildVisualBeacon() {
        const targetTex = this._createTargetTexture();

        this.beaconGroup = new THREE.Group();

        // 1. Diana reflectante
        this.targetPad = new THREE.Mesh(
            new THREE.CircleGeometry(3.5, 32),
            new THREE.MeshStandardMaterial({
                map: targetTex,
                roughness: 0.3,
                metalness: 0.1,
                side: THREE.DoubleSide
            })
        );
        this.targetPad.rotation.x = -Math.PI / 2;
        this.targetPad.position.y = 0.05;
        this.targetPad.receiveShadow = true;
        this.beaconGroup.add(this.targetPad);

        this.neonRing = new THREE.Mesh(
            new THREE.RingGeometry(3.4, 3.9, 32),
            new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
        );
        this.neonRing.rotation.x = -Math.PI / 2;
        this.neonRing.position.y = 0.08;
        this.beaconGroup.add(this.neonRing);

        // 2. Flecha 3D flotante
        this.arrowGroup = new THREE.Group();
        this.arrowGroup.position.y = 5.5;

        const coneGeo = new THREE.ConeGeometry(1.6, 3.2, 16);
        const arrowMat = new THREE.MeshStandardMaterial({
            color: 0xff1e38,
            emissive: 0xff0028,
            emissiveIntensity: 0.85,
            roughness: 0.2,
            metalness: 0.3
        });
        const coneMesh = new THREE.Mesh(coneGeo, arrowMat);
        coneMesh.rotation.x = Math.PI;
        coneMesh.position.y = 1.6;
        coneMesh.castShadow = true;
        this.arrowGroup.add(coneMesh);

        const shaftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.2, 16), arrowMat);
        shaftMesh.position.y = 4.0;
        shaftMesh.castShadow = true;
        this.arrowGroup.add(shaftMesh);

        this.haloMesh = new THREE.Mesh(
            new THREE.TorusGeometry(2.2, 0.12, 12, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 })
        );
        this.haloMesh.rotation.x = Math.PI / 2;
        this.haloMesh.position.y = 3.6;
        this.arrowGroup.add(this.haloMesh);

        this.beaconGroup.add(this.arrowGroup);

        // 3. Haz de luz vertical
        const beamGeo = new THREE.CylinderGeometry(3.0, 3.5, 75, 16, 1, true);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xff2244,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.beam = new THREE.Mesh(beamGeo, beamMat);
        this.beam.position.y = 37.5;
        this.beaconGroup.add(this.beam);

        this.scene.add(this.beaconGroup);
    }

    getCurrentTarget() {
        const activeCargo = this.cargoManager.getActiveCargo();
        if (!activeCargo) return null;

        if (this.missionStep === 'PICKUP') {
            return {
                x: activeCargo.pickupPos.x,
                y: activeCargo.pickupPos.y,
                z: activeCargo.pickupPos.z,
                name: `PUNTO DE RECOGIDA: ${activeCargo.name}`,
                desc: `Aproxima el gancho al cáncamo y pulsa [ESPACIO] para amarrar la carga`,
                radius: 3.5
            };
        } else {
            const drop = activeCargo.dropTarget;
            return {
                x: drop.x,
                y: drop.y,
                z: drop.z,
                name: `DESTINO: ${drop.name}`,
                desc: `Transporta y posa la carga suavemente sobre la diana, luego pulsa [ESPACIO]`,
                radius: drop.radius || 3.5
            };
        }
    }

    handleAction(winchRigging) {
        const activeCargo = this.cargoManager.getActiveCargo();
        if (!activeCargo) return;

        if (this.missionStep === 'PICKUP' && this.canPerformAction) {
            // Enganchar carga
            winchRigging.attach(activeCargo);
            this.missionStep = 'DELIVERY';
            this.canPerformAction = false;

            const toast = document.getElementById('missionToast');
            if (toast) {
                toast.innerText = `¡CARGA AMARRADA! ${activeCargo.name}`;
                toast.className = 'toast-success show';
                setTimeout(() => { if (toast) toast.className = 'toast-success'; }, 2400);
            }
        } else if (this.missionStep === 'DELIVERY' && this.canPerformAction) {
            // Depositar carga con éxito
            winchRigging.detach();
            this.totalScore += 250;
            this.missionStep = 'PICKUP';
            this.canPerformAction = false;

            const toast = document.getElementById('missionToast');
            if (toast) {
                toast.innerText = `¡ENTREGA EXITOSA! +250 PTS`;
                toast.className = 'toast-success show';
                setTimeout(() => { if (toast) toast.className = 'toast-success'; }, 2600);
            }

            const elScore = document.getElementById('missionScore');
            if (elScore) elScore.innerText = `${this.totalScore} PTS`;

            // Avanzar a la siguiente carga disponible
            this.currentMissionIndex = (this.currentMissionIndex + 1) % this.cargoManager.cargoList.length;
            this.cargoManager.setActiveCargoByIndex(this.currentMissionIndex);
        }
    }

    update(dt, timeNow, tipWorld, winchRigging, speed, swaySpeed) {
        const activeCargo = this.cargoManager.getActiveCargo();
        const currentTarget = this.getCurrentTarget();
        if (!activeCargo || !currentTarget) return;

        // Posicionar el faro de luz / baliza 3D en el objetivo actual
        this.beaconGroup.position.set(currentTarget.x, currentTarget.y, currentTarget.z);

        // Distancia horizontal de maniobra estable desde la punta de la pluma
        const distH = Math.hypot(tipWorld.x - currentTarget.x, tipWorld.z - currentTarget.z);
        const hookPos = winchRigging.hookGroup.position;

        // Actualizar visibilidad dinámica de aparejos/crucetas según proximidad del gancho
        if (typeof this.cargoManager.updateRiggingProximity === 'function') {
            this.cargoManager.updateRiggingProximity(hookPos, winchRigging.isHooked);
        }

        let promptMsg = '';
        this.canPerformAction = false;

        if (this.missionStep === 'PICKUP') {
            // Distancia del gancho al cáncamo de la carga
            const cargoPos = activeCargo.mesh.position;
            const eyeTargetY = cargoPos.y + (activeCargo.mesh.userData.hookTargetY || 1.2);
            const distHookToEye = Math.hypot(hookPos.x - cargoPos.x, hookPos.y - eyeTargetY, hookPos.z - cargoPos.z);
            const diffY = Math.abs(hookPos.y - eyeTargetY);

            this.smoothedDiffY = THREE.MathUtils.lerp(this.smoothedDiffY || diffY, diffY, Math.min(1.0, dt * 6.0));

            if (distHookToEye < 2.4 && swaySpeed < 0.5) {
                promptMsg = '[ ESPACIO ] ENGANCHAR CARGA';
                this.canPerformAction = true;
            } else {
                promptMsg = `BAJAR GANCHO A LA CARGA (${distHookToEye.toFixed(1)} m)`;
            }
        } else {
            // Fase de entrega
            const cargoPos = activeCargo.mesh.position;
            const diffY = Math.abs(cargoPos.y - currentTarget.y);
            this.smoothedDiffY = THREE.MathUtils.lerp(this.smoothedDiffY || diffY, diffY, Math.min(1.0, dt * 6.0));
            const loadDistH = Math.hypot(cargoPos.x - currentTarget.x, cargoPos.z - currentTarget.z);

            const isOverTarget = loadDistH <= currentTarget.radius;
            const isGroundedAndStable = winchRigging.isHooked && diffY <= 1.4 && swaySpeed <= 0.35;

            if (isOverTarget && isGroundedAndStable) {
                promptMsg = '[ ESPACIO ] DEPOSITAR CARGA';
                this.canPerformAction = true;
            } else if (isOverTarget) {
                promptMsg = `POSAR CON SUAVIDAD (ALT: ${diffY.toFixed(1)} m)`;
            } else {
                promptMsg = `TRANSPORTAR A DESTINO (${distH.toFixed(1)} m)`;
            }
        }

        // Actualizar HUD de misión
        const elDist = document.getElementById('missionDist');
        const elAlt = document.getElementById('missionAlt');
        const elSway = document.getElementById('missionSway');
        const elProg = document.getElementById('missionProgress');
        const elTag = document.getElementById('missionTag');
        const elTitle = document.getElementById('missionTitle');
        const elDesc = document.getElementById('missionDesc');

        if (elTag) elTag.innerText = `MISIÓN [${this.currentMissionIndex + 1}/${this.cargoManager.cargoList.length}] — ${this.missionStep === 'PICKUP' ? '1. RECOGIDA' : '2. DEPÓSITO'}`;
        if (elTitle) elTitle.innerText = this.missionStep === 'PICKUP' ? `RECOGER: ${activeCargo.name}` : currentTarget.name;
        if (elDesc) {
            elDesc.innerText = promptMsg;
            if (this.canPerformAction) {
                elDesc.style.color = '#f6e05e';
                elDesc.style.fontWeight = 'bold';
            } else {
                elDesc.style.color = '#8b949e';
                elDesc.style.fontWeight = 'normal';
            }
        }

        if (elDist) elDist.innerText = `${distH.toFixed(1)} m`;
        if (elAlt) elAlt.innerText = `${this.smoothedDiffY.toFixed(1)} m`;

        if (elSway) {
            if (swaySpeed < 0.20) {
                elSway.innerText = "ESTABLE";
                elSway.style.color = "#3fb950";
            } else if (swaySpeed < 0.45) {
                elSway.innerText = "CALMANDO";
                elSway.style.color = "#f6e05e";
            } else {
                elSway.innerText = "OSCILANDO";
                elSway.style.color = "#f85149";
            }
        }

        const maxRange = 35.0;
        const proxScore = Math.max(0, Math.min(100, (1 - (distH / maxRange)) * 100));
        if (elProg) {
            elProg.style.width = `${proxScore}%`;
            elProg.style.background = this.canPerformAction ? '#f6e05e' : (this.missionStep === 'PICKUP' ? '#58a6ff' : '#3fb950');
        }

        // Animar baliza visual
        const bob = Math.sin(timeNow * 0.005) * 0.75;
        this.arrowGroup.position.y = 5.2 + bob;
        this.arrowGroup.rotation.y += 2.0 * dt;
        this.haloMesh.rotation.z += 2.8 * dt;

        const pulseScale = 1.0 + 0.1 * Math.sin(timeNow * 0.006);
        this.neonRing.scale.set(pulseScale, pulseScale, 1);
        this.beam.rotation.y += 0.4 * dt;
    }
}
