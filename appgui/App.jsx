
// ── Mobile hook ───────────────────────────────────────────────────────────────
function useMobile() {
  const [mobile, setMobile] = React.useState(()=>window.innerWidth < 680);
  React.useEffect(()=>{
    const h=()=>setMobile(window.innerWidth<680);
    window.addEventListener('resize',h);
    return ()=>window.removeEventListener('resize',h);
  },[]);
  return mobile;
}

// ── Go Logic ──────────────────────────────────────────────────────────────────
function initBoard(size){return Array(size).fill(null).map(()=>Array(size).fill(null));}
function getGroup(stones,row,col,size){
  const color=stones[row][col];if(!color)return null;
  const visited=new Set(),group=[],stack=[[row,col]];
  while(stack.length){const[r,c]=stack.pop(),key=r*size+c;if(visited.has(key))continue;visited.add(key);if(stones[r][c]!==color)continue;group.push([r,c]);for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<size&&nc>=0&&nc<size)stack.push([nr,nc]);}}
  return group;
}
function getLiberties(stones,group,size){const libs=new Set();for(const[r,c]of group)for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<size&&nc>=0&&nc<size&&!stones[nr][nc])libs.add(nr*size+nc);}return libs;}
function placeStone(stones,row,col,color,size){
  const ns=stones.map(r=>[...r]);ns[row][col]=color;
  const opp=color==='B'?'W':'B';let captured=0;
  for(const[dr,dc]of[[-1,0],[1,0],[0,-1],[0,1]]){const nr=row+dr,nc=col+dc;if(nr>=0&&nr<size&&nc>=0&&nc<size&&ns[nr][nc]===opp){const g=getGroup(ns,nr,nc,size);if(g&&getLiberties(ns,g,size).size===0){g.forEach(([gr,gc])=>{ns[gr][gc]=null;captured++;});}}}
  const own=getGroup(ns,row,col,size);if(own&&getLiberties(ns,own,size).size===0)return null;
  return{stones:ns,captured};
}

const COLS2='ABCDEFGHJKLMNOPQRST';

// ── Timer ─────────────────────────────────────────────────────────────────────
function TimerDisplay({seconds,active,byoyomi,compact}){
  const m=Math.floor(seconds/60),s=seconds%60;
  const low=seconds<30,crit=seconds<10;
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:1}}>
      <div style={{fontFamily:'monospace',fontSize:compact?17:20,fontWeight:600,letterSpacing:0.5,
        color:crit?'#c44a2a':low?'#c4872a':active?'#e4dcd2':'#4a4440',
        textShadow:crit&&active?'0 0 10px rgba(196,74,42,0.5)':'none',transition:'color .3s'}}>
        {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </div>
      {byoyomi>0&&<div style={{fontSize:9,color:'#6b6055',display:'flex',gap:2}}>
        {Array(3).fill(0).map((_,i)=><div key={i} style={{width:4,height:4,borderRadius:2,background:i<byoyomi?'#c4872a':'#2a2520'}}/>)}
      </div>}
    </div>
  );
}

// ── Player Panel — desktop ────────────────────────────────────────────────────
function PlayerPanel({player,color,captures,timeLeft,byoyomi,isActive,isRight}){
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,
      background:isActive?'#1a1714':'#111009',border:`1px solid ${isActive?'#3a3228':'#1e1b18'}`,
      transition:'all .3s',flex:1,flexDirection:isRight?'row-reverse':'row'}}>
      <div style={{position:'relative'}}>
        <Avatar name={player.name} size={36} rank={player.rank}/>
        <div style={{position:'absolute',bottom:-3,right:isRight?'auto':-3,left:isRight?-3:'auto',
          width:12,height:12,borderRadius:6,background:color==='B'?'#111':'#f0ede8',
          border:color==='B'?'1.5px solid #555':'1.5px solid #bbb',boxShadow:'0 1px 4px rgba(0,0,0,0.5)'}}/>
      </div>
      <div style={{flex:1,textAlign:isRight?'right':'left'}}>
        <div style={{fontSize:12,fontWeight:500,color:isActive?'#e4dcd2':'#8a7a68',marginBottom:1}}>{player.name}</div>
        <div style={{fontSize:11,color:'#6b6055'}}>
          <span style={{color:'#c4872a',fontWeight:600}}>{player.rank}</span>
          {' · '}<span>{captures} cap.</span>
        </div>
      </div>
      <TimerDisplay seconds={timeLeft} active={isActive} byoyomi={byoyomi}/>
    </div>
  );
}

// ── Player Chip — mobile ──────────────────────────────────────────────────────
function MobilePlayerChip({player,color,captures,timeLeft,byoyomi,isActive,align}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:align==='right'?'flex-end':'flex-start',
      gap:3,padding:'8px 12px',flex:1,
      background:isActive?'#1a1714':'transparent',
      borderRadius:10,transition:'background .3s'}}>
      <div style={{display:'flex',alignItems:'center',gap:7,flexDirection:align==='right'?'row-reverse':'row'}}>
        <div style={{position:'relative'}}>
          <Avatar name={player.name} size={28}/>
          <div style={{position:'absolute',bottom:-2,right:align==='right'?'auto':-2,left:align==='right'?-2:'auto',
            width:10,height:10,borderRadius:5,background:color==='B'?'#111':'#f0ede8',
            border:color==='B'?'1.5px solid #555':'1.5px solid #bbb'}}/>
        </div>
        <div style={{textAlign:align==='right'?'right':'left'}}>
          <div style={{fontSize:12,fontWeight:500,color:isActive?'#e4dcd2':'#6b6055',lineHeight:1.2}}>{player.name.split(' ')[0]}</div>
          <div style={{fontSize:10,color:'#c4872a',fontWeight:600}}>{player.rank}</div>
        </div>
      </div>
      <TimerDisplay seconds={timeLeft} active={isActive} byoyomi={byoyomi} compact/>
    </div>
  );
}

// ── Redo Request Modal ────────────────────────────────────────────────────────
function RedoRequestModal({onClose,onAccept}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,backdropFilter:'blur(4px)',padding:16}}>
      <div style={{background:'#1a1714',border:'1px solid #3a3228',borderRadius:16,padding:'26px 28px',width:'100%',maxWidth:320,boxShadow:'0 24px 80px rgba(0,0,0,0.7)'}}>
        <div style={{fontSize:16,fontWeight:600,color:'#e4dcd2',marginBottom:6}}>Redo Request</div>
        <div style={{fontSize:13,color:'#8a7a68',marginBottom:22,lineHeight:1.55}}>Your opponent wants to redo their last move. Accept to let them play a different stone.</div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onClose} style={{flex:1,padding:'11px',borderRadius:9,border:'1px solid #3a3228',background:'transparent',color:'#8a7a68',fontSize:13,fontWeight:500,cursor:'pointer'}}>Decline</button>
          <button onClick={onAccept} style={{flex:1,padding:'11px',borderRadius:9,border:'none',background:'#c4872a',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 2px 12px rgba(196,135,42,0.3)'}}>Accept</button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({msg,type='info'}){
  const colors={info:'#2a8c8c',success:'#2a8c4a',error:'#c44a2a'};
  return(
    <div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',
      background:'#1a1714',border:`1px solid ${colors[type]}55`,borderRadius:10,
      padding:'11px 18px',display:'flex',alignItems:'center',gap:10,
      boxShadow:'0 8px 32px rgba(0,0,0,0.6)',zIndex:200,minWidth:220,maxWidth:'calc(100vw - 32px)',
      animation:'slideUp .2s ease'}}>
      <div style={{width:7,height:7,borderRadius:4,background:colors[type],flexShrink:0}}/>
      <span style={{fontSize:13,color:'#e4dcd2',fontWeight:500}}>{msg}</span>
    </div>
  );
}

