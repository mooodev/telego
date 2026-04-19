export class NullHUD {
    constructor(options = {}) {
        this.onAction = options.onAction || (() => {});
        this._puzzleSource = '';
        this.analysis = { textContent: '' };
    }
    setTipVisible() {}
    setInfluenceVisible() {}
    setViewMode() {}
    setMode() {}
    setBoardSize() {}
    setHumanColor() {}
    setAiLevel() {}
    setBoardCapabilities() {}
    setAnalysis(text) { this.analysis.textContent = text || ''; }
    setPuzzleStatus() {}
    setPuzzleFiles() {}
    setPuzzleTree() {}
    setPuzzleHintEnabled() {}
    setSoundEnabled() {}
    setSelectedPuzzle() {}
    setAiBusy() {}
    setPassEnabled() {}
    setScoreReview() {}
    setLeadData() {}
    getPuzzleSource() { return this._puzzleSource; }
    setPuzzleSource(url) { this._puzzleSource = url || ''; }
}

export class GameHUD {
    constructor({ onAction }) {
        this.onAction = onAction;
        this.leadHistoryLength = 0;
        this.isScrubbingLeadHistory = false;
        this.aiEnabled = true;
        this.root = document.createElement('div');
        this.root.className = 'game-hud';
        Object.assign(this.root.style, {
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: '100',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'flex-start',
            maxWidth: '340px',
            fontFamily: 'system-ui, sans-serif',
        });

        this.controls = document.createElement('div');
        Object.assign(this.controls.style, this.panelStyle());

        this.analysis = document.createElement('div');
        Object.assign(this.analysis.style, this.panelStyle(), {
            minWidth: '260px',
            whiteSpace: 'pre-line',
            lineHeight: '1.4',
        });

        this.meterPanel = document.createElement('div');
        Object.assign(this.meterPanel.style, this.panelStyle(), {
            minWidth: '260px',
        });

        this.viewButton = this.createButton('Switch to 2D', () => this.onAction('toggleView'));
        this.tipButton = this.createButton('Show Tip', () => this.onAction('toggleTip'));
        this.aiMoveButton = this.createButton('AI Move', () => this.onAction('forceAiMove'));
        this.passButton = this.createButton('Pass', () => this.onAction('passTurn'));
        this.acceptScoreButton = this.createButton('Accept Score', () => this.onAction('acceptScore'));
        this.resumeGameButton = this.createButton('Resume Play', () => this.onAction('resumePlay'));
        this.influenceButton = this.createButton('View Influence Live on Board', () => this.onAction('toggleInfluence'));
        this.boardSizeSelect = this.createSelect(
            [
                ['9', '9 x 9'],
                ['13', '13 x 13'],
                ['19', '19 x 19'],
            ],
            '19',
            value => this.onAction('setBoardSize', Number(value))
        );

        this.modeSelect = this.createSelect(
            [
                ['pvp', 'Player vs Player'],
                ['pvai', 'Player vs AI'],
                ['aivai', 'AI vs AI'],
                ['puzzle', 'SGF Puzzle'],
            ],
            'pvai',
            value => this.onAction('setMode', value)
        );
        this.humanSideSelect = this.createSelect(
            [
                ['1', 'Human as Black'],
                ['2', 'Human as White'],
            ],
            '1',
            value => this.onAction('setHumanColor', Number(value))
        );
        this.blackLevelSelect = this.createSelect(
            [
                ['dan', 'Dan Model'],
                ['kyu', 'Kyu Model'],
                ['legacy-dan', 'Dan Legacy'],
                ['legacy-kyu', 'Kyu Legacy'],
            ],
            'dan',
            value => this.onAction('setAiLevel', { color: 1, level: value })
        );
        this.whiteLevelSelect = this.createSelect(
            [
                ['dan', 'Dan Model'],
                ['kyu', 'Kyu Model'],
                ['legacy-dan', 'Dan Legacy'],
                ['legacy-kyu', 'Kyu Legacy'],
            ],
            'dan',
            value => this.onAction('setAiLevel', { color: 2, level: value })
        );

        this.puzzleSourceInput = document.createElement('input');
        this.puzzleSourceInput.type = 'text';
        this.puzzleSourceInput.value = '';
        Object.assign(this.puzzleSourceInput.style, this.inputStyle());

        this.loadPuzzleListButton = this.createButton('Load Puzzle List', () => {
            this.onAction('loadPuzzleList', this.puzzleSourceInput.value.trim());
        });

        this.puzzleSelect = this.createSelect(
            [['', 'Select puzzle']],
            '',
            value => this.onAction('selectPuzzle', value)
        );
        this.loadPuzzleButton = this.createButton('Open Puzzle', () => this.onAction('loadSelectedPuzzle'));
        this.hintPuzzleButton = this.createButton('Hint', () => this.onAction('showPuzzleHint'));
        this.puzzleStatus = document.createElement('div');
        Object.assign(this.puzzleStatus.style, {
            fontSize: '12px',
            lineHeight: '1.4',
            color: '#333',
            whiteSpace: 'pre-line',
        });
        this.puzzleStatus.textContent = 'Puzzle source idle';

        this.puzzleTree = document.createElement('div');
        Object.assign(this.puzzleTree.style, {
            fontSize: '12px',
            lineHeight: '1.45',
            color: '#222',
            whiteSpace: 'pre-line',
            maxHeight: '220px',
            overflow: 'auto',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '8px',
            padding: '8px',
            background: 'rgba(255,255,255,0.72)',
        });
        this.puzzleTree.textContent = 'Puzzle tree idle';

        this.soundToggle = document.createElement('label');
        Object.assign(this.soundToggle.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: '600',
        });
        this.soundToggleInput = document.createElement('input');
        this.soundToggleInput.type = 'checkbox';
        this.soundToggleInput.checked = true;
        this.soundToggleInput.addEventListener('change', () => this.onAction('setSoundEnabled', this.soundToggleInput.checked));
        this.soundToggle.append(this.soundToggleInput, document.createTextNode('Sound Enabled'));

