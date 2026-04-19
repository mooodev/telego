export class GoGame {
    constructor(size = 19, komi = 7.5) {
        this.size = size;
        this.komi = komi;
        this.dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        this.reset();
    }

    reset() {
        this.board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        this.currentPlayer = 1;
        this.koPos = null;
        this.moveNumber = 0;
        this.lastMove = null;
        this.history = [];
        this.captures = { 1: 0, 2: 0 };
        this.consecutivePasses = 0;
    }

    isOnBoard(i, j) {
        return i >= 0 && i < this.size && j >= 0 && j < this.size;
    }

    getColor(i, j) {
        return this.isOnBoard(i, j) ? this.board[i][j] : null;
    }

    isLegalMove(i, j, color = this.currentPlayer) {
        return Boolean(this.previewMove(i, j, color));
    }

    previewMove(i, j, color = this.currentPlayer) {
        if (!this.isOnBoard(i, j) || this.board[i][j] !== 0) return null;
        if (this.koPos && this.koPos[0] === i && this.koPos[1] === j) return null;

        const me = color;
        const opp = 3 - me;
        this.board[i][j] = me;

        let captured = [];
        for (const [dx, dy] of this.dirs) {
            const ni = i + dx;
            const nj = j + dy;
            if (this.board[ni]?.[nj] === opp) {
                const groupData = this.collectGroupData(ni, nj, opp);
                if (groupData.liberties.size === 0) captured.push(...groupData.group);
            }
        }

        const dedupedCaptured = this.uniquePoints(captured);

        for (const [ci, cj] of dedupedCaptured) this.board[ci][cj] = 0;
        const myGroupData = this.collectGroupData(i, j, me);

        for (const [ci, cj] of dedupedCaptured) this.board[ci][cj] = opp;
        this.board[i][j] = 0;

        if (myGroupData.liberties.size === 0 && dedupedCaptured.length === 0) return null;

        const koPos = dedupedCaptured.length === 1 && myGroupData.group.length === 1 && myGroupData.liberties.size === 1
            ? dedupedCaptured[0]
            : null;

        return {
            color: me,
            i,
            j,
            captured: dedupedCaptured,
            koPos,
        };
    }

    playMove(i, j, color = this.currentPlayer) {
        if (color !== this.currentPlayer) return null;
        const preview = this.previewMove(i, j, color);
        if (!preview) return null;

        this.board[i][j] = color;
        for (const [ci, cj] of preview.captured) this.board[ci][cj] = 0;

        this.captures[color] += preview.captured.length;
        this.koPos = preview.koPos;
        this.currentPlayer = 3 - color;
        this.moveNumber += 1;
        this.lastMove = { i, j, color, captured: preview.captured };
        this.history.push({ i, j, color, captured: preview.captured, pass: false });
        this.consecutivePasses = 0;

        return preview;
    }

    pass(color = this.currentPlayer) {
        if (color !== this.currentPlayer) return false;
        this.currentPlayer = 3 - color;
        this.koPos = null;
        this.moveNumber += 1;
        this.lastMove = { pass: true, color };
        this.history.push({ pass: true, color });
        this.consecutivePasses += 1;
        return true;
    }

    collectGroupData(startI, startJ, color = this.board[startI]?.[startJ]) {
        if (!this.isOnBoard(startI, startJ) || color === 0 || color == null) {
            return { group: [], liberties: new Set() };
        }

        const group = [];
        const liberties = new Set();
        const visited = new Set();
        const stack = [[startI, startJ]];

        while (stack.length) {
            const [i, j] = stack.pop();
            if (!this.isOnBoard(i, j) || this.board[i][j] !== color) continue;

            const key = this.pointKey(i, j);
            if (visited.has(key)) continue;
            visited.add(key);
            group.push([i, j]);

            for (const [dx, dy] of this.dirs) {
                const ni = i + dx;
                const nj = j + dy;
                if (!this.isOnBoard(ni, nj)) continue;
                const nextColor = this.board[ni][nj];
                if (nextColor === color) {
                    stack.push([ni, nj]);
                } else if (nextColor === 0) {
                    liberties.add(this.pointKey(ni, nj));
                }
            }
        }

        return { group, liberties };
    }

    getGroup(i, j, color = this.board[i]?.[j]) {
        return this.collectGroupData(i, j, color).group;
    }

    getLiberties(group) {
        const liberties = new Set();
        for (const [i, j] of group) {
            for (const [dx, dy] of this.dirs) {
                const ni = i + dx;
                const nj = j + dy;
                if (this.board[ni]?.[nj] === 0) liberties.add(this.pointKey(ni, nj));
            }
        }
        return liberties.size;
    }

    getLegalMoves(color = this.currentPlayer) {
        const moves = [];
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.isLegalMove(i, j, color)) moves.push({ i, j });
            }
        }
        return moves;
    }

    toColorGrid() {
        return this.board.map(row => row.slice());
    }

    getHistory() {
        return this.history.slice();
    }

    uniquePoints(points) {
        return [...new Map(points.map(([i, j]) => [`${i},${j}`, [i, j]])).values()];
    }

    cloneBoard(board = this.board) {
        return board.map(row => row.slice());
    }

    pointKey(i, j) {
        return `${i},${j}`;
    }

    parsePointKey(key) {
        const [i, j] = key.split(',').map(Number);
        return [i, j];
    }

    getScoringSummary(deadStoneKeys = []) {
        const deadSet = deadStoneKeys instanceof Set ? deadStoneKeys : new Set(deadStoneKeys);
        const board = this.cloneBoard();
        let removedBlack = 0;
        let removedWhite = 0;

        for (const key of deadSet) {
            const [i, j] = this.parsePointKey(key);
            const color = this.board[i]?.[j] ?? 0;
            if (color === 1) removedBlack += 1;
            if (color === 2) removedWhite += 1;
            if (color !== 0) board[i][j] = 0;
        }

        let blackTerritory = 0;
        let whiteTerritory = 0;
        const territoryMap = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        const visited = new Set();

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (board[i][j] !== 0) continue;

                const key = this.pointKey(i, j);
                if (visited.has(key)) continue;

                const region = [];
                const queue = [[i, j]];
                const borders = new Set();
                visited.add(key);

                while (queue.length) {
                    const [ci, cj] = queue.pop();
                    region.push([ci, cj]);
                    for (const [dx, dy] of this.dirs) {
                        const ni = ci + dx;
                        const nj = cj + dy;
                        if (!this.isOnBoard(ni, nj)) {
                            borders.add(0);
                            continue;
                        }
                        const nextColor = board[ni][nj];
                        if (nextColor === 0) {
                            const nextKey = this.pointKey(ni, nj);
                            if (!visited.has(nextKey)) {
                                visited.add(nextKey);
                                queue.push([ni, nj]);
                            }
                        } else {
                            borders.add(nextColor);
                        }
                    }
                }

                if (borders.size !== 1 || borders.has(0)) continue;

                const owner = borders.has(1) ? 1 : 2;
                if (owner === 1) blackTerritory += region.length;
                if (owner === 2) whiteTerritory += region.length;
                for (const [ri, rj] of region) territoryMap[ri][rj] = owner;
            }
        }

        const blackPrisoners = this.captures[1] + removedWhite;
        const whitePrisoners = this.captures[2] + removedBlack;
        const blackScore = blackTerritory + blackPrisoners;
        const whiteScore = whiteTerritory + whitePrisoners + this.komi;
        const lead = blackScore - whiteScore;

        return {
            rules: 'japanese',
            board,
            deadStoneKeys: new Set(deadSet),
            removedBlack,
            removedWhite,
            blackTerritory,
            whiteTerritory,
            blackPrisoners,
            whitePrisoners,
            blackScore,
            whiteScore,
            lead,
            leader: lead > 0 ? 1 : lead < 0 ? 2 : 0,
            territoryMap,
        };
    }

    estimateScore() {
        let blackStones = 0;
        let whiteStones = 0;
        let blackTerritory = 0;
        let whiteTerritory = 0;
        let blackInfluence = 0;
        let whiteInfluence = 0;
        const territoryMap = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        const influenceMap = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        const visited = new Set();
        const blackDistanceMap = this.buildDistanceMap(1);
        const whiteDistanceMap = this.buildDistanceMap(2);

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const color = this.board[i][j];
                if (color === 1) blackStones += 1;
                if (color === 2) whiteStones += 1;

                const key = `${i},${j}`;
                if (color !== 0 || visited.has(key)) continue;

                const region = [];
                const queue = [[i, j]];
                const borders = new Set();
                visited.add(key);

                while (queue.length) {
                    const [ci, cj] = queue.pop();
                    region.push([ci, cj]);
                    for (const [dx, dy] of this.dirs) {
                        const ni = ci + dx;
                        const nj = cj + dy;
                        if (!this.isOnBoard(ni, nj)) continue;
                        const nextColor = this.board[ni][nj];
                        if (nextColor === 0) {
                            const nextKey = `${ni},${nj}`;
                            if (!visited.has(nextKey)) {
                                visited.add(nextKey);
                                queue.push([ni, nj]);
                            }
                        } else {
                            borders.add(nextColor);
                        }
                    }
                }

                if (borders.size === 1) {
                    const owner = borders.has(1) ? 1 : 2;
                    if (owner === 1) blackTerritory += region.length;
                    if (owner === 2) whiteTerritory += region.length;
                    for (const [ri, rj] of region) territoryMap[ri][rj] = owner;
                    continue;
                }

                for (const [ri, rj] of region) {
                    const blackDist = blackDistanceMap[ri][rj];
                    const whiteDist = whiteDistanceMap[ri][rj];
                    if (blackDist < whiteDist) {
                        blackInfluence += 0.35;
                        influenceMap[ri][rj] = 1;
                    }
                    if (whiteDist < blackDist) {
                        whiteInfluence += 0.35;
                        influenceMap[ri][rj] = 2;
                    }
                }
            }
        }

        const blackScore = blackStones + blackTerritory + blackInfluence + (this.captures[1] * 0.5);
        const whiteScore = whiteStones + whiteTerritory + whiteInfluence + (this.captures[2] * 0.5) + this.komi;
        const lead = blackScore - whiteScore;

        return {
            blackScore,
            whiteScore,
            lead,
            leader: lead > 0 ? 1 : lead < 0 ? 2 : 0,
            blackStones,
            whiteStones,
            blackTerritory,
            whiteTerritory,
            blackInfluence,
            whiteInfluence,
            territoryMap,
            influenceMap,
        };
    }

    buildDistanceMap(targetColor) {
        const distances = Array.from({ length: this.size }, () => Array(this.size).fill(Infinity));
        const queue = [];

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.board[i][j] !== targetColor) continue;
                distances[i][j] = 0;
                queue.push([i, j]);
            }
        }

        for (let index = 0; index < queue.length; index++) {
            const [i, j] = queue[index];
            const nextDistance = distances[i][j] + 1;

            for (const [dx, dy] of this.dirs) {
                const ni = i + dx;
                const nj = j + dy;
                if (!this.isOnBoard(ni, nj) || nextDistance >= distances[ni][nj]) continue;
                distances[ni][nj] = nextDistance;
                queue.push([ni, nj]);
            }
        }

        return distances;
    }
}