// ── Move History ──────────────────────────────────────────────────────────────
function MoveHistory({history,currentIdx,onGoTo}){
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{fontSize:11,fontWeight:600,color:'#6b6055',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Move History</div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:1}}>
        {history.map((h,i)=>(
          <button key={i} onClick={()=>onGoTo(i)}
            style={{display:'flex',alignItems:'center',gap:7,padding:'5px 8px',borderRadius:6,border:'none',
              background:currentIdx===i?'#2a2520':'transparent',cursor:'pointer',textAlign:'left',
              color:currentIdx===i?'#e4dcd2':'#6b6055',fontSize:12,transition:'background .1s'}}>
            <div style={{width:9,height:9,borderRadius:5,flexShrink:0,background:h.color==='B'?'#222':'#ddd',border:h.color==='B'?'1px solid #555':'1px solid #aaa'}}/>
            <span style={{fontWeight:500,color:'#4a4440',minWidth:22}}>#{i+1}</span>
            <span>{h.label}</span>
          </button>
        ))}
        {history.length===0&&<div style={{fontSize:12,color:'#4a4440',padding:'8px'}}>No moves yet</div>}
      </div>
    </div>
  );
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function ChatPanel({messages,onSend}){
  const [input,setInput]=React.useState('');
  const send=()=>{if(input.trim()){onSend(input.trim());setInput('');}};
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{fontSize:11,fontWeight:600,color:'#6b6055',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Chat</div>
      <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
        {messages.map((m,i)=>(
          <div key={i} style={{fontSize:12,lineHeight:1.5}}>
            <span style={{color:'#c4872a',fontWeight:600}}>{m.from}: </span>
            <span style={{color:'#8a7a68'}}>{m.text}</span>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:6}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
          placeholder="Type a message…"
          style={{flex:1,background:'#0d0c0b',border:'1px solid #2a2520',borderRadius:7,padding:'7px 10px',fontSize:12,color:'#e4dcd2',outline:'none',fontFamily:'Outfit,sans-serif'}}/>
        <button onClick={send} style={{padding:'7px 10px',borderRadius:7,background:'#2a2520',border:'none',color:'#8a7a68',cursor:'pointer'}}>
          <Icon d={Icons.chevronR} size={14}/>
        </button>
      </div>
    </div>
  );
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({black,white}){
  const total=black+white||1,bPct=(black/total)*100;
  return(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#6b6055',marginBottom:4}}>
        <span>⚫ {Math.max(0,black-white).toFixed(1)}</span><span style={{fontSize:10}}>AI estimate</span><span>⚪ {Math.max(0,white-black).toFixed(1)}</span>
      </div>
      <div style={{height:5,borderRadius:3,background:'#1e1b18',overflow:'hidden'}}>
        <div style={{width:`${bPct}%`,height:'100%',background:'linear-gradient(90deg,#333,#555)',transition:'width .5s'}}/>
      </div>
    </div>
  );
}

// ── Mobile Drawer ─────────────────────────────────────────────────────────────
function MobileDrawer({open,onClose,title,children}){
  if(!open) return null;
  return(
    <div style={{position:'fixed',inset:0,zIndex:150}} onClick={onClose}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.5)',backdropFilter:'blur(2px)'}}/>
      <div onClick={e=>e.stopPropagation()}
        style={{position:'absolute',bottom:0,left:0,right:0,background:'#161412',borderRadius:'16px 16px 0 0',
          border:'1px solid #2a2520',padding:'0 0 calc(16px + var(--safe-bot))',maxHeight:'75vh',
          display:'flex',flexDirection:'column',animation:'drawerUp .22s ease'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 18px 12px'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#e4dcd2'}}>{title}</div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:14,border:'none',background:'#2a2520',color:'#8a7a68',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon d={Icons.x} size={13} sw={2}/>
          </button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'0 18px 4px'}}>
          {children}
        </div>
      </div>
    </div>
  );
}

function PuzzleFailureCard({message,onRetry,onBack,compact=false}){
  return(
    <div style={{
      display:'flex',
      flexDirection:'column',
      gap:compact?10:12,
      padding:compact?'12px':'16px',
      background:'#1a1210',
      border:'1px solid #5a2b21',
      borderRadius:12,
      boxShadow:'0 12px 32px rgba(0,0,0,0.35)',
    }}>
      <div>
        <div style={{fontSize:compact?14:16,fontWeight:600,color:'#f1d7d0',marginBottom:4}}>Failed</div>
        <div style={{fontSize:compact?12:13,lineHeight:1.5,color:'#b9968f'}}>
          {message||'That move does not lead to a valid continuation.'}
        </div>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={onRetry} style={{
          flex:1,
          minWidth:compact?0:120,
          padding:compact?'9px 10px':'10px 12px',
          borderRadius:9,
          border:'none',
          background:'#c44a2a',
          color:'#fff4f1',
          fontSize:12,
          fontWeight:600,
          cursor:'pointer',
        }}>Retry</button>
        <button onClick={onBack} style={{
          flex:1,
          minWidth:compact?0:120,
          padding:compact?'9px 10px':'10px 12px',
          borderRadius:9,
          border:'1px solid #5a2b21',
          background:'transparent',
          color:'#d7b5ae',
          fontSize:12,
          fontWeight:500,
          cursor:'pointer',
        }}>Back to puzzles</button>
      </div>
    </div>
  );
}

function PuzzleSuccessCard({message,onNext,onBack,compact=false,hasNext=true}){
  return(
    <div style={{
      display:'flex',
      flexDirection:'column',
      gap:compact?10:12,
      padding:compact?'12px':'16px',
      background:'#101912',
      border:'1px solid #285634',
      borderRadius:12,
      boxShadow:'0 12px 32px rgba(0,0,0,0.35)',
    }}>
      <div>
        <div style={{fontSize:compact?14:16,fontWeight:600,color:'#d8f2df',marginBottom:4}}>Congrats</div>
        <div style={{fontSize:compact?12:13,lineHeight:1.5,color:'#9fc0a8'}}>
          {message||'Puzzle solved. You can keep playing moves from this position or jump to the next puzzle.'}
        </div>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <button onClick={onNext} disabled={!hasNext} style={{
          flex:1,
          minWidth:compact?0:120,
          padding:compact?'9px 10px':'10px 12px',
          borderRadius:9,
          border:'none',
          background:hasNext?'#2a8c4a':'#294233',
          color:hasNext?'#f3fff6':'#8aa295',
          fontSize:12,
          fontWeight:600,
          cursor:hasNext?'pointer':'default',
        }}>Next puzzle</button>
        <button onClick={onBack} style={{
          flex:1,
          minWidth:compact?0:120,
          padding:compact?'9px 10px':'10px 12px',
          borderRadius:9,
          border:'1px solid #285634',
          background:'transparent',
          color:'#b3d1bb',
          fontSize:12,
          fontWeight:500,
          cursor:'pointer',
        }}>Back to puzzles</button>
      </div>
    </div>
  );
}

