import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { GoAnimations } from './goanimations.js';
import { GoGame } from './game/GoGame.js';
import { KataGoEngine } from './ai/KataGoEngine.js';
import { GameHUD, NullHUD } from './ui/GameHUD.js';
import { parseSgf } from './sgf/SgfParser.js';
import { SoundManager } from './audio/SoundManager.js';
import { OnlineService } from './online/OnlineService.js';

export class GoBoard {
    constructor(options = {}) {
        this.options = options;
        this.container = options.container || null;
        this._disposed = false;
        this._interactive = true;
        this._domListeners = [];
        this.supportedBoardSizes = [9, 13, 19];
        this.aiSupportedBoardSizes = new Set(this.supportedBoardSizes);
        this.puzzleSupportedBoardSize = 19;
        this.boardSize = 19;
        this.game = new GoGame(this.boardSize);
        this.animations = new GoAnimations();
        this.aiEngine = new KataGoEngine();
        this.soundManager = new SoundManager();
        this.onlineService = new OnlineService();

        this.isMobile = window.innerWidth < 768;
        this.is2D = false;
        this.isTransitioning = false;
        this.transitionStart = 0;
        this.hoverI = -1;
        this.hoverJ = -1;
        this.isCharging = false;
        this.chargeStart = 0;
        this.pointerDownPos = { x: 0, y: 0 };
        this.gobanScale = 1;

        this.mode = 'pvai';
        this.humanColor = 1;
        this.aiLevels = { 1: 'dan', 2: 'dan' };
        this.tipVisible = true;
        this.isAiThinking = false;
        this.analysisRequestId = 0;
        this.latestAnalysis = null;
        this.isReady = false;
        this.leadChartSkipMoves = 2;
        this.leadHistory = [0];
        this.evaluationTimeline = [];
        this.historyCursor = null;
        this.isHistoryPreviewActive = false;
        this.historyShadowGame = null;
        this.historyShadowMoveCount = 0;
        this.historyTipRequestId = 0;
        this.historyTipAnalysis = null;
        this.historyTipPositionKey = null;
        this.historyTipCache = new Map();
        this.puzzleFiles = [];
        this.selectedPuzzleUrl = '';
        this.puzzleState = null;
        this.puzzleHintPoints = [];
        this.puzzleOutcomeCache = new WeakMap();
        this.scoringState = null;
        this.territoryMarkers = [];
        this.influenceMarkers = [];
        this.previewFutureMarkers = [];
        this.suggestionMarkers = [];
        this.blunderMarkers = [];
        this.influenceVisible = false;

        this.initUI();
        this.initScene();
        this.initLighting();
        this.initResources();
        this.setupEvents();
        this.initializeAi();
    }

    initUI() {
        const hudFactory = this.options.hud;
        if (hudFactory) {
            this.hud = typeof hudFactory === 'function'
                ? hudFactory({ onAction: (action, payload) => this.handleHudAction(action, payload) })
                : hudFactory;
            if (!this.hud.onAction) this.hud.onAction = (action, payload) => this.handleHudAction(action, payload);
        } else {
            this.hud = new NullHUD({ onAction: (action, payload) => this.handleHudAction(action, payload) });
        }
        this.hud.setTipVisible(this.tipVisible);
        this.hud.setBoardSize(this.boardSize);
        this.hud.setMode(this.mode);
        this.hud.setHumanColor(this.humanColor);
        this.hud.setAiLevel(1, this.aiLevels[1]);
        this.hud.setAiLevel(2, this.aiLevels[2]);
        this.hud.setBoardCapabilities({
            aiEnabled: this.isAiBoardSupported(this.boardSize),
            puzzleEnabled: this.isPuzzleBoardSupported(this.boardSize),
        });
        this.hud.setPuzzleSource(this.onlineService.getDefaultPuzzleSource());
        this.hud.setPuzzleFiles([]);
        this.hud.setPuzzleStatus('Puzzle source idle');
        this.hud.setPuzzleTree('Load a puzzle to inspect its SGF branches');
        this.hud.setPuzzleHintEnabled(false);
        this.hud.setScoreReview(null);
        this.hud.setSoundEnabled(this.soundManager.enabled);
        this.recordEvaluationSnapshot(this.game.estimateScore(), { resetCursor: false });
        this.updateLeadMeterDisplay();
    }

    handleHudAction(action, payload) {
        if (action === 'toggleView') {
            this.toggleViewMode();
            return;
        }
        if (action === 'toggleTip') {
            this.tipVisible = !this.tipVisible;
            this.hud.setTipVisible(this.tipVisible);
            this.updateSuggestionMarker();
            if (this.isHistoryPreviewActive) {
                if (this.tipVisible) this.refreshHistoricalTip();
                else {
                    this.clearHistoricalTipAnalysis();
                    this.hud.setAnalysis(this.formatHistoricalFallbackText());
                }
            }
            return;
        }
        if (action === 'toggleInfluence') {
            this.influenceVisible = !this.influenceVisible;
            this.hud.setInfluenceVisible(this.influenceVisible);
            this.updateInfluenceMarkers(
                this.isHistoryPreviewActive && this.historyShadowGame
                    ? { board: this.historyShadowGame.board, score: this.historyShadowGame.estimateScore(), consecutivePasses: this.historyShadowGame.consecutivePasses }
                    : (this.historyCursor == null ? this.getLiveInfluenceScore() : this.evaluationTimeline[this.historyCursor])
            );
            return;
        }
        if (action === 'stepLeadHistory') {
            this.stepLeadHistory(payload);
            return;
        }
        if (action === 'setLeadHistoryIndex') {
            this.setLeadHistoryIndex(payload);
            return;
        }
        if (action === 'setMode') {
            const normalizedMode = this.normalizeModeForBoardSize(payload);
            if (this.mode === 'puzzle' && normalizedMode !== 'puzzle') {
                this.resetStandardGame(this.boardSize);
            }
            if (normalizedMode === 'puzzle') {
                this.clearScoringState();
            }
            this.mode = normalizedMode;
            this.hud.setMode(normalizedMode);
            this.refreshAnalysis();
            this.maybeTriggerAiTurn();
            return;
        }
        if (action === 'setBoardSize') {
            this.setBoardSize(payload);
            return;
        }
        if (action === 'setHumanColor') {
            this.humanColor = payload;
            this.hud.setHumanColor(payload);
            this.refreshAnalysis();
            this.maybeTriggerAiTurn();
            return;
        }
        if (action === 'setAiLevel') {
            this.aiLevels[payload.color] = payload.level;
            this.hud.setAiLevel(payload.color, payload.level);
            this.initializeAi(payload.level);
            return;
        }
        if (action === 'forceAiMove') {
            this.requestAiMove(true);
            return;
        }
        if (action === 'passTurn') {
            this.passTurn();
            return;
        }
        if (action === 'acceptScore') {
            this.acceptScoreReview();
            return;
        }
        if (action === 'resumePlay') {
            this.resumeGameFromScoring();
            return;
        }
        if (action === 'loadPuzzleList') {
            this.loadPuzzleList(payload);
            return;
        }
        if (action === 'selectPuzzle') {
            this.selectedPuzzleUrl = payload;
            this.hud.setSelectedPuzzle(payload);
            return;
        }
        if (action === 'loadSelectedPuzzle') {
            this.loadPuzzleFromUrl(this.selectedPuzzleUrl);
            return;
        }
        if (action === 'showPuzzleHint') {
            this.showPuzzleHint();
            return;
        }
        if (action === 'setSoundEnabled') {
            this.soundManager.enabled = payload;
            this.hud.setSoundEnabled(payload);
        }
    }

    isAiBoardSupported(size = this.game.size) {
        return this.aiSupportedBoardSizes.has(size);
    }

    isPuzzleBoardSupported(size = this.game.size) {
        return size === this.puzzleSupportedBoardSize;
    }

    normalizeModeForBoardSize(mode, size = this.game.size) {
        if (mode === 'puzzle' && !this.isPuzzleBoardSupported(size)) return 'pvp';
        if (mode !== 'puzzle' && this.isAiBoardSupported(size)) return mode;
        return mode === 'pvai' || mode === 'aivai' || mode === 'puzzle' ? 'pvp' : mode;
    }

    syncBoardCapabilities(size = this.game.size) {
        this.hud.setBoardSize(size);
        this.hud.setBoardCapabilities({
            aiEnabled: this.isAiBoardSupported(size),
            puzzleEnabled: this.isPuzzleBoardSupported(size),
        });
    }

    setBoardSize(size) {
        if (!this.supportedBoardSizes.includes(size)) return;
        if (size === this.game.size && this.mode !== 'puzzle') return;

        this.boardSize = size;
        const nextMode = this.mode === 'puzzle' ? 'pvp' : this.mode;
        this.mode = this.normalizeModeForBoardSize(nextMode, size);
        this.hud.setMode(this.mode);
        this.syncBoardCapabilities(size);
        this.resetStandardGame(size);
    }

    async initializeAi() {
        this.hud.setAnalysis('AI: loading\nBoard: empty');
        try {
            const infoBlack = await this.aiEngine.init(this.aiLevels[1]);
            await this.aiEngine.init(this.aiLevels[2]);
            this.hud.setAnalysis(`AI: ready (${infoBlack.backend})\nBoard: empty`);
            this.refreshAnalysis();
            this.maybeTriggerAiTurn();
        } catch (error) {
            console.error(error);
            this.hud.setAnalysis(`AI: failed to load\n${error.message}`);
        }
    }

    toggleViewMode() {
        if (this.isTransitioning) return;
        const entering2D = !this.is2D;
        if (!entering2D && this.camera !== this.perspectiveCamera) {
            this.setActiveCamera(this.perspectiveCamera, true);
        }
        this.is2D = entering2D;
        this.updateSceneBackground();
        this.isTransitioning = true;
        this.controls.enabled = false;
        this.startPos.copy(this.camera.position);
        this.startTarget.copy(this.controls.target);
        this.startQuat.copy(this.camera.quaternion);
        this.transitionStart = performance.now();
        this.hud.setViewMode(this.is2D);
        if (this.is2D) {
            this.saved3DPos.copy(this.camera.position);
            this.saved3DTarget.copy(this.controls.target);
            this.saved3DQuat.copy(this.camera.quaternion);
        }
    }

    getViewportWidth() {
        return this.container ? Math.max(1, this.container.clientWidth) : window.innerWidth;
    }

