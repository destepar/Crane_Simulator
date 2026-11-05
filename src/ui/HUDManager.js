import { MAX_MOMENT, MAX_HP_ENGINE, G } from '../config/constants.js';

export class HUDManager {
    constructor() {
        this.loadCanvas = document.getElementById('loadChartCanvas');
        this.ctxLoad = this.loadCanvas.getContext('2d');

        this._init2DCanvas();
    }

    _init2DCanvas() {
        const resize = () => {
            if (this.loadCanvas) {
                this.loadCanvas.width = this.loadCanvas.clientWidth;
                this.loadCanvas.height = this.loadCanvas.clientHeight;
            }
        };
        window.addEventListener('resize', resize);
        resize();
    }

    updateCockpit(speedKmh, rpm, steerAngleRad, vehicleSpeed) {
        const steerDeg = Math.round(steerAngleRad * (180 / Math.PI));

        const elSpeed = document.getElementById('cockpitSpeed');
        if (elSpeed) elSpeed.innerText = speedKmh;

        const elRpm = document.getElementById('cockpitRpm');
        if (elRpm) elRpm.innerText = Math.round(rpm);

        const elSteer = document.getElementById('cockpitSteerAngle');
        if (elSteer) elSteer.innerText = `${steerDeg > 0 ? '+' : ''}${steerDeg}°`;

        const barSpeed = document.getElementById('speedBarFill');
        if (barSpeed) barSpeed.style.width = `${Math.min(100, (Math.abs(vehicleSpeed) / 14.0) * 100)}%`;

        const barRpm = document.getElementById('rpmBarFill');
        if (barRpm) {
            const rpmPercent = Math.min(100, Math.max(0, ((rpm - 600) / 1400) * 100));
            barRpm.style.width = `${rpmPercent}%`;
        }

        const elWheel = document.getElementById('cockpitWheel');
        if (elWheel) elWheel.style.transform = `rotate(${steerDeg * 2.2}deg)`;

        const bR = document.getElementById('badgeR');
        const bN = document.getElementById('badgeN');
        const bD = document.getElementById('badgeD');
        if (bR && bN && bD) {
            bR.className = 'gear-slot';
            bN.className = 'gear-slot';
            bD.className = 'gear-slot';
            if (vehicleSpeed > 0.2) {
                bD.className = 'gear-slot active gear-d';
            } else if (vehicleSpeed < -0.2) {
                bR.className = 'gear-slot active gear-r';
            } else {
                bN.className = 'gear-slot active gear-n';
            }
        }
    }

    updateTelemetry(massTon, speed, ext, angDeg, loadMeshMaterial) {
        const angRad = angDeg * (Math.PI / 180);
        const radius = ext * Math.cos(angRad);
        const moment = massTon * radius;
        const power_kW = (massTon * 1000 * G * speed) / 1000 / 0.75;
        const power_HP = power_kW * 1.34102;
        const isOverload = moment > MAX_MOMENT;

        // Potencia en HP
        const elHP = document.getElementById('outHP');
        if (elHP) elHP.innerText = power_HP.toFixed(0);

        const gaugeHP = document.getElementById('gaugeHP');
        if (gaugeHP) {
            const colorHP = power_HP > MAX_HP_ENGINE * 0.8 ? '#f85149' : (power_HP > MAX_HP_ENGINE * 0.5 ? '#d29922' : '#3fb950');
            gaugeHP.style.setProperty('--p', `${Math.min((power_HP / MAX_HP_ENGINE) * 360, 360)}deg`);
            gaugeHP.style.background = `conic-gradient(${colorHP} var(--p), #222 0deg)`;
        }

        // Radio y Carga
        const outRadius = document.getElementById('outRadius');
        if (outRadius) outRadius.innerText = `${radius.toFixed(1)} m`;

        const outLoad = document.getElementById('outLoad');
        if (outLoad) outLoad.innerText = `${massTon.toFixed(1)} T`;

        // Momento y Alerta de vuelco
        const momentEl = document.getElementById('outMoment');
        const mainStatus = document.getElementById('mainStatus');
        if (momentEl) momentEl.innerText = moment.toFixed(1);

        if (mainStatus) {
            if (isOverload) {
                if (momentEl) momentEl.className = 'big-data warning-text';
                mainStatus.innerText = "PELIGRO: VUELCO ESTRUCTURAL";
                mainStatus.style.background = "#f85149";
                if (loadMeshMaterial) loadMeshMaterial.color.setHex(0xf85149);
            } else {
                if (momentEl) {
                    momentEl.className = 'big-data';
                    momentEl.style.color = moment > MAX_MOMENT * 0.8 ? '#d29922' : '#f6e05e';
                }
                mainStatus.innerText = moment > MAX_MOMENT * 0.8 ? "ADVERTENCIA: LÍMITE LMI" : "SISTEMA NOMINAL";
                mainStatus.style.background = moment > MAX_MOMENT * 0.8 ? "#d29922" : "#2ea043";
                if (loadMeshMaterial) loadMeshMaterial.color.setHex(0xe11d48);
            }
        }

        // Gráfico LMI 2D Canvas
        if (this.loadCanvas && this.ctxLoad) {
            const wL = this.loadCanvas.width;
            const hL = this.loadCanvas.height;
            this.ctxLoad.clearRect(0, 0, wL, hL);

            this.ctxLoad.beginPath();
            this.ctxLoad.moveTo(0, hL);
            for (let r = 1; r <= 70; r++) {
                this.ctxLoad.lineTo((r / 70) * wL, hL - ((Math.min(MAX_MOMENT / r, 60) / 60) * hL));
            }
            this.ctxLoad.lineTo(wL, hL);
            this.ctxLoad.fillStyle = 'rgba(63, 185, 80, 0.15)';
            this.ctxLoad.fill();
            this.ctxLoad.strokeStyle = '#3fb950';
            this.ctxLoad.lineWidth = 2;
            this.ctxLoad.stroke();

            this.ctxLoad.beginPath();
            this.ctxLoad.arc((radius / 70) * wL, hL - ((massTon / 60) * hL), 6, 0, Math.PI * 2);
            this.ctxLoad.fillStyle = isOverload ? '#f85149' : '#58a6ff';
            this.ctxLoad.fill();
            this.ctxLoad.strokeStyle = '#fff';
            this.ctxLoad.stroke();
        }
    }
}