function useTelegoModules(){
  const [mods,setMods]=React.useState(()=>window.TelegoModules||null);
  React.useEffect(()=>{
    if(window.TelegoModules){setMods(window.TelegoModules);return;}
    const handleReady=()=>setMods(window.TelegoModules||null);
    window.addEventListener('teleba-modules-ready',handleReady);
    return()=>window.removeEventListener('teleba-modules-ready',handleReady);
  },[]);
  return mods;
}

function colorNumToCode(color){return color===1?'B':'W';}
function colorCodeToNum(color){return color==='W'?2:1;}
function boardToUi(board){return board.map(row=>row.map(cell=>cell===1?'B':cell===2?'W':null));}
function formatMoveLabel(move,size){
  if(!move) return 'Start';
  if(move.pass) return 'Pass';
  return `${COLS2[move.j]}${size-move.i}`;
}
function uiHistoryFromMoves(moves,size){
  return moves.map(move=>({
    color:colorNumToCode(move.color),
    label:formatMoveLabel(move,size),
    captures:move.captured?.length||0,
  }));
}
function snapshotFromGame(game){
  return {
    stones:boardToUi(game.board),
    turn:colorNumToCode(game.currentPlayer),
    captures:{B:game.captures[1],W:game.captures[2]},
    lastMove:game.lastMove&&!game.lastMove.pass?[game.lastMove.i,game.lastMove.j]:null,
    history:uiHistoryFromMoves(game.getHistory(),game.size),
    score:game.estimateScore(),
  };
}
function otherColor(color){return color===1?2:1;}
function getPuzzleFrontier(node){
  const frontier=[];
  const visit=current=>{
    if(!current.children.length){frontier.push(current);return;}
    current.children.forEach(child=>{if(child.move)frontier.push(child);else visit(child);});
  };
  visit(node);
  return frontier;
}
function getPuzzleMovesForColor(node,color){
  return getPuzzleFrontier(node).filter(child=>child.move&&child.move.color===color);
}
function isPuzzleWinningNode(state,node,nextPlayer){
  let cache=state.cache.get(node);
  if(cache&&cache[nextPlayer]!==undefined) return cache[nextPlayer];
  if(!cache){cache={};state.cache.set(node,cache);}
  let result;
  if(node.isWrong) result=false;
  else if(node.isCorrect) result=true;
  else{
    const moves=getPuzzleMovesForColor(node,nextPlayer);
    if(!moves.length) result=!state.hasExplicitMarks;
    else if(nextPlayer===state.solverColor) result=moves.some(child=>isPuzzleWinningNode(state,child,otherColor(nextPlayer)));
    else result=moves.every(child=>isPuzzleWinningNode(state,child,otherColor(nextPlayer)));
  }
  cache[nextPlayer]=result;
  return result;
}
function getCorrectPuzzleMoves(state,node,color){
  return getPuzzleMovesForColor(node,color).filter(child=>isPuzzleWinningNode(state,child,otherColor(color)));
}

