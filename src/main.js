import { THREE } from './core/three.js?v=construction_v1';
import { SceneManager } from './core/SceneManager.js?v=construction_v1';
import { InputManager } from './core/InputManager.js?v=construction_v1';
import { Environment } from './environment/Environment.js?v=construction_v1';
import { CraneModel } from './crane/CraneModel.js?v=construction_v1';
import { CraneController } from './crane/CraneController.js?v=construction_v1';
import { WinchRigging } from './crane/WinchRigging.js?v=construction_v1';
import { CargoManager } from './systems/CargoManager.js?v=construction_v1';
import { MissionSystem } from './systems/MissionSystem.js?v=construction_v1';
import { HUDManager } from './ui/HUDManager.js?v=construction_v1';

class SimulatorApp {
    constructor() {
        this.sceneManager = new SceneManager();
        this.environment = new Environment(this.sceneManager.scene);
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

        // Exponer setCameraMode al objeto global para botones HTML onclick
        window.setCameraMode = (mode) => this.setCameraMode(mode);

        this.lastTime = performance.now();
        this.frameCount = 0;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    handleAction() {
        this.missionSystem.handleAction(this.winchRigging);
    }

    setCameraMode(mode) {
        const activeCargo = this.cargoManager.getActiveCargo();
        const activeTarget = this.missionSystem.getCurrentTarget();

        this.sceneManager.setCameraMode(mode, {
            loadMesh: this.winchRigging.isHooked && activeCargo ? activeCargo.mesh : this.winchRigging.hookGroup,
            activeMission: activeTarget,
            cabinNode: this.craneModel.cabinNode
        });
    }

    animate() {
        requestAnimationFrame(this.animate);

        const timeNow = performance.now();
        const dt = (timeNow - this.lastTime) / 1000;
        this.lastTime = timeNow;

        this.frameCount++;
        if (this.frameCount % 10 === 0) {
            const fpsEl = document.getElementById('fps');
            if (fpsEl) fpsEl.innerText = `FPS: ${Math.round(1 / dt)}`;
        }

        // 1. Sincronizar sliders y teclas de pluma (Q/A, W/S, E/D)
        const elRot = document.getElementById('rot');
        const elExt = document.getElementById('ext');
        const elAng = document.getElementById('ang');

        if (this.inputManager.isPressed('q')) elRot.value = parseFloat(elRot.value) - 45 * dt;
        if (this.inputManager.isPressed('a')) elRot.value = parseFloat(elRot.value) + 45 * dt;
        if (this.inputManager.isPressed('w')) elExt.value = parseFloat(elExt.value) + 15 * dt;
        if (this.inputManager.isPressed('s')) elExt.value = parseFloat(elExt.value) - 15 * dt;
        if (this.inputManager.isPressed('e')) elAng.value = parseFloat(elAng.value) + 20 * dt;
        if (this.inputManager.isPressed('d')) elAng.value = parseFloat(elAng.value) - 20 * dt;

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

        // 2. Actualizar controlador del vehículo (Ackermann, colisiones, RPMs)
        this.craneController.update(this.inputManager, dt, this.sceneManager.camera);

        // 3. Actualizar cinemática de la grúa (cabina, pluma, cilindros hidráulicos, telescopaje, ruedas)
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

        // 7. Actualizar display LICCON de cabina
        const speedKmh = Math.round(Math.abs(this.craneController.vehicleSpeed) * 3.6);
        this.hudManager.updateCockpit(
            speedKmh,
            this.craneController.currentRpm,
            this.craneController.steerAngle,
            this.craneController.vehicleSpeed
        );

        // 8. Actualizar telemetría LMI y potencia
        const activeCargo = this.cargoManager.getActiveCargo();
        this.hudManager.updateTelemetry(
            rigState.effectiveMass,
            speed,
            ext,
            angDeg,
            null
        );

        // 9. Seguimiento dinámico de cámara según modo activo
        const currentTarget = this.missionSystem.getCurrentTarget();
        this.sceneManager.updateCameraFollow({
            loadMesh: this.winchRigging.isHooked && activeCargo ? activeCargo.mesh : this.winchRigging.hookGroup,
            activeMission: currentTarget,
            cranePosition: this.craneModel.craneGroup.position,
            tipWorld
        });

        // 10. Render final de la escena
        this.sceneManager.render();
    }
}

// Iniciar aplicación cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
    window.simulatorApp = new SimulatorApp();
});
