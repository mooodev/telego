import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// --- AI ENGINE STATE ---
let katoModelDan = null;
let katoModelKyu = null;
let currentLevel = 'dan'; 
let isAiThinking = false;

const BATCHES = 1;
const CHANNELS = 22;
const GLOBAL_CHANNELS = 19;

// --- LOAD MODELS ---
async function loadKatoEngine() {
    try {
        katoModelDan = await tf.loadGraphModel("https://maksimkorzh.github.io/go/model/dan/model.json");
        katoModelKyu = await tf.loadGraphModel("https://maksimkorzh.github.io/go/model/kyu/model.json");
        console.log('✅ Kato engine loaded (both models ready)');
    } catch (e) {
        console.error('❌ Model load failed', e);
    }
}
loadKatoEngine();

// --- AI MOVE LOGIC ---
async function makeAiMove() {
    if (isBlackTurn || isAiThinking) return;
    isAiThinking = true;

    // Small delay for realism
    await new Promise(r => setTimeout(r, 600));

    const move = await getKatoMove(boardState, false); // false = White

    if (move) {
        createStone(move.i, move.j, false, false, 350); // White plays with a medium "slam"
        console.log(`Kato (White) played at ${move.i},${move.j}`);
    } else {
        console.log('Kato passed');
    }

    isBlackTurn = true; // Back to player
    isAiThinking = false;
}

async function getKatoMove(boardState, isBlackTurn) {
    if (!katoModelDan || !katoModelKyu) return null;

    const model = currentLevel === 'dan' ? katoModelDan : katoModelKyu;
    const levelIsDan = currentLevel === 'dan';

    // 1. Create input tensors
    const binInputsData = new Float32Array(BATCHES * 361 * CHANNELS);
    const globalInputsData = new Float32Array(BATCHES * GLOBAL_CHANNELS);

    for (let i = 0; i < 19; i++) {
        for (let j = 0; j < 19; j++) {
            const idx = i * 19 + j; 
            const sq = boardState[i][j];

            binInputsData[idx * CHANNELS + 0] = 1.0; 
            if (sq) {
                if (sq.isBlack) binInputsData[idx * CHANNELS + 1] = 1.0;
                else binInputsData[idx * CHANNELS + 2] = 1.0;
            }
        }
    }
    globalInputsData[5] = isBlackTurn ? 7.5 / 20 : -7.5 / 20;

    const binT = tf.tensor(binInputsData, [BATCHES, 361, CHANNELS]);
    const globalT = tf.tensor(globalInputsData, [BATCHES, GLOBAL_CHANNELS]);

    // 2. Use executeAsync instead of execute
    const results = await model.executeAsync({
        "swa_model/bin_inputs": binT,
        "swa_model/global_inputs": globalT
    });

    // 3. Process results
    // Results is an array of tensors. We find the policy head.
    const policyTensor = levelIsDan ? results[1] : results[3];
    const flatPolicy = await policyTensor.data(); // Downloads data from GPU

    let bestScore = -Infinity;
    let bestI = -1, bestJ = -1;

    for (let idx = 0; idx < 361; idx++) {
        const i = Math.floor(idx / 19);
        const j = idx % 19;
        if (!boardState[i][j]) {
            if (flatPolicy[idx] > bestScore) {
                bestScore = flatPolicy[idx];
                bestI = i;
                bestJ = j;
            }
        }
    }

    // 4. MANUAL CLEANUP (Critical for executeAsync)
    binT.dispose();
    globalT.dispose();
    results.forEach(t => t.dispose()); 

    return (bestI >= 0) ? { i: bestI, j: bestJ } : null;
}

// --- UI SETUP ---
const btn = document.createElement('button');
btn.innerText = 'Switch to 2D';
Object.assign(btn.style, {
    position: 'absolute', top: '16px', left: '16px',
    padding: '14px 22px', fontSize: '15px', fontWeight: 'bold',
    cursor: 'pointer', zIndex: '100', backgroundColor: '#fff',
    border: '1px solid #333', borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.3)', touchAction: 'manipulation'
});
document.body.appendChild(btn);

// --- SCENE & RENDERER ---
const isMobile = window.innerWidth < 768;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(14, 13, 14);

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.domElement.style.touchAction = 'none';
document.body.appendChild(renderer.domElement);

// --- ASSET LOADING ---
let envMap;
const manager = new THREE.LoadingManager(() => initApp());
const texLoader = new THREE.TextureLoader(manager);
const exrLoader = new EXRLoader(manager);

const woodTex = {
    map: texLoader.load('textures/oak_veneer_01_diff_1k.jpg'),
    aoMap: texLoader.load('textures/oak_veneer_01_ao_1k.jpg'),
    displacementMap: texLoader.load('textures/oak_veneer_01_disp_1k.png'),
    normalMap: null, roughnessMap: null
};