// ── Game View ─────────────────────────────────────────────────────────────────
function GameView({gameConfig,onBack,isPuzzle,onNextPuzzle,hasNextPuzzle}){
  const isMobile=useMobile();
  const modules=useTelegoModules();
  const gameRef=React.useRef(null);
  const botRef=React.useRef(null);
  const puzzleRef=React.useRef(null);
  const timeoutRef=React.useRef(null);
  const size=gameConfig?.size||19;
  const myColor=gameConfig?.myColor||'B';
  const myColorNum=colorCodeToNum(myColor);
  const oppName=gameConfig?.opp?.name||(isPuzzle?'Puzzle':'Teleba Bot');
  const oppRank=gameConfig?.opp?.rank||(isPuzzle?'SGF':'KataGo');
  const [snapshots,setSnapshots]=React.useState([{stones:initBoard(size),turn:myColor,captures:{B:0,W:0},lastMove:null,history:[],score:{blackScore:0,whiteScore:0}}]);
  const [stoneHistIdx,setStoneHistIdx]=React.useState(0);
  const [timeB,setTimeB]=React.useState(gameConfig?.timeB||600);
  const [timeW,setTimeW]=React.useState(gameConfig?.timeW||600);
  const [toast,setToast]=React.useState(null);
  const [rightTab,setRightTab]=React.useState('history');
  const [chatMessages,setChatMessages]=React.useState([]);
  const [resigned,setResigned]=React.useState(null);
  const [showCoords,setShowCoords]=React.useState(!isMobile);
  const [analysisOn,setAnalysisOn]=React.useState(false);
  const [analysis,setAnalysis]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [botThinking,setBotThinking]=React.useState(false);
  const [drawerOpen,setDrawerOpen]=React.useState(null);
  const [modeStatus,setModeStatus]=React.useState(isPuzzle?'Loading puzzle…':'Preparing local bot…');
  const [puzzleInfo,setPuzzleInfo]=React.useState(null);
  const [retryNonce,setRetryNonce]=React.useState(0);

  const showToast=React.useCallback((msg,type='info')=>{
    if(timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({msg,type});
    timeoutRef.current=setTimeout(()=>setToast(null),3000);
  },[]);

  React.useEffect(()=>()=>{if(timeoutRef.current)clearTimeout(timeoutRef.current);},[]);

  const commitSnapshot=React.useCallback((game,{replaceLast=false}={})=>{
    const snapshot=snapshotFromGame(game);
    setSnapshots(prev=>{
      const next=replaceLast&&prev.length?[...prev.slice(0,-1),snapshot]:[...prev,snapshot];
      setStoneHistIdx(next.length-1);
      return next;
    });
    return snapshot;
  },[]);

  const pushSystemMessage=React.useCallback(text=>{
    setChatMessages(prev=>[...prev,{from:isPuzzle?'Puzzle':'Teleba',text}]);
  },[isPuzzle]);

  React.useEffect(()=>{
    if(resigned||stoneHistIdx!==snapshots.length-1||loading)return;
    const live=snapshots[snapshots.length-1];
    const t=setInterval(()=>{
      if(live.turn==='B') setTimeB(v=>Math.max(0,v-1));
      else setTimeW(v=>Math.max(0,v-1));
    },1000);
    return()=>clearInterval(t);
  },[snapshots,stoneHistIdx,resigned,loading]);

  React.useEffect(()=>{
    if(!modules) return;
    let cancelled=false;
    async function setup(){
      setLoading(true);
      setAnalysis(null);
      setBotThinking(false);
      setResigned(null);
      setChatMessages([]);
      setTimeB(gameConfig?.timeB||600);
      setTimeW(gameConfig?.timeW||600);
      setStoneHistIdx(0);
      setDrawerOpen(null);
      try{
        const game=new modules.GoGame(size,6.5);
        gameRef.current=game;
        if(isPuzzle&&gameConfig?.sgfPath){
          const text=await fetch(gameConfig.sgfPath).then(r=>{if(!r.ok)throw new Error(`Puzzle fetch failed (${r.status})`);return r.text();});
          if(cancelled) return;
          const parsed=modules.parseSgf(text);
          game.board=Array.from({length:parsed.size},()=>Array(parsed.size).fill(0));
          parsed.setup.black.forEach(([i,j])=>{game.board[i][j]=1;});
          parsed.setup.white.forEach(([i,j])=>{game.board[i][j]=2;});
          game.currentPlayer=parsed.currentPlayer;
          puzzleRef.current={
            title:parsed.title||gameConfig.title,
            comment:parsed.comment,
            status:'Solve the position',
            root:parsed.tree,
            currentNode:parsed.tree,
            solverColor:parsed.currentPlayer,
            hasExplicitMarks:parsed.hasExplicitMarks,
            solved:false,
            failed:false,
            cache:new WeakMap(),
          };
          setPuzzleInfo({title:parsed.title||gameConfig.title,status:'Solve the position',comment:parsed.comment,solved:false,failed:false});
          setModeStatus('Solve the local SGF puzzle');
          pushSystemMessage(parsed.comment||'Play the correct move sequence.');
        }else{
          puzzleRef.current=null;
          setPuzzleInfo(null);
          setModeStatus('Local bot ready');
          pushSystemMessage('Live game started against the local KataGo bot.');
        }
        const first=snapshotFromGame(game);
        setSnapshots([first]);
      }catch(error){
        console.error(error);
        setModeStatus(error.message);
        showToast(error.message,'error');
      }finally{
        if(!cancelled) setLoading(false);
      }
    }
    setup();
    return()=>{cancelled=true;};
  },[modules,gameConfig?.sgfPath,isPuzzle,size,pushSystemMessage,showToast,gameConfig?.timeB,gameConfig?.timeW,retryNonce]);

  const liveSnapshot=snapshots[snapshots.length-1]||snapshots[0];
  const displaySnapshot=snapshots[stoneHistIdx]||liveSnapshot;
  const history=displaySnapshot?.history||[];
  const histIdx=stoneHistIdx-1;
  const isReviewing=stoneHistIdx!==snapshots.length-1;
  const turn=displaySnapshot?.turn||myColor;
  const effectiveMyColor=isPuzzle?colorNumToCode(puzzleRef.current?.solverColor||myColorNum):myColor;
  const captures=displaySnapshot?.captures||{B:0,W:0};
  const lastMove=displaySnapshot?.lastMove||null;
  const score=analysis?.heuristic||displaySnapshot?.score||{blackScore:0,whiteScore:0};
  const puzzleFailed=!!puzzleInfo?.failed;
  const puzzleSolved=!!puzzleInfo?.solved;

  const updatePuzzleState=React.useCallback(()=>{
    const state=puzzleRef.current;
    if(!state) return;
    setPuzzleInfo({
      title:state.title||gameConfig?.title||'Puzzle',
      status:state.status,
      comment:state.comment,
      solved:state.solved,
      failed:state.failed,
    });
  },[gameConfig?.title]);

  const playPuzzleNode=React.useCallback((node)=>{
    const game=gameRef.current;
    const state=puzzleRef.current;
    if(!game||!state) return false;
    let applied=false;
    if(node.move.pass) applied=game.pass(node.move.color);
    else applied=!!game.playMove(node.move.point.i,node.move.point.j,node.move.color);
    if(!applied) return false;
    state.currentNode=node;
    state.comment=node.comment||state.comment;
    const nextPlayer=otherColor(node.move.color);
    const remainsWinning=isPuzzleWinningNode(state,node,nextPlayer);
    if(node.isCorrect){state.status='Solved';state.solved=true;}
    else if(node.isWrong){state.status='Wrong line';state.failed=true;}
    else if(node.move.color===state.solverColor&&!remainsWinning){state.status='Wrong line';state.failed=true;state.comment=node.comment||'That move does not keep a correct continuation.';}
    else if(!node.children.length&&!state.hasExplicitMarks){state.status='Solved';state.solved=true;}
    else state.status='Correct so far';
    commitSnapshot(game);
    updatePuzzleState();
    return true;
  },[commitSnapshot,updatePuzzleState]);

  const advancePuzzleResponses=React.useCallback(()=>{
    const game=gameRef.current;
    const state=puzzleRef.current;
    if(!game||!state) return;
    while(!state.solved&&!state.failed&&game.currentPlayer!==state.solverColor){
      const replies=getCorrectPuzzleMoves(state,state.currentNode,game.currentPlayer);
      if(!replies.length) break;
      if(!playPuzzleNode(replies[0])) break;
    }
    const frontier=getPuzzleMovesForColor(state.currentNode,game.currentPlayer);
    const correct=getCorrectPuzzleMoves(state,state.currentNode,game.currentPlayer);
    if(!state.solved&&!state.failed){
      if(!frontier.length&&!state.hasExplicitMarks){state.status='Solved';state.solved=true;}
      else if(game.currentPlayer===state.solverColor) state.status=correct.length===1?'Your next move':'Choose the right move';
      else state.status='Opponent response';
    }
    updatePuzzleState();
  },[playPuzzleNode,updatePuzzleState]);

  const requestBotMove=React.useCallback(async()=>{
    if(!modules||isPuzzle||loading||botThinking||resigned||isReviewing) return;
    const game=gameRef.current;
    if(!game||game.currentPlayer===myColorNum||game.consecutivePasses>=2) return;
    setBotThinking(true);
    setModeStatus('Bot thinking…');
    try{
      if(!botRef.current) botRef.current=new modules.KataGoEngine();
      const nextAnalysis=await botRef.current.analyze(game,{level:gameConfig?.botLevel||'kyu',maxSuggestions:5});
      setAnalysis(nextAnalysis);
      const move=nextAnalysis.suggestedMove;
      if(move) game.playMove(move.i,move.j,game.currentPlayer);
      else game.pass(game.currentPlayer);
      commitSnapshot(game);
      setModeStatus(move?`Bot played ${formatMoveLabel(game.lastMove,game.size)}`:'Bot passed');
    }catch(error){
      console.error(error);
      showToast(`Bot move failed: ${error.message}`,'error');
      setModeStatus('Bot unavailable');
    }finally{
      setBotThinking(false);
    }
  },[modules,isPuzzle,loading,botThinking,resigned,isReviewing,myColorNum,gameConfig?.botLevel,commitSnapshot,showToast]);

  React.useEffect(()=>{requestBotMove();},[requestBotMove,snapshots.length]);

  const handlePlace=React.useCallback(([row,col])=>{
    if(loading||resigned||isReviewing) return;
    const game=gameRef.current;
    if(!game) return;
    if(isPuzzle){
      const state=puzzleRef.current;
      if(!state||state.failed) return;
      if(state.solved){
        const played=game.playMove(row,col,game.currentPlayer);
        if(!played){showToast('Illegal move','error');return;}
        commitSnapshot(game);
        setModeStatus(`You played ${formatMoveLabel(game.lastMove,game.size)}`);
        return;
      }
      if(game.currentPlayer!==state.solverColor){showToast('Wait for the puzzle response','info');return;}
      const nextNode=getPuzzleFrontier(state.currentNode).find(child=>child.move&&!child.move.pass&&child.move.color===game.currentPlayer&&child.move.point?.i===row&&child.move.point?.j===col);
      if(!nextNode){
        state.status='Wrong line';
        state.failed=true;
        state.comment='No matching SGF branch for that move.';
        updatePuzzleState();
        showToast('Wrong puzzle move','error');
        return;
      }
      if(playPuzzleNode(nextNode)){
        advancePuzzleResponses();
        const stateAfter=puzzleRef.current;
        if(stateAfter?.solved){
          stateAfter.status='Solved. Free play is on.';
          stateAfter.comment='Puzzle solved. Keep playing from this position or move on to the next puzzle.';
          updatePuzzleState();
          showToast('Puzzle solved','success');
        }
      }
      return;
    }
    if(game.currentPlayer!==myColorNum){showToast('Bot is thinking','info');return;}
    const played=game.playMove(row,col,game.currentPlayer);
    if(!played){showToast('Illegal move','error');return;}
    commitSnapshot(game);
    setModeStatus(`You played ${formatMoveLabel(game.lastMove,game.size)}`);
  },[loading,resigned,isReviewing,isPuzzle,myColorNum,commitSnapshot,showToast,playPuzzleNode,advancePuzzleResponses,updatePuzzleState,size]);

  const handlePass=React.useCallback(()=>{
    if(loading||resigned||isReviewing) return;
    const game=gameRef.current;
    if(!game) return;
    if(isPuzzle){showToast('Pass is disabled in puzzle mode','info');return;}
    if(game.currentPlayer!==myColorNum){showToast('Wait for the bot move','info');return;}
    if(!game.pass(game.currentPlayer)) return;
    commitSnapshot(game);
    setModeStatus('You passed');
  },[loading,resigned,isReviewing,isPuzzle,myColorNum,commitSnapshot,showToast]);

  const handleResign=React.useCallback(()=>{
    const winner=turn==='B'?'White':'Black';
    setResigned(winner);
    setModeStatus(`${winner} wins by resignation`);
  },[turn]);

  const handleRetryPuzzle=React.useCallback(()=>{
    if(!isPuzzle) return;
    setRetryNonce(v=>v+1);
  },[isPuzzle]);

  const navActions=[
    ['|<',()=>setStoneHistIdx(0)],
    ['<',()=>setStoneHistIdx(i=>Math.max(0,i-1))],
    ['>',()=>setStoneHistIdx(i=>Math.min(snapshots.length-1,i+1))],
    ['>|',()=>setStoneHistIdx(snapshots.length-1)],
  ];
  const btnBase={display:'flex',alignItems:'center',justifyContent:'center',gap:5,borderRadius:9,fontSize:12,fontWeight:500,cursor:'pointer',border:'1px solid',transition:'all .15s'};
  const infoRows=[
    ['Board',`${size}×${size}`],
    ['Mode',isPuzzle?'Puzzle':'Bot Game'],
    ['Move',String(history.length)],
    ['Status',resigned?`${resigned} won`:botThinking?'Bot thinking…':modeStatus],
  ];

  const boardPane=(
    <div style={{flex:1,minHeight:0,display:'flex',justifyContent:'center'}}>
      <div style={{aspectRatio:'1 / 1',height:'100%',maxWidth:'100%',maxHeight:'100%',width:'100%'}}>
        <GoBoard size={size} stones={displaySnapshot?.stones||initBoard(size)} onPlace={handlePlace}
          currentTurn={turn} lastMove={lastMove} showCoords={showCoords}
          readonly={loading||!!resigned||isReviewing||botThinking||isPuzzle&&!puzzleRef.current?.solved&&turn!==colorNumToCode(puzzleRef.current?.solverColor||1)}/>
      </div>
    </div>
  );

  if(isMobile){
    return(
      <div style={{flex:1,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'#0d0c0b'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid #1e1b18',flexShrink:0,paddingTop:'calc(8px + var(--safe-top))'}}>
          <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 10px',borderRadius:8,border:'1px solid #2a2520',background:'transparent',color:'#6b6055',fontSize:12,cursor:'pointer',minHeight:36}}>
            <Icon d={Icons.chevronL} size={13}/> Back
          </button>
          <div style={{flex:1,textAlign:'center',fontSize:13,fontWeight:500,color:'#8a7a68'}}>{isPuzzle?(puzzleInfo?.title||'Puzzle'):`vs ${oppName}`}</div>
          <button onClick={()=>setAnalysisOn(v=>!v)} style={{width:36,height:36,borderRadius:8,border:'1px solid',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:analysisOn?'#2a2520':'transparent',borderColor:analysisOn?'#3a3228':'#1e1b18',color:analysisOn?'#c4872a':'#4a4440'}}><Icon d={Icons.brain} size={15}/></button>
        </div>
        <div style={{display:'flex',alignItems:'stretch',borderBottom:'1px solid #1e1b18',flexShrink:0,background:'#111009'}}>
          <MobilePlayerChip player={{name:oppName,rank:oppRank}} color={effectiveMyColor==='B'?'W':'B'} captures={captures[effectiveMyColor==='B'?'W':'B']} timeLeft={effectiveMyColor==='B'?timeW:timeB} byoyomi={2} isActive={turn!==effectiveMyColor} align='left'/>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 10px',gap:3}}>
            <div style={{width:10,height:10,borderRadius:5,background:turn==='B'?'#111':'#eee',border:turn==='B'?'1px solid #555':'1px solid #bbb'}}/>
            <div style={{fontSize:9,color:'#4a4440',fontWeight:500}}>TURN</div>
          </div>
          <MobilePlayerChip player={{name:'You',rank:'3k'}} color={effectiveMyColor} captures={captures[effectiveMyColor]} timeLeft={effectiveMyColor==='B'?timeB:timeW} byoyomi={1} isActive={turn===effectiveMyColor} align='right'/>
        </div>
        <div style={{padding:'8px 12px',fontSize:12,color:puzzleInfo?.failed?'#c44a2a':puzzleInfo?.solved?'#2a8c4a':'#8a7a68',borderBottom:'1px solid #1e1b18'}}>{puzzleInfo?.status||modeStatus}</div>
        {isPuzzle&&puzzleFailed&&(
          <div style={{padding:'10px 12px 0',flexShrink:0}}>
            <PuzzleFailureCard
              compact
              message={puzzleInfo?.comment}
              onRetry={handleRetryPuzzle}
              onBack={onBack}
            />
          </div>
        )}
        {isPuzzle&&puzzleSolved&&(
          <div style={{padding:'10px 12px 0',flexShrink:0}}>
            <PuzzleSuccessCard
              compact
              message={puzzleInfo?.comment}
              onNext={onNextPuzzle}
              onBack={onBack}
              hasNext={hasNextPuzzle}
            />
          </div>
        )}
        <div style={{flex:1,minHeight:0,padding:'8px'}}>{boardPane}</div>
        {analysisOn&&<div style={{padding:'6px 12px',background:'#111009',flexShrink:0}}><ScoreBar black={score.blackScore||0} white={score.whiteScore||0}/></div>}
        <div style={{flexShrink:0,borderTop:'1px solid #1e1b18',background:'#0d0c0b',paddingBottom:'var(--safe-bot)'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4,padding:'6px 12px'}}>
            {navActions.map(([label,fn],i)=><button key={i} onClick={fn} style={{...btnBase,padding:'6px 12px',background:'transparent',borderColor:'#2a2520',color:'#6b6055',fontSize:11,minHeight:36,minWidth:44}}>{label}</button>)}
            <div style={{flex:1}}/>
            <span style={{fontSize:11,color:'#4a4440'}}>#{history.length}</span>
          </div>
          <div style={{display:'flex',gap:6,padding:'0 10px 8px'}}>
            <button onClick={handlePass} disabled={!!resigned||isPuzzle} style={{...btnBase,flex:1,padding:'10px 6px',background:'transparent',borderColor:'#2a2520',color:'#8a7a68',opacity:resigned||isPuzzle?0.4:1,minHeight:44}}>Pass</button>
            <button onClick={()=>setDrawerOpen('history')} style={{...btnBase,flex:1,padding:'10px 6px',background:'transparent',borderColor:'#2a2520',color:'#8a7a68',minHeight:44}}><Icon d={Icons.list} size={14}/></button>
            <button onClick={()=>setDrawerOpen('chat')} style={{...btnBase,flex:1,padding:'10px 6px',background:'transparent',borderColor:'#2a2520',color:'#8a7a68',minHeight:44}}><Icon d={Icons.chat} size={14}/></button>
            <button onClick={handleResign} disabled={!!resigned} style={{...btnBase,flex:1,padding:'10px 6px',background:'transparent',borderColor:'#c44a2a44',color:'#c44a2a',opacity:resigned?0.4:1,minHeight:44}}><Icon d={Icons.flag} size={14}/></button>
          </div>
        </div>
        <MobileDrawer open={drawerOpen==='history'} onClose={()=>setDrawerOpen(null)} title="Move History"><div style={{height:280}}><MoveHistory history={history} currentIdx={histIdx} onGoTo={i=>{setStoneHistIdx(i+1);setDrawerOpen(null);}}/></div></MobileDrawer>
        <MobileDrawer open={drawerOpen==='chat'} onClose={()=>setDrawerOpen(null)} title="Notes"><div style={{height:280}}><ChatPanel messages={chatMessages} onSend={m=>setChatMessages(c=>[...c,{from:'You',text:m}])}/></div></MobileDrawer>
        {toast&&<Toast msg={toast.msg} type={toast.type}/>}
      </div>
    );
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',height:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',borderBottom:'1px solid #1e1b18',flexShrink:0}}>
        <button onClick={onBack} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:'1px solid #2a2520',background:'transparent',color:'#6b6055',fontSize:12,cursor:'pointer'}}><Icon d={Icons.chevronL} size={13}/> Back</button>
        <div style={{flex:1,fontSize:13,color:'#8a7a68'}}>{puzzleInfo?.comment||modeStatus}</div>
        <div style={{display:'flex',gap:2}}>
          {[[Icons.eye,showCoords,setShowCoords],[Icons.brain,analysisOn,setAnalysisOn]].map(([icon,val,set],i)=><button key={i} onClick={()=>set(v=>!v)} style={{width:32,height:32,borderRadius:7,border:'1px solid',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s',background:val?'#2a2520':'transparent',borderColor:val?'#3a3228':'#1e1b18',color:val?'#c4872a':'#4a4440'}}><Icon d={icon} size={14}/></button>)}
        </div>
      </div>
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{flex:1,display:'flex',flexDirection:'column',padding:'12px 14px',gap:10,overflow:'hidden'}}>
          <div style={{display:'flex',gap:10,flexShrink:0}}>
            <PlayerPanel player={{name:oppName,rank:oppRank}} color={effectiveMyColor==='B'?'W':'B'} captures={captures[effectiveMyColor==='B'?'W':'B']} timeLeft={effectiveMyColor==='B'?timeW:timeB} byoyomi={2} isActive={turn!==effectiveMyColor} isRight={false}/>
            <div style={{display:'flex',alignItems:'center',fontSize:11,color:'#2a2520',fontWeight:600}}>VS</div>
            <PlayerPanel player={{name:'You',rank:'3k'}} color={effectiveMyColor} captures={captures[effectiveMyColor]} timeLeft={effectiveMyColor==='B'?timeB:timeW} byoyomi={1} isActive={turn===effectiveMyColor} isRight={true}/>
          </div>
          {boardPane}
          {isPuzzle&&puzzleFailed&&(
            <PuzzleFailureCard
              message={puzzleInfo?.comment}
              onRetry={handleRetryPuzzle}
              onBack={onBack}
            />
          )}
          {isPuzzle&&puzzleSolved&&(
            <PuzzleSuccessCard
              message={puzzleInfo?.comment}
              onNext={onNextPuzzle}
              onBack={onBack}
              hasNext={hasNextPuzzle}
            />
          )}
          {analysisOn&&<div style={{flexShrink:0,padding:'8px 12px',background:'#111009',borderRadius:10,border:'1px solid #1e1b18'}}><ScoreBar black={score.blackScore||0} white={score.whiteScore||0}/></div>}
          <div style={{display:'flex',gap:8,flexShrink:0}}>
            <div style={{display:'flex',gap:3}}>
              {navActions.map(([label,fn],i)=><button key={i} onClick={fn} style={{...btnBase,padding:'7px 10px',background:'transparent',borderColor:'#2a2520',color:'#6b6055',fontSize:11,minHeight:36}}>{label}</button>)}
            </div>
            <div style={{flex:1}}/>
            <button onClick={handlePass} disabled={!!resigned||isPuzzle} style={{...btnBase,padding:'7px 14px',background:'transparent',borderColor:'#2a2520',color:'#8a7a68',opacity:resigned||isPuzzle?0.4:1,minHeight:36}}><Icon d={Icons.x} size={13} sw={2}/> Pass</button>
            <button onClick={handleResign} disabled={!!resigned} style={{...btnBase,padding:'7px 14px',background:'transparent',borderColor:'#c44a2a44',color:'#c44a2a',opacity:resigned?0.4:1,minHeight:36}}><Icon d={Icons.flag} size={13}/> Resign</button>
          </div>
        </div>
        <div style={{width:300,flexShrink:0,borderLeft:'1px solid #1e1b18',display:'flex',flexDirection:'column',padding:'12px 14px'}}>
          <div style={{display:'flex',gap:2,marginBottom:12,background:'#0d0c0b',padding:3,borderRadius:8,border:'1px solid #1e1b18'}}>
            {[['history',Icons.clock],['chat',Icons.chat]].map(([t,icon])=>(
              <button key={t} onClick={()=>setRightTab(t)} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'5px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11,fontWeight:500,transition:'all .15s',background:rightTab===t?'#1e1b18':'transparent',color:rightTab===t?'#e4dcd2':'#4a4440'}}><Icon d={icon} size={12}/>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
            ))}
          </div>
          <div style={{flex:1,minHeight:0}}>
            {rightTab==='history'?<MoveHistory history={history} currentIdx={histIdx} onGoTo={i=>setStoneHistIdx(i+1)}/>:<ChatPanel messages={chatMessages} onSend={m=>setChatMessages(c=>[...c,{from:'You',text:m}])}/>}
          </div>
          <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid #1e1b18'}}>
            <div style={{fontSize:10,fontWeight:600,color:'#4a4440',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:7}}>Game Info</div>
            {infoRows.map(([k,v])=><div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:4}}><span style={{color:'#4a4440'}}>{k}</span><span style={{color:'#8a7a68',fontWeight:500,textAlign:'right'}}>{v}</span></div>)}
          </div>
        </div>
      </div>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}
    </div>
  );
}

