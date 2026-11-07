import { THREE } from '../core/three.js';

export class HelicopterController {
    constructor(scene, environment) {
        this.scene = scene;
        this.environment = environment;

        // Grupo raíz de posición y rumbo (Yaw) en el mundo
        this.heliGroup = new THREE.Group();
        this.heliGroup.position.set(-22.0, 0.18, 42.0);
        this.heliGroup.rotation.y = -Math.PI / 6;
        this.scene.add(this.heliGroup);

        // Subgrupo para cabeceo (Pitch en eje Z local) y alabeo (Roll en eje X local)
        // En Helicopter.glb el morro (cabina) apunta hacia -X y la cola hacia +X
        this.tiltGroup = new THREE.Group();
        this.heliGroup.add(this.tiltGroup);

        this.mainRotorPivot = null;
        this.tailRotorPivot = null;
        this.mainBlurMesh = null;
        this.tailBlurMesh = null;
        this.topBeacon = null;
        this.navLights = [];

        // Eje inclinado real del rotor de cola del UH-60 Blackhawk (~10.7° cant)
        this.tailAxis = new THREE.Vector3(0, -0.1896, 1).normalize();

        // Estado del motor y vuelo
        this.engineOn = true;       // Motor activo para ver animación de hélices
        this.targetRpmPct = 100;    // Slider de potencia de rotor (0 - 100%)
        this.currentRpmPct = 45;    // Aceleración progresiva de turbina
        this.rotorAngle = 0;

        // Cinemática de vuelo
        this.groundBaseY = 0.18;
        this.altitude = 0.18;       // Altura Y actual en el mundo
        this.targetAltitude = 0.18; // Objetivo de altitud del slider / colectivo
        this.verticalSpeed = 0;
        this.forwardSpeed = 0;
        this.strafeSpeed = 0;
        this.yawRate = 0;

        this.pitchAngle = 0;        // Inclinación longitudinal (eje Z local)
        this.rollAngle = 0;         // Alabeo lateral (eje X local)
        this.hoverPhase = 0;
        this.isLoaded = false;
    }