exrLoader.load('textures/oak_veneer_01_nor_gl_1k.exr', t => { t.flipY = false; woodTex.normalMap = t; });
exrLoader.load('textures/oak_veneer_01_rough_1k.exr', t => { t.flipY = false; woodTex.roughnessMap = t; });
exrLoader.load('satara_night_no_lamps_1k.exr', t => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    envMap = t;
    scene.backgroundIntensity = 0.1;
});

[woodTex.map, woodTex.aoMap, woodTex.displacementMap].forEach(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    t.colorSpace = THREE.SRGBColorSpace;
});

// --- GRID ---
const GRID_SIZE = 1024, PAD = 64, STEP = (GRID_SIZE - PAD * 2) / 18;
const gridTexture = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = GRID_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    for (let i = 0; i < 19; i++) {
        const c = PAD + i * STEP;
        ctx.beginPath(); ctx.moveTo(c, PAD); ctx.lineTo(c, GRID_SIZE - PAD); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(PAD, c); ctx.lineTo(GRID_SIZE - PAD, c); ctx.stroke();
    }
    ctx.fillStyle = '#000';
    [3, 9, 15].forEach(r => [3, 9, 15].forEach(c => {
        ctx.beginPath(); ctx.arc(PAD + r * STEP, PAD + c * STEP, 8, 0, Math.PI * 2); ctx.fill();
    }));
    return new THREE.CanvasTexture(canvas);
})();

// --- ENVIRONMENT & LIGHTING ---
const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.ShadowMaterial({ opacity: 0.1 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const dirLight = new THREE.DirectionalLight(0xfff0dd, 3.5);
dirLight.position.set(10, 20, 12); dirLight.castShadow = true; scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.target.set(0, 3, 0);

// --- TRANSITION STATE ---
let is2D = false, isTransitioning = false, transitionStart = 0;
const pos2D = new THREE.Vector3(0, 17, 0), target2D = new THREE.Vector3(0, 5.5, 0);
const saved3DPos = new THREE.Vector3(14, 13, 14), saved3DTarget = new THREE.Vector3(0, 3, 0);
const startPos = new THREE.Vector3(), startTarget = new THREE.Vector3(), startQuat = new THREE.Quaternion();

btn.addEventListener('click', () => {
    if (isTransitioning) return;
    is2D = !is2D; isTransitioning = true; controls.enabled = false;
    startPos.copy(camera.position); startTarget.copy(controls.target); startQuat.copy(camera.quaternion);
    transitionStart = performance.now();
    btn.innerText = is2D ? 'Switch to 3D' : 'Switch to 2D';
    if (is2D) { saved3DPos.copy(camera.position); saved3DTarget.copy(controls.target); }
});

// --- GAME STATE ---
const worldStep = (10 * (GRID_SIZE - PAD * 2) / GRID_SIZE) / 18;
const worldOffset = -(worldStep * 9);
const baseY = 5.5 + (0.24 * 0.4);

let gobanGroup, stoneGeo, blackMat, whiteMat, ghostBlackMat, ghostWhiteMat, ghostStone;
const stones = [];
const boardState = Array(19).fill(null).map(() => Array(19).fill(null));

let isBlackTurn = true;
let hoverI = -1, hoverJ = -1;
let isCharging = false, chargeCanceled = false, chargeStart = 0, chargeTimeout = null;
let pointerDownPos = { x: 0, y: 0 };

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -baseY);

function initApp() {
    scene.environment = scene.background = envMap;
    const woodMat = new THREE.MeshPhysicalMaterial({ ...woodTex,displacementScale: 0, roughness: 0.95, metalness: 0.035 });
    const topMat = woodMat.clone();
    
    topMat.onBeforeCompile = shader => {
        shader.uniforms.gridMap = { value: gridTexture };
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRawUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvRawUv = uv;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D gridMap;\nvarying vec2 vRawUv;')
            .replace('#include <map_fragment>', `#include <map_fragment>\nfloat gridMask = 1.0 - texture2D(gridMap, vRawUv).r;\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.01, gridMask * 0.9);`);
    };

    gobanGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 10), [woodMat, woodMat, topMat, woodMat, woodMat, woodMat]);
    body.position.y = 3.5; body.castShadow = body.receiveShadow = true; gobanGroup.add(body);

    stoneGeo = new THREE.SphereGeometry(0.24, 32, 32);
    blackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.65 });
    whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, roughness: 0.25 });
    ghostBlackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, transparent: true, opacity: 0.6 });
    ghostWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, transparent: true, opacity: 0.6 });

    ghostStone = new THREE.Mesh(stoneGeo, ghostBlackMat);
    ghostStone.scale.set(1, 0.4, 1); ghostStone.visible = false; gobanGroup.add(ghostStone);
    scene.add(gobanGroup);
}

