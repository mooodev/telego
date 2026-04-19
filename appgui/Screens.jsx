
// ── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);

const Icons = {
  globe: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 0c-2.5 2.5-4 6-4 10s1.5 7.5 4 10m0-20c2.5 2.5 4 6 4 10s-1.5 7.5-4 10M2 12h20',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  puzzle: ['M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v6m0 0H3m6 0h12m0 0v10a2 2 0 0 1-2 2H5a2 2 0 0 0-2-2V9m18 0H9'],
  grid: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8.18-2.4a8 8 0 0 0 .07-1.1c0-.37-.04-.73-.07-1.1l2.35-1.83a.56.56 0 0 0 .13-.72l-2.23-3.86a.56.56 0 0 0-.68-.24l-2.77 1.11a8.14 8.14 0 0 0-1.9-1.1l-.42-2.95A.54.54 0 0 0 14 2h-4a.54.54 0 0 0-.54.46l-.42 2.95a8.14 8.14 0 0 0-1.9 1.1L4.37 5.4a.55.55 0 0 0-.68.24L1.46 9.5a.55.55 0 0 0 .13.72l2.35 1.83c-.03.37-.06.73-.06 1.1s.03.73.06 1.1L1.59 16.08a.56.56 0 0 0-.13.72l2.23 3.86c.13.24.42.33.68.24l2.77-1.11c.59.43 1.22.79 1.9 1.1l.42 2.95c.07.3.3.46.54.46h4c.3 0 .53-.2.54-.46l.42-2.95a8.14 8.14 0 0 0 1.9-1.1l2.77 1.11c.26.1.55 0 .68-.24l2.23-3.86a.56.56 0 0 0-.13-.72z',
  board: ['M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18'],
  clock: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 5v5l3 3',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  refresh: 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15',
  chevronR: 'M9 18l6-6-6-6',
  chevronL: 'M15 18l-6-6 6-6',
  play: 'M5 3l14 9-14 9V3z',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  plus: 'M12 5v14M5 12h14',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-9v-4m0 8h.01',
  undo: 'M3 7v6h6M3 13A9 9 0 1 0 5.27 6',
  trophy: 'M8 21h8m-4-4v4M5 3H3v8a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V3h-2m-14 0h14',
  brain: 'M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.07-4.6A3 3 0 0 1 6 9.5a2.5 2.5 0 0 1 3.5-2.27zm5 0a2.5 2.5 0 0 0-2.5 2.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 1.07-4.6A3 3 0 0 0 18 9.5a2.5 2.5 0 0 0-3.5-2.27z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
};

const sc = {
  screen: { flex:1, overflowY:'auto', color:'#e4dcd2', WebkitOverflowScrolling:'touch' },
  pageTitle: { fontSize:20, fontWeight:600, marginBottom:4, color:'#e4dcd2', letterSpacing:'-0.3px' },
  pageSubtitle: { fontSize:12, color:'#6b6055', marginBottom:24 },
  card: { background:'#161412', border:'1px solid #2a2520', borderRadius:12, overflow:'hidden', cursor:'pointer', transition:'border-color .15s, transform .12s, box-shadow .15s' },
  tag: { display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:500, padding:'2px 8px', borderRadius:20, background:'#201d1a', color:'#8a7a68', border:'1px solid #2a2520' },
  btn: { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'none', transition:'opacity .15s, background .15s' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const Avatar = ({ name, size = 36, rank, color }) => {
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const colors = ['#8B6914','#1a7a6e','#6b3a8a','#1a5c8a','#7a3a2a'];
  const bg = color || colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{width:size,height:size,borderRadius:size/2,background:bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:size*0.36,fontWeight:600,color:'rgba(255,255,255,0.9)',position:'relative'}}>
      {initials}
      {rank && <span style={{position:'absolute',bottom:-5,right:-4,background:'#1e1b18',border:'1px solid #2a2520',borderRadius:10,fontSize:9,fontWeight:600,color:'#c4872a',padding:'1px 4px',whiteSpace:'nowrap'}}>{rank}</span>}
    </div>
  );
};

const Badge = ({ children, color='#c4872a', bg }) => (
  <span style={{display:'inline-flex',alignItems:'center',fontSize:11,fontWeight:600,padding:'2px 7px',borderRadius:20,background:bg||`${color}22`,color,border:`1px solid ${color}44`,whiteSpace:'nowrap'}}>{children}</span>
);

