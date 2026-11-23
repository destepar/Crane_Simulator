import { MAX_MOMENT, MAX_HP_ENGINE, G } from '../config/constants.js';

export class HUDManager {
    constructor() {
        this.loadCanvas = document.getElementById('loadChartCanvas');
        this.ctxLoad = this.loadCanvas ? this.loadCanvas.getContext('2d') : null;

        // Cachear referencias DOM para evitar consultas por frame
        this.dom = {
            cockpitGearLabel: document.getElementById('cockpitGearLabel'),
            cockpitSpeed: document.getElementById('cockpitSpeed'),
            cockpitRpm: document.getElementById('cockpitRpm'),
            cockpitSteerAngle: document.getElementById('cockpitSteerAngle'),
            speedBarFill: document.getElementById('speedBarFill'),
            rpmBarFill: document.getElementById('rpmBarFill'),
            cockpitWheel: document.getElementById('cockpitWheel'),
            badgeR: document.getElementById('badgeR'),
            badgeN: document.getElementById('badgeN'),
            badgeD: document.getElementById('badgeD'),
            engineCardTitle: document.getElementById('engineCardTitle'),
            outHP: document.getElementById('outHP'),
            gaugeHP: document.getElementById('gaugeHP'),
            outRadius: document.getElementById('outRadius'),
            outLoad: document.getElementById('outLoad'),
            outMoment: document.getElementById('outMoment'),
            mainStatus: document.getElementById('mainStatus')
        };

        this._lastRadius = null;
        this._lastMass = null;
        this._lastOverload = null;

        this._init2DCanvas();
    }

    _init2DCanvas() {
        this._syncCanvasSize = () => {
            if (!this.loadCanvas) return false;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const cw = this.loadCanvas.clientWidth;
            const ch = this.loadCanvas.clientHeight;
            if (cw <= 0 || ch <= 0) return false;
            const targetW = Math.round(cw * dpr);
            const targetH = Math.round(ch * dpr);
            if (this.loadCanvas.width !== targetW || this.loadCanvas.height !== targetH) {
                this.loadCanvas.width = targetW;
                this.loadCanvas.height = targetH;
                this._dpr = dpr;
                this._cssW = cw;
                this._cssH = ch;
                this._lastRadius = null; // Forzar redibujado
            }
            return true;
        };
        window.addEventListener('resize', this._syncCanvasSize);
        this._syncCanvasSize();
    }