// ── Free Board ────────────────────────────────────────────────────────────────
function FreeBoardScreen(){
  const isMobile=useMobile();
  const [size,setSize]=React.useState(19);
  const [stones,setStones]=React.useState(()=>initBoard(19));
  const [turn,setTurn]=React.useState('B');
  const [lastMove,setLastMove]=React.useState(null);
  const [history,setHistory]=React.useState([initBoard(19)]);
  const [histIdx,setHistIdx]=React.useState(0);

  const changeSize=s=>{const b=initBoard(s);setSize(s);setStones(b);setHistory([b]);setHistIdx(0);setLastMove(null);setTurn('B');};
  const handlePlace=([r,c])=>{
    if(stones[r][c])return;
    const res=placeStone(history[histIdx],r,c,turn,size);
    if(!res)return;
    const nh=[...history.slice(0,histIdx+1),res.stones];
    setHistory(nh);setHistIdx(nh.length-1);setStones(res.stones);setLastMove([r,c]);setTurn(t=>t==='B'?'W':'B');
  };
  const undo=()=>{if(histIdx>0){const i=histIdx-1;setHistIdx(i);setStones(history[i]);setTurn(t=>t==='B'?'W':'B');setLastMove(null);}};
  const clear=()=>{const b=initBoard(size);setStones(b);setHistory([b]);setHistIdx(0);setLastMove(null);setTurn('B');};

  if (!isMobile) {
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderBottom:'1px solid #1e1b18',flexShrink:0}}>
          <div style={{fontSize:15,fontWeight:600,color:'#e4dcd2'}}>Free Board</div>
          <div style={{flex:1}}/>
          <span style={{fontSize:11,color:'#6b6055'}}>Move {histIdx}</span>
        </div>
        <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
          <div style={{flex:1,display:'flex',justifyContent:'center',alignItems:'center',padding:'12px 14px',minWidth:0,minHeight:0}}>
            <div style={{aspectRatio:'1 / 1',height:'100%',width:'100%',maxWidth:'100%',maxHeight:'100%'}}>
              <GoBoard size={size} stones={stones} onPlace={handlePlace} currentTurn={turn} lastMove={lastMove} showCoords={true}/>
            </div>
          </div>
          <div style={{width:300,flexShrink:0,borderLeft:'1px solid #1e1b18',padding:'14px 16px',display:'flex',flexDirection:'column',gap:16}}>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:'#4a4440',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Board size</div>
              <div style={{display:'flex',gap:3,background:'#0d0c0b',padding:3,borderRadius:8,border:'1px solid #2a2520'}}>
                {[9,13,19].map(s=>(
                  <button key={s} onClick={()=>changeSize(s)} style={{flex:1,padding:'7px 0',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,transition:'all .15s',
                    background:size===s?'#1e1b18':'transparent',color:size===s?'#e4dcd2':'#6b6055'}}>{s}×{s}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:600,color:'#4a4440',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Turn</div>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'#111009',borderRadius:8,border:'1px solid #1e1b18'}}>
                <div style={{width:14,height:14,borderRadius:7,background:turn==='B'?'#111':'#f0ede8',border:turn==='B'?'1px solid #555':'1px solid #bbb'}}/>
                <span style={{fontSize:13,color:'#e4dcd2',fontWeight:500}}>{turn==='B'?'Black to play':'White to play'}</span>
              </div>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={undo} disabled={histIdx===0}
                style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px',borderRadius:8,border:'1px solid #2a2520',background:'transparent',color:histIdx===0?'#2a2520':'#8a7a68',cursor:histIdx===0?'not-allowed':'pointer',fontSize:12,fontWeight:500}}>
                <Icon d={Icons.undo} size={14}/> Undo
              </button>
              <button onClick={clear}
                style={{flex:1,padding:'9px',borderRadius:8,border:'1px solid #2a2520',background:'transparent',color:'#8a7a68',fontSize:12,fontWeight:500,cursor:'pointer'}}>
                Clear
              </button>
            </div>
            <div style={{marginTop:'auto',paddingTop:14,borderTop:'1px solid #1e1b18'}}>
              <div style={{fontSize:10,fontWeight:600,color:'#4a4440',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>Stats</div>
              {[['Board',`${size}×${size}`],['Moves',String(histIdx)]].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:'#4a4440'}}>{k}</span>
                  <span style={{color:'#8a7a68',fontWeight:500}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',padding:'12px',height:'100%',overflow:'hidden',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,flexWrap:'wrap'}}>
        <div style={{fontSize:15,fontWeight:600,color:'#e4dcd2'}}>Free Board</div>
        <div style={{display:'flex',gap:3,background:'#0d0c0b',padding:3,borderRadius:8,border:'1px solid #2a2520'}}>
          {[9,13,19].map(s=>(
            <button key={s} onClick={()=>changeSize(s)} style={{padding:'4px 10px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:500,transition:'all .15s',
              background:size===s?'#1e1b18':'transparent',color:size===s?'#e4dcd2':'#6b6055'}}>{s}×{s}</button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'#111009',borderRadius:8,border:'1px solid #1e1b18'}}>
          <div style={{width:10,height:10,borderRadius:5,background:turn==='B'?'#111':'#f0ede8',border:turn==='B'?'1px solid #555':'1px solid #bbb'}}/>
          <span style={{fontSize:12,color:'#8a7a68',fontWeight:500}}>{turn==='B'?'Black':'White'}</span>
        </div>
        <div style={{flex:1}}/>
        <button onClick={undo} disabled={histIdx===0}
          style={{width:36,height:36,borderRadius:8,border:'1px solid #2a2520',background:'transparent',color:histIdx===0?'#2a2520':'#8a7a68',cursor:histIdx===0?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon d={Icons.undo} size={15}/>
        </button>
        <button onClick={clear}
          style={{padding:'7px 12px',borderRadius:8,border:'1px solid #2a2520',background:'transparent',color:'#8a7a68',fontSize:12,fontWeight:500,cursor:'pointer'}}>
          Clear
        </button>
      </div>
      <div style={{flex:1,minHeight:0}}>
        <GoBoard size={size} stones={stones} onPlace={handlePlace} currentTurn={turn} lastMove={lastMove} showCoords={false}/>
      </div>
    </div>
  );
}

// ── Sidebar (desktop) ─────────────────────────────────────────────────────────
const NAV=[
  {id:'lobby',icon:Icons.globe,label:'Live Games'},
  {id:'puzzles',icon:Icons.puzzle,label:'Puzzles'},
  {id:'free',icon:Icons.board,label:'Free Board'},
];

function Sidebar({screen,setScreen}){
  const [hov,setHov]=React.useState(null);
  return(
    <div style={{width:64,flexShrink:0,background:'#0d0c0b',borderRight:'1px solid #1e1b18',display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 0',gap:4,paddingTop:'calc(14px + var(--safe-top))'}}>
      <div style={{width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#c4872a,#8B6014)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:18,boxShadow:'0 2px 12px rgba(196,135,42,0.25)',flexShrink:0}}>
        <svg width="20" height="20" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
          <circle cx="10" cy="10" r="3" fill="rgba(255,255,255,0.9)"/>
          <circle cx="5" cy="5" r="2" fill="rgba(0,0,0,0.7)"/>
          <circle cx="15" cy="5" r="2" fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
          <circle cx="5" cy="15" r="2" fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.2)" strokeWidth="0.5"/>
          <circle cx="15" cy="15" r="2" fill="rgba(0,0,0,0.7)"/>
        </svg>
      </div>
      {NAV.map(n=>{
        const active=screen===n.id;
        return(
          <div key={n.id} style={{position:'relative',width:'100%',display:'flex',justifyContent:'center'}}>
            <button onClick={()=>setScreen(n.id)} onMouseEnter={()=>setHov(n.id)} onMouseLeave={()=>setHov(null)}
              style={{width:42,height:42,borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s',
                background:active?'#2a2520':hov===n.id?'#1a1714':'transparent',color:active?'#c4872a':hov===n.id?'#8a7a68':'#4a4440'}}>
              <Icon d={n.icon} size={18} sw={1.5}/>
            </button>
            {active&&<div style={{position:'absolute',right:0,top:'50%',transform:'translateY(-50%)',width:3,height:20,borderRadius:2,background:'#c4872a'}}/>}
            {hov===n.id&&!active&&(
              <div style={{position:'absolute',left:'calc(100% + 10px)',top:'50%',transform:'translateY(-50%)',background:'#1e1b18',border:'1px solid #2a2520',borderRadius:7,padding:'5px 10px',fontSize:12,color:'#e4dcd2',whiteSpace:'nowrap',pointerEvents:'none',zIndex:50,boxShadow:'0 4px 16px rgba(0,0,0,0.4)'}}>
                {n.label}
              </div>
            )}
          </div>
        );
      })}
      <div style={{flex:1}}/>
      <button onClick={()=>setScreen('settings')} onMouseEnter={()=>setHov('settings')} onMouseLeave={()=>setHov(null)}
        style={{width:42,height:42,borderRadius:10,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s',
          background:screen==='settings'?'#2a2520':hov==='settings'?'#1a1714':'transparent',color:screen==='settings'?'#c4872a':hov==='settings'?'#8a7a68':'#4a4440'}}>
        <Icon d={Icons.settings} size={18} sw={1.5}/>
      </button>
    </div>
  );
}

// ── Bottom Nav (mobile) ───────────────────────────────────────────────────────
const NAV_MOBILE=[...NAV,{id:'settings',icon:Icons.settings,label:'Settings'}];

function BottomNav({screen,setScreen}){
  return(
    <div style={{display:'flex',background:'#0d0c0b',borderTop:'1px solid #1e1b18',paddingBottom:'var(--safe-bot)',flexShrink:0}}>
      {NAV_MOBILE.map(n=>{
        const active=screen===n.id;
        return(
          <button key={n.id} onClick={()=>setScreen(n.id)}
            style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'10px 4px 8px',border:'none',background:'transparent',cursor:'pointer',
              color:active?'#c4872a':'#4a4440',transition:'color .15s',minHeight:56}}>
            <Icon d={n.icon} size={20} sw={active?2:1.5}/>
            <span style={{fontSize:9,fontWeight:active?600:400,letterSpacing:'0.02em'}}>{n.label.split(' ')[0]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App(){
  const isMobile=useMobile();
  const [screen,setScreen]=React.useState(()=>localStorage.getItem('telego-screen')||'lobby');
  const [gameConfig,setGameConfig]=React.useState(null);
  const [isPuzzle,setIsPuzzle]=React.useState(false);

  React.useEffect(()=>{if(screen!=='game')localStorage.setItem('telego-screen',screen);},[screen]);

  const startGame=(config,mode)=>{
    setGameConfig(config?{myColor:'B',size:config.size||19,timeB:config.timeB||600,timeW:config.timeW||600,...config}:{size:19,myColor:'B',opp:{name:'Teleba Bot',rank:'KataGo'},timeB:600,timeW:600,mode:'bot',botLevel:'kyu'});
    setIsPuzzle(mode==='puzzle');
    setScreen('game');
  };

  const puzzleLibrary=window.__telebaPuzzleLibrary||[];
  const currentPuzzleIndex=isPuzzle&&gameConfig
    ? puzzleLibrary.findIndex(p=>p.id===gameConfig.id||p.sgfPath===gameConfig.sgfPath)
    : -1;
  const hasNextPuzzle=currentPuzzleIndex>=0&&currentPuzzleIndex<puzzleLibrary.length-1;
  const openNextPuzzle=()=>{
    if(!hasNextPuzzle) return;
    startGame(puzzleLibrary[currentPuzzleIndex+1],'puzzle');
  };

  const inGame=screen==='game';

  const [tweaksOpen,setTweaksOpen]=React.useState(false);
  React.useEffect(()=>{
    const h=e=>{if(e.data?.type==='__activate_edit_mode')setTweaksOpen(true);if(e.data?.type==='__deactivate_edit_mode')setTweaksOpen(false);};
    window.addEventListener('message',h);
    window.parent.postMessage({type:'__edit_mode_available'},'*');
    return()=>window.removeEventListener('message',h);
  },[]);

  const TWEAK_DEFAULTS=/*EDITMODE-BEGIN*/{"accentColor":"#c4872a","boardTone":"warm","density":13}/*EDITMODE-END*/;
  const [tweaks,setTweaks]=React.useState(TWEAK_DEFAULTS);
  const setTweak=(k,v)=>{const n={...tweaks,[k]:v};setTweaks(n);window.parent.postMessage({type:'__edit_mode_set_keys',edits:n},'*');};

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',width:'100%',minWidth:0,background:'#0d0c0b',overflow:'hidden',fontFamily:'Outfit,sans-serif'}}>
      <div style={{flex:1,display:'flex',overflow:'hidden',minHeight:0}}>
        {/* Desktop sidebar */}
        {!isMobile&&!inGame&&<Sidebar screen={screen} setScreen={setScreen}/>}

        {/* Main content */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0,paddingTop:(!isMobile||inGame)?0:'var(--safe-top)'}}>
          {screen==='lobby'&&<PublicGamesScreen onJoinGame={startGame} isMobile={isMobile}/>}
          {screen==='puzzles'&&<PuzzlesScreen onStartPuzzle={p=>startGame(p,'puzzle')} isMobile={isMobile}/>}
          {screen==='free'&&<FreeBoardScreen/>}
          {screen==='settings'&&<SettingsScreen isMobile={isMobile}/>}
          {screen==='game'&&<GameView gameConfig={gameConfig} onBack={()=>setScreen(isPuzzle?'puzzles':'lobby')} isPuzzle={isPuzzle} onNextPuzzle={openNextPuzzle} hasNextPuzzle={hasNextPuzzle}/>}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile&&!inGame&&<BottomNav screen={screen} setScreen={setScreen}/>}

      {/* Tweaks */}
      {tweaksOpen&&(
        <div style={{position:'fixed',bottom:isMobile?80:24,right:16,background:'#1a1714',border:'1px solid #3a3228',borderRadius:14,padding:'18px 20px',width:220,boxShadow:'0 16px 48px rgba(0,0,0,0.6)',zIndex:300}}>
          <div style={{fontSize:13,fontWeight:600,color:'#e4dcd2',marginBottom:14}}>Tweaks</div>
          <div style={{display:'flex',flexDirection:'column',gap:13}}>
            <div>
              <div style={{fontSize:11,color:'#6b6055',marginBottom:6}}>Accent color</div>
              <div style={{display:'flex',gap:6}}>
                {['#c4872a','#2a8c8c','#8c4a2a','#2a5c8c'].map(c=>(
                  <div key={c} onClick={()=>setTweak('accentColor',c)}
                    style={{width:22,height:22,borderRadius:11,background:c,cursor:'pointer',border:tweaks.accentColor===c?'2px solid #fff':'2px solid transparent'}}/>
                ))}
              </div>
            </div>
            <div>
              <div style={{fontSize:11,color:'#6b6055',marginBottom:6}}>Board tone</div>
              <div style={{display:'flex',gap:4}}>
                {[['warm','Warm'],['natural','Natural'],['cool','Cool']].map(([v,l])=>(
                  <button key={v} onClick={()=>setTweak('boardTone',v)}
                    style={{flex:1,padding:'4px 0',borderRadius:6,border:'1px solid',fontSize:10,fontWeight:500,cursor:'pointer',
                      background:tweaks.boardTone===v?'#2a2520':'transparent',
                      borderColor:tweaks.boardTone===v?'#3a3228':'#2a2520',
                      color:tweaks.boardTone===v?'#e4dcd2':'#6b6055'}}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
