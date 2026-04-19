
const { useRef, useEffect } = React;

function toEngineBoard(stones, size) {
  if (!Array.isArray(stones) || stones.length !== size) {
    return Array.from({ length: size }, () => Array(size).fill(0));
  }
  return stones.map((row) =>
    row.map((stone) => (stone === 'B' ? 1 : stone === 'W' ? 2 : 0))
  );
}

function GoBoard({ size = 19, stones, currentTurn = 'B', lastMove = null, onPlace, readonly = false }) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const onPlaceRef = useRef(onPlace);
  const sizeRef = useRef(size);
  const readonlyRef = useRef(readonly);

  useEffect(() => { onPlaceRef.current = onPlace; }, [onPlace]);
  useEffect(() => { sizeRef.current = size; }, [size]);
  useEffect(() => { readonlyRef.current = readonly; }, [readonly]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.game) return;

    engine.mode = 'pvp';
    if (engine.hud?.setMode) engine.hud.setMode('pvp');
    if (engine.clearHistoryPreviewState) engine.clearHistoryPreviewState();
    if (engine.clearScoringState) engine.clearScoringState();

    engine.game.board = toEngineBoard(stones, size);
    engine.game.currentPlayer = currentTurn === 'W' ? 2 : 1;
    engine.game.moveNumber = Array.isArray(stones)
      ? stones.reduce((count, row) => count + row.filter(Boolean).length, 0)
      : 0;
    engine.game.koPos = null;
    engine.game.captures = { 1: 0, 2: 0 };
    engine.game.consecutivePasses = 0;
    engine.game.history = [];
    engine.game.lastMove = lastMove
      ? { i: lastMove[0], j: lastMove[1], color: currentTurn === 'W' ? 1 : 2 }
      : null;

    if (engine.isReady && engine.syncVisualsFromBoard) {
      engine.syncVisualsFromBoard(engine.game.board);
      engine.handleResize?.();
    }
  }, [stones, size, currentTurn, lastMove]);

  useEffect(() => {
    let cancelled = false;
    let engine = null;

    const mount = () => {
      const Engine = window.GoBoard3DEngine;
      if (!Engine || !containerRef.current || cancelled) return;
      engine = new Engine({
        container: containerRef.current,
        onMove: (m) => {
          if (onPlaceRef.current) onPlaceRef.current([m.i, m.j]);
        },
      });
      engineRef.current = engine;
      engine.mode = 'pvp';
      if (engine.hud?.setMode) engine.hud.setMode('pvp');
      if (engine.game && engine.game.size !== sizeRef.current) {
        engine.setBoardSize(sizeRef.current);
      }
      engine.setInteractive(!readonlyRef.current);
      requestAnimationFrame(() => engine.handleResize?.());
    };

    if (window.GoBoard3DEngine) mount();
    else window.addEventListener('teleba-engine-ready', mount, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('teleba-engine-ready', mount);
      if (engine) engine.destroy();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engine.game) return;
    if (engine.game.size !== size) engine.setBoardSize(size);
  }, [size]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.setInteractive(!readonly);
  }, [readonly]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#050505',
        boxShadow: '0 16px 64px rgba(0,0,0,0.75), 0 2px 10px rgba(0,0,0,0.5)',
      }}
    />
  );
}

Object.assign(window, { GoBoard });
