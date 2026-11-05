import { THREE } from '../core/three.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
        this.rooftopTarget = { x: -80, y: 70, z: -80, width: 28, depth: 28 };
        this.highestBuildingMesh = null;

        this._buildGround();
        this._buildCity();
        this._buildContainerYard();
    }

    _createIndustrialGroundTexture() {
        const c = document.createElement('canvas');
        c.width = 2048; c.height = 2048;
        const ctx = c.getContext('2d');

        // 1. Asfalto / Hormigón gris industrial base de alta densidad
        ctx.fillStyle = '#252930';
        ctx.fillRect(0, 0, 2048, 2048);

        // 2. Micrograno de árido y textura de desgaste
        for (let i = 0; i < 18000; i++) {
            const rx = Math.random() * 2048;
            const ry = Math.random() * 2048;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.07)';
            ctx.fillRect(rx, ry, 2, 2);
        }

        // 3. Juntas de losa de hormigón (losas de 8x8 metros) con brea oscura
        ctx.strokeStyle = '#15181e';
        ctx.lineWidth = 4;
        for (let x = 0; x <= 2048; x += 256) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2048); ctx.stroke();
        }
        for (let y = 0; y <= 2048; y += 256) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(2048, y); ctx.stroke();
        }

        // 4. Señalización vial industrial: Carriles y marcas de tránsito de maquinaria pesada
        ctx.strokeStyle = 'rgba(240, 243, 248, 0.75)';
        ctx.lineWidth = 8;
        ctx.setLineDash([40, 30]);
        // Calles principales de obra
        ctx.beginPath(); ctx.moveTo(1024, 0); ctx.lineTo(1024, 2048); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 1024); ctx.lineTo(2048, 1024); ctx.stroke();
        ctx.setLineDash([]); // Reset

        // 5. Bahía de estacionamiento de grúa (líneas sólidas de delimitación)
        ctx.strokeStyle = '#e6a100';
        ctx.lineWidth = 10;
        ctx.strokeRect(896, 896, 256, 256);

        // 6. Franjas de advertencia de seguridad (Safety Hazard Stripes amarillo/negro)
        const drawHazardStripes = (x1, y1, w, h) => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(x1, y1, w, h);
            ctx.clip();
            ctx.fillStyle = '#e6a100';
            ctx.fillRect(x1, y1, w, h);
            ctx.fillStyle = '#181b20';
            for (let i = -h; i < w + h; i += 32) {
                ctx.beginPath();
                ctx.moveTo(x1 + i, y1);
                ctx.lineTo(x1 + i + 16, y1);
                ctx.lineTo(x1 + i + 16 - h, y1 + h);
                ctx.lineTo(x1 + i - h, y1 + h);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        };

        drawHazardStripes(128, 128, 400, 24);
        drawHazardStripes(128, 528, 400, 24);
        drawHazardStripes(1400, 256, 500, 28);
        drawHazardStripes(1400, 800, 500, 28);

        // 7. Flechas de circulación en el pavimento
        ctx.fillStyle = 'rgba(240, 245, 255, 0.65)';
        const drawArrow = (ax, ay, rot) => {
            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(rot);
            ctx.beginPath();
            ctx.moveTo(0, -35);
            ctx.lineTo(25, 0);
            ctx.lineTo(10, 0);
            ctx.lineTo(10, 35);
            ctx.lineTo(-10, 35);
            ctx.lineTo(-10, 0);
            ctx.lineTo(-25, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        };

        drawArrow(960, 600, 0);
        drawArrow(1088, 1400, Math.PI);
        drawArrow(600, 1088, Math.PI / 2);
        drawArrow(1400, 960, -Math.PI / 2);

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(4, 4);
        tex.anisotropy = 8;
        return tex;
    }

    _buildGround() {
        const groundTex = this._createIndustrialGroundTexture();
        const planeGeo = new THREE.PlaneGeometry(800, 800);
        const planeMat = new THREE.MeshStandardMaterial({
            map: groundTex,
            roughness: 0.82,
            metalness: 0.15
        });
        const plane = new THREE.Mesh(planeGeo, planeMat);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        this.scene.add(plane);
    }

    _createFacadeTexture(variant = 0) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 1024;
        const ctx = c.getContext('2d');

        // Color de hormigón / acero arquitectónico
        const baseColors = ['#1a202c', '#242b35', '#2c3542'];
        ctx.fillStyle = baseColors[variant % baseColors.length];
        ctx.fillRect(0, 0, 512, 1024);

        // Rejilla de muros cortina con cristales reflectantes
        const cols = 8;
        const rows = 24;
        const padX = 10;
        const padY = 8;
        const cellW = (512 - (cols + 1) * padX) / cols;
        const cellH = (1024 - (rows + 1) * padY) / rows;

        for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
                const x = padX + col * (cellW + padX);
                const y = padY + r * (cellH + padY);

                // Cristal tintado con reflejos de cielo diurno
                const grad = ctx.createLinearGradient(x, y, x, y + cellH);
                grad.addColorStop(0, '#506e8e');
                grad.addColorStop(0.35, '#2b3f54');
                grad.addColorStop(1, '#131e2b');
                ctx.fillStyle = grad;
                ctx.fillRect(x, y, cellW, cellH);

                // Marco de ventana
                ctx.strokeStyle = '#0d131a';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(x, y, cellW, cellH);
            }
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 1);
        return tex;
    }

    _createHelipadTexture() {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');

        // Base de hormigón oscuro de azotea
        ctx.fillStyle = '#1e242d';
        ctx.fillRect(0, 0, 512, 512);

        // Círculo exterior amarillo reflectante
        ctx.strokeStyle = '#e6a100';
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(256, 256, 220, 0, Math.PI * 2);
        ctx.stroke();

        // Círculo interior blanco
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(256, 256, 175, 0, Math.PI * 2);
        ctx.stroke();

        // Letra 'H' de helipuerto en blanco con sombra reflectante
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 190px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', 256, 256);

        // Marcadores de esquina de advertencia
        ctx.fillStyle = '#e6a100';
        ctx.fillRect(16, 16, 40, 40);
        ctx.fillRect(456, 16, 40, 40);
        ctx.fillRect(16, 456, 40, 40);
        ctx.fillRect(456, 456, 40, 40);

        return new THREE.CanvasTexture(c);
    }

    _buildCity() {
        const cityGroup = new THREE.Group();
        this.scene.add(cityGroup);

        const facadeTex1 = this._createFacadeTexture(0);
        const facadeTex2 = this._createFacadeTexture(1);
        const helipadTex = this._createHelipadTexture();

        const bldgMat1 = new THREE.MeshStandardMaterial({
            map: facadeTex1,
            roughness: 0.35,
            metalness: 0.55
        });
        const bldgMat2 = new THREE.MeshStandardMaterial({
            map: facadeTex2,
            roughness: 0.38,
            metalness: 0.60
        });

        const roofMat = new THREE.MeshStandardMaterial({
            color: 0x212832,
            roughness: 0.85,
            metalness: 0.20
        });

        const helipadMat = new THREE.MeshStandardMaterial({
            map: helipadTex,
            roughness: 0.70,
            metalness: 0.25
        });

        const citySize = 350;
        const safeZone = 75;
        let seed = 42;
        let maxTowerH = 0;
        let highestBldgMesh = null;

        const seededRandom = () => {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };

        for (let x = -citySize; x <= citySize; x += 65) {
            for (let z = -citySize; z <= citySize; z += 65) {
                if (Math.abs(x) < safeZone && Math.abs(z) < safeZone) continue;
                if (seededRandom() > 0.55) continue;

                const offsetX = (seededRandom() - 0.5) * 12;
                const offsetZ = (seededRandom() - 0.5) * 12;

                const height = 35 + seededRandom() * 95;
                const width = 20 + seededRandom() * 16;
                const depth = 20 + seededRandom() * 16;

                const posX = x + offsetX;
                const posZ = z + offsetZ;

                const isTower = (height > maxTowerH && Math.abs(posX) < 130 && Math.abs(posZ) < 130);
                if (isTower) {
                    maxTowerH = height;
                    this.rooftopTarget = { x: posX, y: height, z: posZ, width, depth };
                }

                const bMat = (seededRandom() > 0.5) ? bldgMat1 : bldgMat2;
                const topMat = isTower ? helipadMat : roofMat;

                const bGeo = new THREE.BoxGeometry(width, height, depth);
                // Cara superior con techo/helipuerto
                const bldgMesh = new THREE.Mesh(bGeo, [
                    bMat, bMat, topMat, roofMat, bMat, bMat
                ]);
                bldgMesh.position.set(posX, height / 2, posZ);
                bldgMesh.castShadow = true;
                bldgMesh.receiveShadow = true;
                cityGroup.add(bldgMesh);

                if (isTower) highestBldgMesh = bldgMesh;

                // Casetones de azotea (HVAC, caseta de ascensores) para realismo arquitectónico
                const hvacGeo = new THREE.BoxGeometry(width * 0.45, 4.5, depth * 0.45);
                const hvacMat = new THREE.MeshStandardMaterial({ color: 0x3a424e, roughness: 0.6 });
                const hvacMesh = new THREE.Mesh(hvacGeo, hvacMat);
                hvacMesh.position.set(posX + (isTower ? width * 0.25 : 0), height + 2.25, posZ + (isTower ? depth * 0.25 : 0));
                hvacMesh.castShadow = true;
                hvacMesh.receiveShadow = true;
                cityGroup.add(hvacMesh);

                this.obstacles.push({
                    minX: posX - width / 2,
                    maxX: posX + width / 2,
                    minZ: posZ - depth / 2,
                    maxZ: posZ + depth / 2,
                    height: height
                });
            }
        }

        this.highestBuildingMesh = highestBldgMesh;
    }

    _createContainerTexture(baseColorHex, codeText) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 256;
        const ctx = c.getContext('2d');

        ctx.fillStyle = baseColorHex;
        ctx.fillRect(0, 0, 512, 256);

        // Corrugado realista de chapa
        for (let x = 12; x < 500; x += 16) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
            ctx.fillRect(x, 10, 6, 236);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.fillRect(x + 6, 10, 6, 236);
        }

        ctx.lineWidth = 12;
        ctx.strokeStyle = 'rgba(12, 16, 22, 0.85)';
        ctx.strokeRect(6, 6, 500, 244);

        // Cantoneras de izado reforzadas
        ctx.fillStyle = '#181d24';
        ctx.fillRect(2, 2, 28, 28);
        ctx.fillRect(482, 2, 28, 28);
        ctx.fillRect(2, 226, 28, 28);
        ctx.fillRect(482, 226, 28, 28);

        ctx.font = 'bold 22px Roboto Mono, monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(codeText || 'LIEB-40FT', 40, 54);

        return new THREE.CanvasTexture(c);
    }

    _buildContainerYard() {
        const containerColors = [
            { hex: '#0e5f96', code: 'MAERSK' },
            { hex: '#b33927', code: 'K-LINE' },
            { hex: '#d9651e', code: 'HAPAG' },
            { hex: '#1e683b', code: 'EVERGREEN' },
            { hex: '#c99a18', code: 'LIEBHERR' }
        ];

        const containerGeo = new THREE.BoxGeometry(6, 5, 14);
        const cRoofMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.82 });

        const yardStartX = 25;
        const yardStartZ = -30;
        let cIdx = 0;

        for (let row = 0; row < 3; row++) {
            for (let bay = 0; bay < 4; bay++) {
                const stackHeight = 1 + (bay % 3);
                const cx = yardStartX + row * 16;
                const cz = yardStartZ + bay * 18;

                for (let tier = 0; tier < stackHeight; tier++) {
                    const cInfo = containerColors[(cIdx++) % containerColors.length];
                    const cTex = this._createContainerTexture(cInfo.hex, cInfo.code);
                    const cWallMat = new THREE.MeshStandardMaterial({
                        map: cTex,
                        roughness: 0.42,
                        metalness: 0.35
                    });

                    const crate = new THREE.Mesh(containerGeo, [
                        cWallMat, cWallMat, cRoofMat, cRoofMat, cWallMat, cWallMat
                    ]);
                    const cy = 2.5 + tier * 5.05;
                    crate.position.set(cx, cy, cz);
                    crate.castShadow = true;
                    crate.receiveShadow = true;
                    this.scene.add(crate);
                }

                this.obstacles.push({
                    minX: cx - 3.2, maxX: cx + 3.2,
                    minZ: cz - 7.2, maxZ: cz + 7.2,
                    height: stackHeight * 5.05
                });
            }
        }
    }

    getGroundHeightAt(x, z) {
        let maxH = 0;
        for (const obs of this.obstacles) {
            if (x >= obs.minX && x <= obs.maxX && z >= obs.minZ && z <= obs.maxZ) {
                if (obs.height > maxH) maxH = obs.height;
            }
        }
        return maxH;
    }
}
