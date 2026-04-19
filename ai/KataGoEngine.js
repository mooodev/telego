const TF_VERSION = '4.21.0';
const BATCHES = 1;
const CHANNELS = 22;
const GLOBAL_CHANNELS = 19;
const MODEL_BOARD_SIZE = 19;
const LEVEL_CONFIG = {
    dan: { model: 'dan', encoder: 'upstream', temperature: 0 },
    kyu: { model: 'kyu', encoder: 'upstream', temperature: 0.2 },
    'legacy-dan': { model: 'dan', encoder: 'legacy', temperature: 0 },
    'legacy-kyu': { model: 'kyu', encoder: 'legacy', temperature: 0.2 },
};

export class KataGoEngine {
    constructor() {
        this.models = new Map();
        this.backend = null;
        this.loadingPromise = null;
    }

    async init(level = 'dan') {
        if (!this.loadingPromise) {
            this.loadingPromise = this.loadBackendAndModels();
        }
        await this.loadingPromise;
        await this.ensureModel(level);
        return {
            backend: this.backend,
            level,
        };
    }

    async loadBackendAndModels() {
        if (!globalThis.tf) {
            throw new Error('TensorFlow.js is not available in the page');
        }

        if (globalThis.tf?.wasm?.setWasmPaths) {
            globalThis.tf.wasm.setWasmPaths(`https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${TF_VERSION}/dist/`);
        }

        await globalThis.tf.ready();
        this.backend = await this.selectBackend();
        await Promise.all([...new Set(Object.values(LEVEL_CONFIG).map(config => config.model))].map(level => this.ensureModel(level)));
    }

    async selectBackend() {
        const candidates = [];
        if ('gpu' in navigator && globalThis.tf.findBackend('webgpu')) candidates.push('webgpu');
        if (globalThis.tf.findBackend('wasm')) candidates.push('wasm');
        if (globalThis.tf.findBackend('webgl')) candidates.push('webgl');
        candidates.push('cpu');

        for (const name of candidates) {
            try {
                const success = await globalThis.tf.setBackend(name);
                if (success) {
                    await globalThis.tf.ready();
                    return name;
                }
            } catch (error) {
                console.warn(`Failed to use TensorFlow backend "${name}"`, error);
            }
        }

        throw new Error('No TensorFlow backend could be initialized');
    }

    async ensureModel(level) {
        const { model: modelLevel } = this.getLevelConfig(level);
        if (this.models.has(modelLevel)) return this.models.get(modelLevel);
        const model = await globalThis.tf.loadGraphModel(`./kata/models/${modelLevel}/model.json`);
        this.models.set(modelLevel, model);
        return model;
    }

    async analyze(game, options = {}) {
        if (game.size > MODEL_BOARD_SIZE) {
            throw new Error(`KataGo analysis supports boards up to ${MODEL_BOARD_SIZE}x${MODEL_BOARD_SIZE} (got ${game.size}x${game.size})`);
        }

        const level = options.level ?? 'dan';
        const maxSuggestions = options.maxSuggestions ?? 5;
        const config = this.getLevelConfig(level);
        const temperature = options.temperature ?? config.temperature ?? 0;
        await this.init(level);
        const model = this.models.get(config.model);

        const { binT, globalT } = this.createInputs(game, config);
        const outputs = await model.executeAsync(
            {
                'swa_model/bin_inputs': binT,
                'swa_model/global_inputs': globalT,
            },
            [
                'swa_model/policy_output',
                'swa_model/value_output',
                'swa_model/ownership_output',
                'swa_model/miscvalues_output',
            ]
        );

        const [policyTensor, valueTensor, ownershipTensor, miscTensor] = outputs;
        const [policyData, valueData, ownershipData, miscData] = await Promise.all([
            policyTensor.data(),
            valueTensor.data(),
            ownershipTensor.data(),
            miscTensor.data(),
        ]);

        const moveRanking = this.rankMoves(game, policyData, game.currentPlayer, maxSuggestions, temperature);
        const heuristic = game.estimateScore();

        binT.dispose();
        globalT.dispose();
        outputs.forEach(output => output.dispose());

        return {
            backend: this.backend,
            level,
            model: config.model,
            encoder: config.encoder,
            currentPlayer: game.currentPlayer,
            suggestedMove: moveRanking.suggestedMove,
            topMoves: moveRanking.topMoves,
            bottomMoves: moveRanking.bottomMoves,
            passScore: moveRanking.passScore,
            temperature,
            heuristic,
            winRate: this.extractWinRate(valueData),
            ownership: this.extractOwnershipForGame(game, ownershipData),
            misc: Array.from(miscData),
            rawValue: Array.from(valueData),
        };
    }

    getLevelConfig(level) {
        return LEVEL_CONFIG[level] ?? LEVEL_CONFIG.dan;
    }

    createInputs(game, config = LEVEL_CONFIG.dan) {
        if (config.encoder === 'legacy') return this.createLegacyInputs(game);
        return this.createUpstreamInputs(game);
    }

