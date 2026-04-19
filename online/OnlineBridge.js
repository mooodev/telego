function clonePuzzleFiles(files = []) {
    return files.map(file => ({
        name: file.name,
        path: file.path,
        rawUrl: file.rawUrl,
    }));
}

function helpText() {
    return [
        'telebaOnline.status()',
        'telebaOnline.capabilities()',
        'telebaOnline.getPuzzleFiles()',
        'telebaOnline.getPuzzleSource()',
        'telebaOnline.setPuzzleSource(url)',
        'telebaOnline.loadPuzzleList(url?)',
        'telebaOnline.openPuzzle(url?)',
        'telebaOnline.openSelectedPuzzle()',
    ].join('\n');
}

export function attachOnlineBridge({ board, onlineService }) {
    const api = {
        help() {
            return helpText();
        },

        status() {
            return board.getOnlineState();
        },

        capabilities() {
            return onlineService.getCapabilities();
        },

        getPuzzleFiles() {
            return clonePuzzleFiles(board.puzzleFiles);
        },

        getPuzzleSource() {
            return board.getPuzzleSource();
        },

        setPuzzleSource(url) {
            board.setPuzzleSource(url);
            return board.getOnlineState();
        },

        async loadPuzzleList(url = board.getPuzzleSource()) {
            if (url) board.setPuzzleSource(url);
            await board.reloadPuzzleList();
            return clonePuzzleFiles(board.puzzleFiles);
        },

        async openPuzzle(url = board.selectedPuzzleUrl) {
            await board.loadPuzzleFromUrl(url);
            return board.getOnlineState();
        },

        async openSelectedPuzzle() {
            await board.loadPuzzleFromUrl(board.selectedPuzzleUrl);
            return board.getOnlineState();
        },
    };

    globalThis.telebaBoard = board;
    globalThis.telebaOnline = api;
    globalThis.teleba = {
        board,
        online: api,
    };

    return api;
}
