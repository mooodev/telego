import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

class GoBoard {
    constructor() {
        // --- UI & STATE ---
        this.isMobile = window.innerWidth < 768;
        this.is2D = false;
        this.isTransitioning = false;
        this.transitionStart = 0;
        this.isBlackTurn = true;
        this.hoverI = -1;
        this.hoverJ = -1;
        this.isCharging = false;
        this.chargeCanceled = false;
        this.chargeStart = 0;
        this.pointerDownPos = { x: 0, y: 0 };
        this.koPos = null;

        // --- UI BUTTON ---
        this.btn = document.createElement('button');
        this.btn.innerText = 'Switch to 2D';
        Object.assign(this.btn.style, {
            position: 'absolute', top: '16px', left: '16px',
            padding: '14px 22px', fontSize: '15px', fontWeight: 'bold',
            cursor: 'pointer', zIndex: '100', backgroundColor: '#fff',
            border: '1px solid #333', borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)', touchAction: 'manipulation',
            minWidth: '44px', minHeight: '44px'
        });
        document.body.appendChild(this.btn);

        // --- CORE SCENE ---
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(14, 13, 14);

        this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.domElement.style.touchAction = 'none';
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 3, 0);

        // Camera Transition States
        this.pos2D = new THREE.Vector3(0, 17, 0);
        this.target2D = new THREE.Vector3(0, 5.5, 0);
        this.quat2D = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        this.saved3DPos = new THREE.Vector3(14, 13, 14);
        this.saved3DTarget = new THREE.Vector3(0, 3, 0);
        this.saved3DQuat = new THREE.Quaternion();
        this.startPos = new THREE.Vector3();
        this.startTarget = new THREE.Vector3();
        this.startQuat = new THREE.Quaternion();
        this.ease = t => -(Math.cos(Math.PI * t) - 1) / 2;

        this.btn.addEventListener('click', () => {
            if (this.isTransitioning) return;
            this.is2D = !this.is2D;
            this.isTransitioning = true;
            this.controls.enabled = false;
            this.startPos.copy(this.camera.position);
            this.startTarget.copy(this.controls.target);
            this.startQuat.copy(this.camera.quaternion);
            this.transitionStart = performance.now();
            this.btn.innerText = this.is2D ? 'Switch to 3D' : 'Switch to 2D';
            if (this.is2D) {
                this.saved3DPos.copy(this.camera.position);
                this.saved3DTarget.copy(this.controls.target);
                this.saved3DQuat.copy(this.camera.quaternion);
            }
        });

        // --- LIGHTING ---
        this.floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.1 }));
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);

        this.dirLight = new THREE.DirectionalLight(0xfff0dd, 3.5);
        this.dirLight.position.set(10, 20, 12);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.setScalar(this.isMobile ? 1024 : 2048);
        this.dirLight.shadow.bias = -0.0001;
        this.dirLight.shadow.normalBias = 0.01;
        this.dirLight.shadow.radius = 2;
        Object.assign(this.dirLight.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.1, far: 40 });
        this.scene.add(this.dirLight);

        this.fillLight = new THREE.DirectionalLight(0x90b0d0, 1.2);
        this.fillLight.position.set(-10, 10, -10);
        this.scene.add(this.fillLight);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));

        // --- LOADERS & TEXTURES ---
        this.envMap = null;
        this.manager = new THREE.LoadingManager(() => this.initApp());
        this.texLoader = new THREE.TextureLoader(this.manager);
        this.exrLoader = new EXRLoader(this.manager);

        this.woodTex = {
            map: this.texLoader.load('textures/oak_veneer_01_diff_1k.jpg'),
            aoMap: this.texLoader.load('textures/oak_veneer_01_ao_1k.jpg'),
            displacementMap: this.texLoader.load('textures/oak_veneer_01_disp_1k.png'),
            normalMap: null,
            roughnessMap: null
        };

        this.exrLoader.load('textures/oak_veneer_01_nor_gl_1k.exr', t => { t.flipY = false; this.woodTex.normalMap = t; });
        this.exrLoader.load('textures/oak_veneer_01_rough_1k.exr', t => { t.flipY = false; this.woodTex.roughnessMap = t; });
        this.exrLoader.load('satara_night_no_lamps_1k.exr', t => {
            t.mapping = THREE.EquirectangularReflectionMapping;
            t.colorSpace = THREE.LinearSRGBColorSpace;
            this.envMap = t;
            this.scene.backgroundIntensity = 0.1;
        });

        [this.woodTex.map, this.woodTex.aoMap, this.woodTex.displacementMap].forEach(t => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(2, 2);
            t.colorSpace = THREE.SRGBColorSpace;
        });

        // --- GRID GENERATOR ---
        this.GRID_SIZE = 1024;
        this.PAD = 64;
        this.STEP = (this.GRID_SIZE - this.PAD * 2) / 18;
        this.gridTexture = (() => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = this.GRID_SIZE;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, this.GRID_SIZE, this.GRID_SIZE);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            for (let i = 0; i < 19; i++) {
                const c = this.PAD + i * this.STEP;
                ctx.beginPath();
                ctx.moveTo(c, this.PAD);
                ctx.lineTo(c, this.GRID_SIZE - this.PAD);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(this.PAD, c);
                ctx.lineTo(this.GRID_SIZE - this.PAD, c);
                ctx.stroke();
            }
            ctx.fillStyle = '#000';
            [3, 9, 15].forEach(r => [3, 9, 15].forEach(c => {
                ctx.beginPath();
                ctx.arc(this.PAD + r * this.STEP, this.PAD + c * this.STEP, 8, 0, Math.PI * 2);
                ctx.fill();
            }));
            const tex = new THREE.CanvasTexture(canvas);
            tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
            return tex;
        })();

        // --- GAME STATE & GO LOGIC ---
        this.worldStep = (10 * (this.GRID_SIZE - this.PAD * 2) / this.GRID_SIZE) / 18;
        this.worldOffset = -(this.worldStep * 9);
        this.baseY = 5.5 + (0.24 * 0.4);

        this.gobanGroup = null;
        this.stoneGeo = null;
        this.blackMat = null;
        this.whiteMat = null;
        this.ghostBlackMat = null;
        this.ghostWhiteMat = null;
        this.ghostStone = null;
        this.stones = [];
        this.boardState = Array(19).fill(null).map(() => Array(19).fill(null));
        this.dirs = [[1,0], [-1,0], [0,1], [0,-1]];

        // --- INTERACTION ---
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.baseY);

        this.setupEvents();
    }

    // --- GAME LOGIC METHODS (unchanged internal logic) ---
    getGroup(x, y, c, v = new Set()) {
        const k = `${x},${y}`;
        if (v.has(k) || this.boardState[x]?.[y]?.color !== c) return [];
        v.add(k);
        return [[x, y], ...this.dirs.flatMap(([dx, dy]) => this.getGroup(x + dx, y + dy, c, v))];
    }

    getLibs(g) {
        return new Set(
            g.flatMap(([x, y]) => this.dirs.map(([dx, dy]) => [x + dx, y + dy]))
             .filter(([x, y]) => this.boardState[x] !== undefined && this.boardState[x][y] === null)
             .map(([x, y]) => `${x},${y}`)
        ).size;
    }

    removeGroup(g) {
        g.forEach(([x, y]) => {
            const s = this.boardState[x][y];
            if (!s) return;
            if (s.mesh) {
                this.gobanGroup.remove(s.mesh);
                const index = this.stones.indexOf(s);
                if (index !== -1) this.stones.splice(index, 1);
            }
            this.boardState[x][y] = null;
        });
    }

    createStone(i, j, isBlack, isInitial = false, chargeDuration = 0) {
        if (this.koPos && this.koPos[0] === i && this.koPos[1] === j) return false;

        const me = isBlack ? 1 : 2;
        const opp = 3 - me;
        
        this.boardState[i][j] = { color: me };
        let captured = [];

        for (let [dx, dy] of this.dirs) {
            let nx = i + dx, ny = j + dy;
            if (this.boardState[nx]?.[ny]?.color === opp) {
                let g = this.getGroup(nx, ny, opp);
                if (this.getLibs(g) === 0) captured.push(...g);
            }
        }

        let myGroup = this.getGroup(i, j, me);
        if (this.getLibs(myGroup) === 0 && captured.length === 0) {
            this.boardState[i][j] = null;
            return false;
        }

        if (captured.length === 1 && myGroup.length === 1 && this.getLibs(myGroup) === 1) {
            this.koPos = captured[0];
        } else {
            this.koPos = null;
        }

        this.removeGroup(captured);

        const basex = this.worldOffset + i * this.worldStep;
        const basey = this.baseY + (isBlack ? -0.002 : 0.015);
        const basez = this.worldOffset + j * this.worldStep;

        const stone = new THREE.Mesh(this.stoneGeo, isBlack ? this.blackMat : this.whiteMat);
        stone.scale.set(1, 0.4, 1);
        stone.castShadow = stone.receiveShadow = true;
        this.gobanGroup.add(stone);

        let power = 0;
        let slamY = basey;

        if (!isInitial) {
            const t = Math.max(0, chargeDuration - 100) / 1000;
            power = 2.0 * (1 - Math.exp(-2.5 * t));
            slamY = basey + 0.5 + power * 2;
        }

        stone.position.set(basex, slamY, basez);

        const stoneData = {
            mesh: stone, color: me, i, j, basex, basey, basez, slamY, power,
            rattleEnergy: 0, vx: 0, vy: 0, vz: 0, offsetX: 0, offsetY: 0, offsetZ: 0
        };

        this.stones.push(stoneData);
        this.boardState[i][j] = stoneData;

        return true;
    }

    // --- BOARD INITIALIZATION (called after textures load) ---
    initApp() {
        this.scene.environment = this.scene.background = this.envMap;

        const woodMat = new THREE.MeshPhysicalMaterial({ ...this.woodTex, displacementScale: 0, roughness: 0.95, metalness: 0.035 });
        const topMat = woodMat.clone();

        topMat.onBeforeCompile = shader => {
            shader.uniforms.gridMap = { value: this.gridTexture };
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec2 vRawUv;')
                .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRawUv = uv;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nuniform sampler2D gridMap;\nvarying vec2 vRawUv;')
                .replace('#include <map_fragment>', `#include <map_fragment>\nfloat gridMask = 1.0 - texture2D(gridMap, vRawUv).r;\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.01, gridMask * 0.9);`)
                .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, gridMask);`);
        };

        this.gobanGroup = new THREE.Group();
        const boardGeo = new THREE.BoxGeometry(10, 4, 10, 1, 1, 1);
        const uv = boardGeo.attributes.uv;
        for (let i = 0; i < 8; i++) uv.setXY(i, uv.getX(i) * 0.15, uv.getY(i) * 0.5);
        for (let i = 16; i < 24; i++) uv.setXY(i, uv.getX(i) * 0.20, uv.getY(i) * 0.4);
        uv.needsUpdate = true;

        const body = new THREE.Mesh(boardGeo, [woodMat, woodMat, topMat, woodMat, woodMat, woodMat]);
        body.position.y = 3.5;
        body.castShadow = body.receiveShadow = true;
        this.gobanGroup.add(body);

        [[-4.2, 4.2], [4.2, 4.2], [-4.2, -4.2], [4.2, -4.2]].forEach(([x, z]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.22, 1.25, this.isMobile ? 24 : 48), woodMat);
            leg.position.set(x, 1.5 - 1.25 + 0.995, z);
            leg.castShadow = leg.receiveShadow = true;
            this.gobanGroup.add(leg);
        });

        const stoneSegs = this.isMobile ? 20 : 32;
        this.stoneGeo = new THREE.SphereGeometry(0.24, stoneSegs, stoneSegs);
        this.blackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.65, clearcoat: 0.15, clearcoatRoughness: 0.2 });
        this.whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.1 });
        this.ghostBlackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, transparent: true, opacity: 0.6, roughness: 0.65 });
        this.ghostWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, transparent: true, opacity: 0.6, roughness: 0.25 });

        this.ghostStone = new THREE.Mesh(this.stoneGeo, this.ghostBlackMat);
        this.ghostStone.scale.set(1, 0.4, 1);
        this.ghostStone.castShadow = true;
        this.ghostStone.visible = false;
        this.gobanGroup.add(this.ghostStone);
        this.scene.add(this.gobanGroup);

        this.animate();
    }

    updateHover(e) {
        this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersect = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.interactionPlane, intersect)) {
            const i = Math.round((intersect.x - this.worldOffset) / this.worldStep);
            const j = Math.round((intersect.z - this.worldOffset) / this.worldStep);
            if (i >= 0 && i <= 18 && j >= 0 && j <= 18) {
                this.hoverI = i;
                this.hoverJ = j;
                return;
            }
        }
        this.hoverI = this.hoverJ = -1;
    }

    setupEvents() {
        window.addEventListener('pointerdown', (e) => {
            if (e.target !== this.renderer.domElement) return;
            this.pointerDownPos = { x: e.clientX, y: e.clientY };
            this.updateHover(e);
            if (this.hoverI >= 0 && this.hoverJ >= 0 && !this.boardState[this.hoverI][this.hoverJ]) {
                this.chargeCanceled = false;
                this.isCharging = true;
                this.chargeStart = performance.now();
                this.controls.enabled = false;
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isCharging) {
                if (Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) > 15) {
                    this.isCharging = false;
                    this.chargeCanceled = true;
                    if (!this.is2D) this.controls.enabled = true;
                }
                return;
            }
            this.updateHover(e);
        });

        window.addEventListener('pointerup', (e) => {
            if (!this.isCharging && this.chargeCanceled) return;

            if (this.isCharging && this.hoverI >= 0 && this.hoverJ >= 0 && !this.boardState[this.hoverI][this.hoverJ]) {
                const chargeDuration = performance.now() - this.chargeStart;
                if (this.createStone(this.hoverI, this.hoverJ, this.isBlackTurn, false, chargeDuration)) {
                    this.isBlackTurn = !this.isBlackTurn;
                }
            }
            this.isCharging = false;
            if (!this.is2D) this.controls.enabled = true;
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // --- RENDER LOOP (exact same logic as original) ---
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.isTransitioning) {
            const t = Math.min(1, (performance.now() - this.transitionStart) / 350);
            const eased = this.ease(t);
            const dPos = this.is2D ? this.pos2D : this.saved3DPos;
            const dTgt = this.is2D ? this.target2D : this.saved3DTarget;
            const dQuat = this.is2D ? this.quat2D : this.saved3DQuat;
            this.camera.position.lerpVectors(this.startPos, dPos, eased);
            this.controls.target.lerpVectors(this.startTarget, dTgt, eased);
            this.camera.quaternion.copy(this.startQuat.clone().slerp(dQuat, eased));
            if (t >= 1) {
                this.camera.position.copy(dPos);
                this.controls.target.copy(dTgt);
                this.camera.quaternion.copy(dQuat);
                this.isTransitioning = false;
                this.controls.enabled = !this.is2D;
            }
        } else if (!this.is2D) {
            this.controls.update();
        }

        if (this.ghostStone) {
            if (this.hoverI >= 0 && this.hoverJ >= 0 && !this.boardState[this.hoverI][this.hoverJ] && !this.isTransitioning) {
                this.ghostStone.visible = true;
                this.ghostStone.material = this.isBlackTurn ? this.ghostBlackMat : this.ghostWhiteMat;
                this.ghostStone.position.set(this.worldOffset + this.hoverI * this.worldStep, this.baseY, this.worldOffset + this.hoverJ * this.worldStep);
                if (this.isCharging) {
                    const charge = 2.0 * (1 - Math.exp(-2.5 * ((performance.now() - this.chargeStart) / 370)));
                    this.ghostStone.position.y += 0.5 + charge * 2;
                }
            } else {
                this.ghostStone.visible = false;
            }
        }

        this.stones.forEach(s => {
            if (s.slamY > s.basey) {
                s.slamY -= 0.5;
                if (s.slamY <= s.basey) {
                    s.slamY = s.basey;

                    if (s.power > 0.15) {
                        s.rattleEnergy = Math.max(s.rattleEnergy, s.power * 1.2);

                        this.stones.forEach(other => {
                            if (other !== s) {
                                const distSq = Math.pow(other.i - s.i, 2) + Math.pow(other.j - s.j, 2);
                                other.rattleEnergy = Math.max(other.rattleEnergy, (s.power * 0.8) / (distSq + 1));
                            }
                        });
                    } else {
                        s.rattleEnergy = Math.max(s.rattleEnergy, 0.5);
                    }
                }
                s.mesh.position.y = s.slamY;
                return;
            }

            if (s.rattleEnergy > 0.0001) {
                const stiffness = 0.4 + s.rattleEnergy * 0.2;
                const noise = 0.03 * s.rattleEnergy;
                s.vx += -s.offsetX * stiffness + (Math.random() - 0.5) * noise;
                s.vy += -s.offsetY * stiffness + (Math.random() - 0.5) * noise;
                s.vz += -s.offsetZ * stiffness + (Math.random() - 0.5) * noise;
                s.vx *= 0.75;
                s.vz *= 0.75;
                s.vy *= 0.375;
                s.offsetX += s.vx;
                s.offsetY += s.vy;
                s.offsetZ += s.vz;

                s.mesh.position.set(s.basex + s.offsetX, s.basey + s.offsetY, s.basez + s.offsetZ);
                s.mesh.rotation.x += s.vx * 0.2;
                s.mesh.rotation.z += s.vz * 0.2;
                s.rattleEnergy *= 0.96;
            } else {
                s.offsetX = s.offsetY = s.offsetZ = s.vx = s.vy = s.vz = 0;
                s.mesh.position.set(s.basex, s.basey, s.basez);
            }
        });

        this.renderer.render(this.scene, this.camera);
    }
}

new GoBoard();