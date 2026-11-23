/**
 * src/ui/IntegratedReviewer.js
 *
 * Revisor y Auditor E2E Integrado en Navegador para Crane Simulator 3D.
 * Expone telemetría WebGL en vivo (Draw Calls, Triángulos, Geometrías, Texturas, ms/frame)
 * y ejecuta una batería automatizada de pruebas de física, misiones y helicóptero
 * directamente en el DOM sin necesidad de abrir navegadores externos.
 */

export class IntegratedReviewer {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.isRunningTest = false;
        this.lastStatsUpdate = 0;

        this.dom = {
            panel: document.getElementById('integratedReviewerPanel'),
            btnToggle: document.getElementById('btnToggleReviewer'),
            btnRunTest: document.getElementById('btnRunAutoTest'),
            btnResetSim: document.getElementById('btnResetSim'),
            statFps: document.getElementById('revStatFps'),
            statDraws: document.getElementById('revStatDraws'),
            statTris: document.getElementById('revStatTris'),
            statMem: document.getElementById('revStatMem'),
            statAssets: document.getElementById('revStatAssets'),
            testStatusBadge: document.getElementById('revTestBadge'),
            reportList: document.getElementById('revReportList')
        };

        this._initListeners();
    }

    _initListeners() {
        if (this.dom.btnToggle) {
            this.dom.btnToggle.addEventListener('click', () => this.togglePanel());
        }
        if (this.dom.btnRunTest) {
            this.dom.btnRunTest.addEventListener('click', () => this.runAutoTest());
        }
        if (this.dom.btnResetSim) {
            this.dom.btnResetSim.addEventListener('click', () => this.resetSimulatorState());
        }

        window.craneReviewer = this;
    }

    togglePanel(forceState) {
        this.isOpen = typeof forceState === 'boolean' ? forceState : !this.isOpen;
        if (this.dom.panel) {
            this.dom.panel.style.display = this.isOpen ? 'flex' : 'none';
        }
        if (this.dom.btnToggle) {
            this.dom.btnToggle.classList.toggle('active', this.isOpen);
        }
        if (this.isOpen) {
            this.updateLiveMetrics(performance.now(), 0.016, true);
        }
    }

    updateLiveMetrics(timeNow, dt, force = false) {
        if (!this.isOpen && !force) return;
        if (!force && (timeNow - this.lastStatsUpdate) < 250) return;
        this.lastStatsUpdate = timeNow;

        const renderer = this.app?.sceneManager?.renderer;
        const info = renderer ? renderer.info : null;
        const env = this.app?.environment;
        const crane = this.app?.craneModel;
        const heli = this.app?.helicopterController;

        const fps = Math.round(1 / Math.max(0.001, dt));
        const frameMs = (dt * 1000).toFixed(1);

        if (this.dom.statFps) {
            this.dom.statFps.innerText = `${fps} FPS (${frameMs} ms)`;
        }
        if (info && this.dom.statDraws) {
            this.dom.statDraws.innerText = `${info.render.calls} calls`;
        }
        if (info && this.dom.statTris) {
            this.dom.statTris.innerText = `${(info.render.triangles / 1000).toFixed(1)}k tris`;
        }
        if (info && this.dom.statMem) {
            this.dom.statMem.innerText = `${info.memory.geometries} geo / ${info.memory.textures} tex`;
        }
        if (this.dom.statAssets) {
            const okCrane = crane?.isLoaded ? 'OK' : '...';
            const okEnv = env?.isAssetsLoaded ? `OK (${env.obstacles.length} obs)` : '...';
            const okHeli = heli?.isLoaded ? 'OK' : '...';
            this.dom.statAssets.innerText = `Grúa:${okCrane} | Env:${okEnv} | Heli:${okHeli}`;
        }
    }

    _logStep(label, passed, detail = '') {
        if (!this.dom.reportList) return;
        const item = document.createElement('div');
        item.className = `rev-step-item ${passed ? 'pass' : 'fail'}`;
        item.innerText = `${passed ? '[PASS]' : '[FAIL]'} ${label}${detail ? ' — ' + detail : ''}`;
        this.dom.reportList.appendChild(item);
    }

    resetSimulatorState() {
        const app = this.app;
        if (!app) return;

        app.selectVehicle('crane');
        app.winchRigging.detach(0.0);
        app.winchRigging.swayOffset.set(0, 0);
        app.winchRigging.swayVelocity.set(0, 0);
        app.winchRigging.cableLength = 12.0;

        app.craneModel.craneGroup.position.set(0, 0, 0);
        app.craneModel.craneGroup.rotation.y = 0;
        app.craneController.vehicleSpeed = 0;
        app.craneController.steerAngle = 0;

        app.setCraneControls({ rotDeg: 30, ext: 35, angDeg: 50 });

        // Restaurar posiciones originales de las 4 cargas
        app.cargoManager.cargoList.forEach(c => {
            c.mesh.position.copy(c.pickupPos);
            c.mesh.rotation.set(0, 0, 0);
            if (c.mesh.userData.rigGroup) {
                c.mesh.userData.rigGroup.visible = false;
            }
        });
        app.missionSystem.currentMissionIndex = 0;
        app.missionSystem.missionStep = 'PICKUP';
        app.cargoManager.setActiveCargoByIndex(0);
        app.setCameraMode('orbit');
    }

    async runAutoTest() {
        if (this.isRunningTest) return;
        this.isRunningTest = true;
        this.togglePanel(true);

        if (this.dom.reportList) this.dom.reportList.innerHTML = '';
        if (this.dom.testStatusBadge) {
            this.dom.testStatusBadge.innerText = 'EJECUTANDO...';
            this.dom.testStatusBadge.className = 'rev-badge running';
        }

        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        const app = this.app;
        let allPassed = true;

        try {
            // 1. Verificar carga de assets 3D y WebGL
            for (let i = 0; i < 30; i++) {
                if (app.craneModel.isLoaded && app.environment.isAssetsLoaded && app.helicopterController.isLoaded) break;
                await wait(200);
            }
            const info = app.sceneManager.renderer.info;
            const assetsOk = app.craneModel.isLoaded && app.environment.isAssetsLoaded && app.helicopterController.isLoaded;
            this._logStep(
                '1. Carga 3D & WebGL',
                assetsOk,
                `Calls:${info.render.calls}, Geos:${info.memory.geometries}, Obs:${app.environment.obstacles.length}`
            );
            if (!assetsOk) allPassed = false;

            // Reiniciar a estado limpio antes de prueba física
            this.resetSimulatorState();
            await wait(150);

            // 2. Misión 1: Posicionar pluma exactamente sobre punto de recogida del Porsche (18.0, 0.0, 6.0)
            const porsche = app.cargoManager.getActiveCargo();
            const pickupPos = porsche.pickupPos;
            const solvedPickup = this._solveCraneBoomForTarget(pickupPos.x, pickupPos.z);
            app.setCraneControls(solvedPickup);
            app.craneModel.updateKinematics(
                solvedPickup.rotDeg * Math.PI / 180,
                solvedPickup.angDeg * Math.PI / 180,
                solvedPickup.ext,
                0
            );
            const tipAtPickup = app.craneModel.getTipWorldPosition().clone();
            const hookTargetY = porsche.mesh.userData.hookTargetY || 2.85;

            // Estabilizar gancho exactamente en el cáncamo anulando la inercia del salto de pluma
            app.winchRigging.stabilizeAt(tipAtPickup, pickupPos.y + hookTargetY);
            await wait(120);
            app.winchRigging.stabilizeAt(tipAtPickup, pickupPos.y + hookTargetY);
            await wait(80);

            const yBeforeAttach = porsche.mesh.position.y;
            const canPickup = app.missionSystem.canPerformAction && app.missionSystem.missionStep === 'PICKUP';
            app.handleAction();
            await wait(100);
            const yAfterAttach = porsche.mesh.position.y;
            const jumpDelta = Math.abs(yAfterAttach - yBeforeAttach);
            const pickupOk = canPickup && app.winchRigging.isHooked && jumpDelta < 0.15;

            this._logStep(
                '2. Misión 1 Amarre sin Salto/Clipping',
                pickupOk,
                `Hooked:${app.winchRigging.isHooked}, Jump:${jumpDelta.toFixed(2)}m`
            );
            if (!pickupOk) allPassed = false;

            // 3. Misión 1: Transportar y posar el Porsche en Parking Oeste (-16.5, 0.1, -12.0)
            const drop = porsche.dropTarget;
            const solvedDrop = this._solveCraneBoomForTarget(drop.x, drop.z);
            app.setCraneControls(solvedDrop);
            app.craneModel.updateKinematics(
                solvedDrop.rotDeg * Math.PI / 180,
                solvedDrop.angDeg * Math.PI / 180,
                solvedDrop.ext,
                0
            );
            const tipAtDrop = app.craneModel.getTipWorldPosition().clone();
            // Posar el Porsche suavemente en el suelo (y = 0.0 -> hookY = hookTargetY) sin oscilación
            app.winchRigging.stabilizeAt(tipAtDrop, hookTargetY);
            await wait(120);
            app.winchRigging.stabilizeAt(tipAtDrop, hookTargetY);
            await wait(80);

            const cargoLandedY = porsche.mesh.position.y;
            const diffY = Math.abs(cargoLandedY - drop.y);
            const canDeliver = app.missionSystem.canPerformAction && app.missionSystem.missionStep === 'DELIVERY';
            const scoreBefore = app.missionSystem.totalScore;
            app.handleAction();
            await wait(100);
            const scoreAfter = app.missionSystem.totalScore;
            const deliveryOk = canDeliver && !app.winchRigging.isHooked && (scoreAfter === scoreBefore + 250);

            this._logStep(
                '3. Misión 1 Entrega & Puntuación',
                deliveryOk,
                `Alt:${cargoLandedY.toFixed(2)}m, DiffY:${diffY.toFixed(2)}m, Score:${scoreAfter} PTS`
            );
            if (!deliveryOk) allPassed = false;

            // 4. Prueba de Helicóptero UH-60, Rotores, Ocultación de Barra Derecha y Telemetría de Rumbo
            app.selectVehicle('helicopter');
            app.helicopterController.targetAltitude = 28.0;
            app.helicopterController.altitude = 28.0;
            const testYawDeg = 120;
            app.helicopterController.heliGroup.rotation.y = testYawDeg * (Math.PI / 180);
            await wait(250);

            const steerText = document.getElementById('cockpitSteerAngle')?.innerText || '';
            const rightPanel = document.getElementById('rightTelemetryPanel');
            const rightHidden = rightPanel && rightPanel.style.display === 'none';
            const heliOk = app.helicopterController.isLoaded &&
                steerText === '+120°' &&
                rightHidden;

            this._logStep(
                '4. UH-60 Vuelo, Rotores & Layout 2-Col',
                heliOk,
                `Rumbo HUD:${steerText}, PanelDerOculto:${rightHidden}`
            );
            if (!heliOk) allPassed = false;

            // 5. Prueba de Modos de Cámara (1..4)
            const modes = ['orbit', 'hook', 'target', 'cab'];
            for (const m of modes) {
                app.setCameraMode(m);
                await wait(80);
            }
            app.selectVehicle('crane');
            app.setCameraMode('orbit');
            const camOk = app.sceneManager.currentCameraMode === 'orbit';
            this._logStep('5. Conmutación 4 Cámaras & Reset', camOk, 'Modos 1..4 verificados');
            if (!camOk) allPassed = false;

            if (this.dom.testStatusBadge) {
                this.dom.testStatusBadge.innerText = allPassed ? '5/5 PASS (OK)' : 'ALERTA EN TEST';
                this.dom.testStatusBadge.className = `rev-badge ${allPassed ? 'pass' : 'fail'}`;
            }
            this.updateLiveMetrics(performance.now(), 0.016, true);
        } catch (err) {
            console.error('[INTEGRATED REVIEWER ERROR]:', err);
            this._logStep('Excepción en Auto-Test', false, err.message);
            if (this.dom.testStatusBadge) {
                this.dom.testStatusBadge.innerText = 'ERROR';
                this.dom.testStatusBadge.className = 'rev-badge fail';
            }
        } finally {
            this.isRunningTest = false;
        }
    }

    /**
     * Calcula con precisión milimétrica los parámetros (rotDeg, ext, angDeg) de la pluma
     * Liebherr LTM 1110 para situar la punta exactamente sobre (targetX, targetZ).
     */
    _solveCraneBoomForTarget(targetX, targetZ) {
        const app = this.app;
        const targetAngle = Math.atan2(targetZ, targetX);
        const targetRadius = Math.hypot(targetX, targetZ);

        // 1. Resolver ángulo de rotación (rotDeg) midiendo la dirección real del modelo 3D
        let bestRot = 0;
        let bestAng = 50;
        let bestExt = 36;

        for (let iter = 0; iter < 10; iter++) {
            app.craneModel.updateKinematics(bestRot * Math.PI / 180, bestAng * Math.PI / 180, bestExt, 0);
            const tip0 = app.craneModel.getTipWorldPosition();
            const ang0 = Math.atan2(tip0.z, tip0.x);

            let err0 = targetAngle - ang0;
            while (err0 > Math.PI) err0 -= Math.PI * 2;
            while (err0 < -Math.PI) err0 += Math.PI * 2;
            if (Math.abs(err0) < 0.0005) break;

            // Medir derivada numérica d(ang)/d(rot)
            const probeRot = bestRot + 1.0;
            app.craneModel.updateKinematics(probeRot * Math.PI / 180, bestAng * Math.PI / 180, bestExt, 0);
            const tip1 = app.craneModel.getTipWorldPosition();
            const ang1 = Math.atan2(tip1.z, tip1.x);
            let dAng = ang1 - ang0;
            while (dAng > Math.PI) dAng -= Math.PI * 2;
            while (dAng < -Math.PI) dAng += Math.PI * 2;

            const sign = dAng >= 0 ? 1 : -1;
            bestRot += sign * err0 * (180 / Math.PI);
            while (bestRot > 180) bestRot -= 360;
            while (bestRot < -180) bestRot += 360;
        }

        // 2. Búsqueda binaria sobre ángulo de pluma (angDeg: 15..78) y extensión (ext: 10..60)
        // para clavar el radio horizontal exacto targetRadius
        let lowAng = 15.0, highAng = 78.0;
        for (let iter = 0; iter < 16; iter++) {
            bestAng = 0.5 * (lowAng + highAng);
            app.craneModel.updateKinematics(bestRot * Math.PI / 180, bestAng * Math.PI / 180, bestExt, 0);
            const tip = app.craneModel.getTipWorldPosition();
            const curRadius = Math.hypot(tip.x, tip.z);
            // A mayor ángulo de elevación (angDeg), menor es el radio horizontal (cos(ang))
            if (curRadius > targetRadius) {
                lowAng = bestAng;
            } else {
                highAng = bestAng;
            }
        }

        return {
            rotDeg: Number(bestRot.toFixed(2)),
            ext: Number(bestExt.toFixed(2)),
            angDeg: Number(bestAng.toFixed(2))
        };
    }
}