    updateCockpit(speedKmh, rpm, steerAngleRad, vehicleSpeed, isHeli = false, isAirborne = false) {
        const steerDeg = Math.round(steerAngleRad * (180 / Math.PI));

        if (this.dom.cockpitSpeed) this.dom.cockpitSpeed.innerText = speedKmh;
        if (this.dom.cockpitRpm) this.dom.cockpitRpm.innerText = Math.round(rpm);
        if (this.dom.cockpitSteerAngle) {
            this.dom.cockpitSteerAngle.innerText = `${steerDeg > 0 ? '+' : ''}${steerDeg}°`;
        }

        if (this.dom.speedBarFill) {
            const maxSpd = isHeli ? 22.0 : 14.0;
            this.dom.speedBarFill.style.width = `${Math.min(100, (Math.abs(vehicleSpeed) / maxSpd) * 100)}%`;
        }

        if (this.dom.rpmBarFill) {
            const rpmPercent = isHeli
                ? Math.min(100, Math.max(0, (rpm / 1950) * 100))
                : Math.min(100, Math.max(0, ((rpm - 600) / 1400) * 100));
            this.dom.rpmBarFill.style.width = `${rpmPercent}%`;
        }

        if (this.dom.cockpitWheel) {
            const wheelRot = isHeli ? steerDeg : steerDeg * 2.2;
            this.dom.cockpitWheel.style.transform = `rotate(${wheelRot}deg)`;
        }

        const bR = this.dom.badgeR;
        const bN = this.dom.badgeN;
        const bD = this.dom.badgeD;
        if (bR && bN && bD) {
            if (isHeli) {
                if (this.dom.cockpitGearLabel) this.dom.cockpitGearLabel.innerText = 'VUELO';
                bR.innerText = 'GND';
                bN.innerText = 'HVR';
                bD.innerText = 'FLT';
                bR.className = 'gear-slot';
                bN.className = 'gear-slot';
                bD.className = 'gear-slot';
                if (!isAirborne) {
                    bR.className = 'gear-slot active gear-n';
                } else if (Math.abs(vehicleSpeed) > 1.5) {
                    bD.className = 'gear-slot active gear-d';
                } else {
                    bN.className = 'gear-slot active gear-d';
                }
            } else {
                if (this.dom.cockpitGearLabel) this.dom.cockpitGearLabel.innerText = 'MARCHA';
                bR.innerText = 'R';
                bN.innerText = 'N';
                bD.innerText = 'D';
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
    }

    updateTelemetry(massTon, speed, ext, angDeg, loadMeshMaterial, heliTel = null) {
        const angRad = angDeg * (Math.PI / 180);
        const radius = ext * Math.cos(angRad);
        const moment = massTon * radius;
        const isOverload = moment > MAX_MOMENT;

        let power_HP = 0;
        let maxHP = MAX_HP_ENGINE;

        if (heliTel) {
            if (this.dom.engineCardTitle) this.dom.engineCardTitle.innerText = 'Turbina GE T700 (UH-60)';
            maxHP = 1800;
            const baseHP = (heliTel.rpmPct / 100) * 620;
            const hoverHP = heliTel.isAirborne ? 540 : 0;
            const climbOrFwdHP = Math.abs(heliTel.forwardSpeed) * 24;
            power_HP = Math.min(maxHP, baseHP + hoverHP + climbOrFwdHP);
        } else {
            if (this.dom.engineCardTitle) this.dom.engineCardTitle.innerText = 'Rendimiento Motor Diésel';
            const power_kW = (massTon * 1000 * G * speed) / 1000 / 0.75;
            power_HP = power_kW * 1.34102;
        }

        // Potencia en HP
        if (this.dom.outHP) this.dom.outHP.innerText = power_HP.toFixed(0);

        if (this.dom.gaugeHP) {
            const colorHP = power_HP > maxHP * 0.8 ? '#f85149' : (power_HP > maxHP * 0.5 ? '#d29922' : '#3fb950');
            this.dom.gaugeHP.style.setProperty('--p', `${Math.min((power_HP / maxHP) * 360, 360)}deg`);
            this.dom.gaugeHP.style.background = `conic-gradient(${colorHP} var(--p), #222 0deg)`;
        }

        // Radio y Carga
        if (this.dom.outRadius) this.dom.outRadius.innerText = `${radius.toFixed(1)} m`;
        if (this.dom.outLoad) this.dom.outLoad.innerText = `${massTon.toFixed(1)} T`;

        // Momento y Alerta de vuelco
        const momentEl = this.dom.outMoment;
        const mainStatus = this.dom.mainStatus;
        if (momentEl) momentEl.innerText = moment.toFixed(1);

        if (mainStatus && mainStatus.innerText !== 'INICIALIZANDO...' && !mainStatus.innerText.startsWith('CARGANDO')) {
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

        // Gráfico LMI 2D Moderno con Cuadrícula Técnica: garantiza tamaño válido incluso tras ocultar/mostrar panel
        if (this.loadCanvas && this.ctxLoad) {
            if (!this._syncCanvasSize()) return;

            const changed = (
                this._lastRadius === null ||
                Math.abs(radius - this._lastRadius) > 0.04 ||
                Math.abs(massTon - this._lastMass) > 0.04 ||
                isOverload !== this._lastOverload
            );
            if (!changed) return;

            this._lastRadius = radius;
            this._lastMass = massTon;
            this._lastOverload = isOverload;

            const ctx = this.ctxLoad;
            const dpr = this._dpr || 1;
            const w = this._cssW || this.loadCanvas.width;
            const h = this._cssH || this.loadCanvas.height;

            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            // Fondo técnico oscuro con ligero degradado
            const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
            bgGrad.addColorStop(0, '#0a0e14');
            bgGrad.addColorStop(1, '#0d131c');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, w, h);

            const padL = 22;
            const padR = 8;
            const padT = 10;
            const padB = 16;
            const plotW = Math.max(10, w - padL - padR);
            const plotH = Math.max(10, h - padT - padB);
            const maxR = 60; // Radio máximo representado (m)
            const maxM = 50; // Masa máxima representada (T)

            const toX = (r) => padL + Math.min(1, Math.max(0, r / maxR)) * plotW;
            const toY = (m) => padT + plotH - Math.min(1, Math.max(0, m / maxM)) * plotH;

            // 1. Cuadrícula técnica (Sub-grid y Grid principal)
            ctx.lineWidth = 1;
            ctx.font = '600 8px "Roboto Mono", monospace';

            // Líneas verticales de Radio (cada 10m)
            for (let r = 0; r <= maxR; r += 10) {
                const x = Math.round(toX(r)) + 0.5;
                ctx.strokeStyle = (r % 20 === 0) ? 'rgba(88, 166, 255, 0.22)' : 'rgba(88, 166, 255, 0.10)';
                ctx.beginPath();
                ctx.moveTo(x, padT);
                ctx.lineTo(x, padT + plotH);
                ctx.stroke();

                if (r > 0 && r % 20 === 0) {
                    ctx.fillStyle = '#6e7681';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${r}m`, x, h - 4);
                }
            }

            // Líneas horizontales de Carga (cada 10T)
            for (let m = 0; m <= maxM; m += 10) {
                const y = Math.round(toY(m)) + 0.5;
                ctx.strokeStyle = (m % 20 === 0) ? 'rgba(88, 166, 255, 0.22)' : 'rgba(88, 166, 255, 0.10)';
                ctx.beginPath();
                ctx.moveTo(padL, y);
                ctx.lineTo(padL + plotW, y);
                ctx.stroke();

                if (m > 0 && m % 20 === 0) {
                    ctx.fillStyle = '#6e7681';
                    ctx.textAlign = 'right';
                    ctx.fillText(`${m}T`, padL - 3, y + 3);
                }
            }

            // 2. Área segura bajo la curva límite LMI (MAX_MOMENT)
            ctx.save();
            ctx.beginPath();
            ctx.rect(padL, padT, plotW, plotH);
            ctx.clip();

            const areaGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
            areaGrad.addColorStop(0, 'rgba(88, 166, 255, 0.28)');
            areaGrad.addColorStop(0.6, 'rgba(63, 185, 80, 0.16)');
            areaGrad.addColorStop(1, 'rgba(63, 185, 80, 0.04)');

            ctx.beginPath();
            ctx.moveTo(toX(0), toY(0));
            for (let r = 1; r <= maxR; r += 1) {
                const limitM = Math.min(maxM, MAX_MOMENT / r);
                ctx.lineTo(toX(r), toY(limitM));
            }
            ctx.lineTo(toX(maxR), toY(0));
            ctx.closePath();
            ctx.fillStyle = areaGrad;
            ctx.fill();

            // 3. Curva de pre-aviso (80% LMI) punteada en ámbar
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            for (let r = 1; r <= maxR; r += 1) {
                const warnM = Math.min(maxM, (MAX_MOMENT * 0.8) / r);
                const px = toX(r), py = toY(warnM);
                if (r === 1) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = 'rgba(210, 153, 34, 0.75)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.setLineDash([]);

            // 4. Curva límite estructural (100% LMI) en azul/verde brillante
            ctx.beginPath();
            for (let r = 1; r <= maxR; r += 1) {
                const limitM = Math.min(maxM, MAX_MOMENT / r);
                const px = toX(r), py = toY(limitM);
                if (r === 1) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 2.0;
            ctx.stroke();

            // 5. Guías láser (crosshair) y Punto Operativo Actual (Radio, Carga)
            const ptX = toX(radius);
            const ptY = toY(massTon);
            const ptColor = isOverload ? '#f85149' : (moment > MAX_MOMENT * 0.8 ? '#f6e05e' : '#58a6ff');

            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = isOverload ? 'rgba(248, 81, 73, 0.65)' : 'rgba(88, 166, 255, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ptX, padT + plotH);
            ctx.lineTo(ptX, ptY);
            ctx.moveTo(padL, ptY);
            ctx.lineTo(ptX, ptY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Halo exterior del punto operativo
            ctx.beginPath();
            ctx.arc(ptX, ptY, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = isOverload ? 'rgba(248, 81, 73, 0.28)' : 'rgba(88, 166, 255, 0.28)';
            ctx.fill();

            // Núcleo del punto operativo
            ctx.beginPath();
            ctx.arc(ptX, ptY, 3.8, 0, Math.PI * 2);
            ctx.fillStyle = ptColor;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            ctx.restore();

            // 6. Marco del área de trazado y badge % LMI en esquina superior derecha
            ctx.strokeStyle = 'rgba(88, 166, 255, 0.32)';
            ctx.lineWidth = 1;
            ctx.strokeRect(padL + 0.5, padT + 0.5, plotW - 1, plotH - 1);

            const lmiPct = Math.min(999, Math.round((moment / MAX_MOMENT) * 100));
            ctx.font = 'bold 9px "Orbitron", sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = ptColor;
            ctx.fillText(`LMI ${lmiPct}%`, padL + plotW - 4, padT + 11);

            ctx.restore();
        }
    }
}
