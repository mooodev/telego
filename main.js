import { GoBoard } from './goBoard.js';
import { attachOnlineBridge } from './online/OnlineBridge.js';

document.addEventListener('DOMContentLoaded', () => {
    const board = new GoBoard();
    attachOnlineBridge({
        board,
        onlineService: board.onlineService,
    });
});
