import { THREE } from './core/three.js?v=2.2';
import { SceneManager } from './core/SceneManager.js?v=2.2';
import { InputManager } from './core/InputManager.js?v=2.2';
import { Environment } from './environment/Environment.js?v=2.2';
import { CraneModel } from './crane/CraneModel.js?v=2.2';
import { CraneController } from './crane/CraneController.js?v=2.2';
import { WinchRigging } from './crane/WinchRigging.js?v=2.2';
import { CargoManager } from './systems/CargoManager.js?v=2.2';
import { MissionSystem } from './systems/MissionSystem.js?v=2.2';
import { HelicopterController } from './systems/HelicopterController.js?v=2.2';
import { HUDManager } from './ui/HUDManager.js?v=2.2';

class SimulatorApp {
    constructor() {
        this.activeVehicle = 'crane'; // 'crane' | 'helicopter'

        this.sceneManager = new SceneManager();
        this.environment = new Environment(this.sceneManager.scene, () => {
            if (this.cargoManager) {
                this.cargoManager.setRooftopTarget(this.environment.rooftopTarget);
            }
        });

        // Inicializar controlador del helicóptero UH-60L Blackhawk y vincularlo al entorno
        this.helicopterController = new HelicopterController(this.sceneManager.scene, this.environment);
        this.environment.setHelicopterController(this.helicopterController);

        this.cargoManager = new CargoManager(this.sceneManager.scene);
        this.cargoManager.setRooftopTarget(this.environment.rooftopTarget);

        this.missionSystem = new MissionSystem(this.sceneManager.scene, this.cargoManager);
        this.hudManager = new HUDManager();
        this.winchRigging = new WinchRigging(this.sceneManager.scene);

        this.craneModel = new CraneModel(
            this.sceneManager.scene,
            (percent) => {
                const statusEl = document.getElementById('mainStatus');
                if (statusEl) {
                    statusEl.innerText = `CARGANDO GRÚA ${percent}%`;
                    statusEl.style.background = "#d29922";
                }
            },
            () => {
                const statusEl = document.getElementById('mainStatus');
                if (statusEl) {
                    statusEl.innerText = "SISTEMA NOMINAL";
                    statusEl.style.background = "#2ea043";
                }
            },
            (err) => {
                const statusEl = document.getElementById('mainStatus');
                if (statusEl) {
                    if (window.location.protocol === 'file:') {
                        statusEl.innerText = "ERROR: USA START.BAT (HTTP)";
                    } else {
                        statusEl.innerText = "ERROR CARGA 3D (REVISA CONSOLA)";
                    }
                    statusEl.style.background = "#f85149";
                }
            }
        );

        this.craneController = new CraneController(this.craneModel.craneGroup, this.environment.obstacles);

        // Input manager con cambio de cámara y acción de gancho [ESPACIO]
        this.inputManager = new InputManager(
            (mode) => this.setCameraMode(mode),
            () => this.handleAction()
        );

        this._initHelicopterUIListeners();

        // Exponer funciones al objeto global para botones HTML onclick
        window.setCameraMode = (mode) => this.setCameraMode(mode);
        window.selectVehicle = (vehicle) => this.selectVehicle(vehicle);
        window.toggleHeliEngine = () => this.toggleHeliEngine();

        this.lastTime = performance.now();
        this.frameCount = 0;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    _initHelicopterUIListeners() {
        const elHeliRpm = document.getElementById('heliRpm');
        const elHeliAlt = document.getElementById('heliAlt');
        const elHeliYaw = document.getElementById('heliYaw');

        if (elHeliRpm) {
            elHeliRpm.addEventListener('input', () => {
                this.helicopterController.targetRpmPct = parseFloat(elHeliRpm.value);
            });
        }
        if (elHeliAlt) {
            elHeliAlt.addEventListener('input', () => {
                this.helicopterController.targetAltitude = parseFloat(elHeliAlt.value);
            });
        }
        if (elHeliYaw) {
            elHeliYaw.addEventListener('input', () => {
                const deg = parseFloat(elHeliYaw.value);
                this.helicopterController.heliGroup.rotation.y = deg * (Math.PI / 180);
            });
        }
    }

    selectVehicle(vehicle) {
        this.activeVehicle = vehicle;
        const isHeli = (vehicle === 'helicopter');

        const btnCrane = document.getElementById('btnSelectCrane');
        const btnHeli = document.getElementById('btnSelectHeli');
        const craneGroup = document.getElementById('craneControlsGroup');
        const heliGroup = document.getElementById('heliControlsGroup');
        const btnCam1 = document.getElementById('btnCam1');
        const rpmLabel = document.getElementById('cockpitRpmLabel');
        const steerLabel = document.getElementById('cockpitSteerLabel');

        if (btnCrane) btnCrane.className = isHeli ? 'veh-btn' : 'veh-btn active';
        if (btnHeli) btnHeli.className = isHeli ? 'veh-btn active' : 'veh-btn';
        if (craneGroup) craneGroup.style.display = isHeli ? 'none' : 'flex';
        if (heliGroup) heliGroup.style.display = isHeli ? 'flex' : 'none';
        if (btnCam1) btnCam1.innerText = isHeli ? '1: HELI' : '1: GRÚA';
        if (rpmLabel) rpmLabel.innerText = isHeli ? 'TURBINA RPM' : 'DIÉSEL RPM';
        if (steerLabel) steerLabel.innerText = isHeli ? 'RUMBO' : 'DIRECCIÓN';

        // Al seleccionar el helicóptero, asegurar que el motor esté encendido y enfocar la cámara
        if (isHeli && !this.helicopterController.engineOn) {
            this.toggleHeliEngine();
        }

        this.setCameraMode('orbit');
    }

    toggleHeliEngine() {
        const isOn = this.helicopterController.toggleEngine();
        const btn = document.getElementById('btnHeliEngine');
        const badge = document.getElementById('valHeliEngine');
        if (btn) {
            btn.className = isOn ? 'heli-action-btn active' : 'heli-action-btn';
            btn.innerText = isOn ? 'MOTOR GE T700: ACTIVO' : 'MOTOR GE T700: APAGADO';
        }
        if (badge) {
            badge.innerText = isOn ? 'ON' : 'OFF';
            badge.style.color = isOn ? '#3fb950' : '#f85149';
        }
    }

    handleAction() {
        if (this.activeVehicle === 'crane') {
            this.missionSystem.handleAction(this.winchRigging);
        } else {
            this.toggleHeliEngine();
        }
    }

    setCameraMode(mode) {
        const activeCargo = this.cargoManager.getActiveCargo();
        const activeTarget = this.missionSystem.getCurrentTarget();

        this.sceneManager.setCameraMode(mode, {
            loadMesh: this.winchRigging.isHooked && activeCargo ? activeCargo.mesh : this.winchRigging.hookGroup,
            activeMission: activeTarget,
            cabinNode: this.craneModel.cabinNode,
            cranePosition: this.craneModel.craneGroup.position,
            activeVehicle: this.activeVehicle,
            heliGroup: this.helicopterController.heliGroup
        });
    }

    animate() {
        requestAnimationFrame(this.animate);

        const timeNow = performance.now();
        const dt = Math.min(0.1, (timeNow - this.lastTime) / 1000);
        this.lastTime = timeNow;

        this.frameCount++;
        if (this.frameCount % 10 === 0) {
            const fpsEl = document.getElementById('fps');
            if (fpsEl) fpsEl.innerText = `FPS: ${Math.round(1 / Math.max(0.001, dt))}`;
        }

        const isHeliActive = (this.activeVehicle === 'helicopter');

        // 1. Controles de pluma de la grúa (solo responden a teclado cuando la grúa está activa)
        const elRot = document.getElementById('rot');
        const elExt = document.getElementById('ext');
        const elAng = document.getElementById('ang');

        if (!isHeliActive) {
            if (this.inputManager.isPressed('q')) elRot.value = parseFloat(elRot.value) - 45 * dt;
            if (this.inputManager.isPressed('a')) elRot.value = parseFloat(elRot.value) + 45 * dt;
            if (this.inputManager.isPressed('w')) elExt.value = parseFloat(elExt.value) + 15 * dt;
            if (this.inputManager.isPressed('s')) elExt.value = parseFloat(elExt.value) - 15 * dt;
            if (this.inputManager.isPressed('e')) elAng.value = parseFloat(elAng.value) + 20 * dt;
            if (this.inputManager.isPressed('d')) elAng.value = parseFloat(elAng.value) - 20 * dt;
        }

        const massTon = parseFloat(document.getElementById('m').value);
        const speed = parseFloat(document.getElementById('v').value);
        const rotDeg = parseFloat(elRot.value);
        const ext = parseFloat(elExt.value);
        const angDeg = parseFloat(elAng.value);

        const rotRad = rotDeg * (Math.PI / 180);
        const angRad = angDeg * (Math.PI / 180);

        document.getElementById('valMass').innerText = massTon.toFixed(1);
        document.getElementById('valSpeed').innerText = speed.toFixed(1);
        document.getElementById('valRot').innerText = rotDeg.toFixed(1);
        document.getElementById('valExt').innerText = ext.toFixed(1);
        document.getElementById('valAng').innerText = angDeg.toFixed(1);

        // 2. Actualizar controlador del vehículo Grúa (si está activa) y del Helicóptero UH-60
        if (!isHeliActive) {
            this.craneController.update(this.inputManager, dt, this.sceneManager.camera);
        }
        this.helicopterController.update(dt, timeNow, this.inputManager, isHeliActive, this.sceneManager.camera);

        // Sincronizar badges y sliders del panel de helicóptero
        const heliTel = this.helicopterController.getTelemetry();
        const elHeliAlt = document.getElementById('heliAlt');
        const elHeliYaw = document.getElementById('heliYaw');
        const valHeliRpm = document.getElementById('valHeliRpm');
        const valHeliAlt = document.getElementById('valHeliAlt');
        const valHeliYaw = document.getElementById('valHeliYaw');

        if (valHeliRpm) valHeliRpm.innerText = `${Math.round(heliTel.rpmPct)}%`;
        if (valHeliAlt) valHeliAlt.innerText = heliTel.altitude.toFixed(1);
        if (valHeliYaw) valHeliYaw.innerText = `${heliTel.yawDeg}°`;
        if (elHeliAlt && document.activeElement !== elHeliAlt) {
            elHeliAlt.value = this.helicopterController.targetAltitude.toFixed(1);
        }
        if (elHeliYaw && document.activeElement !== elHeliYaw) {
            elHeliYaw.value = heliTel.yawDeg;
        }

        // 3. Actualizar cinemática de la grúa
        this.craneModel.updateKinematics(rotRad, angRad, ext, this.craneController.moveDist);

        // 4. Obtener ancla de punta de pluma en coordenadas mundiales
        const tipWorld = this.craneModel.getTipWorldPosition();

        // 5. Actualizar aparejo de cabrestante, física pendular, cables y eslingas
        const rigState = this.winchRigging.update(
            dt,
            timeNow,
            tipWorld,
            this.craneModel.craneGroup.rotation.y,
            speed,
            massTon,
            this.inputManager,
            this.environment
        );

        // 6. Actualizar misiones con ciclo de RECOGIDA y DEPÓSITO
        const swaySpeed = this.winchRigging.swayVelocity.length();
        this.missionSystem.update(
            dt,
            timeNow,
            tipWorld,
            this.winchRigging,
            speed,
            swaySpeed
        );

        // 7. Actualizar display digital inferior según unidad activa
        if (isHeliActive) {
            this.hudManager.updateCockpit(
                heliTel.speedKmh,
                heliTel.turbineRpm,
                this.helicopterController.heliGroup.rotation.y * 0.25,
                heliTel.forwardSpeed
            );
        } else {
            const speedKmh = Math.round(Math.abs(this.craneController.vehicleSpeed) * 3.6);
            this.hudManager.updateCockpit(
                speedKmh,
                this.craneController.currentRpm,
                this.craneController.steerAngle,
                this.craneController.vehicleSpeed
            );
        }

        // 8. Actualizar telemetría LMI y potencia
        const activeCargo = this.cargoManager.getActiveCargo();
        this.hudManager.updateTelemetry(
            rigState.effectiveMass,
            speed,
            ext,
            angDeg,
            null
        );

        // 9. Seguimiento dinámico de cámara según modo y vehículo activo
        const currentTarget = this.missionSystem.getCurrentTarget();
        this.sceneManager.updateCameraFollow({
            loadMesh: this.winchRigging.isHooked && activeCargo ? activeCargo.mesh : this.winchRigging.hookGroup,
            activeMission: currentTarget,
            cranePosition: this.craneModel.craneGroup.position,
            tipWorld,
            activeVehicle: this.activeVehicle,
            heliGroup: this.helicopterController.heliGroup
        });

        // 10. Render final de la escena
        this.sceneManager.render();
    }
}

// Iniciar aplicación de forma segura (tanto si el DOM ya cargó como si está cargando)
function initSimulator() {
    if (!window.simulatorApp) {
        window.simulatorApp = new SimulatorApp();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSimulator);
} else {
    initSimulator();
}