    /**
     * Recibe la escena GLTF de Helicopter.glb, separa dinámicamente los triángulos
     * del rotor principal y del rotor de cola para animarlos con precisión.
     */
    setupModel(gltfScene) {
        // Coordenadas exactas de los ejes de rotación en el espacio de Helicopter.glb
        const mainCenter = new THREE.Vector3(-1.656, 2.65, 0.0);
        const tailCenter = new THREE.Vector3(5.7261, 2.6256, -0.2615);

        this.mainRotorPivot = new THREE.Group();
        this.mainRotorPivot.position.copy(mainCenter);
        this.tiltGroup.add(this.mainRotorPivot);

        this.tailRotorPivot = new THREE.Group();
        this.tailRotorPivot.position.copy(tailCenter);
        this.tiltGroup.add(this.tailRotorPivot);

        const meshesToProcess = [];
        gltfScene.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                meshesToProcess.push(node);
            }
        });

        meshesToProcess.forEach((mesh) => {
            const geo = mesh.geometry;
            const posAttr = geo.attributes.position;
            const indexAttr = geo.index;

            // El material Fuselaje.001 contiene el fuselaje + rotor principal + rotor de cola
            if (posAttr && indexAttr && posAttr.count > 50000) {
                const indices = indexAttr.array;
                const fuselageIdx = [];
                const mainRotorIdx = [];
                const tailRotorIdx = [];

                for (let i = 0; i < indices.length; i += 3) {
                    const i0 = indices[i];
                    const i1 = indices[i + 1];
                    const i2 = indices[i + 2];

                    const cx = (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3;
                    const cy = (posAttr.getY(i0) + posAttr.getY(i1) + posAttr.getY(i2)) / 3;
                    const cz = (posAttr.getZ(i0) + posAttr.getZ(i1) + posAttr.getZ(i2)) / 3;

                    // 1. Rotor principal: situado sobre el mástil superior (Y >= 2.45, X < 4.1)
                    if (cx < 4.1 && cy >= 2.45) {
                        mainRotorIdx.push(i0, i1, i2);
                    }
                    // 2. Rotor de cola: situado en el pilón trasero izquierdo con plano inclinado
                    else if (cx > 4.45 && cy > 1.44 && (cz - 0.1896 * (cy - 2.6256)) < -0.185) {
                        tailRotorIdx.push(i0, i1, i2);
                    }
                    // 3. Resto del fuselaje
                    else {
                        fuselageIdx.push(i0, i1, i2);
                    }
                }

                // Actualizar geometría del fuselaje
                const IndexArrayType = indices instanceof Uint32Array ? Uint32Array : Uint16Array;
                geo.setIndex(new THREE.BufferAttribute(new IndexArrayType(fuselageIdx), 1));

                // Crear malla del Rotor Principal
                if (mainRotorIdx.length > 0) {
                    const mainGeo = geo.clone();
                    mainGeo.setIndex(new THREE.BufferAttribute(new IndexArrayType(mainRotorIdx), 1));
                    const mainMesh = new THREE.Mesh(mainGeo, mesh.material);
                    mainMesh.position.set(-mainCenter.x, -mainCenter.y, -mainCenter.z);
                    mainMesh.castShadow = true;
                    mainMesh.receiveShadow = true;
                    this.mainRotorPivot.add(mainMesh);
                }

                // Crear malla del Rotor de Cola
                if (tailRotorIdx.length > 0) {
                    const tailGeo = geo.clone();
                    tailGeo.setIndex(new THREE.BufferAttribute(new IndexArrayType(tailRotorIdx), 1));
                    const tailMesh = new THREE.Mesh(tailGeo, mesh.material);
                    tailMesh.position.set(-tailCenter.x, -tailCenter.y, -tailCenter.z);
                    tailMesh.castShadow = true;
                    tailMesh.receiveShadow = true;
                    this.tailRotorPivot.add(tailMesh);
                }
            }
        });

        this.tiltGroup.add(gltfScene);

        // Añadir discos de barrido visual (Motion Blur de hélices a altas RPM)
        this._buildRotorBlurDiscs();

        // Baliza estroboscópica superior y luces de navegación
        this._buildAviationLights();

        this.isLoaded = true;
    }

    _createBlurTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const cx = 128, cy = 128;

        const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 124);
        grad.addColorStop(0.0, 'rgba(20, 24, 30, 0.0)');
        grad.addColorStop(0.18, 'rgba(35, 42, 50, 0.35)');
        grad.addColorStop(0.75, 'rgba(25, 30, 36, 0.22)');
        grad.addColorStop(0.95, 'rgba(180, 195, 210, 0.18)');
        grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 124, 0, Math.PI * 2);
        ctx.fill();

        // Estelas sutiles de 4 palas en el disco
        for (let b = 0; b < 4; b++) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((b * Math.PI) / 2);
            const bladeGrad = ctx.createLinearGradient(0, -18, 0, 18);
            bladeGrad.addColorStop(0, 'rgba(0,0,0,0)');
            bladeGrad.addColorStop(0.5, 'rgba(15, 18, 22, 0.45)');
            bladeGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = bladeGrad;
            ctx.fillRect(14, -18, 108, 36);
            ctx.restore();
        }

        return new THREE.CanvasTexture(canvas);
    }

    _buildRotorBlurDiscs() {
        const blurTex = this._createBlurTexture();
        const blurMatMain = new THREE.MeshBasicMaterial({
            map: blurTex,
            transparent: true,
            opacity: 0.0,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        this.mainBlurMesh = new THREE.Mesh(new THREE.CircleGeometry(5.24, 36), blurMatMain);
        this.mainBlurMesh.rotation.x = -Math.PI / 2;
        this.mainBlurMesh.position.set(0, 0.04, 0);
        this.mainRotorPivot.add(this.mainBlurMesh);

        const blurMatTail = blurMatMain.clone();
        this.tailBlurMesh = new THREE.Mesh(new THREE.CircleGeometry(1.16, 24), blurMatTail);
        // Alinear el disco con el plano inclinado del rotor de cola
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.tailAxis);
        this.tailBlurMesh.quaternion.copy(q);
        this.tailRotorPivot.add(this.tailBlurMesh);
    }

    _buildAviationLights() {
        // Baliza roja anticolisión en la cola superior
        this.topBeacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 8),
            new THREE.MeshStandardMaterial({
                color: 0xff0022,
                emissive: 0xff0022,
                emissiveIntensity: 1.8
            })
        );
        this.topBeacon.position.set(5.68, 3.82, -0.05);
        this.tiltGroup.add(this.topBeacon);

        // Luces de navegación laterales (Roja a babor +Z, Verde a estribor -Z)
        const portLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff1111, emissiveIntensity: 1.4 })
        );
        portLight.position.set(-1.5, 1.15, 1.35);

        const starboardLight = new THREE.Mesh(
            new THREE.SphereGeometry(0.07, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00dd44, emissiveIntensity: 1.4 })
        );
        starboardLight.position.set(-1.5, 1.15, -1.35);

        this.tiltGroup.add(portLight, starboardLight);
        this.navLights.push(portLight, starboardLight);
    }

    toggleEngine() {
        this.engineOn = !this.engineOn;
        return this.engineOn;
    }

    update(dt, timeNow, inputManager, isPilotActive, camera) {
        if (!this.isLoaded) return;

        // 1. Dinámica de RPM de la turbina y hélices
        const desiredRpm = this.engineOn ? this.targetRpmPct : 0;
        const spoolRate = this.engineOn ? 28.0 : 18.0;
        if (this.currentRpmPct < desiredRpm) {
            this.currentRpmPct = Math.min(desiredRpm, this.currentRpmPct + spoolRate * dt);
        } else if (this.currentRpmPct > desiredRpm) {
            this.currentRpmPct = Math.max(desiredRpm, this.currentRpmPct - spoolRate * dt);
        }

        // Velocidad angular del rotor principal (hasta ~26 rad/s a 100% RPM)
        const normalizedRpm = this.currentRpmPct / 100;
        const omegaMain = normalizedRpm * 26.0;
        this.rotorAngle += omegaMain * dt;

        if (this.mainRotorPivot) {
            this.mainRotorPivot.rotation.y += omegaMain * dt;
        }
        if (this.tailRotorPivot) {
            this.tailRotorPivot.rotateOnAxis(this.tailAxis, omegaMain * 4.5 * dt);
        }

        // Actualizar opacidad del efecto Motion Blur de las aspas
        const blurAlpha = Math.max(0, (normalizedRpm - 0.35) / 0.65) * 0.42;
        if (this.mainBlurMesh) this.mainBlurMesh.material.opacity = blurAlpha;
        if (this.tailBlurMesh) this.tailBlurMesh.material.opacity = blurAlpha * 0.9;

        // Parpadeo estroboscópico de la baliza superior
        if (this.topBeacon) {
            const pulse = this.engineOn ? (Math.sin(timeNow * 0.01) > 0.2 ? 2.4 : 0.2) : 0.05;
            this.topBeacon.material.emissiveIntensity = pulse;
        }

        // 2. Altura de suelo o azotea bajo el helicóptero
        const groundY = Math.max(
            0.18,
            this.environment ? this.environment.getGroundHeightAt(this.heliGroup.position.x, this.heliGroup.position.z) : 0.18
        );

        // 3. Controles de vuelo cuando el selector está en modo HELICÓPTERO
        const canFly = this.currentRpmPct >= 55;
        let targetFwd = 0;
        let targetYawRate = 0;
        let targetRoll = 0;

        if (isPilotActive && canFly) {
            // Colectivo (Subir / Bajar con W/S o E/D)
            if (inputManager.isPressed('w') || inputManager.isPressed('e')) {
                this.targetAltitude = Math.min(85.0, this.targetAltitude + 10.5 * dt);
            }
            if (inputManager.isPressed('s') || inputManager.isPressed('d')) {
                this.targetAltitude = Math.max(groundY, this.targetAltitude - 10.5 * dt);
            }

            // Avance / Retroceso (Flechas Arriba / Abajo)
            if (inputManager.isPressed('ArrowUp')) {
                targetFwd = 22.0; // m/s (~80 km/h)
            } else if (inputManager.isPressed('ArrowDown')) {
                targetFwd = -12.0;
            }

            // Viraje / Guiñada (Flechas Izquierda / Derecha o Q / A)
            if (inputManager.isPressed('ArrowLeft') || inputManager.isPressed('q')) {
                targetYawRate = 1.25;
                targetRoll = -0.18; // Alabeo en viraje
            } else if (inputManager.isPressed('ArrowRight') || inputManager.isPressed('a')) {
                targetYawRate = -1.25;
                targetRoll = 0.18;
            }
        } else if (!canFly) {
            // Si se apaga el motor o bajan las RPM, desciende suavemente al suelo
            this.targetAltitude = Math.max(groundY, this.targetAltitude - 6.0 * dt);
        }

        // Garantizar que el objetivo de altitud nunca atraviese el suelo o azotea
        if (this.targetAltitude < groundY) {
            this.targetAltitude = groundY;
        }

        // 4. Integrar altitud y flotación estacionaria (Hover sinusoidal)
        const prevAlt = this.altitude;
        this.altitude += (this.targetAltitude - this.altitude) * Math.min(1.0, dt * 4.5);
        if (this.altitude < groundY) {
            this.altitude = groundY;
        }
        this.verticalSpeed = (this.altitude - prevAlt) / Math.max(0.001, dt);

        const isAirborne = (this.altitude - groundY) > 0.25;
        let hoverOffset = 0;
        if (isAirborne && canFly) {
            this.hoverPhase += dt * 2.6;
            hoverOffset = Math.sin(this.hoverPhase) * 0.09;
        }

        // 5. Integrar velocidad horizontal, rumbo y traslación en el mundo
        if (!isAirborne) {
            targetFwd *= 0.15;
            targetYawRate *= 0.35;
            targetRoll = 0;
        }

        this.forwardSpeed += (targetFwd - this.forwardSpeed) * Math.min(1.0, dt * 3.2);
        this.yawRate += (targetYawRate - this.yawRate) * Math.min(1.0, dt * 5.0);

        if (Math.abs(this.yawRate) > 0.001) {
            this.heliGroup.rotation.y += this.yawRate * dt;
            // Mantener ángulo en rango [-PI, PI]
            if (this.heliGroup.rotation.y > Math.PI) this.heliGroup.rotation.y -= Math.PI * 2;
            if (this.heliGroup.rotation.y < -Math.PI) this.heliGroup.rotation.y += Math.PI * 2;
        }

        // En Helicopter.glb el morro apunta hacia -X local:
        // Al rotar por rotation.y, el vector frontal en el mundo es (-cos(rotY), 0, sin(rotY))
        const yaw = this.heliGroup.rotation.y;
        const forwardX = -Math.cos(yaw);
        const forwardZ = Math.sin(yaw);

        const dx = forwardX * this.forwardSpeed * dt;
        const dz = forwardZ * this.forwardSpeed * dt;
        const dy = (this.altitude + hoverOffset) - this.heliGroup.position.y;

        // Limitar dentro del perímetro del mapa (-220 a 220m)
        this.heliGroup.position.x = Math.max(-220, Math.min(220, this.heliGroup.position.x + dx));
        this.heliGroup.position.z = Math.max(-220, Math.min(220, this.heliGroup.position.z + dz));
        this.heliGroup.position.y = this.altitude + hoverOffset;

        // Mover la cámara junto con el helicóptero cuando está siendo pilotado
        if (isPilotActive && camera) {
            camera.position.x += dx;
            camera.position.y += dy;
            camera.position.z += dz;
        }

        // 6. Inclinación física realista del fuselaje (Pitch en Z y Roll en X)
        // Morro hacia abajo (+Z rotation) cuando avanza hacia -X
        const desiredPitch = isAirborne ? (this.forwardSpeed / 22.0) * 0.22 : 0;
        const desiredRoll = isAirborne ? targetRoll : 0;

        this.pitchAngle += (desiredPitch - this.pitchAngle) * Math.min(1.0, dt * 5.0);
        this.rollAngle += (desiredRoll - this.rollAngle) * Math.min(1.0, dt * 5.0);

        this.tiltGroup.rotation.z = this.pitchAngle;
        this.tiltGroup.rotation.x = this.rollAngle;
    }

    getTelemetry() {
        const speedKmh = Math.round(Math.abs(this.forwardSpeed) * 3.6);
        const turbineRpm = Math.round((this.currentRpmPct / 100) * 1950);
        const yawDeg = Math.round(this.heliGroup.rotation.y * (180 / Math.PI));
        return {
            speedKmh,
            turbineRpm,
            yawDeg,
            altitude: this.altitude,
            rpmPct: this.currentRpmPct,
            forwardSpeed: this.forwardSpeed,
            isAirborne: this.altitude > 0.45
        };
    }
}