    createLegacyInputs(game) {
        const boardState = this.buildModelBoardState(game);
        const { board, koPos, onBoard } = boardState;
        const currentPlayer = game.currentPlayer;
        const opponent = 3 - currentPlayer;
        const { binInputsData, globalInputsData } = this.createInputBuffers();

        this.fillBoardInputs({
            board,
            onBoard,
            currentPlayer,
            opponent,
            binInputsData,
            onPoint: ({ i, j, baseIndex, color }) => {
                if (koPos && koPos[0] === i && koPos[1] === j) binInputsData[baseIndex + 3] = 1.0;
                if (game.lastMove && !game.lastMove.pass && game.lastMove.i === i && game.lastMove.j === j) {
                    binInputsData[baseIndex + 4] = 1.0;
                }
            },
        });

        globalInputsData[0] = 1.0;
        globalInputsData[1] = game.moveNumber / 200;
        globalInputsData[2] = game.captures[currentPlayer] / 50;
        globalInputsData[3] = game.captures[opponent] / 50;
        globalInputsData[4] = game.consecutivePasses / 2;
        globalInputsData[5] = currentPlayer === 1 ? game.komi / 20 : -game.komi / 20;

        return this.createTensorInputs(binInputsData, globalInputsData);
    }

    createUpstreamInputs(game) {
        const boardState = this.buildModelBoardState(game);
        const { board, koPos, onBoard } = boardState;
        const currentPlayer = game.currentPlayer;
        const opponent = 3 - currentPlayer;
        const { binInputsData, globalInputsData } = this.createInputBuffers();
        const libertyMap = this.buildLibertyMap(boardState);
        const history = game.getHistory ? game.getHistory() : [];

        this.fillBoardInputs({
            board,
            onBoard,
            currentPlayer,
            opponent,
            binInputsData,
            onPoint: ({ i, j, baseIndex }) => {
                const liberties = libertyMap[i][j];
                if (liberties === 1) binInputsData[baseIndex + 3] = 1.0;
                if (liberties === 2) binInputsData[baseIndex + 4] = 1.0;
                if (liberties === 3) binInputsData[baseIndex + 5] = 1.0;
                if (koPos && koPos[0] === i && koPos[1] === j) binInputsData[baseIndex + 6] = 1.0;
            },
        });

        const channelConfig = [
            { channel: 9, color: opponent, globalIndex: 0 },
            { channel: 10, color: currentPlayer, globalIndex: 1 },
            { channel: 11, color: opponent, globalIndex: 2 },
            { channel: 12, color: currentPlayer, globalIndex: 3 },
            { channel: 13, color: opponent, globalIndex: 4 },
        ];

        for (let step = 0; step < channelConfig.length; step++) {
            const move = history[history.length - 1 - step];
            if (!move) break;

            const { channel, color, globalIndex } = channelConfig[step];
            if (move.color !== color) continue;
            if (move.pass) {
                globalInputsData[globalIndex] = 1.0;
                continue;
            }

            const idx = this.toModelIndex(move.i, move.j);
            binInputsData[idx * CHANNELS + channel] = 1.0;
        }

        globalInputsData[5] = (currentPlayer === 2 ? game.komi + 1 : -game.komi) / 20;

        return this.createTensorInputs(binInputsData, globalInputsData);
    }

    createInputBuffers() {
        return {
            binInputsData: new Float32Array(BATCHES * MODEL_BOARD_SIZE * MODEL_BOARD_SIZE * CHANNELS),
            globalInputsData: new Float32Array(BATCHES * GLOBAL_CHANNELS),
        };
    }

    createTensorInputs(binInputsData, globalInputsData) {
        return {
            binT: globalThis.tf.tensor(binInputsData, [BATCHES, MODEL_BOARD_SIZE * MODEL_BOARD_SIZE, CHANNELS]),
            globalT: globalThis.tf.tensor(globalInputsData, [BATCHES, GLOBAL_CHANNELS]),
        };
    }

    fillBoardInputs({ board, onBoard, currentPlayer, opponent, binInputsData, onPoint }) {
        for (let i = 0; i < MODEL_BOARD_SIZE; i++) {
            for (let j = 0; j < MODEL_BOARD_SIZE; j++) {
                if (!onBoard[i][j]) continue;
                const color = board[i][j];
                const baseIndex = this.toModelIndex(i, j) * CHANNELS;
                binInputsData[baseIndex] = 1.0;
                if (color === currentPlayer) binInputsData[baseIndex + 1] = 1.0;
                if (color === opponent) binInputsData[baseIndex + 2] = 1.0;
                onPoint?.({ i, j, color, baseIndex });
            }
        }
    }

    buildModelBoardState(game) {
        const board = Array.from({ length: MODEL_BOARD_SIZE }, () => Array(MODEL_BOARD_SIZE).fill(0));
        const onBoard = Array.from({ length: MODEL_BOARD_SIZE }, (_, i) =>
            Array.from({ length: MODEL_BOARD_SIZE }, (_, j) => i < game.size && j < game.size)
        );
        const sourceBoard = game.toColorGrid();

        for (let i = 0; i < game.size; i++) {
            for (let j = 0; j < game.size; j++) {
                board[i][j] = sourceBoard[i][j];
            }
        }

        const koPos = game.koPos && game.koPos[0] < game.size && game.koPos[1] < game.size
            ? game.koPos
            : null;

        return { board, koPos, onBoard };
    }

