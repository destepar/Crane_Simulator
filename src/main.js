import { THREE } from './core/three.js';
import { SceneManager } from './core/SceneManager.js';
import { InputManager } from './core/InputManager.js';
import { Environment } from './environment/Environment.js';
import { CraneModel } from './crane/CraneModel.js';
import { CraneController } from './crane/CraneController.js';
import { WinchRigging } from './crane/WinchRigging.js';
import { CargoManager } from './systems/CargoManager.js';
import { MissionSystem } from './systems/MissionSystem.js';
import { HelicopterController } from './systems/HelicopterController.js';
import { HUDManager } from './ui/HUDManager.js';
import { IntegratedReviewer } from './ui/IntegratedReviewer.js';

class SimulatorApp {
    constructor() {
        this.activeVehicle = 'crane'; // 'crane' | 'helicopter'

        // Estado cinemático en coma flotante para evitar cuantización por frame de inputs range
        this.craneState = {
            massTon: 10.0,
            speed: 1.0,
            rotDeg: 30.0,
            ext: 35.0,
            angDeg: 50.0
        };

        // Cachear referencias DOM para ciclo animate() libre de búsquedas DOM
        this.dom = {
            mainDashboard: document.getElementById('mainDashboard'),
            rightTelemetryPanel: document.getElementById('rightTelemetryPanel'),
            mainStatus: document.getElementById('mainStatus'),
            fps: document.getElementById('fps'),
            m: document.getElementById('m'),
            v: document.getElementById('v'),
            rot: document.getElementById('rot'),
            ext: document.getElementById('ext'),
            ang: document.getElementById('ang'),
            valMass: document.getElementById('valMass'),
            valSpeed: document.getElementById('valSpeed'),
            valRot: document.getElementById('valRot'),
            valExt: document.getElementById('valExt'),
            valAng: document.getElementById('valAng'),
            btnSelectCrane: document.getElementById('btnSelectCrane'),
            btnSelectHeli: document.getElementById('btnSelectHeli'),
            craneControlsGroup: document.getElementById('craneControlsGroup'),
            heliControlsGroup: document.getElementById('heliControlsGroup'),
            btnCam1: document.getElementById('btnCam1'),
            cockpitRpmLabel: document.getElementById('cockpitRpmLabel'),
            cockpitSteerLabel: document.getElementById('cockpitSteerLabel'),
            btnHeliEngine: document.getElementById('btnHeliEngine'),
            valHeliEngine: document.getElementById('valHeliEngine'),
            heliRpm: document.getElementById('heliRpm'),
            heliAlt: document.getElementById('heliAlt'),
            heliYaw: document.getElementById('heliYaw'),
            valHeliRpm: document.getElementById('valHeliRpm'),
            valHeliAlt: document.getElementById('valHeliAlt'),
            valHeliYaw: document.getElementById('valHeliYaw')
        };

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
                const statusEl = this.dom.mainStatus;
                if (statusEl) {
                    statusEl.innerText = `CARGANDO GRÚA ${percent}%`;
                    statusEl.style.background = "#d29922";
                }
            },
            () => {
                const statusEl = this.dom.mainStatus;
                if (statusEl) {
                    statusEl.innerText = "SISTEMA NOMINAL";
                    statusEl.style.background = "#2ea043";
                }
            },
            () => {
                const statusEl = this.dom.mainStatus;
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

        this._initCraneUIListeners();
        this._initHelicopterUIListeners();

        // Inicializar Revisor Integrado en Navegador (Diagnóstico WebGL + Auto-Test E2E)
        this.integratedReviewer = new IntegratedReviewer(this);

        // Exponer funciones al objeto global para botones HTML onclick
        window.setCameraMode = (mode) => this.setCameraMode(mode);
        window.selectVehicle = (vehicle) => this.selectVehicle(vehicle);
        window.toggleHeliEngine = () => this.toggleHeliEngine();

        this.lastTime = performance.now();
        this.frameCount = 0;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    _initCraneUIListeners() {
        if (this.dom.m) {
            this.dom.m.addEventListener('input', () => {
                this.craneState.massTon = parseFloat(this.dom.m.value);
            });
        }
        if (this.dom.v) {
            this.dom.v.addEventListener('input', () => {
                this.craneState.speed = parseFloat(this.dom.v.value);
            });
        }
        if (this.dom.rot) {
            this.dom.rot.addEventListener('input', () => {
                this.craneState.rotDeg = parseFloat(this.dom.rot.value);
            });
        }
        if (this.dom.ext) {
            this.dom.ext.addEventListener('input', () => {
                this.craneState.ext = parseFloat(this.dom.ext.value);
            });
        }
        if (this.dom.ang) {
            this.dom.ang.addEventListener('input', () => {
                this.craneState.angDeg = parseFloat(this.dom.ang.value);
            });
        }
    }

    setCraneControls({ rotDeg, ext, angDeg, massTon, speed }) {
        if (typeof rotDeg === 'number') {
            this.craneState.rotDeg = rotDeg;
            if (this.dom.rot) this.dom.rot.value = rotDeg.toFixed(1);
        }
        if (typeof ext === 'number') {
            this.craneState.ext = Math.max(10, Math.min(60, ext));
            if (this.dom.ext) this.dom.ext.value = this.craneState.ext.toFixed(1);
        }
        if (typeof angDeg === 'number') {
            this.craneState.angDeg = Math.max(10, Math.min(85, angDeg));
            if (this.dom.ang) this.dom.ang.value = this.craneState.angDeg.toFixed(1);
        }
        if (typeof massTon === 'number') {
            this.craneState.massTon = massTon;
            if (this.dom.m) this.dom.m.value = massTon.toFixed(1);
        }
        if (typeof speed === 'number') {
            this.craneState.speed = speed;
            if (this.dom.v) this.dom.v.value = speed.toFixed(1);
        }
    }

    _initHelicopterUIListeners() {
        const { heliRpm, heliAlt, heliYaw } = this.dom;

        if (heliRpm) {
            heliRpm.addEventListener('input', () => {
                this.helicopterController.targetRpmPct = parseFloat(heliRpm.value);
            });
        }
        if (heliAlt) {
            heliAlt.addEventListener('input', () => {
                this.helicopterController.targetAltitude = parseFloat(heliAlt.value);
            });
        }
        if (heliYaw) {
            heliYaw.addEventListener('input', () => {
                const deg = parseFloat(heliYaw.value);
                this.helicopterController.heliGroup.rotation.y = deg * (Math.PI / 180);
            });
        }
    }

    selectVehicle(vehicle) {
        this.activeVehicle = vehicle;
        const isHeli = (vehicle === 'helicopter');

        const {
            mainDashboard,
            rightTelemetryPanel,
            btnSelectCrane,
            btnSelectHeli,
            craneControlsGroup,
            heliControlsGroup,
            btnCam1,
            cockpitRpmLabel,
            cockpitSteerLabel
        } = this.dom;

        if (btnSelectCrane) btnSelectCrane.className = isHeli ? 'veh-btn' : 'veh-btn active';
        if (btnSelectHeli) btnSelectHeli.className = isHeli ? 'veh-btn active' : 'veh-btn';
        if (craneControlsGroup) craneControlsGroup.style.display = isHeli ? 'none' : 'flex';
        if (heliControlsGroup) heliControlsGroup.style.display = isHeli ? 'flex' : 'none';
        if (rightTelemetryPanel) rightTelemetryPanel.style.display = isHeli ? 'none' : 'flex';
        if (mainDashboard) mainDashboard.classList.toggle('heli-mode', isHeli);
        if (btnCam1) btnCam1.innerText = isHeli ? '1: HELI' : '1: GRÚA';
        if (cockpitRpmLabel) cockpitRpmLabel.innerText = isHeli ? 'TURBINA RPM' : 'DIÉSEL RPM';
        if (cockpitSteerLabel) cockpitSteerLabel.innerText = isHeli ? 'RUMBO' : 'DIRECCIÓN';

        // Recalcular dimensiones del canvas 3D al ocultar/mostrar la barra lateral derecha
        this.sceneManager.handleResize();

        // Al seleccionar el helicóptero, asegurar que el motor esté encendido y enfocar la cámara
        if (isHeli && !this.helicopterController.engineOn) {
            this.toggleHeliEngine();
        }

        this.setCameraMode('orbit');
    }

    toggleHeliEngine() {
        const isOn = this.helicopterController.toggleEngine();
        const btn = this.dom.btnHeliEngine;
        const badge = this.dom.valHeliEngine;
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
            const tipWorld = this.craneModel.getTipWorldPosition();
            this.missionSystem.handleAction(this.winchRigging, tipWorld);
            if (this.winchRigging.isHooked && this.winchRigging.attachedCargo) {
                this.craneState.massTon = this.winchRigging.attachedCargo.massTon;
            }
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
            if (this.dom.fps) {
                this.dom.fps.innerText = `FPS: ${Math.round(1 / Math.max(0.001, dt))}`;
            }
        }

        const isHeliActive = (this.activeVehicle === 'helicopter');

        // 1. Controles de pluma de la grúa con precisión continua y giro 360° sin bloqueo
        if (!isHeliActive) {
            let changed = false;
            if (this.inputManager.isPressed('q')) {
                this.craneState.rotDeg -= 45 * dt;
                if (this.craneState.rotDeg < -180) this.craneState.rotDeg += 360;
                changed = true;
            }
            if (this.inputManager.isPressed('a')) {
                this.craneState.rotDeg += 45 * dt;
                if (this.craneState.rotDeg > 180) this.craneState.rotDeg -= 360;
                changed = true;
            }
            if (this.inputManager.isPressed('w')) {
                this.craneState.ext = Math.min(60, this.craneState.ext + 15 * dt);
                changed = true;
            }
            if (this.inputManager.isPressed('s')) {
                this.craneState.ext = Math.max(10, this.craneState.ext - 15 * dt);
                changed = true;
            }
            if (this.inputManager.isPressed('e')) {
                this.craneState.angDeg = Math.min(85, this.craneState.angDeg + 20 * dt);
                changed = true;
            }
            if (this.inputManager.isPressed('d')) {
                this.craneState.angDeg = Math.max(10, this.craneState.angDeg - 20 * dt);
                changed = true;
            }

            if (changed) {
                if (this.dom.rot && document.activeElement !== this.dom.rot) {
                    this.dom.rot.value = this.craneState.rotDeg.toFixed(1);
                }
                if (this.dom.ext && document.activeElement !== this.dom.ext) {
                    this.dom.ext.value = this.craneState.ext.toFixed(1);
                }
                if (this.dom.ang && document.activeElement !== this.dom.ang) {
                    this.dom.ang.value = this.craneState.angDeg.toFixed(1);
                }
            }
        }

        // Sincronizar si un test o script externo modificó el value del DOM directamente
        if (this.dom.rot && Math.abs(parseFloat(this.dom.rot.value) - this.craneState.rotDeg) > 0.25) {
            this.craneState.rotDeg = parseFloat(this.dom.rot.value);
        }
        if (this.dom.ext && Math.abs(parseFloat(this.dom.ext.value) - this.craneState.ext) > 0.25) {
            this.craneState.ext = parseFloat(this.dom.ext.value);
        }
        if (this.dom.ang && Math.abs(parseFloat(this.dom.ang.value) - this.craneState.angDeg) > 0.25) {
            this.craneState.angDeg = parseFloat(this.dom.ang.value);
        }
        if (this.dom.m) {
            this.craneState.massTon = parseFloat(this.dom.m.value);
        }
        if (this.dom.v) {
            this.craneState.speed = parseFloat(this.dom.v.value);
        }

        const { massTon, speed, rotDeg, ext, angDeg } = this.craneState;
        const rotRad = rotDeg * (Math.PI / 180);
        const angRad = angDeg * (Math.PI / 180);

        if (this.dom.valMass) this.dom.valMass.innerText = massTon.toFixed(1);
        if (this.dom.valSpeed) this.dom.valSpeed.innerText = speed.toFixed(1);
        if (this.dom.valRot) this.dom.valRot.innerText = rotDeg.toFixed(1);
        if (this.dom.valExt) this.dom.valExt.innerText = ext.toFixed(1);
        if (this.dom.valAng) this.dom.valAng.innerText = angDeg.toFixed(1);

        // 2. Actualizar controlador del vehículo Grúa (si está activa) y del Helicóptero UH-60
        if (!isHeliActive) {
            this.craneController.update(this.inputManager, dt, this.sceneManager.camera);
        } else {
            this.craneController.moveDist = 0;
        }
        this.helicopterController.update(dt, timeNow, this.inputManager, isHeliActive, this.sceneManager.camera);

        // Sincronizar badges y sliders del panel de helicóptero
        const heliTel = this.helicopterController.getTelemetry();
        const { heliAlt, heliYaw, valHeliRpm, valHeliAlt, valHeliYaw } = this.dom;

        if (valHeliRpm) valHeliRpm.innerText = `${Math.round(heliTel.rpmPct)}%`;
        if (valHeliAlt) valHeliAlt.innerText = heliTel.altitude.toFixed(1);
        if (valHeliYaw) valHeliYaw.innerText = `${heliTel.yawDeg}°`;
        if (heliAlt && document.activeElement !== heliAlt) {
            heliAlt.value = this.helicopterController.targetAltitude.toFixed(1);
        }
        if (heliYaw && document.activeElement !== heliYaw) {
            heliYaw.value = heliTel.yawDeg;
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
            this.environment,
            rotRad
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
                this.helicopterController.heliGroup.rotation.y,
                heliTel.forwardSpeed,
                true,
                heliTel.isAirborne
            );
        } else {
            const speedKmh = Math.round(Math.abs(this.craneController.vehicleSpeed) * 3.6);
            this.hudManager.updateCockpit(
                speedKmh,
                this.craneController.currentRpm,
                this.craneController.steerAngle,
                this.craneController.vehicleSpeed,
                false,
                false
            );
        }

        // 8. Actualizar telemetría LMI y potencia (solo cuando la Grúa LTM está activa y el panel derecho es visible)
        const activeCargo = this.cargoManager.getActiveCargo();
        if (!isHeliActive) {
            this.hudManager.updateTelemetry(
                rigState.effectiveMass,
                speed,
                ext,
                angDeg,
                null
            );
        }

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

        // 10. Render final de la escena y actualización del Revisor Integrado
        this.sceneManager.render();
        this.integratedReviewer.updateLiveMetrics(timeNow, dt);
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
