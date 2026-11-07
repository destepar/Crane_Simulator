/**
 * scripts/test_browser.js
 * 
 * Test runner automatizado en navegador Headless (Edge / Chrome) para Crane Simulator 3D.
 * Utiliza Node.js nativo (HTTP server + WebSocket + Chrome DevTools Protocol).
 * No requiere dependencias externas de npm.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORT = 8899;
const CDP_PORT = 9444;

// MIME types comunes para servidor Three.js
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.bin': 'application/octet-stream',
    '.ico': 'image/x-icon'
};

function findBrowserBinary() {
    const candidates = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        `${process.env.LOCALAPPDATA}\\Microsoft\\Edge SxS\\Application\\msedge.exe`,
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
    ];

    for (const p of candidates) {
        if (p && fs.existsSync(p)) return p;
    }
    return null;
}

// 1. Servidor Estático Interno
function startStaticServer(port) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);
            let safePath = path.normalize(decodeURIComponent(parsedUrl.pathname));
            if (safePath === '/' || safePath === '\\') safePath = '/index.html';

            const filePath = path.join(PROJECT_ROOT, safePath);

            // Prevenir Path Traversal
            if (!filePath.startsWith(PROJECT_ROOT)) {
                res.writeHead(403);
                return res.end('Acceso denegado');
            }

            if (safePath === '/favicon.ico' || safePath === '\\favicon.ico') {
                res.writeHead(204);
                return res.end();
            }

            fs.readFile(filePath, (err, data) => {
                if (err) {
                    if (err.code === 'ENOENT') {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        return res.end(`404 No encontrado: ${safePath}`);
                    }
                    res.writeHead(500);
                    return res.end(`Error de lectura: ${err.message}`);
                }

                const ext = path.extname(filePath).toLowerCase();
                const contentType = MIME_TYPES[ext] || 'application/octet-stream';
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        });

        server.on('error', reject);
        server.listen(port, '127.0.0.1', () => {
            resolve(server);
        });
    });
}

// 2. Cliente CDP sobre WebSocket nativo
class CDPClient {
    constructor(wsUrl) {
        this.wsUrl = wsUrl;
        this.ws = null;
        this.nextId = 1;
        this.callbacks = new Map();
        this.eventListeners = new Map();
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsUrl);
            this.ws.onopen = () => resolve();
            this.ws.onerror = (err) => reject(err);
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.id && this.callbacks.has(data.id)) {
                        const { resolve, reject } = this.callbacks.get(data.id);
                        this.callbacks.delete(data.id);
                        if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
                        else resolve(data.result);
                    } else if (data.method) {
                        const handlers = this.eventListeners.get(data.method) || [];
                        handlers.forEach(h => h(data.params));
                    }
                } catch (e) {
                    console.error('Error parseando mensaje CDP:', e);
                }
            };
        });
    }

    send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            this.callbacks.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    on(event, handler) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(handler);
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 3. Suite de Pruebas
async function runSimulatorTest(options = {}) {
    const port = options.port || DEFAULT_PORT;
    const cdpPort = options.cdpPort || CDP_PORT;
    const screenshotPath = options.screenshot || path.join(PROJECT_ROOT, 'test_screenshot.png');
    const simulateInputs = options.simulateInputs !== false;

    console.log('====================================================');
    console.log('  CRANE SIMULATOR 3D - BROWSER HEADLESS TEST RUNNER ');
    console.log('====================================================');

    const browserBinary = findBrowserBinary();
    if (!browserBinary) {
        throw new Error('No se encontro ningun ejecutable de Edge o Chrome en rutas estandar.');
    }
    console.log(`[INFO] Navegador detectado: ${browserBinary}`);

    // Iniciar Servidor Estático
    console.log(`[INFO] Levantando servidor estatico en http://127.0.0.1:${port}...`);
    const server = await startStaticServer(port);

    // Limpiar restos de perfiles temporales anteriores en la raíz
    try {
        fs.readdirSync(PROJECT_ROOT).forEach(f => {
            if (f.startsWith('.tmp_test_profile_')) {
                try { fs.rmSync(path.join(PROJECT_ROOT, f), { recursive: true, force: true }); } catch (e) {}
            }
        });
    } catch (e) {}

    // Usar directorio temporal del sistema operativo (os.tmpdir()) para no ensuciar el workspace
    const tmpProfileDir = path.join(os.tmpdir(), 'crane_sim_edge_test_' + Date.now());
    fs.mkdirSync(tmpProfileDir, { recursive: true });

    // Lanzar Navegador
    console.log(`[INFO] Lanzando navegador headless con CDP en puerto ${cdpPort}...`);
    const browserProcess = spawn(browserBinary, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${tmpProfileDir}`,
        '--window-size=1280,720',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ]);

    let wsUrl = null;
    const logs = [];
    const errors = [];
    const failedRequests = [];

    // Capturar wsUrl de stderr
    const wsPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout esperando inicio de CDP en navegador')), 15000);
        browserProcess.stderr.on('data', (d) => {
            const str = d.toString();
            const match = str.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-zA-Z0-9\-]+)/);
            if (match && !wsUrl) {
                clearTimeout(timeout);
                wsUrl = match[1];
                resolve(wsUrl);
            }
        });
    });

    try {
        await wsPromise;
        console.log(`[INFO] CDP Conectado: ${wsUrl}`);

        const browserCDP = new CDPClient(wsUrl);
        await browserCDP.connect();

        // Crear una nueva pagina / target
        const targetRes = await browserCDP.send('Target.createTarget', { url: 'about:blank' });
        const targetId = targetRes.targetId;
        const pageWsUrl = `ws://127.0.0.1:${cdpPort}/devtools/page/${targetId}`;

        const pageCDP = new CDPClient(pageWsUrl);
        await pageCDP.connect();

        // Habilitar dominios
        await pageCDP.send('Page.enable');
        await pageCDP.send('Runtime.enable');
        await pageCDP.send('Network.enable');

        pageCDP.on('Runtime.consoleAPICalled', (params) => {
            const text = params.args.map(a => a.value || a.description || '').join(' ');
            logs.push(`[CONSOLE ${params.type.toUpperCase()}] ${text}`);
            if (params.type === 'error') {
                errors.push(text);
            }
        });

        pageCDP.on('Runtime.exceptionThrown', (params) => {
            const desc = params.exceptionDetails.text || params.exceptionDetails.exception?.description;
            errors.push(`[EXCEPTION] ${desc}`);
        });

        pageCDP.on('Network.responseReceived', (params) => {
            if (params.response.status >= 400 && !params.response.url.endsWith('favicon.ico')) {
                failedRequests.push(`${params.response.status} ${params.response.url}`);
            }
        });

        // Navegar a la aplicación
        console.log(`[TEST 1] Navegando a http://127.0.0.1:${port}/index.html...`);
        await pageCDP.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });

        // Esperar evento load
        await new Promise((resolve) => {
            pageCDP.on('Page.loadEventFired', resolve);
            setTimeout(resolve, 3000); // fallback
        });

        console.log('[TEST 2] Esperando inicializacion de Three.js y SimulatorApp...');
        let simulatorReady = false;
        let lastStatus = '';
        for (let i = 0; i < 80; i++) {
            await new Promise(r => setTimeout(r, 250));

            const evalRes = await pageCDP.send('Runtime.evaluate', {
                expression: `(() => {
                    const app = window.simulatorApp;
                    const status = document.getElementById('mainStatus')?.innerText || '';
                    const fps = document.getElementById('fps')?.innerText || '';
                    return {
                        hasApp: !!app,
                        frameCount: app ? app.frameCount : 0,
                        status: status,
                        fps: fps,
                        hasCrane: !!app?.craneModel?.craneGroup,
                        hasObstacles: app?.environment?.obstacles?.length || 0,
                        hasCargos: app?.cargoManager?.cargoList?.length || 0,
                        isAssetsLoaded: app?.environment?.isAssetsLoaded || false
                    };
                })()`,
                returnByValue: true
            });

            const state = evalRes.result?.value;
            if (state) {
                lastStatus = state.status;
                if (state.hasApp && state.frameCount > 15 && state.isAssetsLoaded) {
                    simulatorReady = true;
                    console.log(`[OK] Simulador inicializado con exito!`);
                    console.log(`     - FrameCount: ${state.frameCount}`);
                    console.log(`     - Estado UI: ${state.status}`);
                    console.log(`     - Obstaculos cargados: ${state.hasObstacles}`);
                    console.log(`     - Cargas disponibles: ${state.hasCargos}`);
                    break;
                }
            }
        }

        if (!simulatorReady) {
            throw new Error(`El simulador no alcanzo estado nominal a tiempo. Ultimo estado: ${lastStatus}`);
        }

        // Simular interactividad si está habilitado
        if (simulateInputs) {
            console.log('[TEST 3] Simulando interacciones de controles y camaras...');

            // 1. Cambio de camara a gancho (tecla 2)
            await pageCDP.send('Runtime.evaluate', {
                expression: `window.setCameraMode && window.setCameraMode('hook')`
            });
            await new Promise(r => setTimeout(r, 300));
            console.log('     [OK] Modo de camara cambiado a Gancho (hook)');

            // 2. Cambio de camara a zona (tecla 3)
            await pageCDP.send('Runtime.evaluate', {
                expression: `window.setCameraMode && window.setCameraMode('target')`
            });
            await new Promise(r => setTimeout(r, 300));
            console.log('     [OK] Modo de camara cambiado a Zona (target)');

            // 3. Volver a camara orbital grúa (tecla 1)
            await pageCDP.send('Runtime.evaluate', {
                expression: `window.setCameraMode && window.setCameraMode('orbit')`
            });
            await new Promise(r => setTimeout(r, 300));
            console.log('     [OK] Modo de camara restaurado a Grúa (orbit)');

            // 4. Modificar controles cinemáticos (extensión y rotación)
            const controlsCheck = await pageCDP.send('Runtime.evaluate', {
                expression: `(() => {
                    const rotInput = document.getElementById('rot');
                    const extInput = document.getElementById('ext');
                    if (rotInput && extInput) {
                        rotInput.value = 45;
                        rotInput.dispatchEvent(new Event('input'));
                        extInput.value = 40;
                        extInput.dispatchEvent(new Event('input'));
                        return { rot: rotInput.value, ext: extInput.value };
                    }
                    return null;
                })()`,
                returnByValue: true
            });
            console.log(`     [OK] Controles actualizados: Rot=${controlsCheck.result?.value?.rot}°, Ext=${controlsCheck.result?.value?.ext}m`);

            // Esperar algunos frames para que se aplique la cinematica
            await new Promise(r => setTimeout(r, 500));
        }

        const sceneDump = await pageCDP.send('Runtime.evaluate', {
            expression: 'JSON.stringify((() => { const app = window.simulatorApp; const scene = app.sceneManager.scene; const list = []; scene.traverse(node => { if (node.isMesh) { const wp = new THREE.Vector3(); node.getWorldPosition(wp); list.push({ name: node.name, parent: node.parent ? node.parent.name : null, pos: { x: wp.x.toFixed(1), y: wp.y.toFixed(1), z: wp.z.toFixed(1) }, visible: node.visible }); } }); return { total: list.length, items: list }; })())',
            returnByValue: true
        });
        const dump = JSON.parse(sceneDump.result?.value || '{}');
        console.log('\n=== AUDITORIA DE OBJETOS 3D EN ESCENA ===');
        console.log('Total mallas renderizandose en la escena:', dump?.total);
        if (dump?.items) {
            const buildings = dump.items.filter(i => (i.name && i.name.includes('Residential')) || (i.parent && i.parent.includes('Residential')));
            const poles = dump.items.filter(i => (i.name && (i.name.includes('preset') || i.name.includes('pole'))) || (i.parent && (i.parent.includes('preset') || i.parent.includes('pole'))));
            const barriers = dump.items.filter(i => (i.name && i.name.includes('barrier')) || (i.parent && i.parent.includes('barrier')));
            const vehicles = dump.items.filter(i => (i.name && i.name.includes('covered_car')) || (i.parent && i.parent.includes('covered_car')));
            const boxes = dump.items.filter(i => (i.name && i.name.includes('utility_box')) || (i.parent && i.parent.includes('utility_box')));

            console.log(`- Mallas Edificios Residenciales (Assets3D/residential_buildings_set.glb): ${buildings.length}`);
            buildings.filter(b => b.name.endsWith('_1')).forEach(b => console.log(`   * ${b.parent} en (${b.pos.x}, ${b.pos.y}, ${b.pos.z})`));

            console.log(`- Mallas Postes de Electricidad (Assets3D/modular_electricity_poles): ${poles.length}`);
            console.log(`- Mallas Barreras New Jersey (Assets3D/concrete_road_barrier): ${barriers.length}`);
            console.log(`- Mallas Vehiculos de Servicio (Assets3D/covered_car): ${vehicles.length}`);
            console.log(`- Mallas Casetas Electricas (Assets3D/utility_box): ${boxes.length}`);

            const helis = dump.items.filter(i => (i.name && (i.name.toLowerCase().includes('blackhawk') || i.name.toLowerCase().includes('heli'))) || (i.parent && (i.parent.toLowerCase().includes('blackhawk') || i.parent.toLowerCase().includes('heli'))));
            console.log(`- Mallas Helicoptero (Assets3D/Helicopter.glb): ${helis.length}`);
            helis.forEach(h => console.log(`   * ${h.name} (Parent: ${h.parent}) en (${h.pos.x}, ${h.pos.y}, ${h.pos.z}), visible=${h.visible}`));
        }
        console.log('===========================================\n');

        // Test 4: Comprobacion de Telemetria y Fisiologia
        console.log('[TEST 4] Verificando telemetria y fisica...');
        const telemetryRes = await pageCDP.send('Runtime.evaluate', {
            expression: `(() => {
                const app = window.simulatorApp;
                const tip = app.craneModel.getTipWorldPosition();
                const hookPos = app.winchRigging.hookGroup.position;
                const activeCargo = app.cargoManager.getActiveCargo();
                const mission = app.missionSystem.getCurrentTarget();
                return {
                    tipY: tip.y.toFixed(2),
                    hookY: hookPos.y.toFixed(2),
                    activeCargoType: activeCargo ? activeCargo.type : 'N/A',
                    missionTarget: mission ? mission.name : 'N/A'
                };
            })()`,
            returnByValue: true
        });
        const tele = telemetryRes.result?.value;
        console.log(`     - Punta de pluma Altura: ${tele.tipY}m`);
        console.log(`     - Gancho Altura: ${tele.hookY}m`);
        console.log(`     - Tipo de carga activa: ${tele.activeCargoType}`);
        console.log(`     - Mision activa: ${tele.missionTarget}`);

        // Capturar Screenshot
        console.log(`[TEST 5] Capturando screenshot de verificacion visual: ${path.basename(screenshotPath)}...`);
        const ss = await pageCDP.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(screenshotPath, Buffer.from(ss.data, 'base64'));
        await pageCDP.send('Runtime.evaluate', {
            expression: '(() => { const app = window.simulatorApp; if (app && app.sceneManager) { app.sceneManager.currentCameraMode = "custom"; app.sceneManager.camera.position.set(36, 22, -18); app.sceneManager.controls.target.set(-15, 6, 12); app.sceneManager.controls.update(); } })()'
        });
        await new Promise(r => setTimeout(r, 600));
        const ssWest = await pageCDP.send('Page.captureScreenshot', { format: 'png' });
        const westPath = path.join(PROJECT_ROOT, 'test_screenshot_west.png');
        fs.writeFileSync(westPath, Buffer.from(ssWest.data, 'base64'));
        console.log(`[OK] Screenshot Sector Oeste guardado en: ${westPath}`);

        // Vista directa al Helipuerto y Helicoptero en vuelo con selector activo
        await pageCDP.send('Runtime.evaluate', {
            expression: '(() => { const app = window.simulatorApp; if (app) { app.selectVehicle("helicopter"); app.helicopterController.targetAltitude = 8.5; app.helicopterController.forwardSpeed = 12.0; } })()'
        });
        await new Promise(r => setTimeout(r, 900));
        const heliStateRes = await pageCDP.send('Runtime.evaluate', {
            expression: '(() => { const h = window.simulatorApp.helicopterController; return { loaded: h.isLoaded, rotorAngle: h.rotorAngle, alt: h.altitude, mainChildren: h.mainRotorPivot ? h.mainRotorPivot.children.length : 0, tailChildren: h.tailRotorPivot ? h.tailRotorPivot.children.length : 0 }; })()',
            returnByValue: true
        });
        console.log('[TEST HELI] Estado Rotor y Vuelo:', heliStateRes.result?.value);
        const ssHeli = await pageCDP.send('Page.captureScreenshot', { format: 'png' });
        const heliPath = path.join(PROJECT_ROOT, 'heli_screenshot.png');
        fs.writeFileSync(heliPath, Buffer.from(ssHeli.data, 'base64'));
        console.log(`[OK] Screenshot Helicoptero guardado en: ${heliPath}`);
        console.log(`[OK] Screenshot guardado correctamente en: ${screenshotPath}`);

        // Resultados
        console.log('\n====================================================');
        console.log('                 RESUMEN DEL TEST                   ');
        console.log('====================================================');
        console.log(`- Solicitudes HTTP fallidas (404/500): ${failedRequests.length}`);
        if (failedRequests.length > 0) {
            failedRequests.forEach(req => console.warn(`   ! FALLO: ${req}`));
        }

        console.log(`- Errores de consola / excepciones JS: ${errors.length}`);
        if (errors.length > 0) {
            errors.forEach(err => console.error(`   ! ERROR: ${err}`));
        }

        console.log('\n--- TODOS LOS LOGS DEL NAVEGADOR ---');
        console.log(logs.join('\n'));
        console.log('-------------------------------------\n');

        const success = errors.length === 0 && failedRequests.length === 0;
        console.log(`\nESTADO GENERAL: ${success ? '>>> SUPERADO CON EXITO (PASSED) <<<' : '>>> FALLIDO CON ALERTAS (FAILED) <<<'}`);
        console.log('====================================================\n');

        pageCDP.close();
        browserCDP.close();

        return {
            success,
            errors,
            failedRequests,
            telemetry: tele,
            screenshotPath
        };

    } finally {
        // Limpieza forzosa de procesos y servidores
        try {
            if (process.platform === 'win32' && browserProcess && browserProcess.pid) {
                require('child_process').execSync('taskkill /pid ' + browserProcess.pid + ' /f /t', { stdio: 'ignore' });
            } else if (browserProcess) {
                browserProcess.kill('SIGKILL');
            }
        } catch (e) { }
        try { server.close(); } catch (e) { }

        // Borrado robusto del directorio temporal de pruebas
        for (let r = 0; r < 5; r++) {
            try {
                if (fs.existsSync(tmpProfileDir)) {
                    fs.rmSync(tmpProfileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
                }
                break;
            } catch (e) {
                const stop = Date.now() + 150;
                while (Date.now() < stop) {}
            }
        }
    }
}

// Ejecución directa desde CLI
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' && args[i + 1]) options.port = parseInt(args[++i], 10);
        if (args[i] === '--screenshot' && args[i + 1]) options.screenshot = path.resolve(args[++i]);
    }

    runSimulatorTest(options)
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('\n[ERROR CRITICO EN RUNNER]:', err);
            process.exit(1);
        });
}

module.exports = { runSimulatorTest };