const miniBoard = (size=9) => {
  const s = []; for(let i=0;i<size;i++){s.push([]);for(let j=0;j<size;j++)s[i].push(null);}
  const placements=[[[4,4],'B'],[[3,3],'W'],[[5,5],'B'],[[3,5],'W'],[[5,3],'B'],[[6,4],'W'],[[4,6],'B'],[[2,4],'W']];
  for(const[[r,c],col] of placements)if(r<size&&c<size)s[r][c]=col;
  return s;
};

const MiniGoBoard = ({ size=9, stones }) => {
  const canvasRef = React.useRef(null);
  React.useEffect(()=>{
    const c = canvasRef.current; if(!c) return;
    const dim=80, cs=dim/(size+1);
    c.width=dim; c.height=dim;
    const ctx=c.getContext('2d');
    const bg=ctx.createLinearGradient(0,0,dim,dim);
    bg.addColorStop(0,'#c49030'); bg.addColorStop(1,'#a87020');
    ctx.fillStyle=bg; ctx.fillRect(0,0,dim,dim);
    ctx.strokeStyle='rgba(50,22,0,0.6)'; ctx.lineWidth=0.6;
    for(let i=0;i<size;i++){
      const p=cs+i*cs;
      ctx.beginPath();ctx.moveTo(p,cs);ctx.lineTo(p,cs+(size-1)*cs);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cs,p);ctx.lineTo(cs+(size-1)*cs,p);ctx.stroke();
    }
    if(stones){
      for(let r=0;r<size;r++) for(let col2=0;col2<size;col2++){
        const s=stones[r]?.[col2]; if(!s) continue;
        const x=cs+col2*cs, y=cs+r*cs, r2=cs*0.42;
        const g=ctx.createRadialGradient(x-r2*.3,y-r2*.3,r2*.05,x,y,r2);
        if(s==='B'){g.addColorStop(0,'#444');g.addColorStop(1,'#050505');}
        else{g.addColorStop(0,'#fff');g.addColorStop(1,'#ccc');}
        ctx.beginPath();ctx.arc(x,y,r2,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      }
    }
  },[stones,size]);
  return <canvas ref={canvasRef} style={{borderRadius:3,boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}/>;
};

function usePuzzleLibrary() {
  const [library, setLibrary] = React.useState(() => window.__telebaPuzzleLibrary || []);

  React.useEffect(() => {
    if (window.__telebaPuzzleLibrary) {
      setLibrary(window.__telebaPuzzleLibrary);
      return;
    }
    const handleReady = () => setLibrary(window.__telebaPuzzleLibrary || []);
    window.addEventListener('teleba-modules-ready', handleReady);
    return () => window.removeEventListener('teleba-modules-ready', handleReady);
  }, []);

  return library;
}

// ── Public Games ──────────────────────────────────────────────────────────────
const liveModes = [
  {id:'bot-9',size:9,time:'5m+3×20s',level:'kyu',title:'Quick 9×9',sub:'Fast tactical game against the local bot'},
  {id:'bot-13',size:13,time:'10m+3×30s',level:'kyu',title:'Balanced 13×13',sub:'Compact full-board game with room to fight'},
  {id:'bot-19',size:19,time:'15m+5×30s',level:'dan',title:'Full 19×19',sub:'Standard board against the stronger local bot'},
];

function PublicGamesScreen({ onJoinGame, isMobile }) {
  const [hov, setHov] = React.useState(null);
  const pad = isMobile ? '16px' : '32px 36px';

  return (
    <div style={{...sc.screen, padding: pad}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,gap:16,flexWrap:'wrap'}}>
        <div>
          <div style={sc.pageTitle}>Live Play</div>
          <div style={sc.pageSubtitle}>Start a real local game against the built-in KataGo bot</div>
        </div>
        <Badge color='#2a8c8c'>Local AI</Badge>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
        {liveModes.map(mode=>(
          <div key={mode.id}
            onMouseEnter={()=>!isMobile&&setHov(mode.id)} onMouseLeave={()=>setHov(null)}
            onClick={()=>onJoinGame({
              mode:'bot',
              size:mode.size,
              botLevel:mode.level,
              myColor:'B',
              timeB: mode.size===9 ? 300 : mode.size===13 ? 600 : 900,
              timeW: mode.size===9 ? 300 : mode.size===13 ? 600 : 900,
              opp:{name:'Teleba Bot',rank:mode.level==='dan'?'KataGo Dan':'KataGo Kyu'},
            },'play')}
            style={{...sc.card,borderColor:hov===mode.id?'#3a3228':'#2a2520',transform:hov===mode.id?'translateY(-2px)':'none',boxShadow:hov===mode.id?'0 8px 24px rgba(0,0,0,0.4)':'none'}}>
            <div style={{padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <Badge color='#c4872a'>{mode.size}×{mode.size}</Badge>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={sc.tag}><Icon d={Icons.clock} size={10} sw={2}/>{mode.time}</span>
                  <span style={sc.tag}><Icon d={Icons.brain} size={10} sw={2}/>{mode.level}</span>
                </div>
              </div>
              <div style={{fontSize:15,fontWeight:600,color:'#e4dcd2',marginBottom:6}}>{mode.title}</div>
              <div style={{fontSize:12,color:'#8a7a68',lineHeight:1.55,marginBottom:14}}>{mode.sub}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <Avatar name='Teleba Bot' size={34} rank={mode.level==='dan'?'Dan':'Kyu'} color='#1a5c8a'/>
                  <div>
                    <div style={{fontSize:13,fontWeight:500,color:'#e4dcd2'}}>Play Black vs Teleba Bot</div>
                    <div style={{fontSize:11,color:'#6b6055'}}>Runs fully in-browser with local models</div>
                  </div>
                </div>
                <button style={{...sc.btn,background:'#c4872a',color:'#fff',padding:'8px 14px'}}>
                  <Icon d={Icons.play} size={12} fill='currentColor' stroke='none'/> Start
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{height:8}}/>
    </div>
  );
}

// ── My Games ──────────────────────────────────────────────────────────────────
const myGames = [
  {id:10,opp:{name:'Kenta Mori',rank:'4d'},color:'W',size:19,time:'5m+3×30s',move:67,status:'your-turn',timeLeft:'4:22'},
  {id:11,opp:{name:'Priya Nair',rank:'9k'},color:'B',size:13,time:'10m+0',move:31,status:'waiting',timeLeft:'9:58'},
  {id:12,opp:{name:'Marcus Webb',rank:'5k'},color:'B',size:19,time:'15m+3×60s',move:144,status:'your-turn',timeLeft:'0:45'},
  {id:13,opp:{name:'Sofia Brandt',rank:'3d'},color:'W',size:9,time:'3m+1×30s',move:55,status:'finished',result:'W+3.5'},
  {id:14,opp:{name:'Chen Wei',rank:'3d'},color:'B',size:19,time:'20m+0',move:201,status:'finished',result:'B+R'},
];

function MyGamesScreen({ onJoinGame, isMobile }) {
  const [tab, setTab] = React.useState('active');
  const active = myGames.filter(g=>g.status!=='finished');
  const finished = myGames.filter(g=>g.status==='finished');
  const list = tab==='active' ? active : finished;
  const pad = isMobile ? '16px' : '32px 36px';

  return (
    <div style={{...sc.screen, padding: pad}}>
      <div style={sc.pageTitle}>My Games</div>
      <div style={sc.pageSubtitle}>Continue where you left off</div>
      <div style={{display:'flex',gap:4,marginBottom:20,background:'#0d0c0b',padding:3,borderRadius:10,border:'1px solid #2a2520',width:'fit-content'}}>
        {[['active',`Active (${active.length})`],['finished','Finished']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{padding:'7px 16px',borderRadius:7,fontSize:12,fontWeight:500,border:'none',cursor:'pointer',transition:'all .15s',
            background:tab===v?'#1e1b18':'transparent', color:tab===v?'#e4dcd2':'#6b6055'}}>{l}</button>
        ))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {list.map(g=>(
          <div key={g.id} onClick={()=>g.status!=='finished'&&onJoinGame(g,'play')}
            style={{...sc.card,cursor:g.status!=='finished'?'pointer':'default',display:'flex',alignItems:'center',padding:'14px 16px',gap:14,
              borderColor:g.status==='your-turn'?'#c4872a44':'#2a2520',minHeight:72}}>
            <div style={{width:10,height:10,borderRadius:5,background:g.color==='B'?'#111':'#eee',border:g.color==='B'?'1px solid #555':'1px solid #aaa',flexShrink:0}}/>
            <Avatar name={g.opp.name} size={40} rank={g.opp.rank}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4,flexWrap:'wrap'}}>
                <span style={{fontSize:14,fontWeight:500,color:'#e4dcd2'}}>{g.opp.name}</span>
                <Badge color={g.status==='your-turn'?'#c4872a':g.status==='waiting'?'#2a8c8c':'#6b6055'}>
                  {g.status==='your-turn'?'Your turn':g.status==='waiting'?'Waiting…':g.result}
                </Badge>
              </div>
              <div style={{display:'flex',gap:8,fontSize:11,color:'#6b6055'}}>
                <span>{g.size}×{g.size}</span><span>·</span><span>Move {g.move}</span>
                {g.status!=='finished'&&<><span>·</span><span style={{color:g.timeLeft.startsWith('0:')?'#c44a2a':'#6b6055'}}>⏱ {g.timeLeft}</span></>}
              </div>
            </div>
            {g.status!=='finished'&&<Icon d={Icons.chevronR} size={16} stroke='#3a3228'/>}
          </div>
        ))}
      </div>
      <div style={{height:8}}/>
    </div>
  );
}

// ── Puzzles ───────────────────────────────────────────────────────────────────
const diffColor = {Beginner:'#2a8c4a',Intermediate:'#c4872a',Advanced:'#c44a2a'};

function PuzzlesScreen({ onStartPuzzle, isMobile }) {
  const puzzles = usePuzzleLibrary();
  const [cat,setCat]=React.useState('All');
  const cats=['All', ...new Set(puzzles.map(p=>p.diff))];
  const list=cat==='All'?puzzles:puzzles.filter(p=>p.diff===cat);
  const [hov,setHov]=React.useState(null);
  const pad = isMobile ? '16px' : '32px 36px';

  return (
    <div style={{...sc.screen, padding: pad}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
        <div>
          <div style={sc.pageTitle}>Puzzles</div>
          <div style={sc.pageSubtitle}>{puzzles.length} local SGFs linked from the project and ready to open</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:24,fontWeight:600,color:'#c4872a',lineHeight:1}}>{list.length}</div>
          <div style={{fontSize:11,color:'#6b6055'}}>shown</div>
        </div>
      </div>
      <div style={{display:'flex',gap:6,marginBottom:20,overflowX:'auto',paddingBottom:4}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:500,border:'1px solid',cursor:'pointer',transition:'all .15s',whiteSpace:'nowrap',
            background:cat===c?'#c4872a':'transparent',borderColor:cat===c?'#c4872a':'#2a2520',color:cat===c?'#fff':'#8a7a68'}}>
            {c}
          </button>
        ))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
        {list.map(p=>(
          <div key={p.id} onClick={()=>onStartPuzzle({...p,mode:'puzzle'})}
            onMouseEnter={()=>!isMobile&&setHov(p.id)} onMouseLeave={()=>setHov(null)}
            style={{...sc.card,borderColor:hov===p.id?'#3a3228':'#2a2520',transform:hov===p.id?'translateY(-2px)':'none',boxShadow:hov===p.id?'0 8px 24px rgba(0,0,0,0.4)':'none'}}>
            <div style={{height:84,background:'linear-gradient(135deg,#171411,#0d0c0b)',display:'flex',alignItems:'flex-end',justifyContent:'space-between',padding:'12px 13px'}}>
              <Badge color={diffColor[p.diff]}>{p.diff}</Badge>
              <span style={{fontSize:11,color:'#6b6055',fontFamily:'monospace'}}>{p.code}</span>
            </div>
            <div style={{padding:'12px 13px'}}>
              <div style={{fontSize:12,fontWeight:500,color:'#e4dcd2',marginBottom:7,lineHeight:1.4}}>{p.title}</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
                <span style={sc.tag}>{p.category}</span>
                <span style={sc.tag}>19×19</span>
              </div>
              <div style={{fontSize:11,color:'#6b6055'}}>{p.source}</div>
            </div>
          </div>
        ))}
      </div>
      {!puzzles.length&&<div style={{marginTop:12,padding:'18px',background:'#161412',border:'1px solid #2a2520',borderRadius:12,fontSize:13,color:'#8a7a68'}}>Puzzle library is still loading.</div>}
      <div style={{height:8}}/>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsScreen({ isMobile }) {
  const [sound,setSound]=React.useState(true);
  const [coords,setCoords]=React.useState(true);
  const [moveNums,setMoveNums]=React.useState(false);
  const [theme,setTheme]=React.useState('dark');
  const [boardStyle,setBoardStyle]=React.useState('kaya');
  const [stoneStyle,setStoneStyle]=React.useState('realistic');
  const [ai,setAI]=React.useState(true);
  const pad = isMobile ? '16px' : '32px 36px';

  const Toggle = ({val,set}) => (
    <div onClick={()=>set(!val)} style={{width:40,height:24,borderRadius:12,background:val?'#c4872a':'#2a2520',cursor:'pointer',transition:'background .2s',position:'relative',flexShrink:0}}>
      <div style={{position:'absolute',top:4,left:val?20:4,width:16,height:16,borderRadius:8,background:'#fff',transition:'left .2s',boxShadow:'0 1px 4px rgba(0,0,0,0.4)'}}/>
    </div>
  );
  const Row = ({label,sub,children}) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 0',borderBottom:'1px solid #1e1b18',minHeight:52}}>
      <div><div style={{fontSize:13,color:'#e4dcd2',fontWeight:500}}>{label}</div>{sub&&<div style={{fontSize:11,color:'#6b6055',marginTop:2}}>{sub}</div>}</div>
      {children}
    </div>
  );
  const Section = ({title,children}) => (
    <div style={{marginBottom:24}}>
      <div style={{fontSize:11,fontWeight:600,color:'#6b6055',letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>{title}</div>
      <div style={{background:'#161412',border:'1px solid #2a2520',borderRadius:12,padding:'0 16px'}}>{children}</div>
    </div>
  );
  const Pills = ({options,val,set}) => (
    <div style={{display:'flex',gap:3,background:'#0d0c0b',borderRadius:8,padding:3,border:'1px solid #2a2520'}}>
      {options.map(o=>(
        <button key={o.v} onClick={()=>set(o.v)} style={{padding:'4px 9px',borderRadius:6,fontSize:11,fontWeight:500,border:'none',cursor:'pointer',transition:'all .15s',
          background:val===o.v?'#1e1b18':'transparent',color:val===o.v?'#e4dcd2':'#6b6055'}}>{o.l}</button>
      ))}
    </div>
  );

  return (
    <div style={{...sc.screen, padding: pad}}>
      <div style={sc.pageTitle}>Settings</div>
      <div style={{...sc.pageSubtitle,marginBottom:28}}>Customize your experience</div>
      <Section title="Account">
        <Row label="Display Name"><span style={{fontSize:13,color:'#6b6055'}}>Guest Player</span></Row>
        <Row label="Rank"><span style={{fontSize:13,color:'#c4872a',fontWeight:600}}>3k</span></Row>
        <Row label="AI Analysis" sub="KataGo engine (local)"><Toggle val={ai} set={setAI}/></Row>
      </Section>
      <Section title="Board">
        <Row label="Coordinates"><Toggle val={coords} set={setCoords}/></Row>
        <Row label="Move numbers"><Toggle val={moveNums} set={setMoveNums}/></Row>
        <Row label="Board style">
          <Pills options={[{v:'kaya',l:'Kaya'},{v:'bamboo',l:'Bamboo'},{v:'plain',l:'Plain'}]} val={boardStyle} set={setBoardStyle}/>
        </Row>
        <Row label="Stone style">
          <Pills options={[{v:'realistic',l:'Realistic'},{v:'flat',l:'Flat'}]} val={stoneStyle} set={setStoneStyle}/>
        </Row>
      </Section>
      <Section title="Interface">
        <Row label="Theme"><Pills options={[{v:'dark',l:'Dark'},{v:'light',l:'Light'}]} val={theme} set={setTheme}/></Row>
      </Section>
      <Section title="Sound">
        <Row label="Stone sounds"><Toggle val={sound} set={setSound}/></Row>
      </Section>
      <div style={{height:8}}/>
    </div>
  );
}

Object.assign(window, { PublicGamesScreen, MyGamesScreen, PuzzlesScreen, SettingsScreen, Avatar, Badge, Icon, Icons, sc, MiniGoBoard, miniBoard, diffColor });