        this.puzzlePanel = document.createElement('div');
        Object.assign(this.puzzlePanel.style, this.panelStyle(), {
            minWidth: '260px',
        });
        this.puzzlePanel.append(
            this.wrapField('Puzzle Source', this.puzzleSourceInput),
            this.loadPuzzleListButton,
            this.wrapField('Puzzle File', this.puzzleSelect),
            this.loadPuzzleButton,
            this.hintPuzzleButton,
            this.soundToggle,
            this.puzzleStatus,
            this.wrapField('Puzzle Tree', this.puzzleTree)
        );

        this.controls.append(
            this.viewButton,
            this.tipButton,
            this.aiMoveButton,
            this.passButton,
            this.wrapField('Board Size', this.boardSizeSelect),
            this.wrapField('Mode', this.modeSelect),
            this.wrapField('Human Side', this.humanSideSelect),
            this.wrapField('Black AI', this.blackLevelSelect),
            this.wrapField('White AI', this.whiteLevelSelect)
        );

        this.scorePanel = document.createElement('div');
        Object.assign(this.scorePanel.style, this.panelStyle(), {
            minWidth: '260px',
            display: 'none',
        });
        this.scoreStatus = document.createElement('div');
        Object.assign(this.scoreStatus.style, {
            fontSize: '12px',
            lineHeight: '1.45',
            color: '#222',
            whiteSpace: 'pre-line',
        });
        this.scorePanel.append(
            this.wrapField('Score Review', this.scoreStatus),
            this.acceptScoreButton,
            this.resumeGameButton
        );

        this.meterTitle = document.createElement('div');
        this.meterTitle.textContent = 'Lead History';
        Object.assign(this.meterTitle.style, {
            fontSize: '13px',
            fontWeight: '700',
        });