// --- INTERACTION ---
function updateHover(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(interactionPlane, intersect)) {
        const i = Math.round((intersect.x - worldOffset) / worldStep);
        const j = Math.round((intersect.z - worldOffset) / worldStep);
        if (i >= 0 && i <= 18 && j >= 0 && j <= 18) { hoverI = i; hoverJ = j; return; }
    }
    hoverI = -1; hoverJ = -1;
}

window.addEventListener('pointerdown', e => {
    if (e.target !== renderer.domElement || !isBlackTurn || isAiThinking) return;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    updateHover(e);
    if (hoverI >= 0 && !boardState[hoverI][hoverJ]) {
        chargeCanceled = false;
        chargeTimeout = setTimeout(() => { isCharging = true; chargeStart = performance.now(); controls.enabled = false; }, 100);
    }
});

window.addEventListener('pointermove', e => {
    if (!isCharging && chargeTimeout) {
        if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 15) {
            clearTimeout(chargeTimeout); chargeTimeout = null; chargeCanceled = true;
        }
    }
    if (isCharging) {
        if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 40) {
            isCharging = false; chargeCanceled = true; controls.enabled = !is2D;
        }
        return;
    }
    updateHover(e);
});

window.addEventListener('pointerup', () => {
    if (chargeTimeout) { clearTimeout(chargeTimeout); chargeTimeout = null; }
    if (hoverI >= 0 && hoverJ >= 0 && !boardState[hoverI][hoverJ] && isBlackTurn && !isAiThinking) {
        const duration = (isCharging && !chargeCanceled) ? (performance.now() - chargeStart) : 0;
        createStone(hoverI, hoverJ, true, false, duration);
        isBlackTurn = false;
        makeAiMove();
    }
    isCharging = false; controls.enabled = !is2D;
});

function createStone(i, j, isBlack, isInitial = false, chargeDuration = 0) {
    const basex = worldOffset + i * worldStep;
    const basey = baseY + (isBlack ? -0.002 : 0.015);
    const basez = worldOffset + j * worldStep;
    const stone = new THREE.Mesh(stoneGeo, isBlack ? blackMat : whiteMat);
    stone.scale.set(1, 0.4, 1); stone.castShadow = stone.receiveShadow = true;
    gobanGroup.add(stone);

    let power = 0, slamY = basey;
    if (!isInitial) {
        power = 2.0 * (1 - Math.exp(-2.5 * (chargeDuration / 1000)));
        slamY = basey + 0.5 + power * 2;
    }
    stone.position.set(basex, slamY, basez);
    const data = { mesh: stone, i, j, isBlack, basex, basey, basez, slamY, power, rattleEnergy: 0, vx:0, vy:0, vz:0, offsetX:0, offsetY:0, offsetZ:0 };
    stones.push(data); boardState[i][j] = data;
}

// --- ANIMATION ---
function animate() {
    requestAnimationFrame(animate);
    if (isTransitioning) {
        const t = Math.min(1, (performance.now() - transitionStart) / 400);
        const dPos = is2D ? pos2D : saved3DPos, dTgt = is2D ? target2D : saved3DTarget;
        camera.position.lerpVectors(startPos, dPos, t);
        controls.target.lerpVectors(startTarget, dTgt, t);
        if (t >= 1) { isTransitioning = false; controls.enabled = !is2D; }
    } else if (!is2D) controls.update();

    if (ghostStone) {
        if (hoverI >= 0 && !boardState[hoverI][hoverJ] && !isTransitioning && isBlackTurn && !isAiThinking) {
            ghostStone.visible = true; ghostStone.material = ghostBlackMat;
            ghostStone.position.set(worldOffset + hoverI * worldStep, isCharging ? (baseY + 0.5 + (2.0 * (1 - Math.exp(-2.5 * (performance.now()-chargeStart)/370))) * 2) : baseY, worldOffset + hoverJ * worldStep);
        } else ghostStone.visible = false;
    }

    stones.forEach(s => {
        if (s.slamY > s.basey) {
            s.slamY -= 0.4;
            if (s.slamY <= s.basey) {
                s.slamY = s.basey;
                if (s.power > 0.1) stones.forEach(o => { if (o !== s) o.rattleEnergy = Math.max(o.rattleEnergy, (s.power * 0.5) / (Math.hypot(o.i - s.i, o.j - s.j) ** 2 + 1)); });
            }
            s.mesh.position.y = s.slamY;
        } else if (s.rattleEnergy > 0.001) {
            s.vx += -s.offsetX * 0.5; s.vz += -s.offsetZ * 0.5;
            s.vx += (Math.random() - 0.5) * 0.03 * s.rattleEnergy; s.vz += (Math.random() - 0.5) * 0.03 * s.rattleEnergy;
            s.offsetX += (s.vx *= 0.7); s.offsetZ += (s.vz *= 0.7);
            s.mesh.position.set(s.basex + s.offsetX, s.basey, s.basez + s.offsetZ);
            s.rattleEnergy *= 0.95;
        }
    });
    renderer.render(scene, camera);
}
animate();
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });