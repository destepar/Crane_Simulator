import { THREE, OrbitControls } from './three.js';

export class SceneManager {
    constructor(containerId = 'canvas3DContainer') {
        this.container = document.getElementById(containerId);
        this.currentCameraMode = 'orbit'; // 'orbit', 'hook', 'target', 'cab'

        this._initScene();
        this._initCamera();
        this._initRenderer();
        this._initControls();
        this._initEnvironment();
        this._initLights();
        this._initEvents();
    }

    _initScene() {
        this.scene = new THREE.Scene();
        this.skyColor = new THREE.Color(0x8ec2f2);
        this.scene.background = this.skyColor;
        this.scene.fog = new THREE.Fog(0xbad7f5, 180, 950);
    }

    _initCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 2000);
        this.camera.position.set(-85, 55, 95);
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.10;
        this.container.appendChild(this.renderer.domElement);
    }

    _initControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 12, 0);
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
        this.controls.update();
    }

    _initEnvironment() {
        const pmremGen = new THREE.PMREMGenerator(this.renderer);
        pmremGen.compileEquirectangularShader();

        const envScene = new THREE.Scene();
        const skyDomeGeo = new THREE.SphereGeometry(150, 24, 16);
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 1024; skyCanvas.height = 512;
        const sCtx = skyCanvas.getContext('2d');
        const sGrad = sCtx.createLinearGradient(0, 0, 0, 512);
        sGrad.addColorStop(0, '#1d68be');    // Azul cielo profundo en cenit
        sGrad.addColorStop(0.42, '#a8cdfa'); // Dispersión diurna en horizonte
        sGrad.addColorStop(0.50, '#dbe9fa'); // Banda de horizonte luminosa
        sGrad.addColorStop(0.53, '#4a515e'); // Rebote de losa de hormigón
        sGrad.addColorStop(1, '#242830');
        sCtx.fillStyle = sGrad;
        sCtx.fillRect(0, 0, 1024, 512);

        const skyDomeTex = new THREE.CanvasTexture(skyCanvas);
        const skyDomeMat = new THREE.MeshBasicMaterial({ map: skyDomeTex, side: THREE.BackSide });
        envScene.add(new THREE.Mesh(skyDomeGeo, skyDomeMat));

        const sunReflectLight = new THREE.DirectionalLight(0xfff4e6, 3.0);
        sunReflectLight.position.set(120, 200, 80);
        envScene.add(sunReflectLight);

        this.envTexture = pmremGen.fromScene(envScene).texture;
        this.scene.environment = this.envTexture;
    }

    _initLights() {
        this.hemiLight = new THREE.HemisphereLight(0x7bb7f5, 0x3a4049, 1.35);
        this.hemiLight.position.set(0, 150, 0);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xfff8ee, 2.65);
        this.dirLight.position.set(140, 240, 100);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 4096;
        this.dirLight.shadow.mapSize.height = 4096;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 600;
        this.dirLight.shadow.camera.left = -170;
        this.dirLight.shadow.camera.right = 170;
        this.dirLight.shadow.camera.top = 170;
        this.dirLight.shadow.camera.bottom = -170;
        this.dirLight.shadow.bias = -0.0003;
        this.dirLight.shadow.normalBias = 0.038;
        this.scene.add(this.dirLight);

        this.fillLight = new THREE.DirectionalLight(0x9bc2f0, 0.75);
        this.fillLight.position.set(-110, 80, -90);
        this.scene.add(this.fillLight);
    }

    _initEvents() {
        window.addEventListener('resize', () => {
            const w = this.container.clientWidth;
            const h = this.container.clientHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        });
    }

    setCameraMode(mode, context = {}) {
        this.currentCameraMode = mode;

        const btns = { orbit: 'btnCam1', hook: 'btnCam2', target: 'btnCam3', cab: 'btnCam4' };
        Object.keys(btns).forEach(m => {
            const b = document.getElementById(btns[m]);
            if (b) b.className = (m === mode) ? 'cam-btn active' : 'cam-btn';
        });

        const { loadMesh, activeMission, cabinNode } = context;

        if (mode === 'hook' && loadMesh) {
            this.camera.position.set(loadMesh.position.x - 14, loadMesh.position.y + 16, loadMesh.position.z + 18);
            this.controls.target.copy(loadMesh.position);
        } else if (mode === 'target' && activeMission) {
            this.camera.position.set(activeMission.x - 18, activeMission.y + 12, activeMission.z + 20);
            this.controls.target.set(activeMission.x, activeMission.y + 1.0, activeMission.z);
        } else if (mode === 'cab' && cabinNode) {
            const cabPos = new THREE.Vector3();
            cabinNode.getWorldPosition(cabPos);
            this.camera.position.set(cabPos.x, cabPos.y + 4.5, cabPos.z);
        }
        this.controls.update();
    }

    updateCameraFollow(context = {}) {
        const { loadMesh, activeMission, cranePosition, tipWorld } = context;

        if (this.currentCameraMode === 'hook' && loadMesh) {
            this.controls.target.lerp(loadMesh.position, 0.12);
        } else if (this.currentCameraMode === 'target' && activeMission) {
            const targetCenter = new THREE.Vector3(activeMission.x, activeMission.y + 1.2, activeMission.z);
            this.controls.target.lerp(targetCenter, 0.1);
        } else if (this.currentCameraMode === 'cab' && tipWorld) {
            this.controls.target.lerp(new THREE.Vector3(tipWorld.x, tipWorld.y * 0.65, tipWorld.z), 0.1);
        } else if (cranePosition) {
            const craneCenter = new THREE.Vector3(cranePosition.x, 12, cranePosition.z);
            this.controls.target.lerp(craneCenter, 0.08);
        }
        this.controls.update();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