        this.meter = document.createElement('div');
        Object.assign(this.meter.style, {
            position: 'relative',
            width: '100%',
            height: '24px',
            borderRadius: '999px',
            overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.25)',
            background: 'linear-gradient(90deg, #000 0%, #000 50%, #fff 50%, #fff 100%)',
        });

        this.meterCenter = document.createElement('div');
        Object.assign(this.meterCenter.style, {
            position: 'absolute',
            left: '50%',
            top: '0',
            bottom: '0',
            width: '2px',
            background: 'rgba(200,40,40,0.8)',
            transform: 'translateX(-50%)',
        });

        this.meterArrow = document.createElement('div');
        this.meterArrow.textContent = '▲';
        Object.assign(this.meterArrow.style, {
            position: 'absolute',
            top: '1px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '18px',
            color: '#b22222',
            lineHeight: '1',
            textShadow: '0 1px 2px rgba(255,255,255,0.45)',
        });

        this.meterLabels = document.createElement('div');
        Object.assign(this.meterLabels.style, {
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: '700',
        });
        this.meterLabels.innerHTML = '<span style="color:#111">BLACK</span><span style="color:#666">WHITE</span>';

        this.leadText = document.createElement('div');
        Object.assign(this.leadText.style, {
            fontSize: '13px',
            fontWeight: '600',
        });

        this.historyNav = document.createElement('div');
        Object.assign(this.historyNav.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
        });
        this.historyBackButton = this.createButton('<', () => this.onAction('stepLeadHistory', -1));
        this.historyForwardButton = this.createButton('>', () => this.onAction('stepLeadHistory', 1));
        Object.assign(this.historyBackButton.style, {
            minHeight: '34px',
            minWidth: '42px',
            padding: '6px 12px',
        });
        Object.assign(this.historyForwardButton.style, {
            minHeight: '34px',
            minWidth: '42px',
            padding: '6px 12px',
        });
        this.historyLabel = document.createElement('div');
        Object.assign(this.historyLabel.style, {
            fontSize: '12px',
            fontWeight: '600',
            color: '#444',
            flex: '1',
            textAlign: 'center',
        });
        this.historyNav.append(this.historyBackButton, this.historyLabel, this.historyForwardButton);

        this.historyCanvas = document.createElement('canvas');
        this.historyCanvas.width = 300;
        this.historyCanvas.height = 96;
        Object.assign(this.historyCanvas.style, {
            width: '100%',
            height: '96px',
            borderRadius: '10px',
            background: 'linear-gradient(180deg, #000 0%, #000 50%, #fff 50%, #fff 100%)',
            cursor: 'pointer',
            touchAction: 'none',
        });
        this.historyCanvas.addEventListener('pointerdown', e => this.handleHistoryPointerDown(e));
        this.historyCanvas.addEventListener('pointermove', e => this.handleHistoryPointerMove(e));
        this.historyCanvas.addEventListener('pointerup', () => this.stopHistoryScrub());
        this.historyCanvas.addEventListener('pointercancel', () => this.stopHistoryScrub());

        this.analysis.textContent = 'AI: loading\nBoard: empty';
        this.meter.append(this.meterCenter, this.meterArrow);
        this.meterPanel.append(this.meterTitle, this.leadText, this.historyNav, this.historyCanvas, this.influenceButton);
        this.root.append(this.controls, this.scorePanel, this.puzzlePanel, this.meterPanel, this.analysis);
        document.body.appendChild(this.root);
        this.setLeadData({ lead: 0, history: [], selectedIndex: null, moveLabel: 'Live', canStepBack: false, canStepForward: false });
        this.setInfluenceVisible(false);
        this.setScoreReview(null);
        this.setBoardCapabilities({ aiEnabled: true, puzzleEnabled: true });
    }

    panelStyle() {
        return {
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(20,20,20,0.2)',
            borderRadius: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            color: '#111',
        };
    }

    createButton(label, onClick) {
        const button = document.createElement('button');
        button.textContent = label;
        Object.assign(button.style, this.buttonStyle());
        button.addEventListener('click', onClick);
        return button;
    }

    createSelect(options, value, onChange) {
        const select = document.createElement('select');
        Object.assign(select.style, this.inputStyle());
        for (const [optionValue, label] of options) {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = label;
            if (optionValue === value) option.selected = true;
            select.appendChild(option);
        }
        select.addEventListener('change', () => onChange(select.value));
        return select;
    }

    wrapField(label, element) {
        const wrapper = document.createElement('label');
        Object.assign(wrapper.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '12px',
            fontWeight: '600',
        });
        wrapper.textContent = label;
        wrapper.appendChild(element);
        return wrapper;
    }

    buttonStyle() {
        return {
            padding: '10px 14px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderRadius: '10px',
            border: '1px solid rgba(0,0,0,0.2)',
            background: '#fff',
            color: '#111',
            minHeight: '42px',
        };
    }

    inputStyle() {
        return {
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid rgba(0,0,0,0.2)',
            background: '#fff',
            color: '#111',
        };
    }

    setViewMode(is2D) {
        this.viewButton.textContent = is2D ? 'Switch to 3D' : 'Switch to 2D';
    }

    setTipVisible(isVisible) {
        this.tipButton.textContent = isVisible ? 'Hide Tip' : 'Show Tip';
    }

    setInfluenceVisible(isVisible) {
        this.influenceButton.textContent = isVisible ? 'Hide Influence on Board' : 'View Influence Live on Board';
    }

    setMode(mode) {
        this.modeSelect.value = mode;
    }

    setBoardSize(size) {
        this.boardSizeSelect.value = String(size);
    }

    setHumanColor(color) {
        this.humanSideSelect.value = String(color);
    }

    setAiLevel(color, level) {
        if (color === 1) this.blackLevelSelect.value = level;
        if (color === 2) this.whiteLevelSelect.value = level;
    }

    setBoardCapabilities({ aiEnabled, puzzleEnabled }) {
        this.aiEnabled = aiEnabled;
        this.setSelectOptionEnabled(this.modeSelect, 'pvai', aiEnabled);
        this.setSelectOptionEnabled(this.modeSelect, 'aivai', aiEnabled);
        this.setSelectOptionEnabled(this.modeSelect, 'puzzle', puzzleEnabled);

        this.setEnabled(this.aiMoveButton, aiEnabled);
        this.setEnabled(this.blackLevelSelect, aiEnabled);
        this.setEnabled(this.whiteLevelSelect, aiEnabled);
    }

    setAnalysis(text) {
        this.analysis.textContent = text;
    }

    setPuzzleStatus(text) {
        this.puzzleStatus.textContent = text;
    }

    getPuzzleSource() {
        return this.puzzleSourceInput.value.trim();
    }

    setPuzzleSource(url) {
        this.puzzleSourceInput.value = url;
    }

    setPuzzleTree(text) {
        this.puzzleTree.textContent = text;
    }

    setPuzzleHintEnabled(isEnabled) {
        this.setEnabled(this.hintPuzzleButton, isEnabled);
    }

    setSoundEnabled(isEnabled) {
        this.soundToggleInput.checked = isEnabled;
    }

    setPuzzleFiles(files) {
        this.puzzleSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = files.length ? 'Select puzzle' : 'No SGF files found';
        this.puzzleSelect.appendChild(placeholder);

        for (const file of files) {
            const option = document.createElement('option');
            option.value = file.rawUrl;
            option.textContent = file.path;
            this.puzzleSelect.appendChild(option);
        }
    }

    setSelectedPuzzle(url) {
        this.puzzleSelect.value = url;
    }

    setAiBusy(isBusy) {
        this.aiMoveButton.disabled = isBusy || !this.aiEnabled;
        this.aiMoveButton.style.opacity = !this.aiEnabled ? '0.55' : (isBusy ? '0.6' : '1');
        if (isBusy) {
            this.setEnabled(this.passButton, false);
        }
    }

    setPassEnabled(isEnabled) {
        this.setEnabled(this.passButton, isEnabled);
    }

    setEnabled(element, isEnabled, disabledOpacity = '0.55') {
        element.disabled = !isEnabled;
        element.style.opacity = isEnabled ? '1' : disabledOpacity;
    }

    setSelectOptionEnabled(select, value, isEnabled) {
        const option = [...select.options].find(entry => entry.value === value);
        if (option) option.disabled = !isEnabled;
    }

    setScoreReview(review) {
        const isVisible = Boolean(review?.visible);
        this.scorePanel.style.display = isVisible ? 'flex' : 'none';
        if (!isVisible) return;

        this.scoreStatus.textContent = review.status ?? 'Score review pending';
        const autoAccepted = Boolean(review.autoAccepted);
        this.acceptScoreButton.style.display = autoAccepted ? 'none' : '';
        this.setEnabled(this.acceptScoreButton, !review.accepted);
        this.acceptScoreButton.textContent = review.accepted ? 'Score Accepted' : 'Accept Score';
        this.setEnabled(this.resumeGameButton, true);
    }

    setLeadData({ lead, history, selectedIndex = null, moveLabel = 'Live', canStepBack = false, canStepForward = false }) {
        this.leadHistoryLength = history.length;
        const clamped = Math.max(-15, Math.min(15, lead));
        const percent = ((clamped + 15) / 30) * 100;
        this.meterArrow.style.left = `${percent}%`;

        const leader = lead > 0 ? 'Black' : lead < 0 ? 'White' : 'Even';
        const amount = Math.abs(lead).toFixed(1);
        const summary = leader === 'Even' ? 'Even game' : `${leader} leads by ${amount}`;
        this.leadText.textContent = `${summary}  •  ${moveLabel}`;
        this.historyLabel.textContent = moveLabel;
        this.setEnabled(this.historyBackButton, canStepBack, '0.5');
        this.setEnabled(this.historyForwardButton, canStepForward, '0.5');

        this.drawHistory(history, selectedIndex);
    }

    handleHistoryPointerDown(event) {
        if (!this.leadHistoryLength) return;
        this.isScrubbingLeadHistory = true;
        this.historyCanvas.setPointerCapture(event.pointerId);
        this.selectLeadHistoryFromEvent(event);
    }

    handleHistoryPointerMove(event) {
        if (!this.isScrubbingLeadHistory) return;
        this.selectLeadHistoryFromEvent(event);
    }

    stopHistoryScrub() {
        this.isScrubbingLeadHistory = false;
    }

    selectLeadHistoryFromEvent(event) {
        const index = this.getLeadHistoryIndexFromEvent(event);
        if (index == null) return;
        this.onAction('setLeadHistoryIndex', index);
    }

    getLeadHistoryIndexFromEvent(event) {
        if (!this.leadHistoryLength) return null;
        if (this.leadHistoryLength === 1) return 0;

        const rect = this.historyCanvas.getBoundingClientRect();
        if (!rect.width) return null;

        const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
        const ratio = x / rect.width;
        return Math.max(0, Math.min(
            Math.round(ratio * (this.leadHistoryLength - 1)),
            this.leadHistoryLength - 1
        ));
    }

    drawHistory(history, selectedIndex = null) {
        const canvas = this.historyCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();

        if (!history.length) return;

        const maxAbs = Math.max(5, ...history.map(value => Math.abs(value)));
        ctx.lineWidth = 2;
        ctx.beginPath();
        history.forEach((value, index) => {
            const x = history.length === 1 ? width / 2 : (index / (history.length - 1)) * (width - 8) + 4;
            const y = height / 2 - (value / maxAbs) * ((height / 2) - 8);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.strokeStyle = '#b22222';
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (selectedIndex == null || history[selectedIndex] == null) return;

        const x = history.length === 1 ? width / 2 : (selectedIndex / (history.length - 1)) * (width - 8) + 4;
        const y = height / 2 - (history[selectedIndex] / maxAbs) * ((height / 2) - 8);

        ctx.fillStyle = '#b22222';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}