    getViewportHeight() {
        return this.container ? Math.max(1, this.container.clientHeight) : window.innerHeight;
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.perspectiveCamera = new THREE.PerspectiveCamera(45, this.getViewportWidth() / this.getViewportHeight(), 0.1, 100);
        this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        this.camera = this.perspectiveCamera;
        this.default3DPos = new THREE.Vector3(14, 13, 14);
        this.default3DTarget = new THREE.Vector3(0, 3, 0);
        this.default2DPos = new THREE.Vector3(0, 17, 0);
        this.default2DTarget = new THREE.Vector3(0, 5.5, 0);
        this.perspectiveCamera.position.copy(this.default3DPos);
        this.orthoCamera.position.copy(this.default2DPos);

        this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, powerPreference: 'high-performance', alpha: true });
        this.renderer.setSize(this.getViewportWidth(), this.getViewportHeight());
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.domElement.style.touchAction = 'none';
        if (this.container) {
            this.renderer.domElement.style.position = 'absolute';
            this.renderer.domElement.style.inset = '0';
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.container.appendChild(this.renderer.domElement);
        } else {
            document.body.appendChild(this.renderer.domElement);
        }

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.copy(this.default3DTarget);

        this.pos2D = this.default2DPos.clone();
        this.target2D = this.default2DTarget.clone();
        this.quat2D = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        this.saved3DPos = this.default3DPos.clone();
        this.saved3DTarget = this.default3DTarget.clone();
        this.saved3DQuat = new THREE.Quaternion();
        this.startPos = new THREE.Vector3();
        this.startTarget = new THREE.Vector3();
        this.startQuat = new THREE.Quaternion();
        this.updateCameraProjection();
    }

    initLighting() {
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
    }

    initResources() {
        this.envMap = null;
        this.manager = new THREE.LoadingManager(() => this.initApp());
        this.texLoader = new THREE.TextureLoader(this.manager);
        this.exrLoader = new EXRLoader(this.manager);

        this.woodTex = {
            map: this.texLoader.load('textures/oak_veneer_01_diff_1k.jpg'),
            aoMap: this.texLoader.load('textures/oak_veneer_01_ao_1k.jpg'),
            displacementMap: this.texLoader.load('textures/oak_veneer_01_disp_1k.png'),
            normalMap: null,
            roughnessMap: null,
        };

        this.exrLoader.load('textures/oak_veneer_01_nor_gl_1k.exr', texture => {
            texture.flipY = false;
            this.woodTex.normalMap = texture;
        });
        this.exrLoader.load('textures/oak_veneer_01_rough_1k.exr', texture => {
            texture.flipY = false;
            this.woodTex.roughnessMap = texture;
        });
        this.exrLoader.load('textures/satara_night_no_lamps_1k.exr', texture => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            this.envMap = texture;
            this.scene.backgroundIntensity = 0.1;
        });

        [this.woodTex.map, this.woodTex.aoMap, this.woodTex.displacementMap].forEach(texture => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2, 2);
            texture.colorSpace = THREE.SRGBColorSpace;
        });

        this.BOARD_LOCAL_SIZE = 10;
        this.REFERENCE_BOARD_SIZE = 19;
        this.REFERENCE_WOOD_REPEAT = 2;
        this.BOARD_TOP_Y = 5.5;
        this.STONE_RADIUS = 0.24;
        this.GRID_SIZE = 1024;
        this.PAD = 64;
        this.GRID_LINE_WIDTH = 4;
        this.STAR_POINT_RADIUS = 8;
        this.baseY = this.BOARD_TOP_Y + (this.STONE_RADIUS * 0.4);
        this.configureBoardMetrics(this.game.size);
        this.gridTexture = this.generateGrid(this.game.size);

        this.gobanGroup = null;
        this.stones = [];
        this.stoneMap = Array(this.game.size).fill(null).map(() => Array(this.game.size).fill(null));
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.baseY);
    }

    configureBoardMetrics(size = this.game.size) {
        this.gobanScale = 1;
        const divisions = Math.max(1, size - 1);
        const referenceDivisions = Math.max(1, this.REFERENCE_BOARD_SIZE - 1);
        const referencePlayableSize = this.BOARD_LOCAL_SIZE * (this.GRID_SIZE - this.PAD * 2) / this.GRID_SIZE;
        const referenceEdgeMargin = this.BOARD_LOCAL_SIZE * this.PAD / this.GRID_SIZE;

        this.worldStep = referencePlayableSize / referenceDivisions;
        this.boardLocalSize = referenceEdgeMargin * 2 + this.worldStep * divisions;
        const boardPixelsPerWorldUnit = this.GRID_SIZE / this.boardLocalSize;

        this.gridPad = referenceEdgeMargin * boardPixelsPerWorldUnit;
        this.STEP = this.worldStep * boardPixelsPerWorldUnit;
        this.gridLineWidth = this.GRID_LINE_WIDTH * (boardPixelsPerWorldUnit / (this.GRID_SIZE / this.BOARD_LOCAL_SIZE));
        this.starPointRadius = this.STAR_POINT_RADIUS * (boardPixelsPerWorldUnit / (this.GRID_SIZE / this.BOARD_LOCAL_SIZE));
        this.worldOffset = -(this.worldStep * divisions) / 2;
        this.baseY = this.BOARD_TOP_Y + (this.STONE_RADIUS * 0.4);
    }

    updateBoardMeshLayout() {
        if (!this.boardBody) return;

        const boardScale = this.boardLocalSize / this.BOARD_LOCAL_SIZE;
        this.boardBody.scale.set(boardScale, 1, boardScale);
        this.updateWoodTextureScale(boardScale);

        const halfSize = this.boardLocalSize / 2;
        const legOffset = Math.max(0, halfSize - 0.8);
        this.boardLegs?.forEach((leg, index) => {
            const x = index % 2 === 0 ? -legOffset : legOffset;
            const z = index < 2 ? legOffset : -legOffset;
            leg.position.set(x, 1.5 - 1.25 + 0.995, z);
        });
    }

    getScaledBoardTopY() {
        return this.baseY * this.gobanScale;
    }

    cloneWoodTextureSet() {
        return Object.fromEntries(
            Object.entries(this.woodTex)
                .filter(([, texture]) => texture)
                .map(([key, texture]) => [key, texture.clone()])
        );
    }

    setTextureRepeat(textureSet, repeatX, repeatY) {
        Object.values(textureSet).forEach(texture => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeatX, repeatY);
            texture.needsUpdate = true;
        });
    }

    updateWoodTextureScale(boardScale = this.boardLocalSize / this.BOARD_LOCAL_SIZE) {
        const topRepeat = this.REFERENCE_WOOD_REPEAT * boardScale;
        const sideRepeatX = this.REFERENCE_WOOD_REPEAT * boardScale;

        if (this.sideWoodTextures) {
            this.setTextureRepeat(this.sideWoodTextures, sideRepeatX, this.REFERENCE_WOOD_REPEAT);
        }

        if (this.topWoodTextures) {
            this.setTextureRepeat(this.topWoodTextures, topRepeat, topRepeat);
        }

        if (this.bottomWoodTextures) {
            this.setTextureRepeat(this.bottomWoodTextures, topRepeat, topRepeat);
        }
    }

    updateCameraPresets() {
        const cameraScale = this.getCameraViewScale();
        this.pos2D.copy(this.default2DPos).multiplyScalar(cameraScale);
        this.target2D.copy(this.default2DTarget).multiplyScalar(this.gobanScale);
        this.updateCameraProjection();
    }

    getOrthoViewHeight() {
        const aspect = this.getViewportWidth() / this.getViewportHeight();
        const boardSpan = (this.boardLocalSize + (this.worldStep * 2)) * this.gobanScale;
        return Math.max(12, boardSpan, boardSpan / aspect);
    }

    updateCameraProjection() {
        const aspect = this.getViewportWidth() / this.getViewportHeight();
        this.perspectiveCamera.aspect = aspect;
        this.perspectiveCamera.updateProjectionMatrix();

        const halfHeight = this.getOrthoViewHeight() / 2;
        const halfWidth = halfHeight * aspect;
        Object.assign(this.orthoCamera, {
            left: -halfWidth,
            right: halfWidth,
            top: halfHeight,
            bottom: -halfHeight,
            near: 0.1,
            far: 100,
        });
        this.orthoCamera.updateProjectionMatrix();
    }

    setActiveCamera(camera, preservePose = false) {
        if (this.camera === camera) return;
        if (preservePose) {
            camera.position.copy(this.camera.position);
            camera.quaternion.copy(this.camera.quaternion);
        }
        this.camera = camera;
        this.controls.object = camera;
        this.controls.update();
    }

    sync2DCamera() {
        this.orthoCamera.position.copy(this.pos2D);
        this.orthoCamera.quaternion.copy(this.quat2D);
    }

    updateSceneBackground() {
        this.scene.environment = this.envMap;
        this.scene.background = this.is2D ? new THREE.Color(0x000000) : this.envMap;
    }

    getCameraViewScale() {
        return 0.72 + (this.gobanScale * 0.28);
    }

    updateStoneMeshScale(mesh) {
        if (!mesh) return;
        const scaleCompensation = 1 / this.gobanScale;
        mesh.scale.set(scaleCompensation, 0.4 * scaleCompensation, scaleCompensation);
    }

    updateStoneScales() {
        this.stones.forEach(stone => this.updateStoneMeshScale(stone.mesh));
        this.updateStoneMeshScale(this.ghostStone);
    }

    applyBoardScale(size = this.game.size, preserveView = true) {
        const previousScale = this.gobanScale || 1;
        const previousCameraScale = this.getCameraViewScale();
        this.configureBoardMetrics(size);
        this.updateCameraPresets();
        const cameraScale = this.getCameraViewScale();

        if (this.gobanGroup) {
            this.gobanGroup.scale.setScalar(this.gobanScale);
        }
        this.updateBoardMeshLayout();
        this.updateStoneScales();

        if (this.interactionPlane) {
            this.interactionPlane.constant = -this.getScaledBoardTopY();
        }

        if (!preserveView) {
            this.perspectiveCamera.position.copy(this.default3DPos).multiplyScalar(cameraScale);
            this.controls.target.copy(this.default3DTarget).multiplyScalar(this.gobanScale);
            this.saved3DPos.copy(this.perspectiveCamera.position);
            this.saved3DTarget.copy(this.controls.target);
            this.sync2DCamera();
            if (this.is2D) {
                this.camera.position.copy(this.pos2D);
                this.camera.quaternion.copy(this.quat2D);
                this.controls.target.copy(this.target2D);
            }
            return;
        }

        const cameraRatio = cameraScale / previousCameraScale;
        const targetRatio = this.gobanScale / previousScale;
        if (this.is2D) {
            this.sync2DCamera();
            this.camera.position.copy(this.pos2D);
            this.controls.target.copy(this.target2D);
            this.camera.quaternion.copy(this.quat2D);
        } else {
            this.perspectiveCamera.position.multiplyScalar(cameraRatio);
            this.controls.target.multiplyScalar(targetRatio);
        }

        this.saved3DPos.multiplyScalar(cameraRatio);
        this.saved3DTarget.multiplyScalar(targetRatio);
    }

    getStarPointIndices(size = this.game.size) {
        if (size === 19) return [3, 9, 15];
        if (size === 13) return [3, 6, 9];
        if (size === 9) return [2, 4, 6];
        return [];
    }

    generateGrid(size = this.game.size) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = this.GRID_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, this.GRID_SIZE, this.GRID_SIZE);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = this.gridLineWidth;
        for (let i = 0; i < size; i++) {
            const c = this.gridPad + i * this.STEP;
            ctx.beginPath();
            ctx.moveTo(c, this.gridPad);
            ctx.lineTo(c, this.GRID_SIZE - this.gridPad);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(this.gridPad, c);
            ctx.lineTo(this.GRID_SIZE - this.gridPad, c);
            ctx.stroke();
        }
        ctx.fillStyle = '#000';
        const starPoints = this.getStarPointIndices(size);
        starPoints.forEach(r => starPoints.forEach(c => {
            ctx.beginPath();
            ctx.arc(this.gridPad + r * this.STEP, this.gridPad + c * this.STEP, this.starPointRadius, 0, Math.PI * 2);
            ctx.fill();
        }));
        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        return texture;
    }

    removeGroup(group) {
        group.forEach(([i, j]) => {
            const stoneData = this.stoneMap[i][j];
            if (!stoneData) return;
            if (stoneData.mesh) {
                this.gobanGroup.remove(stoneData.mesh);
                const index = this.stones.indexOf(stoneData);
                if (index !== -1) this.stones.splice(index, 1);
            }
            this.stoneMap[i][j] = null;
        });
    }

    playMove(i, j, color, isInitial = false, chargeDuration = 0) {
        const moveResult = this.game.playMove(i, j, color);
        if (!moveResult) return false;

        this.removeGroup(moveResult.captured);
        this.createStoneVisual(i, j, color, isInitial, chargeDuration);
        if (!isInitial) {
            this.soundManager.playStonePlacement({
                chargeDuration,
                captureCount: moveResult.captured.length,
            });
        }
        this.onBoardChanged();
        if (!isInitial && typeof this.options.onMove === 'function') {
            this.options.onMove({
                i,
                j,
                color,
                captured: moveResult.captured.length,
                currentPlayer: this.game.currentPlayer,
                moveNumber: this.game.moveNumber,
            });
        }
        return true;
    }

    setInteractive(value) {
        this._interactive = Boolean(value);
    }

    destroy() {
        this._disposed = true;
        this._interactive = false;
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        for (const { target, type, handler, options } of this._domListeners) {
            target.removeEventListener(type, handler, options);
        }
        this._domListeners = [];
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement?.parentNode?.removeChild(this.renderer.domElement);
        }
    }

    createStoneVisual(i, j, color, isInitial = false, chargeDuration = 0) {
        const basex = this.worldOffset + i * this.worldStep;
        const basey = this.baseY + (color === 1 ? -0.002 : 0.015);
        const basez = this.worldOffset + j * this.worldStep;
        const stoneMaterial = this.getStoneMaterial(i, j, color);

        const stone = new THREE.Mesh(this.stoneGeo, stoneMaterial);
        this.updateStoneMeshScale(stone);
        stone.castShadow = stone.receiveShadow = true;
        this.gobanGroup.add(stone);

        let power = 0;
        let slamY = basey;
        if (!isInitial) {
            const t = Math.max(0, chargeDuration - 100) / 370;
            power = 2.0 * (1 - Math.exp(-2.5 * t));
            slamY = basey + 0.5 + power * 2;
        }

        stone.position.set(basex, slamY, basez);
        const stoneData = {
            mesh: stone,
            color,
            i,
            j,
            basex,
            basey,
            basez,
            slamY,
            power,
            rattleEnergy: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            offsetX: 0,
            offsetY: 0,
            offsetZ: 0,
        };

        this.stones.push(stoneData);
        this.stoneMap[i][j] = stoneData;
    }

    getStoneMaterial(i, j, color) {
        if (!this.isHistoryPreviewActive || this.historyCursor == null) {
            return color === 1 ? this.blackMat : this.whiteMat;
        }

        const snapshotBoard = this.evaluationTimeline[this.historyCursor]?.board;
        const existedInSelectedHistory = snapshotBoard?.[i]?.[j] === color;
        if (existedInSelectedHistory) {
            return color === 1 ? this.blackMat : this.whiteMat;
        }

        return color === 1 ? this.historyBlackMat : this.historyWhiteMat;
    }

    onBoardChanged() {
        this.clearScoringState();
        const score = this.game.estimateScore();
        this.leadHistory.push(score.lead);
        this.recordEvaluationSnapshot(score);
        this.refreshAnalysis();
        this.maybeTriggerAiTurn();
    }

    getLeadChartHistory() {
        const history = this.evaluationTimeline.map(entry => entry.lead);
        if (history.length <= 1) return history;

        const flatUntilIndex = Math.min(5, history.length - 1);
        const baselineLead = history[0];
        for (let index = 1; index <= flatUntilIndex; index++) {
            history[index] = baselineLead;
        }
        return history;
    }

    shouldAutoAcceptScoring() {
        return this.mode === 'aivai';
    }

    clearScoringState() {
        this.scoringState = null;
        this.hud.setScoreReview(null);
        this.applyDeadStoneVisuals();
    }

    formatMoveLabel(move, moveNumber) {
        if (!move || moveNumber === 0) return 'Move 0';
        const color = move.color === 1 ? 'B' : 'W';
        if (move.pass) return `Move ${moveNumber} • ${color} pass`;
        return `Move ${moveNumber} • ${color} ${move.i + 1},${move.j + 1}`;
    }

    getMovePointKey(move) {
        if (!move || move.pass || move.i == null || move.j == null) return null;
        return `${move.i},${move.j}`;
    }

    getHistoricalFutureMoves(limit = 10) {
        if (!this.isHistoryPreviewActive || this.historyCursor == null) return [];

        const futureMoves = [];
        for (let index = this.historyCursor + 1; index < this.evaluationTimeline.length && futureMoves.length < limit; index++) {
            const move = this.evaluationTimeline[index]?.move;
            if (!move || move.pass) continue;
            futureMoves.push({
                ...move,
                previewIndex: futureMoves.length,
            });
        }
        return futureMoves;
    }

    getHistoricalTipMoveMaps() {
        const topMoves = this.historyTipAnalysis?.topMoves ?? [];
        const bottomMoves = this.historyTipAnalysis?.bottomMoves ?? [];
        const topMap = new Map(topMoves.map((move, index) => [`${move.i},${move.j}`, { move, index }]));
        const bottomMap = new Map(bottomMoves.map((move, index) => [`${move.i},${move.j}`, { move, index }]));
        return { topMoves, bottomMoves, topMap, bottomMap };
    }

    canPassTurn() {
        if (!this.isReady || !this.isHumanTurn()) return false;
        if (this.isHistoryPreviewActive) return Boolean(this.historyShadowGame) && !this.isAiThinking;
        if (this.mode === 'puzzle') return false;
        return this.game.consecutivePasses < 2;
    }

    shouldShowHistoricalTips() {
        if (!this.tipVisible || !this.isHistoryPreviewActive || !this.historyShadowGame) return false;
        if (this.mode === 'pvai') return this.historyShadowGame.currentPlayer === this.humanColor;
        if (this.mode === 'puzzle') return this.puzzleState?.solverColor === this.historyShadowGame.currentPlayer;
        return true;
    }

    recordEvaluationSnapshot(score, { resetCursor = true } = {}) {
        const snapshot = {
            moveNumber: this.game.moveNumber,
            lead: score.lead,
            label: this.formatMoveLabel(this.game.lastMove, this.game.moveNumber),
            board: this.game.cloneBoard(),
            score,
            consecutivePasses: this.game.consecutivePasses,
            move: this.game.lastMove ? { ...this.game.lastMove } : null,
            currentPlayer: this.game.currentPlayer,
            koPos: this.game.koPos ? [...this.game.koPos] : null,
            captures: { ...this.game.captures },
            lastMove: this.game.lastMove ? { ...this.game.lastMove } : null,
            history: this.game.getHistory().map(move => ({ ...move })),
        };
        const lastSnapshot = this.evaluationTimeline[this.evaluationTimeline.length - 1];
        if (lastSnapshot?.moveNumber === snapshot.moveNumber) {
            this.evaluationTimeline[this.evaluationTimeline.length - 1] = snapshot;
        } else {
            this.evaluationTimeline.push(snapshot);
        }
        if (resetCursor) this.historyCursor = null;
    }

    updateLeadMeterDisplay() {
        const history = this.getLeadChartHistory();
        const selectedIndex = history.length
            ? (this.historyCursor == null ? history.length - 1 : Math.max(0, Math.min(this.historyCursor, history.length - 1)))
            : null;
        const selectedSnapshot = selectedIndex == null ? null : this.evaluationTimeline[selectedIndex];
        const activeLead = this.isHistoryPreviewActive && this.historyShadowGame
            ? this.historyShadowGame.estimateScore().lead
            : (selectedSnapshot?.lead ?? 0);
        const activeLabel = this.isHistoryPreviewActive && selectedSnapshot
            ? `${selectedSnapshot.label}${this.historyShadowMoveCount ? ` + ${this.historyShadowMoveCount} shadow` : ''}`
            : (selectedSnapshot ? selectedSnapshot.label : 'Live');
        this.hud.setLeadData({
            lead: activeLead,
            history,
            selectedIndex,
            moveLabel: activeLabel,
            canStepBack: selectedIndex != null && selectedIndex > 0,
            canStepForward: selectedIndex != null && selectedIndex < history.length - 1,
        });
    }

    stepLeadHistory(delta) {
        if (!this.evaluationTimeline.length) return;
        const currentIndex = this.historyCursor == null
            ? this.evaluationTimeline.length - 1
            : this.historyCursor;
        const nextIndex = Math.max(0, Math.min(currentIndex + delta, this.evaluationTimeline.length - 1));
        this.historyCursor = nextIndex === this.evaluationTimeline.length - 1 ? null : nextIndex;
        this.updateLeadMeterDisplay();
        this.updateHistoryPreview();
    }

    setLeadHistoryIndex(index) {
        if (!this.evaluationTimeline.length) return;
        const nextIndex = Math.max(0, Math.min(index, this.evaluationTimeline.length - 1));
        this.historyCursor = nextIndex === this.evaluationTimeline.length - 1 ? null : nextIndex;
        this.updateLeadMeterDisplay();
        this.updateHistoryPreview();
    }

    updateHistoryPreview() {
        const previewSnapshot = this.historyCursor == null ? null : this.evaluationTimeline[this.historyCursor];
        this.isHistoryPreviewActive = Boolean(previewSnapshot);
        this.historyShadowGame = previewSnapshot ? this.createGameFromSnapshot(previewSnapshot) : null;
        this.historyShadowMoveCount = 0;
        this.clearHistoricalTipAnalysis();
        this.hud.setPassEnabled(this.canPassTurn());

        if (!previewSnapshot) {
            this.syncVisualsFromGame();
            this.updateSuggestionMarker();
            this.updatePuzzleHintMarkers();
            this.updateInfluenceMarkers(this.getLiveInfluenceScore());
            this.updatePreviewFutureMarkers();
            if (this.latestAnalysis) this.hud.setAnalysis(this.formatAnalysisText(this.latestAnalysis));
            return;
        }

        this.syncVisualsFromBoard(previewSnapshot.board);
        this.updateSuggestionMarker();
        this.updatePuzzleHintMarkers();
        this.updateTerritoryMarkers(previewSnapshot);
        this.updateInfluenceMarkers(previewSnapshot);
        this.updatePreviewFutureMarkers();
        this.hud.setAnalysis(this.formatHistoricalFallbackText());
        if (this.shouldShowHistoricalTips()) this.refreshHistoricalTip();
    }

    createGameFromSnapshot(snapshot) {
        const game = new GoGame(this.game.size, this.game.komi);
        game.board = snapshot.board.map(row => row.slice());
        game.currentPlayer = snapshot.currentPlayer;
        game.koPos = snapshot.koPos ? [...snapshot.koPos] : null;
        game.moveNumber = snapshot.moveNumber;
        game.lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
        game.history = snapshot.history.map(move => ({ ...move }));
        game.captures = { ...snapshot.captures };
        game.consecutivePasses = snapshot.consecutivePasses;
        return game;
    }

    playHistoryShadowMove(i, j) {
        if (!this.isHistoryPreviewActive || !this.historyShadowGame) return false;
        const color = this.historyShadowGame.currentPlayer;
        const result = this.historyShadowGame.playMove(i, j, color);
        if (!result) return false;

        this.historyShadowMoveCount += 1;
        const shadowScore = this.historyShadowGame.estimateScore();
        this.syncVisualsFromBoard(this.historyShadowGame.board);
        this.updateLeadMeterDisplay();
        this.hud.setPassEnabled(this.canPassTurn());
        this.updateSuggestionMarker();
        this.updatePuzzleHintMarkers();
        this.updateTerritoryMarkers({
            board: this.historyShadowGame.board,
            score: shadowScore,
            consecutivePasses: this.historyShadowGame.consecutivePasses,
        });
        this.updateInfluenceMarkers({
            board: this.historyShadowGame.board,
            score: shadowScore,
            consecutivePasses: this.historyShadowGame.consecutivePasses,
        });
        this.updatePreviewFutureMarkers();
        this.clearHistoricalTipAnalysis();
        this.hud.setAnalysis(this.formatHistoricalFallbackText());
        if (this.shouldShowHistoricalTips()) this.refreshHistoricalTip();
        return true;
    }

    passHistoryShadowTurn() {
        if (!this.isHistoryPreviewActive || !this.historyShadowGame) return false;
        const color = this.historyShadowGame.currentPlayer;
        if (!this.historyShadowGame.pass(color)) return false;

        this.historyShadowMoveCount += 1;
        const shadowScore = this.historyShadowGame.estimateScore();
        this.syncVisualsFromBoard(this.historyShadowGame.board);
        this.updateLeadMeterDisplay();
        this.hud.setPassEnabled(this.canPassTurn());
        this.updateSuggestionMarker();
        this.updatePuzzleHintMarkers();
        this.updateTerritoryMarkers({
            board: this.historyShadowGame.board,
            score: shadowScore,
            consecutivePasses: this.historyShadowGame.consecutivePasses,
        });
        this.updateInfluenceMarkers({
            board: this.historyShadowGame.board,
            score: shadowScore,
            consecutivePasses: this.historyShadowGame.consecutivePasses,
        });
        this.updatePreviewFutureMarkers();
        this.clearHistoricalTipAnalysis();
        this.hud.setAnalysis(this.formatHistoricalFallbackText());
        if (this.shouldShowHistoricalTips()) this.refreshHistoricalTip();
        return true;
    }

    clearHistoryPreviewState() {
        this.isHistoryPreviewActive = false;
        this.historyShadowGame = null;
        this.historyShadowMoveCount = 0;
        this.clearHistoricalTipAnalysis();
    }

    getPositionKey(game) {
        const lastMove = game.lastMove
            ? `${game.lastMove.color}:${game.lastMove.pass ? 'pass' : `${game.lastMove.i},${game.lastMove.j}`}`
            : 'none';
        return [
            game.currentPlayer,
            game.moveNumber,
            game.consecutivePasses,
            game.koPos ? game.koPos.join(',') : 'none',
            lastMove,
            game.board.map(row => row.join('')).join('|'),
        ].join('::');
    }

    clearHistoricalTipAnalysis() {
        this.historyTipRequestId += 1;
        this.historyTipAnalysis = null;
        this.historyTipPositionKey = null;
    }

    formatHistoricalFallbackText() {
        if (!this.isHistoryPreviewActive || !this.historyShadowGame) {
            return this.latestAnalysis ? this.formatAnalysisText(this.latestAnalysis) : this.hud.analysis.textContent;
        }

        const game = this.historyShadowGame;
        const score = game.estimateScore();
        const leaderName = score.leader === 1 ? 'Black' : score.leader === 2 ? 'White' : 'Even';
        const leadValue = Math.abs(score.lead).toFixed(1);
        const turnName = game.currentPlayer === 1 ? 'Black' : 'White';
        const label = this.historyCursor == null ? 'Live' : this.evaluationTimeline[this.historyCursor]?.label ?? 'History';
        const shadowSuffix = this.historyShadowMoveCount ? ` + ${this.historyShadowMoveCount} shadow` : '';

        return [
            'Mode: History Preview',
            'AI: heuristic / preview',
            'Net: dan / upstream',
            `Position: ${label}${shadowSuffix}`,
            `Turn: ${turnName}`,
            `Lead: ${leaderName === 'Even' ? 'Even' : `${leaderName} +${leadValue}`}`,
            this.shouldShowHistoricalTips() ? 'Tip: loading dan top moves...' : 'Tip: hidden',
            this.shouldShowHistoricalTips() ? 'Top 5: loading...' : 'Top 5: hidden',
            this.shouldShowHistoricalTips() ? 'Blunders: loading...' : 'Blunders: hidden',
            `Captures: B ${game.captures[1]} | W ${game.captures[2]}`,
            `Passes: ${game.consecutivePasses}/2`,
        ].join('\n');
    }

    formatHistoricalAnalysisText(analysis, game) {
        const { heuristic, suggestedMove, topMoves, bottomMoves, backend, model, encoder, winRate, passScore } = analysis;
        const leaderName = heuristic.leader === 1 ? 'Black' : heuristic.leader === 2 ? 'White' : 'Even';
        const leadValue = Math.abs(heuristic.lead).toFixed(1);
        const turnName = game.currentPlayer === 1 ? 'Black' : 'White';
        const tip = suggestedMove ? `${suggestedMove.i + 1}, ${suggestedMove.j + 1}` : 'pass';
        const rankedTips = (topMoves?.length
            ? topMoves.map((move, index) => `${index + 1}. ${move.i + 1}, ${move.j + 1} (${move.score.toFixed(3)})`).join(' | ')
            : 'n/a');
        const blunderTips = (bottomMoves?.length
            ? bottomMoves.map((move, index) => `${index + 1}. ${move.i + 1}, ${move.j + 1} (${move.score.toFixed(3)})`).join(' | ')
            : 'n/a');
        const winLine = winRate == null ? 'AI confidence: n/a' : `AI confidence: ${(winRate * 100).toFixed(1)}%`;
        const label = this.historyCursor == null ? 'Live' : this.evaluationTimeline[this.historyCursor]?.label ?? 'History';
        const shadowSuffix = this.historyShadowMoveCount ? ` + ${this.historyShadowMoveCount} shadow` : '';

        return [
            'Mode: History Preview',
            `AI: ${backend} / dan`,
            `Net: ${model ?? 'dan'} / ${encoder ?? 'upstream'}`,
            `Position: ${label}${shadowSuffix}`,
            `Turn: ${turnName}`,
            `Lead: ${leaderName === 'Even' ? 'Even' : `${leaderName} +${leadValue}`}`,
            `Tip: ${tip}`,
            `Top 5: ${rankedTips}`,
            `Blunders: ${blunderTips}`,
            `Pass Score: ${passScore == null ? 'n/a' : passScore.toFixed(3)}`,
            winLine,
            `Captures: B ${game.captures[1]} | W ${game.captures[2]}`,
            `Passes: ${game.consecutivePasses}/2`,
        ].join('\n');
    }

    async refreshHistoricalTip() {
        if (!this.shouldShowHistoricalTips()) return;

        const previewGame = this.createGameFromSnapshot({
            board: this.historyShadowGame.board,
            currentPlayer: this.historyShadowGame.currentPlayer,
            koPos: this.historyShadowGame.koPos,
            moveNumber: this.historyShadowGame.moveNumber,
            lastMove: this.historyShadowGame.lastMove,
            history: this.historyShadowGame.getHistory(),
            captures: this.historyShadowGame.captures,
            consecutivePasses: this.historyShadowGame.consecutivePasses,
        });
        const positionKey = this.getPositionKey(previewGame);
        const cached = this.historyTipCache.get(positionKey);

        this.historyTipPositionKey = positionKey;
        if (cached) {
            this.historyTipAnalysis = cached;
            this.hud.setAnalysis(this.formatHistoricalAnalysisText(cached, previewGame));
            this.updateSuggestionMarker();
            this.updatePreviewFutureMarkers();
            return;
        }

        const requestId = ++this.historyTipRequestId;
        this.historyTipAnalysis = null;
        this.hud.setAnalysis(this.formatHistoricalFallbackText());
        this.updateSuggestionMarker();

        try {
            const analysis = await this.aiEngine.analyze(previewGame, {
                level: 'dan',
                maxSuggestions: 5,
            });
            if (
                requestId !== this.historyTipRequestId ||
                !this.tipVisible ||
                !this.isHistoryPreviewActive ||
                this.getPositionKey(this.historyShadowGame) !== positionKey
            ) return;

            this.historyTipCache.set(positionKey, analysis);
            this.historyTipAnalysis = analysis;
            this.historyTipPositionKey = positionKey;
            this.hud.setAnalysis(this.formatHistoricalAnalysisText(analysis, this.historyShadowGame));
            this.updateSuggestionMarker();
            this.updatePreviewFutureMarkers();
        } catch (error) {
            if (requestId !== this.historyTipRequestId) return;
            console.warn('Historical tip analysis failed', error);
            this.historyTipAnalysis = null;
            this.hud.setAnalysis(`${this.formatHistoricalFallbackText()}\nAI: unavailable`);
            this.updateSuggestionMarker();
            this.updatePreviewFutureMarkers();
        }
    }

    getInteractionGame() {
        return this.isHistoryPreviewActive && this.historyShadowGame
            ? this.historyShadowGame
            : this.game;
    }

    getLiveInfluenceScore() {
        return this.latestAnalysis?.heuristic ?? this.game.estimateScore();
    }

    getOwnershipAt(analysis, i, j) {
        if (!analysis?.ownership?.length) return 0;
        const raw = analysis.ownership[i * this.game.size + j] ?? 0;
        return analysis.currentPlayer === 1 ? raw : -raw;
    }

    suggestDeadStones(analysis) {
        if (!analysis?.ownership?.length) return new Set();

        const dead = new Set();
        const visited = new Set();
        const threshold = 0.72;

        for (let i = 0; i < this.game.size; i++) {
            for (let j = 0; j < this.game.size; j++) {
                const color = this.game.board[i][j];
                if (!color) continue;

                const key = `${i},${j}`;
                if (visited.has(key)) continue;

                const group = this.game.getGroup(i, j, color);
                group.forEach(([gi, gj]) => visited.add(`${gi},${gj}`));

                let total = 0;
                for (const [gi, gj] of group) total += this.getOwnershipAt(analysis, gi, gj);
                const avgOwnership = total / group.length;
                const isBlackDead = color === 1 && avgOwnership <= -threshold;
                const isWhiteDead = color === 2 && avgOwnership >= threshold;
                if (!isBlackDead && !isWhiteDead) continue;

                group.forEach(([gi, gj]) => dead.add(`${gi},${gj}`));
            }
        }

        return dead;
    }

    updateScoringState(deadStoneKeys = this.scoringState?.deadStoneKeys ?? new Set()) {
        const normalizedKeys = deadStoneKeys instanceof Set ? deadStoneKeys : new Set(deadStoneKeys);
        const summary = this.game.getScoringSummary(normalizedKeys);
        const suggestedDead = this.scoringState?.suggestedDead ?? new Set();
        const accepted = this.shouldAutoAcceptScoring();
        const source = this.scoringState?.source ?? 'Manual review';

        this.scoringState = {
            active: true,
            accepted,
            source,
            suggestedDead,
            deadStoneKeys: new Set(normalizedKeys),
            summary,
        };
        this.renderScoringReview();
    }

    renderScoringReview() {
        if (!this.scoringState?.active) {
            this.hud.setScoreReview(null);
            this.applyDeadStoneVisuals();
            return;
        }

        const { summary, source, accepted, deadStoneKeys, suggestedDead } = this.scoringState;
        const leaderName = summary.leader === 1 ? 'Black' : summary.leader === 2 ? 'White' : 'Even';
        const leadValue = Math.abs(summary.lead).toFixed(1);
        const suggestedCount = suggestedDead.size;
        const removedCount = deadStoneKeys.size;
        const autoAccepted = this.shouldAutoAcceptScoring();

        this.recordEvaluationSnapshot(summary, { resetCursor: false });
        this.updateLeadMeterDisplay();
        this.hud.setAnalysis([
            'Mode: Score Review',
            'Rules: Japanese territory',
            leaderName === 'Even' ? 'Result: Draw' : `Result: ${leaderName} wins by ${leadValue}`,
            `Final Score: B ${summary.blackScore.toFixed(1)} | W ${summary.whiteScore.toFixed(1)}`,
            `Territory: B ${summary.blackTerritory} | W ${summary.whiteTerritory}`,
            `Prisoners: B ${summary.blackPrisoners} | W ${summary.whitePrisoners}`,
            `Removed Dead: B ${summary.removedBlack} | W ${summary.removedWhite}`,
            autoAccepted ? 'Status: AI accepted score' : 'Review: click stones to toggle dead/alive, then accept',
        ].join('\n'));
        this.hud.setScoreReview({
            visible: true,
            accepted,
            autoAccepted,
            status: [
                `Source: ${source}`,
                `Suggested dead stones: ${suggestedCount}`,
                `Selected dead stones: ${removedCount}`,
                autoAccepted ? 'Status: AI accepted' : (accepted ? 'Status: accepted' : 'Status: review pending'),
            ].join('\n'),
        });
        this.updateSuggestionMarker();
        this.applyDeadStoneVisuals();
        this.updateTerritoryMarkers(summary);
        this.updateInfluenceMarkers(this.game.estimateScore());
    }

    async prepareScoringReview(requestId) {
        if (!this.isAiBoardSupported()) {
            if (requestId !== this.analysisRequestId || this.game.consecutivePasses < 2) return;
            this.scoringState = {
                active: true,
                accepted: false,
                source: 'Manual review only',
                suggestedDead: new Set(),
                deadStoneKeys: new Set(),
                summary: this.game.getScoringSummary(),
            };
            this.renderScoringReview();
            return;
        }

        try {
            const analysis = await this.aiEngine.analyze(this.game, {
                level: this.aiLevels[this.game.currentPlayer],
                maxSuggestions: 0,
            });
            if (requestId !== this.analysisRequestId || this.game.consecutivePasses < 2) return;
            this.latestAnalysis = analysis;
            const suggestedDead = this.suggestDeadStones(analysis);
            this.scoringState = {
                active: true,
                accepted: this.shouldAutoAcceptScoring(),
                source: 'KataGo ownership suggestion',
                suggestedDead,
                deadStoneKeys: new Set(suggestedDead),
                summary: this.game.getScoringSummary(suggestedDead),
            };
        } catch (error) {
            if (requestId !== this.analysisRequestId || this.game.consecutivePasses < 2) return;
            console.warn('Score review analysis failed', error);
            this.scoringState = {
                active: true,
                accepted: this.shouldAutoAcceptScoring(),
                source: 'Manual review only',
                suggestedDead: new Set(),
                deadStoneKeys: new Set(),
                summary: this.game.getScoringSummary(),
            };
        }

        this.renderScoringReview();
    }

    toggleDeadGroupAt(i, j) {
        if (!this.scoringState?.active) return false;
        const color = this.game.board[i]?.[j] ?? 0;
        if (!color) return false;

        const group = this.game.getGroup(i, j, color);
        const shouldRemove = group.some(([gi, gj]) => !this.scoringState.deadStoneKeys.has(`${gi},${gj}`));
        const nextDead = new Set(this.scoringState.deadStoneKeys);

        for (const [gi, gj] of group) {
            const key = `${gi},${gj}`;
            if (shouldRemove) nextDead.add(key);
            else nextDead.delete(key);
        }

        this.scoringState.accepted = this.shouldAutoAcceptScoring();
        this.updateScoringState(nextDead);
        return true;
    }

    acceptScoreReview() {
        if (!this.scoringState?.active) return;
        this.scoringState.accepted = true;
        this.renderScoringReview();
    }

    resumeGameFromScoring() {
        if (!this.scoringState?.active) return;
        this.game.consecutivePasses = 0;
        this.clearScoringState();
        this.refreshAnalysis();
        this.maybeTriggerAiTurn();
    }

    applyDeadStoneVisuals() {
        const deadKeys = this.scoringState?.active ? this.scoringState.deadStoneKeys : null;
        for (const stone of this.stones) {
            const isDead = Boolean(deadKeys?.has(`${stone.i},${stone.j}`));
            stone.mesh.material = isDead
                ? (stone.color === 1 ? this.deadBlackMat : this.deadWhiteMat)
                : (stone.color === 1 ? this.blackMat : this.whiteMat);
            stone.mesh.position.y = stone.basey + (isDead ? 0.03 : 0);
        }
    }

    async refreshAnalysis() {
        const requestId = ++this.analysisRequestId;
        const score = this.game.estimateScore();
        this.recordEvaluationSnapshot(score, { resetCursor: false });
        this.updateLeadMeterDisplay();
        this.hud.setPassEnabled(this.canPassTurn());
        this.hud.setPuzzleHintEnabled(Boolean(
            this.mode === 'puzzle' &&
            this.puzzleState &&
            !this.puzzleState.failed &&
            !this.puzzleState.solved &&
            this.game.currentPlayer === this.puzzleState.solverColor
        ));

        if (this.mode === 'puzzle' && !this.puzzleState) {
            this.latestAnalysis = null;
            this.hud.setScoreReview(null);
            this.hud.setAnalysis('Mode: SGF Puzzle\nLoad a puzzle list, then open an SGF file');
            this.hud.setPuzzleTree('No puzzle loaded');
            this.updatePuzzleHintMarkers();
            this.updateSuggestionMarker();
            this.updateTerritoryMarkers();
            this.updateInfluenceMarkers(this.game.estimateScore());
            return;
        }

        if (this.mode === 'puzzle' && this.puzzleState) {
            this.latestAnalysis = null;
            this.hud.setScoreReview(null);
            this.hud.setAnalysis(this.formatPuzzleText());
            this.hud.setPuzzleTree(this.formatPuzzleTree());
            this.updatePuzzleHintMarkers();
            this.updateSuggestionMarker();
            this.updateTerritoryMarkers();
            this.updateInfluenceMarkers(this.game.estimateScore());
            return;
        }

        this.hud.setPuzzleTree('Puzzle tree hidden outside puzzle mode');

        if (this.game.consecutivePasses >= 2) {
            if (!this.scoringState?.active) {
                this.hud.setAnalysis(this.isAiBoardSupported()
                    ? 'Mode: Score Review\nPreparing KataGo ownership review...'
                    : `Mode: Score Review\nManual review only on ${this.game.size}x${this.game.size}`);
                this.hud.setScoreReview({
                    visible: true,
                    accepted: this.shouldAutoAcceptScoring(),
                    autoAccepted: this.shouldAutoAcceptScoring(),
                    status: this.isAiBoardSupported()
                        ? (this.shouldAutoAcceptScoring()
                            ? 'Source: KataGo ownership suggestion\nStatus: AI preparing accepted score'
                            : 'Source: KataGo ownership suggestion\nStatus: preparing review')
                        : 'Source: Manual review only\nStatus: AI scoring is unavailable for this board size',
                });
                this.updateTerritoryMarkers();
                this.updateInfluenceMarkers(this.game.estimateScore());
                this.prepareScoringReview(requestId);
                return;
            }
            this.renderScoringReview();
            return;
        }

        const fallbackText = this.formatAnalysisText({
            backend: 'heuristic',
            level: this.aiLevels[this.game.currentPlayer],
            heuristic: score,
            suggestedMove: null,
            topMoves: [],
            winRate: null,
            passScore: null,
        });
        this.hud.setAnalysis(fallbackText);
        this.updateTerritoryMarkers(score);
        this.updateInfluenceMarkers(score);

        if (!this.isAiBoardSupported()) {
            this.latestAnalysis = null;
            this.hud.setAnalysis(`${fallbackText}\nAI: unavailable on ${this.game.size}x${this.game.size}`);
            this.updateSuggestionMarker();
            return;
        }

        try {
            const analysis = await this.aiEngine.analyze(this.game, {
                level: this.aiLevels[this.game.currentPlayer],
                maxSuggestions: 5,
            });
            if (requestId !== this.analysisRequestId) return;
            this.latestAnalysis = analysis;
            this.hud.setAnalysis(this.formatAnalysisText(analysis));
            this.recordEvaluationSnapshot(analysis.heuristic, { resetCursor: false });
            this.updateLeadMeterDisplay();
            this.updateSuggestionMarker();
            this.updateTerritoryMarkers(analysis.heuristic);
            this.updateInfluenceMarkers(analysis.heuristic);
        } catch (error) {
            if (requestId !== this.analysisRequestId) return;
            console.warn('AI analysis failed', error);
            this.latestAnalysis = null;
            this.hud.setAnalysis(`${fallbackText}\nAI: unavailable`);
            this.updateSuggestionMarker();
            this.updateTerritoryMarkers(score);
            this.updateInfluenceMarkers(score);
        }
    }

    formatAnalysisText(analysis) {
        const { heuristic, suggestedMove, topMoves, bottomMoves, backend, level, model, encoder, winRate, passScore } = analysis;
        const isFinished = this.game.consecutivePasses >= 2;
        const leaderName = heuristic.leader === 1 ? 'Black' : heuristic.leader === 2 ? 'White' : 'Even';
        const leadValue = Math.abs(heuristic.lead).toFixed(1);
        const turnName = this.game.currentPlayer === 1 ? 'Black' : 'White';
        const tip = suggestedMove ? `${suggestedMove.i + 1}, ${suggestedMove.j + 1}` : 'pass';
        const rankedTips = (topMoves?.length
            ? topMoves.map((move, index) => `${index + 1}. ${move.i + 1}, ${move.j + 1} (${move.score.toFixed(3)})`).join(' | ')
            : 'n/a');
        const blunderTips = (bottomMoves?.length
            ? bottomMoves.map((move, index) => `${index + 1}. ${move.i + 1}, ${move.j + 1} (${move.score.toFixed(3)})`).join(' | ')
            : 'n/a');
        const winLine = winRate == null ? 'AI confidence: n/a' : `AI confidence: ${(winRate * 100).toFixed(1)}%`;
        const modeLabel = this.mode === 'pvp' ? 'Player vs Player' : this.mode === 'pvai' ? 'Player vs AI' : 'AI vs AI';
        const resultLine = heuristic.leader === 0
            ? 'Result: Draw'
            : `Result: ${leaderName} wins by ${leadValue}`;
        const territoryLine = `Territory: B ${heuristic.blackTerritory} | W ${heuristic.whiteTerritory}`;
        const influenceLine = `Influence: B ${heuristic.blackInfluence.toFixed(1)} | W ${heuristic.whiteInfluence.toFixed(1)}`;

        if (isFinished) {
            return [
                `Mode: ${modeLabel}`,
                'Game Over',
                resultLine,
                `Final Score: B ${heuristic.blackScore.toFixed(1)} | W ${heuristic.whiteScore.toFixed(1)}`,
                territoryLine,
                influenceLine,
                `Captures: B ${this.game.captures[1]} | W ${this.game.captures[2]}`,
                `Passes: ${this.game.consecutivePasses}/2`,
            ].join('\n');
        }

        return [
            `Mode: ${modeLabel}`,
            `AI: ${backend} / ${level}`,
            `Net: ${model ?? level} / ${encoder ?? 'unknown'}`,
            `Turn: ${turnName}`,
            `Lead: ${leaderName === 'Even' ? 'Even' : `${leaderName} +${leadValue}`}`,
            `Tip: ${tip}`,
            `Top 5: ${rankedTips}`,
            `Blunders: ${blunderTips}`,
            `Pass Score: ${passScore == null ? 'n/a' : passScore.toFixed(3)}`,
            winLine,
            territoryLine,
            `Captures: B ${this.game.captures[1]} | W ${this.game.captures[2]}`,
            `Passes: ${this.game.consecutivePasses}/2`,
        ].join('\n');
    }

    formatPuzzleText() {
        const turnName = this.game.currentPlayer === 1 ? 'Black' : 'White';
        const title = this.puzzleState?.title ?? 'SGF Puzzle';
        const status = this.puzzleState?.status ?? 'Solve the position';
        const comment = this.puzzleState?.comment ?? '';
        const solverName = this.puzzleState?.solverColor === 1 ? 'Black' : 'White';
        const result = this.puzzleState?.solved ? 'Solved' : this.puzzleState?.failed ? 'Failed' : 'In progress';
        const continuation = this.puzzleState?.continuationEnabled ? 'AI continuation enabled' : 'Puzzle validation only';

        return [
            `Mode: SGF Puzzle`,
            `Title: ${title}`,
            `Solver: ${solverName}`,
            `Turn: ${turnName}`,
            `Result: ${result}`,
            `Status: ${status}`,
            `After Solve: ${continuation}`,
            comment ? `Note: ${comment}` : 'Note: follow the SGF branches',
        ].join('\n');
    }

    formatPuzzleTree() {
        if (!this.puzzleState) return 'No puzzle loaded';

        const frontier = this.getPuzzleFrontier(this.puzzleState.currentNode);
        const lines = [
            `Current status: ${this.puzzleState.status}`,
            `Current frontier: ${frontier.length} branch(es)`,
        ];

        if (!frontier.length) {
            lines.push('No further SGF branches from this node.');
            return lines.join('\n');
        }

        frontier.forEach((child, index) => {
            const moveLabel = child.move
                ? child.move.pass
                    ? `${child.move.color === 1 ? 'B' : 'W'} pass`
                    : `${child.move.color === 1 ? 'B' : 'W'} ${child.move.point.i + 1},${child.move.point.j + 1}`
                : 'No move node';
            const mark = child.isCorrect ? '[OK]' : child.isWrong ? '[X]' : '[?]';
            const comment = child.comment ? ` - ${child.comment.replace(/\s+/g, ' ').slice(0, 70)}` : '';
            lines.push(`${index + 1}. ${mark} ${moveLabel}${comment}`);
        });

        return lines.join('\n');
    }

    updateSuggestionMarker() {
        if (!this.suggestionMarkers?.length || !this.blunderMarkers?.length) return;

        const rankedMoves = !this.tipVisible
            ? []
            : this.isHistoryPreviewActive
                ? (this.shouldShowHistoricalTips() ? (this.historyTipAnalysis?.topMoves ?? []) : [])
                : this.game.consecutivePasses < 2
                    ? (this.latestAnalysis?.topMoves ?? [])
                    : [];
        const blunderMoves = !this.tipVisible
            ? []
            : this.isHistoryPreviewActive
                ? (this.shouldShowHistoricalTips() ? (this.historyTipAnalysis?.bottomMoves ?? []) : [])
                : this.game.consecutivePasses < 2
                    ? (this.latestAnalysis?.bottomMoves ?? [])
                    : [];
        const overlapKeys = this.isHistoryPreviewActive && this.shouldShowHistoricalTips()
            ? new Set(this.getHistoricalFutureMoves().map(move => this.getMovePointKey(move)).filter(Boolean))
            : new Set();
        this.suggestionMarkers.forEach((entry, index) => {
            const move = rankedMoves[index];
            if (!move || overlapKeys.has(this.getMovePointKey(move))) {
                entry.group.visible = false;
                return;
            }

            const style = this.getTopMoveStyle(index, rankedMoves);
            entry.ring.material.color.setHex(style.color);
            entry.ring.scale.setScalar(style.scale);
            entry.group.visible = true;
            entry.group.position.set(
                this.worldOffset + move.i * this.worldStep,
                this.baseY + 0.04 + (index * 0.002),
                this.worldOffset + move.j * this.worldStep
            );
            entry.label.material.map?.dispose();
            entry.label.material.map = this.createTipLabelTexture(style.emoji, style);
            entry.label.material.needsUpdate = true;
        });

        this.blunderMarkers.forEach((entry, index) => {
            const move = blunderMoves[index];
            if (!move || overlapKeys.has(this.getMovePointKey(move))) {
                entry.group.visible = false;
                return;
            }

            const style = this.getBlunderMoveStyle(index, blunderMoves);
            entry.ring.material.color.setHex(style.color);
            entry.ring.scale.setScalar(style.scale);
            entry.group.visible = true;
            entry.group.position.set(
                this.worldOffset + move.i * this.worldStep,
                this.baseY + 0.025 + (index * 0.002),
                this.worldOffset + move.j * this.worldStep
            );
            entry.label.material.map?.dispose();
            entry.label.material.map = this.createTipLabelTexture(style.emoji, style);
            entry.label.material.needsUpdate = true;
        });
    }

    getTopMoveStyle(index, rankedMoves) {
        if (index === 0) {
            return {
                emoji: '🤩',
                color: 0x2e8b57,
                scale: 1.1,
                glow: 'rgba(34, 197, 94, 0.42)',
            };
        }

        const current = rankedMoves[index]?.score ?? -Infinity;
        const best = rankedMoves[0]?.score ?? current;
        const gap = best - current;

        if (gap <= 0.025) {
            return {
                emoji: '👍',
                color: 0xf59e0b,
                scale: 0.98,
                glow: 'rgba(245, 158, 11, 0.42)',
            };
        }

        return {
            emoji: '🙂',
            color: 0xfde68a,
            scale: 0.9,
            glow: 'rgba(253, 230, 138, 0.34)',
        };
    }

    getBlunderMoveStyle(index, blunderMoves) {
        const current = blunderMoves[index]?.score ?? -Infinity;
        const safest = blunderMoves[0]?.score ?? current;
        const gap = safest - current;

        if (index === blunderMoves.length - 1 || gap > 0.08) {
            return {
                emoji: '😱',
                color: 0x991b1b,
                scale: 0.94,
                glow: 'rgba(153, 27, 27, 0.42)',
            };
        }

        return {
            emoji: '😭',
            color: 0xdc2626,
            scale: 0.88,
            glow: 'rgba(220, 38, 38, 0.4)',
        };
    }

    createTipLabelTexture(text, style = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.shadowColor = style.glow ?? 'rgba(255,255,255,0.36)';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 140px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    createPreviewMoveLabelTexture(text, color, accentText = '', accentColor = null) {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');
        const isCombinedMarker = Boolean(accentText);
        const circleRadius = isCombinedMarker ? 62 : 52;
        const numberFontSize = isCombinedMarker ? 50 : 54;
        const accentFontSize = isCombinedMarker ? 18 : 20;
        const numberY = isCombinedMarker ? 60 : (accentText ? 64 : (canvas.height / 2 + 2));
        const accentY = isCombinedMarker ? 114 : 112;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = color === 1 ? 'rgba(17,17,17,0.58)' : 'rgba(255,252,245,0.64)';
        ctx.strokeStyle = color === 1 ? 'rgba(255,252,245,0.96)' : 'rgba(17,17,17,0.92)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, circleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = color === 1 ? '#fffaf0' : '#111111';
        ctx.font = `700 ${numberFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, numberY);

        if (accentText) {
            ctx.fillStyle = accentColor ?? (color === 1 ? '#fffaf0' : '#111111');
            ctx.font = `700 ${accentFontSize}px Arial`;
            ctx.fillText(accentText, canvas.width / 2, accentY);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    updateTerritoryMarkers(score = null) {
        if (!this.gobanGroup || !this.territoryMarkers) return;

        this.territoryMarkers.forEach(marker => this.gobanGroup.remove(marker));
        this.territoryMarkers = [];

        const renderBoard = score?.board ?? this.game.board;
        const renderPasses = score?.consecutivePasses ?? this.game.consecutivePasses;

        if (this.mode === 'puzzle' || renderPasses < 2) return;

        const finalScore = score?.score ? score.score : (score ?? this.game.estimateScore());
        const scoringBoard = finalScore.board ?? renderBoard;
        for (let i = 0; i < renderBoard.length; i++) {
            for (let j = 0; j < renderBoard.length; j++) {
                if (scoringBoard[i][j] !== 0) continue;

                const territoryOwner = finalScore.territoryMap?.[i]?.[j] ?? 0;
                if (!territoryOwner) continue;

                const marker = new THREE.Mesh(
                    new THREE.CircleGeometry(0.12, 20),
                    new THREE.MeshBasicMaterial({
                        color: territoryOwner === 1 ? 0x111111 : 0xf3efe6,
                        transparent: true,
                        opacity: 0.42,
                        side: THREE.DoubleSide,
                    })
                );
                marker.rotation.x = Math.PI / 2;
                marker.position.set(
                    this.worldOffset + i * this.worldStep,
                    this.baseY + 0.03,
                    this.worldOffset + j * this.worldStep
                );
                this.territoryMarkers.push(marker);
                this.gobanGroup.add(marker);
            }
        }
    }

    updateInfluenceMarkers(score = null) {
        if (!this.gobanGroup || !this.influenceMarkers) return;

        this.influenceMarkers.forEach(marker => this.gobanGroup.remove(marker));
        this.influenceMarkers = [];

        if (!this.influenceVisible) return;

        const liveScore = score?.score ? score.score : (score ?? this.getLiveInfluenceScore());
        const renderBoard = score?.board ?? this.game.board;
        const influenceMap = liveScore?.influenceMap;
        if (!influenceMap) return;

        for (let i = 0; i < renderBoard.length; i++) {
            for (let j = 0; j < renderBoard.length; j++) {
                if (renderBoard[i][j] !== 0) continue;

                const influenceOwner = influenceMap[i]?.[j] ?? 0;
                if (!influenceOwner) continue;
                const distance = this.findNearestStoneDistanceOnBoard(renderBoard, i, j, influenceOwner);
                const clampedDistance = Math.min(8, Math.max(1, distance));
                const opacity = 0.12 + ((8 - clampedDistance) / 7) * 0.46;

                const marker = new THREE.Mesh(
                    new THREE.CircleGeometry(0.12, 20),
                    new THREE.MeshBasicMaterial({
                        color: influenceOwner === 1 ? 0x111111 : 0xf3efe6,
                        transparent: true,
                        opacity,
                        side: THREE.DoubleSide,
                    })
                );
                marker.rotation.x = Math.PI / 2;
                marker.position.set(
                    this.worldOffset + i * this.worldStep,
                    this.baseY + 0.03,
                    this.worldOffset + j * this.worldStep
                );
                this.influenceMarkers.push(marker);
                this.gobanGroup.add(marker);
            }
        }
    }

    findNearestStoneDistanceOnBoard(board, startI, startJ, targetColor) {
        let best = Infinity;
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board.length; j++) {
                if (board[i][j] !== targetColor) continue;
                best = Math.min(best, Math.abs(startI - i) + Math.abs(startJ - j));
            }
        }
        return best;
    }

    updatePreviewFutureMarkers() {
        if (!this.previewFutureMarkers) return;

        this.previewFutureMarkers.forEach(entry => {
            this.gobanGroup?.remove(entry.group);
            entry.label.material.map?.dispose();
        });
        this.previewFutureMarkers = [];

        if (!this.isHistoryPreviewActive || this.historyCursor == null || !this.shouldShowHistoricalTips()) return;

        const futureMoves = this.getHistoricalFutureMoves();
        const { topMoves, bottomMoves, topMap, bottomMap } = this.getHistoricalTipMoveMaps();

        futureMoves.forEach((move, index) => {
            const pointKey = this.getMovePointKey(move);
            const topMatch = pointKey ? topMap.get(pointKey) : null;
            const bottomMatch = pointKey ? bottomMap.get(pointKey) : null;
            const matchedStyle = topMatch
                ? this.getTopMoveStyle(topMatch.index, topMoves)
                : bottomMatch
                    ? this.getBlunderMoveStyle(bottomMatch.index, bottomMoves)
                    : null;
            const accentText = matchedStyle?.emoji ?? '';
            const ringColor = matchedStyle?.color ?? (move.color === 1 ? 0x111111 : 0xfffcf5);
            const accentColor = topMatch
                ? '#dcfce7'
                : bottomMatch
                    ? '#fecaca'
                    : (move.color === 1 ? '#fffaf0' : '#111111');
            const group = new THREE.Group();
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.19, 0.03, 12, 32),
                new THREE.MeshBasicMaterial({
                    color: ringColor,
                    transparent: true,
                    opacity: 0.58,
                })
            );
            ring.rotation.x = Math.PI / 2;

            const label = new THREE.Sprite(new THREE.SpriteMaterial({
                transparent: true,
                depthTest: false,
                depthWrite: false,
                map: this.createPreviewMoveLabelTexture(String(index + 1), move.color, accentText, accentColor),
            }));
            label.position.set(0, 0.24, 0);
            label.scale.set(accentText ? 0.46 : 0.38, accentText ? 0.46 : 0.38, 1);

            group.position.set(
                this.worldOffset + move.i * this.worldStep,
                this.baseY + 0.015 + (index * 0.003),
                this.worldOffset + move.j * this.worldStep
            );
            group.add(ring);
            group.add(label);
            this.gobanGroup?.add(group);
            this.previewFutureMarkers.push({ group, label });
        });
    }

    isHumanTurn() {
        if (this.isHistoryPreviewActive) return Boolean(this.historyShadowGame);
        if (this.mode === 'puzzle') {
            if (!this.puzzleState) return false;
            if (this.puzzleState.failed) return false;
            if (this.puzzleState.solved && this.puzzleState.continuationEnabled) {
                return this.game.currentPlayer === this.puzzleState.solverColor;
            }
            return this.game.currentPlayer === this.puzzleState.solverColor && !this.puzzleState.solved;
        }
        if (this.mode === 'pvp') return true;
        if (this.mode === 'aivai') return false;
        return this.game.currentPlayer === this.humanColor;
    }

    maybeTriggerAiTurn() {
        if (this.isHistoryPreviewActive) return;
        if (this.scoringState?.active) return;
        if (this.mode === 'puzzle') {
            if (!this.puzzleState?.continuationEnabled || !this.puzzleState.solved || this.puzzleState.failed) return;
            if (!this.isReady || this.isAiThinking || this.game.consecutivePasses >= 2) return;
            if (this.game.currentPlayer === this.puzzleState.solverColor) return;
            this.requestAiMove(false);
            return;
        }
        if (!this.isReady || this.isAiThinking || this.game.consecutivePasses >= 2) return;
        if (this.mode === 'pvp') return;
        if (this.mode === 'pvai' && this.game.currentPlayer === this.humanColor) return;
        this.requestAiMove(false);
    }

    async requestAiMove(force) {
        if (!this.isReady || this.isAiThinking || this.scoringState?.active || !this.isAiBoardSupported()) return;
        if (!force && this.isHumanTurn()) return;

        this.isAiThinking = true;
        this.hud.setAiBusy(true);
        const movingColor = this.game.currentPlayer;
        const movingLevel = this.aiLevels[movingColor];
        try {
            await new Promise(resolve => setTimeout(resolve, 450));
            const analysis = await this.aiEngine.analyze(this.game, {
                level: movingLevel,
                maxSuggestions: 5,
            });
            this.latestAnalysis = analysis;
            this.hud.setAnalysis(this.formatAnalysisText(analysis));
            this.recordEvaluationSnapshot(analysis.heuristic, { resetCursor: false });
            this.updateLeadMeterDisplay();
            this.updateSuggestionMarker();

            const move = analysis.suggestedMove;
            if (!move) {
                this.game.pass(movingColor);
                this.leadHistory.push(this.game.estimateScore().lead);
                this.recordEvaluationSnapshot(this.game.estimateScore());
                this.refreshAnalysis();
                return;
            }
            this.playMove(move.i, move.j, movingColor, false, 350);
        } catch (error) {
            console.error('AI move failed', error);
            this.refreshAnalysis();
        } finally {
            this.isAiThinking = false;
            this.hud.setAiBusy(false);
            if (this.mode === 'aivai' && this.game.consecutivePasses < 2) {
                setTimeout(() => this.maybeTriggerAiTurn(), 250);
            }
        }
    }

    passTurn() {
        if (this.isHistoryPreviewActive) return this.passHistoryShadowTurn();
        if (!this.isReady || !this.isHumanTurn() || this.game.consecutivePasses >= 2 || this.scoringState?.active) return false;
        const didPass = this.game.pass(this.game.currentPlayer);
        if (!didPass) return false;
        const score = this.game.estimateScore();
        this.leadHistory.push(score.lead);
        this.recordEvaluationSnapshot(score);
        this.refreshAnalysis();
        this.maybeTriggerAiTurn();
        return true;
    }

    resetStandardGame(size = this.boardSize) {
        this.boardSize = size;
        this.game = new GoGame(size);
        const baseMode = this.mode === 'puzzle' ? 'pvp' : this.mode;
        this.mode = this.normalizeModeForBoardSize(baseMode, size);
        this.puzzleState = null;
        this.puzzleHintPoints = [];
        this.puzzleOutcomeCache = new WeakMap();
        this.clearScoringState();
        this.clearHistoryPreviewState();
        this.leadHistory = [0];
        this.evaluationTimeline = [];
        this.historyCursor = null;
        this.latestAnalysis = null;
        this.rebuildBoardForSize(size);
        this.clearVisualBoard();
        this.updatePuzzleHintMarkers();
        this.syncBoardCapabilities(size);
        this.hud.setMode(this.mode);
        this.recordEvaluationSnapshot(this.game.estimateScore(), { resetCursor: false });
        this.refreshAnalysis();
    }

    async loadPuzzleList(sourceUrl) {
        if (!sourceUrl) return;
        this.hud.setPuzzleStatus('Loading puzzle list...');
        try {
            const files = await this.onlineService.loadPuzzleList(sourceUrl);
            const sourceInfo = this.onlineService.describeSource(sourceUrl);
            this.puzzleFiles = files;
            this.selectedPuzzleUrl = files[0]?.rawUrl ?? '';
            this.hud.setPuzzleFiles(files);
            this.hud.setSelectedPuzzle(this.selectedPuzzleUrl);
            this.hud.setPuzzleStatus(files.length
                ? `Loaded ${files.length} SGF files\nSource: ${sourceInfo.label}`
                : 'No SGF files found in that folder');
        } catch (error) {
            console.error(error);
            this.hud.setPuzzleStatus(`Puzzle list failed\n${error.message}`);
        }
    }

    async loadPuzzleFromUrl(url) {
        if (!url) {
            this.hud.setPuzzleStatus('Select an SGF puzzle first');
            return;
        }

        this.hud.setPuzzleStatus('Loading SGF puzzle...');
        try {
            const sgfText = await this.onlineService.loadPuzzleText(url);
            const puzzle = parseSgf(sgfText);
            this.applyPuzzle(puzzle, url);
            this.hud.setPuzzleStatus(`Loaded puzzle\n${puzzle.title}`);
        } catch (error) {
            console.error(error);
            this.hud.setPuzzleStatus(`Puzzle load failed\n${error.message}`);
        }
    }

    applyPuzzle(puzzle, url) {
        if (puzzle.size !== 19) {
            throw new Error(`Only 19x19 SGF puzzles are supported right now (got ${puzzle.size})`);
        }

        this.mode = 'puzzle';
        this.boardSize = puzzle.size;
        this.hud.setMode('puzzle');
        this.selectedPuzzleUrl = url;
        this.game = new GoGame(puzzle.size);
        this.clearScoringState();
        this.clearHistoryPreviewState();
        this.game.currentPlayer = puzzle.currentPlayer;
        this.puzzleOutcomeCache = new WeakMap();

        for (const [i, j] of puzzle.setup.black) this.game.board[i][j] = 1;
        for (const [i, j] of puzzle.setup.white) this.game.board[i][j] = 2;

        this.puzzleState = {
            title: puzzle.title,
            root: puzzle.tree,
            currentNode: puzzle.tree,
            solverColor: puzzle.currentPlayer,
            hasExplicitMarks: puzzle.hasExplicitMarks,
            comment: puzzle.comment,
            status: 'Solve the position',
            solved: false,
            failed: false,
            continuationEnabled: true,
        };

        this.leadHistory = [this.game.estimateScore().lead];
        this.evaluationTimeline = [];
        this.historyCursor = null;
        this.latestAnalysis = null;
        this.puzzleHintPoints = [];
        this.rebuildBoardForSize(puzzle.size);
        this.syncBoardCapabilities(puzzle.size);
        this.recordEvaluationSnapshot(this.game.estimateScore(), { resetCursor: false });
        this.syncVisualsFromGame();
        this.refreshAnalysis();
    }

    attemptPuzzleMove(i, j, chargeDuration = 0) {
        if (!this.puzzleState || this.puzzleState.failed) return false;
        if (this.puzzleState.solved && this.puzzleState.continuationEnabled) {
            return this.playMove(i, j, this.game.currentPlayer, false, chargeDuration);
        }
        if (this.game.currentPlayer !== this.puzzleState.solverColor) return false;
        const nextNode = this.findMatchingPuzzleChild(this.puzzleState.currentNode, this.game.currentPlayer, i, j);
        if (!nextNode) {
            this.puzzleState.status = `Wrong move at ${i + 1}, ${j + 1}`;
            this.puzzleState.failed = true;
            this.puzzleState.comment = 'No matching SGF branch for that move';
            this.puzzleHintPoints = [];
            this.refreshAnalysis();
            return false;
        }

        const didPlay = this.playPuzzleNode(nextNode, chargeDuration);
        if (!didPlay) return false;
        this.puzzleHintPoints = [];
        this.advancePuzzleAutoResponses();
        this.refreshAnalysis();
        this.maybeTriggerAiTurn();
        return true;
    }

    findMatchingPuzzleChild(node, color, i, j) {
        return this.getPuzzleFrontier(node).find(child => {
            if (!child.move || child.move.color !== color || child.move.pass) return false;
            return child.move.point?.i === i && child.move.point?.j === j;
        }) ?? null;
    }

    otherColor(color) {
        return color === 1 ? 2 : 1;
    }

    getPuzzleMovesForColor(node, color) {
        return this.getPuzzleFrontier(node).filter(child => child.move && child.move.color === color);
    }

    isPuzzleWinningNode(node, nextPlayer) {
        if (!this.puzzleState) return false;

        let cacheEntry = this.puzzleOutcomeCache.get(node);
        if (cacheEntry && cacheEntry[nextPlayer] !== undefined) {
            return cacheEntry[nextPlayer];
        }
        if (!cacheEntry) {
            cacheEntry = {};
            this.puzzleOutcomeCache.set(node, cacheEntry);
        }

        let result;
        if (node.isWrong) {
            result = false;
        } else if (node.isCorrect) {
            result = true;
        } else {
            const moves = this.getPuzzleMovesForColor(node, nextPlayer);
            if (!moves.length) {
                result = !this.puzzleState.hasExplicitMarks;
            } else if (nextPlayer === this.puzzleState.solverColor) {
                result = moves.some(child => this.isPuzzleWinningNode(child, this.otherColor(nextPlayer)));
            } else {
                result = moves.every(child => this.isPuzzleWinningNode(child, this.otherColor(nextPlayer)));
            }
        }

        cacheEntry[nextPlayer] = result;
        return result;
    }

    getCorrectPuzzleMoves(node, color) {
        return this.getPuzzleMovesForColor(node, color)
            .filter(child => this.isPuzzleWinningNode(child, this.otherColor(color)));
    }

    getPuzzleFrontier(node) {
        const frontier = [];

        const visit = current => {
            if (!current.children.length) {
                frontier.push(current);
                return;
            }

            for (const child of current.children) {
                if (child.move) {
                    frontier.push(child);
                } else {
                    visit(child);
                }
            }
        };

        visit(node);
        return frontier;
    }

    playPuzzleNode(node, chargeDuration = 0) {
        if (!node.move) {
            this.puzzleState.currentNode = node;
            return true;
        }

        let didApply = false;
        if (node.move.pass) {
            didApply = this.game.pass(node.move.color);
        } else {
            didApply = this.playMove(node.move.point.i, node.move.point.j, node.move.color, false, chargeDuration);
        }
        if (!didApply) return false;

        this.puzzleState.currentNode = node;
        this.puzzleState.comment = node.comment || this.puzzleState.comment;
        const nextPlayer = this.otherColor(node.move.color);
        const remainsWinning = this.isPuzzleWinningNode(node, nextPlayer);
        if (node.isCorrect) {
            this.puzzleState.status = 'Solved, continuing with AI';
            this.puzzleState.solved = true;
        } else if (node.isWrong) {
            this.puzzleState.status = 'Wrong line';
            this.puzzleState.failed = true;
        } else if (node.move.color === this.puzzleState.solverColor && !remainsWinning) {
            this.puzzleState.status = 'Wrong line';
            this.puzzleState.failed = true;
            this.puzzleState.comment = node.comment || 'That move does not keep a correct continuation.';
        } else if (!node.children.length && !this.puzzleState.hasExplicitMarks) {
            this.puzzleState.status = 'Line complete, continuing with AI';
            this.puzzleState.solved = true;
        } else if (!node.children.length) {
            this.puzzleState.status = 'Reached end of line, but not explicitly marked solved';
        } else {
            this.puzzleState.status = 'Correct so far';
        }
        return true;
    }

    advancePuzzleAutoResponses() {
        while (this.puzzleState && !this.puzzleState.solved && !this.puzzleState.failed) {
            const node = this.puzzleState.currentNode;
            if (this.game.currentPlayer === this.puzzleState.solverColor) break;

            const responses = this.getCorrectPuzzleMoves(node, this.game.currentPlayer);
            if (!responses.length) break;
            if (!this.playPuzzleNode(responses[0], 220)) break;
        }

        if (this.puzzleState && !this.puzzleState.solved && !this.puzzleState.failed) {
            const node = this.puzzleState.currentNode;
            const frontier = this.getPuzzleMovesForColor(node, this.game.currentPlayer);
            const correctFrontier = this.getCorrectPuzzleMoves(node, this.game.currentPlayer);
            if (!frontier.length && !this.puzzleState.hasExplicitMarks) {
                this.puzzleState.status = 'Solved, continuing with AI';
                this.puzzleState.solved = true;
            } else if (!frontier.length) {
                this.puzzleState.status = 'Reached end of line, but not explicitly marked solved';
            } else if (this.game.currentPlayer === this.puzzleState.solverColor) {
                if (!correctFrontier.length) {
                    this.puzzleState.status = 'Wrong line';
                    this.puzzleState.failed = true;
                    this.puzzleState.comment = this.puzzleState.comment || 'No winning continuation remains from this position.';
                } else {
                    this.puzzleState.status = correctFrontier.length === 1 ? 'Your next move' : 'Choose the right move';
                }
            } else {
                if (!correctFrontier.length) {
                    this.puzzleState.status = 'Wrong line';
                    this.puzzleState.failed = true;
                    this.puzzleState.comment = this.puzzleState.comment || 'This branch fails against the listed opponent responses.';
                } else {
                    this.puzzleState.status = correctFrontier.length === 1
                        ? 'Opponent has a forced response'
                        : 'Opponent has multiple valid responses';
                }
            }
        }

        if (this.puzzleState?.solved && this.puzzleState.continuationEnabled) {
            this.puzzleState.comment = this.puzzleState.comment || 'Puzzle solved. Play continues from the resulting position.';
        }
    }

    syncVisualsFromGame() {
        this.syncVisualsFromBoard(this.game.board);
        this.updateTerritoryMarkers();
    }

    syncVisualsFromBoard(board) {
        this.clearVisualBoard();
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board.length; j++) {
                const color = board[i][j];
                if (color !== 0) this.createStoneVisual(i, j, color, true, 0);
            }
        }
    }

    clearVisualBoard() {
        for (const stone of this.stones) {
            if (stone.mesh) this.gobanGroup?.remove(stone.mesh);
        }
        this.stones = [];
        this.stoneMap = Array(this.game.size).fill(null).map(() => Array(this.game.size).fill(null));
        this.territoryMarkers?.forEach(marker => this.gobanGroup?.remove(marker));
        this.territoryMarkers = [];
        this.influenceMarkers?.forEach(marker => this.gobanGroup?.remove(marker));
        this.influenceMarkers = [];
        this.previewFutureMarkers?.forEach(entry => {
            this.gobanGroup?.remove(entry.group);
            entry.label.material.map?.dispose();
        });
        this.previewFutureMarkers = [];
        this.suggestionMarkers?.forEach(entry => {
            entry.group.visible = false;
            entry.label.material.map?.dispose();
            entry.label.material.map = null;
        });
        this.blunderMarkers?.forEach(entry => {
            entry.group.visible = false;
            entry.label.material.map?.dispose();
            entry.label.material.map = null;
        });
    }

    rebuildBoardForSize(size = this.game.size) {
        this.applyBoardScale(size);

        if (this.gridTexture) this.gridTexture.dispose();
        this.gridTexture = this.generateGrid(size);

        if (this.boardTopMaterial?.userData?.shader?.uniforms?.gridMap) {
            this.boardTopMaterial.userData.shader.uniforms.gridMap.value = this.gridTexture;
        }

        this.hoverI = -1;
        this.hoverJ = -1;
    }

    showPuzzleHint() {
        if (!this.puzzleState || this.puzzleState.failed || this.puzzleState.solved) return;
        if (this.game.currentPlayer !== this.puzzleState.solverColor) return;

        const hints = this.getCorrectPuzzleMoves(this.puzzleState.currentNode, this.game.currentPlayer)
            .filter(child => !child.move.pass)
            .map(child => child.move.point)
            .filter(Boolean);

        this.puzzleHintPoints = hints;
        if (!hints.length) {
            this.puzzleState.comment = 'No direct move hint is available on this branch.';
        } else if (hints.length === 1) {
            this.puzzleState.comment = `Hint: try ${hints[0].i + 1}, ${hints[0].j + 1}`;
        } else {
            const coords = hints.map(point => `${point.i + 1},${point.j + 1}`).join(' or ');
            this.puzzleState.comment = `Hint candidates: ${coords}`;
        }

        this.refreshAnalysis();
    }

    updatePuzzleHintMarkers() {
        if (!this.puzzleHintMarkers) return;

        this.puzzleHintMarkers.forEach(marker => this.gobanGroup.remove(marker));
        this.puzzleHintMarkers = [];

        if (this.isHistoryPreviewActive || this.mode !== 'puzzle' || !this.puzzleHintPoints.length) return;

        for (const point of this.puzzleHintPoints) {
            const marker = new THREE.Mesh(
                new THREE.TorusGeometry(0.16, 0.025, 10, 28),
                new THREE.MeshBasicMaterial({ color: 0xd28b00 })
            );
            marker.rotation.x = Math.PI / 2;
            marker.position.set(
                this.worldOffset + point.i * this.worldStep,
                this.baseY + 0.035,
                this.worldOffset + point.j * this.worldStep
            );
            this.puzzleHintMarkers.push(marker);
            this.gobanGroup.add(marker);
        }
    }

    initApp() {
        this.updateSceneBackground();
        this.sideWoodTextures = this.cloneWoodTextureSet();
        this.topWoodTextures = this.cloneWoodTextureSet();
        this.bottomWoodTextures = this.cloneWoodTextureSet();
        this.updateWoodTextureScale();

        const sideMat = new THREE.MeshPhysicalMaterial({
            ...this.sideWoodTextures,
            displacementScale: 0,
            roughness: 0.95,
            metalness: 0.035,
        });
        const bottomMat = new THREE.MeshPhysicalMaterial({
            ...this.bottomWoodTextures,
            displacementScale: 0,
            roughness: 0.95,
            metalness: 0.035,
        });
        const topMat = new THREE.MeshPhysicalMaterial({
            ...this.topWoodTextures,
            displacementScale: 0,
            roughness: 0.95,
            metalness: 0.035,
        });
        this.boardTopMaterial = topMat;

        topMat.onBeforeCompile = shader => {
            shader.uniforms.gridMap = { value: this.gridTexture };
            topMat.userData.shader = shader;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nvarying vec2 vRawUv;')
                .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRawUv = uv;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nuniform sampler2D gridMap;\nvarying vec2 vRawUv;')
                .replace('#include <map_fragment>', '#include <map_fragment>\nfloat gridMask = 1.0 - texture2D(gridMap, vRawUv).r;\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.01, gridMask * 0.9);')
                .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.3, gridMask);');
        };

        this.gobanGroup = new THREE.Group();
        const boardGeo = new THREE.BoxGeometry(this.BOARD_LOCAL_SIZE, 4, this.BOARD_LOCAL_SIZE, 1, 1, 1);
        const uv = boardGeo.attributes.uv;
        for (let i = 0; i < 8; i++) uv.setXY(i, uv.getX(i) * 0.15, uv.getY(i) * 0.5);
        for (let i = 16; i < 24; i++) uv.setXY(i, uv.getX(i) * 0.20, uv.getY(i) * 0.4);
        uv.needsUpdate = true;

        const body = new THREE.Mesh(boardGeo, [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat]);
        body.position.y = 3.5;
        body.castShadow = body.receiveShadow = true;
        this.boardBody = body;
        this.gobanGroup.add(body);

        this.boardLegs = [[-4.2, 4.2], [4.2, 4.2], [-4.2, -4.2], [4.2, -4.2]].map(([x, z]) => {
            const leg = new THREE.Mesh(
                new THREE.CylinderGeometry(0.78, 0.22, 1.25, this.isMobile ? 24 : 48),
                sideMat
            );
            leg.position.set(x, 1.5 - 1.25 + 0.995, z);
            leg.castShadow = leg.receiveShadow = true;
            this.gobanGroup.add(leg);
            return leg;
        });

        const stoneSegs = this.isMobile ? 20 : 32;
        this.stoneGeo = new THREE.SphereGeometry(this.STONE_RADIUS, stoneSegs, stoneSegs);
        this.blackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.65, clearcoat: 0.15, clearcoatRoughness: 0.2 });
        this.whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.1 });
        this.historyBlackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.65, clearcoat: 0.15, clearcoatRoughness: 0.2, transparent: true, opacity: 0.78 });
        this.historyWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.1, transparent: true, opacity: 0.8 });
        this.deadBlackMat = new THREE.MeshPhysicalMaterial({ color: 0x444444, roughness: 0.8, transparent: true, opacity: 0.32 });
        this.deadWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, roughness: 0.35, transparent: true, opacity: 0.42 });
        this.ghostBlackMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, transparent: true, opacity: 0.6, roughness: 0.65 });
        this.ghostWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffcf5, transparent: true, opacity: 0.6, roughness: 0.25 });

        this.ghostStone = new THREE.Mesh(this.stoneGeo, this.ghostBlackMat);
        this.updateStoneMeshScale(this.ghostStone);
        this.ghostStone.castShadow = true;
        this.ghostStone.visible = false;
        this.gobanGroup.add(this.ghostStone);

        this.suggestionMarkers = Array.from({ length: 5 }, () => {
            const group = new THREE.Group();
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.21, 0.038, 14, 40),
                new THREE.MeshBasicMaterial({ color: 0x2e8b57 })
            );
            ring.rotation.x = Math.PI / 2;

            const label = new THREE.Sprite(new THREE.SpriteMaterial({
                transparent: true,
                depthTest: false,
                depthWrite: false,
            }));
            label.position.set(0, 0.04, 0);
            label.scale.set(0.44, 0.44, 1);

            group.visible = false;
            group.add(ring);
            group.add(label);
            this.gobanGroup.add(group);

            return { group, ring, label };
        });

        this.blunderMarkers = Array.from({ length: 3 }, () => {
            const group = new THREE.Group();
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.185, 0.034, 12, 36),
                new THREE.MeshBasicMaterial({ color: 0x991b1b })
            );
            ring.rotation.x = Math.PI / 2;

            const label = new THREE.Sprite(new THREE.SpriteMaterial({
                transparent: true,
                depthTest: false,
                depthWrite: false,
            }));
            label.position.set(0, 0.04, 0);
            label.scale.set(0.42, 0.42, 1);

            group.visible = false;
            group.add(ring);
            group.add(label);
            this.gobanGroup.add(group);

            return { group, ring, label };
        });

        this.puzzleHintMarkers = [];

        this.scene.add(this.gobanGroup);
        this.applyBoardScale(this.game.size, false);
        this.isReady = true;
        this.updateSuggestionMarker();
        this.updatePuzzleHintMarkers();
        this.updateTerritoryMarkers();
        this.updateInfluenceMarkers();
        this.maybeTriggerAiTurn();
        this.animate();
    }

    updateHover(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersect = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.interactionPlane, intersect)) {
            const localX = intersect.x / this.gobanScale;
            const localZ = intersect.z / this.gobanScale;
            const i = Math.round((localX - this.worldOffset) / this.worldStep);
            const j = Math.round((localZ - this.worldOffset) / this.worldStep);
            if (i >= 0 && i < this.game.size && j >= 0 && j < this.game.size) {
                this.hoverI = i;
                this.hoverJ = j;
                return;
            }
        }
        this.hoverI = this.hoverJ = -1;
    }

    addDomListener(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        this._domListeners.push({ target, type, handler, options });
    }

    setupEvents() {
        const canvas = this.renderer.domElement;

        this.addDomListener(canvas, 'pointerdown', e => {
            if (!this.isReady || !this._interactive) return;
            this.pointerDownPos = { x: e.clientX, y: e.clientY };
            this.updateHover(e);
            if (this.scoringState?.active && !this.isHistoryPreviewActive) return;
            if (!this.isHumanTurn()) return;
            const interactionGame = this.getInteractionGame();
            if (this.hoverI >= 0 && interactionGame.isLegalMove(this.hoverI, this.hoverJ)) {
                this.isCharging = true;
                this.chargeStart = performance.now();
                this.controls.enabled = false;
            }
        });

        this.addDomListener(window, 'pointermove', e => {
            if (this.isCharging) {
                if (Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y) > 15) {
                    this.isCharging = false;
                    if (!this.is2D) this.controls.enabled = true;
                }
                return;
            }
            this.updateHover(e);
        });

        this.addDomListener(window, 'pointerup', () => {
            if (this.scoringState?.active && !this.isHistoryPreviewActive && this.hoverI >= 0 && !this.scoringState.accepted) {
                this.toggleDeadGroupAt(this.hoverI, this.hoverJ);
                return;
            }
            const interactionGame = this.getInteractionGame();
            if (this.isCharging && this.hoverI >= 0 && interactionGame.isLegalMove(this.hoverI, this.hoverJ) && this.isHumanTurn()) {
                if (this.isHistoryPreviewActive) {
                    this.playHistoryShadowMove(this.hoverI, this.hoverJ);
                } else
                if (this.mode === 'puzzle') {
                    this.attemptPuzzleMove(this.hoverI, this.hoverJ, performance.now() - this.chargeStart);
                } else {
                    this.playMove(this.hoverI, this.hoverJ, this.game.currentPlayer, false, performance.now() - this.chargeStart);
                }
            }
            this.isCharging = false;
            if (!this.is2D) this.controls.enabled = true;
        });

        if (this.container) {
            this._resizeObserver = new ResizeObserver(() => this.handleResize());
            this._resizeObserver.observe(this.container);
        } else {
            this.addDomListener(window, 'resize', () => this.handleResize());
        }
    }

    handleResize() {
        if (this._disposed) return;
        this.updateCameraProjection();
        this.renderer.setSize(this.getViewportWidth(), this.getViewportHeight());
    }

    animate() {
        if (this._disposed) return;
        requestAnimationFrame(() => this.animate());
        this.animations.update(this);
        this.renderer.render(this.scene, this.camera);
    }

    getPuzzleSource() {
        return this.hud.getPuzzleSource();
    }

    setPuzzleSource(url) {
        this.hud.setPuzzleSource(url);
    }

    async reloadPuzzleList() {
        return this.loadPuzzleList(this.getPuzzleSource());
    }

    getOnlineState() {
        return {
            mode: this.mode,
            boardSize: this.game.size,
            source: this.getPuzzleSource(),
            selectedPuzzleUrl: this.selectedPuzzleUrl,
            puzzleFilesLoaded: this.puzzleFiles.length,
            puzzleTitle: this.puzzleState?.title ?? null,
            puzzleStatus: this.puzzleState?.status ?? null,
            capabilities: this.onlineService.getCapabilities(),
        };
    }
}