    buildLibertyMap(boardState) {
        const { board, onBoard } = boardState;
        const libertyMap = Array.from({ length: MODEL_BOARD_SIZE }, () => Array(MODEL_BOARD_SIZE).fill(0));
        const visited = new Set();

        for (let i = 0; i < MODEL_BOARD_SIZE; i++) {
            for (let j = 0; j < MODEL_BOARD_SIZE; j++) {
                if (!onBoard[i][j]) continue;
                const color = board[i][j];
                if (color === 0) continue;

                const key = `${i},${j}`;
                if (visited.has(key)) continue;

                const group = this.collectGroup(boardState, i, j, color, visited);
                const liberties = this.countLiberties(boardState, group);
                for (const [gi, gj] of group) {
                    libertyMap[gi][gj] = liberties;
                }
            }
        }

        return libertyMap;
    }

    collectGroup(boardState, startI, startJ, color, visited) {
        const { board, onBoard } = boardState;
        const group = [];
        const stack = [[startI, startJ]];

        while (stack.length) {
            const [i, j] = stack.pop();
            const key = `${i},${j}`;
            if (!onBoard[i]?.[j] || visited.has(key) || board[i]?.[j] !== color) continue;
            visited.add(key);
            group.push([i, j]);

            if (i > 0) stack.push([i - 1, j]);
            if (i + 1 < MODEL_BOARD_SIZE) stack.push([i + 1, j]);
            if (j > 0) stack.push([i, j - 1]);
            if (j + 1 < MODEL_BOARD_SIZE) stack.push([i, j + 1]);
        }

        return group;
    }

    countLiberties(boardState, group) {
        const { board, onBoard } = boardState;
        const liberties = new Set();

        for (const [i, j] of group) {
            if (onBoard[i - 1]?.[j] && board[i - 1]?.[j] === 0) liberties.add(`${i - 1},${j}`);
            if (onBoard[i + 1]?.[j] && board[i + 1]?.[j] === 0) liberties.add(`${i + 1},${j}`);
            if (onBoard[i]?.[j - 1] && board[i]?.[j - 1] === 0) liberties.add(`${i},${j - 1}`);
            if (onBoard[i]?.[j + 1] && board[i]?.[j + 1] === 0) liberties.add(`${i},${j + 1}`);
        }

        return liberties.size;
    }

    rankMoves(game, policyData, color, maxSuggestions, temperature = 0) {
        const ranked = [];

        for (let idx = 0; idx < game.size * game.size; idx++) {
            const i = Math.floor(idx / game.size);
            const j = idx % game.size;
            if (!game.isLegalMove(i, j, color)) continue;
            ranked.push({
                i,
                j,
                score: policyData[this.toModelIndex(i, j)],
            });
        }

        ranked.sort((a, b) => b.score - a.score);
        const topMoves = ranked.slice(0, maxSuggestions);
        const bottomMoves = ranked.slice(Math.max(ranked.length - 3, 0)).reverse();
        const passScore = policyData[MODEL_BOARD_SIZE * MODEL_BOARD_SIZE] ?? -Infinity;
        const sampledMove = this.sampleMove(ranked, passScore, temperature);
        const shouldPass = sampledMove == null;

        return {
            topMoves,
            bottomMoves,
            passScore,
            suggestedMove: shouldPass ? null : sampledMove,
        };
    }

    extractOwnershipForGame(game, ownershipData) {
        const cropped = [];

        for (let i = 0; i < game.size; i++) {
            for (let j = 0; j < game.size; j++) {
                cropped.push(ownershipData[this.toModelIndex(i, j)] ?? 0);
            }
        }

        return cropped;
    }

    toModelIndex(i, j) {
        return i * MODEL_BOARD_SIZE + j;
    }

    sampleMove(rankedMoves, passScore, temperature) {
        const bestMove = rankedMoves[0] ?? null;
        if (!bestMove) return null;

        if (!(temperature > 0)) {
            return passScore >= bestMove.score ? null : bestMove;
        }

        const candidates = [
            ...rankedMoves.map(move => ({ move, score: move.score })),
            { move: null, score: passScore },
        ];
        const maxScore = Math.max(...candidates.map(candidate => candidate.score));
        const weights = candidates.map(candidate => Math.exp((candidate.score - maxScore) / temperature));
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

        if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
            return passScore >= bestMove.score ? null : bestMove;
        }

        let target = Math.random() * totalWeight;
        for (let index = 0; index < candidates.length; index++) {
            target -= weights[index];
            if (target <= 0) return candidates[index].move;
        }

        return candidates[candidates.length - 1].move;
    }

    extractWinRate(valueData) {
        if (!valueData?.length) return null;
        const total = valueData.reduce((sum, value) => sum + value, 0);
        if (!Number.isFinite(total) || total <= 0) return null;
        return valueData[0] / total;
    }
}
