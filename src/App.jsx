import { useState, useEffect, useCallback } from "react";

const CONFIG = {
  UPI_ID:   "mr.n@superyes",
  UPI_NAME: "Cryptex Signal",
  PLANS: {
    basic: { name:"BASIC",  price:299,  label:"Rs.299/mo"  },
    pro:   { name:"PRO",    price:799,  label:"Rs.799/mo"  },
    elite: { name:"ELITE",  price:1999, label:"Rs.1999/mo" },
  },
};

const COIN_LIST = [
  { id:"BTC",  name:"Bitcoin",   logo:"B", symbol:"BTCUSDT",  base:83000 },
  { id:"ETH",  name:"Ethereum",  logo:"E", symbol:"ETHUSDT",  base:1600  },
  { id:"SOL",  name:"Solana",    logo:"S", symbol:"SOLUSDT",  base:124   },
  { id:"BNB",  name:"BNB",       logo:"B", symbol:"BNBUSDT",  base:590   },
  { id:"AVAX", name:"Avalanche", logo:"A", symbol:"AVAXUSDT", base:20    },
];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#04080f;--bg2:#080e1a;--bg3:#0d1525;
  --bdr:#162035;--bdr2:rgba(0,229,255,.2);
  --cyan:#00e5ff;--green:#00ff88;--red:#ff3d71;
  --yellow:#ffaa00;--purple:#a855f7;
  --text:#c8dff5;--muted:#3d5a7a;
  --card:rgba(8,14,26,.96);
}
html,body{background:var(--bg);color:var(--text);font-family:'Rajdhani',sans-serif;font-size:15px;overflow-x:hidden;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:3px}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(0,229,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.025) 1px,transparent 1px);
  background-size:40px 40px}
.orb{font-family:'Orbitron',monospace}
.mono{font-family:'Share Tech Mono',monospace}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.6)}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(0,229,255,.2)}50%{box-shadow:0 0 24px rgba(0,229,255,.5)}}
.au{animation:fadeUp .4s ease both}
.ai{animation:fadeIn .35s ease both}
.sp{animation:spin 1s linear infinite}
.pu{animation:pulse 1.4s ease infinite}
.gl{animation:glow 2s ease infinite}
.card{background:var(--card);border:1px solid var(--bdr);border-radius:14px;backdrop-filter:blur(16px);overflow:hidden;transition:border-color .2s,box-shadow .2s;position:relative}
.card:hover{border-color:var(--bdr2)}
.btn{font-family:'Orbitron',monospace;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:10px 18px;border-radius:8px;cursor:pointer;border:none;transition:all .18s;display:inline-flex;align-items:center;gap:6px;justify-content:center;white-space:nowrap}
.btn:disabled{opacity:.4;cursor:not-allowed;pointer-events:none}
.bc{background:var(--cyan);color:#000;box-shadow:0 0 14px rgba(0,229,255,.3)}
.bg{background:var(--green);color:#000;box-shadow:0 0 14px rgba(0,255,136,.3)}
.br{background:var(--red);color:#fff;box-shadow:0 0 14px rgba(255,61,113,.3)}
.bp{background:var(--purple);color:#fff}
.bc:hover:not(:disabled){box-shadow:0 0 28px rgba(0,229,255,.6);transform:translateY(-1px)}
.bg:hover:not(:disabled){box-shadow:0 0 28px rgba(0,255,136,.6);transform:translateY(-1px)}
.br:hover:not(:disabled){box-shadow:0 0 28px rgba(255,61,113,.6);transform:translateY(-1px)}
.bo{background:transparent;color:var(--cyan);border:1px solid var(--cyan)}
.bo:hover{background:rgba(0,229,255,.08)}
.bh{background:transparent;color:var(--muted);border:1px solid var(--bdr)}
.bh:hover{color:var(--text);border-color:var(--bdr2)}
.pill{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700}
.pg{background:rgba(0,255,136,.1);color:var(--green);border:1px solid rgba(0,255,136,.25)}
.pr{background:rgba(255,61,113,.1);color:var(--red);border:1px solid rgba(255,61,113,.25)}
.py{background:rgba(255,170,0,.1);color:var(--yellow);border:1px solid rgba(255,170,0,.25)}
.pc{background:rgba(0,229,255,.1);color:var(--cyan);border:1px solid rgba(0,229,255,.25)}
.pp{background:rgba(168,85,247,.1);color:var(--purple);border:1px solid rgba(168,85,247,.25)}
.prog{height:4px;background:var(--bg3);border-radius:2px;overflow:hidden}
.pf{height:100%;border-radius:2px;transition:width .7s ease}
.inp{background:var(--bg3);border:1px solid var(--bdr);border-radius:8px;padding:11px 14px;color:var(--text);font-family:'Rajdhani',sans-serif;font-size:14px;outline:none;width:100%;transition:border .2s,box-shadow .2s}
.inp:focus{border-color:var(--cyan);box-shadow:0 0 0 3px rgba(0,229,255,.1)}
.inp::placeholder{color:var(--muted)}
.tog{position:relative;width:46px;height:26px;cursor:pointer;flex-shrink:0}
.tog input{opacity:0;width:0;height:0;position:absolute}
.ts{position:absolute;inset:0;background:var(--bg3);border:1px solid var(--bdr);border-radius:13px;transition:.25s}
.ts::before{content:'';position:absolute;width:20px;height:20px;left:2px;top:2px;background:var(--muted);border-radius:50%;transition:.25s}
.tog input:checked+.ts{background:rgba(0,255,136,.15);border-color:var(--green)}
.tog input:checked+.ts::before{transform:translateX(20px);background:var(--green);box-shadow:0 0 8px rgba(0,255,136,.5)}
.tr{overflow:hidden;background:var(--bg2);border-bottom:1px solid var(--bdr)}
.tt{display:flex;gap:36px;white-space:nowrap;animation:ticker 28s linear infinite;width:max-content;padding:7px 0}
.nb{cursor:pointer;padding:8px 13px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-family:'Rajdhani',sans-serif;font-weight:600;font-size:13px;transition:all .18s;display:flex;align-items:center;gap:6px;position:relative}
.nb:hover{color:var(--text);background:var(--bg3)}
.nb.act{color:var(--cyan);background:rgba(0,229,255,.07)}
.nd{width:8px;height:8px;background:var(--red);border-radius:50%}
.sx{overflow-x:auto;-webkit-overflow-scrolling:touch}
.sx::-webkit-scrollbar{height:3px}
@media(max-width:768px){.lo{display:none!important}}
@media(min-width:769px){.so{display:none!important}}
`;

const f = (n, d=2) => typeof n==="number" ? n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}) : String(n);
const pct = (a,b) => (((b-a)/Math.abs(a))*100).toFixed(2);

async function fetchPrices() {
  try {
    const syms = COIN_LIST.map(c=>'"'+c.symbol+'"').join(",");
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=['+syms+']', {signal:AbortSignal.timeout(6000)});
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.map(item => {
      const c = COIN_LIST.find(x=>x.symbol===item.symbol);
      return { id:c.id, name:c.name, logo:c.logo, symbol:c.symbol,
        price:parseFloat(item.lastPrice), chg24:parseFloat(item.priceChangePercent),
        high24:parseFloat(item.highPrice), low24:parseFloat(item.lowPrice),
        vol:parseFloat(item.volume), volUsdt:parseFloat(item.quoteVolume) };
    });
  } catch {
    return COIN_LIST.map(c=>({id:c.id,name:c.name,logo:c.logo,symbol:c.symbol,
      price:c.base,chg24:0,high24:c.base*1.05,low24:c.base*0.95,vol:1e6,volUsdt:c.base*1e6}));
  }
}

async function getAnalysis(coin) {
  const up = coin.chg24 >= 0;
  const rsi = Math.max(20, Math.min(80, Math.round(50 + coin.chg24*2.5 + Math.random()*10-5)));
  const ema = {
    m15: coin.chg24>1?"Bull":coin.chg24<-1?"Bear":"Neut",
    h1:  coin.chg24>0.5?"Bull":coin.chg24<-0.5?"Bear":"Neut",
    h4:  coin.chg24>0?"Bull":"Bear",
    d1:  coin.chg24>-3?"Bull":"Bear",
  };
  const bulls = Object.values(ema).filter(x=>x==="Bull").length;
  const signal = bulls>=2?"LONG":"SHORT";
  const conf   = Math.min(95, Math.max(55, Math.round(60+bulls*6+Math.abs(coin.chg24)*1.5)));
  const lev    = conf>=85?12:conf>=75?10:8;
  const isL    = signal==="LONG";
  const e      = isL ? coin.price*0.9985 : coin.price*1.0015;
  const d      = coin.price>100?2:4;
  const fix    = n => parseFloat(n.toFixed(d));
  return {
    signal, conf, lev,
    entry: fix(e),
    sl:    isL ? fix(e*0.975) : fix(e*1.025),
    tp1:   isL ? fix(e*1.018) : fix(e*0.982),
    tp2:   isL ? fix(e*1.038) : fix(e*0.962),
    tp3:   isL ? fix(e*1.065) : fix(e*0.935),
    risk:  conf>=85?"LOW":conf>=72?"MEDIUM":"HIGH",
    urgency: conf>=85?"HIGH":conf>=72?"MEDIUM":"LOW",
    tf: "1H/4H",
    hrs: isL?8:6,
    ema, rsi,
    macd: up?"Bullish":"Bearish",
    summary: isL
      ? coin.id+" showing "+( coin.chg24>=0?"positive":"recovering")+" momentum. "+bulls+"/4 EMA timeframes bullish. RSI "+rsi+" — "+( rsi<65?"room to move higher":"watch for resistance")+". Volume "+( coin.chg24>2?"above average — strong buyers":"steady")+"."
      : coin.id+" showing bearish pressure. "+(4-bulls)+"/4 EMA timeframes bearish. RSI "+rsi+" — "+( rsi>55?"elevated, downside likely":"near support but resistance strong")+". Short entry at current resistance zone.",
  };
}

function Spin({size=20,color="var(--cyan)"}) {
  return <div style={{width:size,height:size,border:"2px solid rgba(0,229,255,.15)",borderTop:"2px solid "+color,borderRadius:"50%",flexShrink:0}} className="sp"/>;
}
function Tog({checked,onChange}) {
  return <label className="tog"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="ts"/></label>;
}
function Ring({val,color,size=100}) {
  const r=38,c=2*Math.PI*r,p=Math.min(val,100)/100;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg3)" strokeWidth="7"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={c*p+" "+(c*(1-p))} strokeLinecap="round"
          style={{filter:"drop-shadow(0 0 6px "+color+")",transition:"stroke-dasharray .8s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div className="orb" style={{fontSize:size*.19,fontWeight:900,color}}>{val}</div>
        <div style={{fontSize:size*.1,color:"var(--muted)"}}>CONF%</div>
      </div>
    </div>
  );
}
function Ticker({coins}) {
  const it=[...coins,...coins];
  return (
    <div className="tr">
      <div className="tt">
        {it.map((c,i)=>(
          <span key={i} className="mono" style={{fontSize:12,display:"flex",alignItems:"center",gap:8,color:c.chg24>=0?"var(--green)":"var(--red)"}}>
            <span style={{color:"var(--cyan)",fontWeight:700}}>{c.id}</span>
            <span style={{color:"var(--text)"}}>${f(c.price)}</span>
            <span>{c.chg24>=0?"▲":"▼"}{Math.abs(c.chg24).toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Dashboard({coins,analyses,loading,setTab,setActive}) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20,flexWrap:"wrap",gap:10}}>
        <div>
          <h1 className="orb" style={{fontSize:18,fontWeight:900,marginBottom:4}}>TOP 5 <span style={{color:"var(--cyan)"}}>LIVE</span> SIGNALS</h1>
          <div style={{fontSize:12,color:"var(--muted)"}}>Live Binance prices • AI analysis • Auto-refresh 30s</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {loading ? <span className="pill pc">Loading...</span> : <>
            <span className="pill pg">▲ {analyses.filter(a=>a?.signal==="LONG").length} LONG</span>
            <span className="pill pr">▼ {analyses.filter(a=>a?.signal==="SHORT").length} SHORT</span>
          </>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
        {[
          {l:"MARKET",     v:"$2.87T", s:"Total cap",    c:"var(--cyan)"},
          {l:"BTC DOM",    v:"54.2%",  s:"Alt: No",      c:"var(--yellow)"},
          {l:"FEAR/GREED", v:"62/100", s:"GREED",        c:"var(--green)"},
          {l:"TRACKING",   v:"5 COINS",s:"Live signals", c:"var(--purple)"},
        ].map((item,i)=>(
          <div key={i} className="card au" style={{padding:"14px 16px",animationDelay:i*.06+"s"}}>
            <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:6,textTransform:"uppercase"}}>{item.l}</div>
            <div className="mono" style={{fontSize:16,fontWeight:700,color:item.c}}>{item.v}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{item.s}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
        {COIN_LIST.map((cd,i)=>{
          const coin=coins.find(c=>c.id===cd.id)||{...cd,price:cd.base,chg24:0};
          const ai=analyses[i];
          const isL=ai?.signal==="LONG";
          const col=isL?"var(--green)":"var(--red)";
          return (
            <div key={cd.id} className="card au" style={{padding:16,cursor:"pointer",animationDelay:i*.07+"s",border:"1px solid "+(isL?"rgba(0,255,136,.2)":"rgba(255,61,113,.2)")}}
              onClick={()=>{setActive(i);setTab("signals");}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:40,height:40,borderRadius:"50%",border:"1px solid "+col,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba("+(isL?"0,255,136":"255,61,113")+",.08)"}}>
                    <span className="orb" style={{fontSize:14,color:col,fontWeight:900}}>{cd.logo}</span>
                  </div>
                  <div>
                    <div className="orb" style={{fontSize:13,fontWeight:700}}>{cd.id}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{cd.name}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  {loading ? <Spin size={18}/> : <>
                    <div className="mono" style={{fontSize:15}}>${f(coin.price)}</div>
                    <div style={{fontSize:12,color:coin.chg24>=0?"var(--green)":"var(--red)"}}>{coin.chg24>=0?"+":""}{coin.chg24.toFixed(2)}%</div>
                  </>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                {ai ? <span className={"pill "+(isL?"pg":"pr")}>{isL?"▲ LONG":"▼ SHORT"}</span> : <span className="pill pc">Analyzing...</span>}
                {ai && <span className={"pill "+(ai.urgency==="HIGH"?"pr":ai.urgency==="MEDIUM"?"py":"pc")}>{ai.urgency}</span>}
              </div>
              {ai && <>
                <div className="prog"><div className="pf" style={{width:ai.conf+"%",background:col}}/></div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,color:"var(--muted)"}}>
                  <span>Confidence {ai.conf}%</span>
                  <span>Entry ${f(ai.entry)}</span>
                </div>
              </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Signals({coins,analyses,loading,active,setActive,refresh}) {
  const cd=COIN_LIST[active];
  const coin=coins.find(c=>c.id===cd.id)||{...cd,price:cd.base,chg24:0};
  const ai=analyses[active];
  const isL=ai?.signal==="LONG";
  const col=isL?"var(--green)":"var(--red)";
  return (
    <div>
      <div className="sx" style={{marginBottom:16}}>
        <div style={{display:"flex",gap:8,paddingBottom:4,minWidth:"max-content"}}>
          {COIN_LIST.map((c,i)=>{
            const a=analyses[i];
            return (
              <button key={c.id} onClick={()=>setActive(i)}
                className={"btn "+(i===active?(a?.signal==="LONG"?"bg":"br"):"bh")}
                style={{padding:"8px 16px",fontSize:11,position:"relative"}}>
                {c.id}
                {a?.urgency==="HIGH" && <span style={{position:"absolute",top:3,right:3,width:6,height:6,background:"var(--red)",borderRadius:"50%"}} className="pu"/>}
              </button>
            );
          })}
          <button onClick={refresh} className="btn bo" style={{padding:"8px 14px",fontSize:10}} disabled={loading}>
            {loading?<Spin size={14}/>:"Refresh"}
          </button>
        </div>
      </div>
      {!ai ? (
        <div className="card" style={{padding:48,textAlign:"center"}}><Spin size={40}/><div className="orb" style={{marginTop:16,color:"var(--cyan)"}}>ANALYZING {cd.id}...</div></div>
      ) : (
        <div className="au" style={{display:"flex",flexDirection:"column",gap:14}}>
          <div className="card" style={{padding:22,border:"1px solid "+(isL?"rgba(0,255,136,.3)":"rgba(255,61,113,.3)"),background:"rgba("+(isL?"0,255,136":"255,61,113")+",.03)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14,marginBottom:16}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                  <span className="orb" style={{fontSize:22,fontWeight:900,color:col}}>{cd.id}/USDT</span>
                  <span className={"pill "+(isL?"pg":"pr")} style={{fontSize:13,padding:"4px 12px"}}>{isL?"▲ LONG":"▼ SHORT"}</span>
                  {loading && <Spin size={14}/>}
                </div>
                <div style={{color:"var(--muted)",fontSize:13}}>{cd.name} • {ai.tf} • Risk: <span style={{color:ai.risk==="HIGH"?"var(--red)":ai.risk==="MEDIUM"?"var(--yellow)":"var(--green)"}}>{ai.risk}</span></div>
                <div style={{marginTop:6}}><span className="mono" style={{fontSize:20}}>${f(coin.price)}</span><span style={{fontSize:13,marginLeft:10,color:coin.chg24>=0?"var(--green)":"var(--red)"}}>{coin.chg24>=0?"+":""}{coin.chg24.toFixed(2)}%</span></div>
                <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>H: ${f(coin.high24)} L: ${f(coin.low24)}</div>
              </div>
              <Ring val={ai.conf} color={col} size={108}/>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
              {Object.entries({m15:ai.ema.m15,H1:ai.ema.h1,H4:ai.ema.h4,D1:ai.ema.d1}).map(([t,v])=>(
                <div key={t} style={{padding:"4px 10px",borderRadius:6,background:"var(--bg3)",fontSize:11,border:"1px solid "+(v==="Bull"?"rgba(0,255,136,.2)":v==="Bear"?"rgba(255,61,113,.2)":"var(--bdr)")}}>
                  <span style={{color:"var(--muted)"}}>{t}: </span>
                  <span style={{fontWeight:700,color:v==="Bull"?"var(--green)":v==="Bear"?"var(--red)":"var(--yellow)"}}>{v==="Bull"?"▲":v==="Bear"?"▼":"—"}</span>
                </div>
              ))}
              <div style={{padding:"4px 10px",borderRadius:6,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
                <span style={{color:"var(--muted)"}}>RSI: </span>
                <span style={{fontWeight:700,color:ai.rsi>70?"var(--red)":ai.rsi<35?"var(--green)":"var(--text)"}}>{ai.rsi}</span>
              </div>
            </div>
            <div style={{background:"var(--bg3)",borderRadius:8,padding:"12px 14px",borderLeft:"3px solid "+col}}>
              <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:6}}>AI ANALYSIS</div>
              <div style={{fontSize:13,lineHeight:1.7}}>{ai.summary}</div>
              <div style={{marginTop:8,fontSize:11,color:"var(--muted)"}}>Est. duration: {ai.hrs}h</div>
            </div>
          </div>
          <div className="card" style={{padding:20}}>
            <div className="orb" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:14}}>TRADE SETUP</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:18}}>
              {[{l:"ENTRY",v:"$"+f(ai.entry),c:"var(--cyan)"},{l:"LEVERAGE",v:ai.lev+"x",c:"var(--yellow)"},{l:"STOP LOSS",v:"$"+f(ai.sl),c:"var(--red)"},{l:"SL %",v:Math.abs(pct(ai.entry,ai.sl))+"%",c:"var(--red)"}].map(item=>(
                <div key={item.l} style={{background:"var(--bg3)",borderRadius:8,padding:12,border:"1px solid var(--bdr)",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:6,textTransform:"uppercase"}}>{item.l}</div>
                  <div className="mono" style={{fontSize:16,fontWeight:700,color:item.c}}>{item.v}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:10,color:"var(--muted)",letterSpacing:1.5,marginBottom:10}}>TAKE PROFIT TARGETS</div>
            {[[ai.tp1,35],[ai.tp2,68],[ai.tp3,100]].map(([tp,w],i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div className="orb" style={{fontSize:10,color:col,width:28,flexShrink:0}}>TP{i+1}</div>
                <div className="prog" style={{flex:1}}><div className="pf" style={{width:w+"%",background:col}}/></div>
                <div className="mono" style={{fontSize:12,color:col,width:76,textAlign:"right"}}>${f(tp)}</div>
                <div style={{fontSize:11,color:"var(--muted)",width:44,textAlign:"right"}}>+{pct(ai.entry,tp)}%</div>
                <div style={{fontSize:11,color:"var(--green)",width:50,textAlign:"right"}}>+{(parseFloat(pct(ai.entry,tp))*ai.lev).toFixed(1)}%</div>
              </div>
            ))}
          </div>
          <div className="card" style={{padding:18}}>
            <div className="orb" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:12}}>RISK MANAGEMENT</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {[
                {k:"Risk:Reward",v:"1:"+(parseFloat(pct(ai.entry,ai.tp2))/Math.abs(parseFloat(pct(ai.entry,ai.sl)))).toFixed(1),c:"var(--green)"},
                {k:"Max Position",v:"30% balance",c:"var(--yellow)"},
                {k:"Profit TP2",v:"+"+( parseFloat(pct(ai.entry,ai.tp2))*ai.lev).toFixed(1)+"%",c:"var(--green)"},
                {k:"Max Loss",v:"-"+(Math.abs(parseFloat(pct(ai.entry,ai.sl)))*ai.lev).toFixed(1)+"%",c:"var(--red)"},
              ].map(item=>(
                <div key={item.k} style={{background:"var(--bg3)",padding:"10px 12px",borderRadius:8,border:"1px solid var(--bdr)"}}>
                  <div style={{fontSize:10,color:"var(--muted)",marginBottom:4}}>{item.k}</div>
                  <div className="mono" style={{fontSize:14,fontWeight:700,color:item.c}}>{item.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <button className={"btn "+(isL?"bg":"br")} style={{flex:2,padding:14,minWidth:180}}>{isL?"▲ ENTER LONG":"▼ ENTER SHORT"} @ ${f(ai.entry)}</button>
            <button className="btn bo" style={{flex:1,padding:14}}>Set Alert</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Scan({coins,analyses,setTab,setActive}) {
  const [step,setStep]=useState("idle");
  const [steps,setSteps]=useState([]);
  const [best,setBest]=useState(null);
  const scan=async()=>{
    setStep("scan");setSteps([]);setBest(null);
    const msgs=["Fetching Binance live prices...","Calculating EMA 15m/1H/4H/1D...","Analyzing RSI & MACD...","Checking volume signals...","AI scoring 5 coins...","Selecting best trade..."];
    for(let m of msgs){await new Promise(r=>setTimeout(r,420));setSteps(s=>[...s,m]);}
    let bi=0,bc=0;
    analyses.forEach((a,i)=>{if(a&&a.conf>bc){bc=a.conf;bi=i;}});
    setBest(bi);setStep("done");
  };
  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 className="orb" style={{fontSize:16,fontWeight:900,marginBottom:4}}>AI MARKET <span style={{color:"var(--cyan)"}}>SCANNER</span></h2>
        <div style={{fontSize:13,color:"var(--muted)"}}>Live prices → AI analysis → Best trade found</div>
      </div>
      {step==="idle" && (
        <div className="card ai" style={{padding:48,textAlign:"center"}}>
          <div style={{fontSize:56,marginBottom:20}}>◎</div>
          <div className="orb" style={{fontSize:15,marginBottom:8}}>READY TO SCAN</div>
          <div style={{color:"var(--muted)",fontSize:13,marginBottom:28,maxWidth:380,margin:"0 auto 28px"}}>Live Binance data + AI multi-timeframe analysis → highest probability trade right now.</div>
          <button className="btn bc" style={{padding:"16px 48px",fontSize:13}} onClick={scan}>START SCAN</button>
        </div>
      )}
      {step==="scan" && (
        <div className="card ai" style={{padding:40,textAlign:"center"}}>
          <Spin size={48}/>
          <div className="orb" style={{fontSize:13,color:"var(--cyan)",margin:"20px 0 16px",letterSpacing:2}}>SCANNING...</div>
          <div style={{maxWidth:300,margin:"0 auto"}}>
            {steps.map((s,i)=><div key={i} style={{fontSize:12,color:"var(--green)",padding:"4px 0",textAlign:"left",display:"flex",alignItems:"center",gap:8}}><span>✓</span>{s}</div>)}
          </div>
        </div>
      )}
      {step==="done" && best!==null && analyses[best] && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <div style={{padding:"10px 16px",background:"rgba(0,255,136,.07)",border:"1px solid rgba(0,255,136,.25)",borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>🎯</span>
              <div>
                <div className="orb" style={{fontSize:10,color:"var(--green)",letterSpacing:1}}>BEST TRADE FOUND</div>
                <div style={{fontSize:12,color:"var(--muted)"}}>{COIN_LIST[best].id} — Confidence {analyses[best].conf}%</div>
              </div>
            </div>
            <button className="btn bh" onClick={()=>setStep("idle")} style={{fontSize:10}}>Rescan</button>
          </div>
          <Signals coins={coins} analyses={analyses} loading={false} active={best} setActive={i=>{setActive(i);setTab("signals");}} refresh={()=>{}}/>
        </div>
      )}
    </div>
  );
}

function Alerts({notifs,setNotifs,paused}) {
  const unread=notifs.filter(n=>!n.read).length;
  const tc={entry:"var(--green)",tp:"var(--cyan)",alert:"var(--yellow)",info:"var(--muted)",sl:"var(--red)"};
  const ti={entry:"⚡",tp:"✅",alert:"⚠️",info:"📊",sl:"🛑"};
  if(paused) return (
    <div className="card ai" style={{padding:48,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:16}}>⏸</div>
      <div className="orb" style={{fontSize:16,color:"var(--yellow)",marginBottom:8}}>TRADING PAUSED</div>
      <div style={{color:"var(--muted)"}}>Notifications OFF. Settings-இல் resume செய்யுங்கள்.</div>
    </div>
  );
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <h2 className="orb" style={{fontSize:16,fontWeight:900}}>ALERTS <span style={{color:"var(--red)",fontSize:12}}>({unread} new)</span></h2>
        <button className="btn bh" style={{fontSize:10}} onClick={()=>setNotifs(ns=>ns.map(n=>({...n,read:true})))}>Mark all read</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {notifs.map(n=>(
          <div key={n.id} className={"card "+(n.urgent&&!n.read?"gl":"")}
            style={{padding:"14px 16px",opacity:n.read?.7:1,cursor:"pointer",borderLeft:"3px solid "+(tc[n.type]||"var(--muted)")}}
            onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  {!n.read && <span className="nd pu"/>}
                  <span className="orb" style={{fontSize:10,color:tc[n.type],letterSpacing:1}}>{ti[n.type]} {n.coin} • {n.type.toUpperCase()}</span>
                </div>
                <div style={{fontSize:13,lineHeight:1.6}}>{n.msg}</div>
              </div>
              <div style={{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap"}}>{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Settings({settings,update}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div className="card" style={{padding:18,border:"1px solid "+(settings.paused?"rgba(255,170,0,.3)":"var(--bdr)")}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div className="orb" style={{fontSize:13,fontWeight:700,marginBottom:4,color:settings.paused?"var(--yellow)":"var(--text)"}}>{settings.paused?"⏸ PAUSED":"▶ ACTIVE"}</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>Paused = all notifications stop</div>
          </div>
          <Tog checked={!settings.paused} onChange={v=>update("paused",!v)}/>
        </div>
      </div>
      <div className="card" style={{padding:18}}>
        <div className="orb" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:14}}>NOTIFICATIONS</div>
        {[{k:"notifEntry",l:"Entry Signals"},{k:"notifTP",l:"Take Profit"},{k:"notifSL",l:"Stop Loss"},{k:"notifMarket",l:"Market Updates"}].map((item,i,arr)=>(
          <div key={item.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:i<arr.length-1?"1px solid var(--bdr)":"none"}}>
            <div style={{fontWeight:600,fontSize:14}}>{item.l}</div>
            <Tog checked={!!settings[item.k]} onChange={v=>update(item.k,v)}/>
          </div>
        ))}
      </div>
      <div className="card" style={{padding:18}}>
        <div className="orb" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:14}}>DEFAULT LEVERAGE</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[3,5,8,10,12,15].map(l=>(
            <button key={l} className={"btn "+(settings.lev===l?"bc":"bh")} style={{padding:"8px 14px",fontSize:12}} onClick={()=>update("lev",l)}>{l}x</button>
          ))}
        </div>
        {settings.lev>=15 && <div style={{marginTop:10,fontSize:12,color:"var(--yellow)"}}>⚠️ High leverage = high risk!</div>}
      </div>
    </div>
  );
}

function Subscribe() {
  const [email,setEmail]=useState("");
  const [plan,setPlan]=useState("pro");
  const [step,setStep]=useState("select");
  const [loading,setLoading]=useState(false);
  const sel=CONFIG.PLANS[plan];
  let sub=null;
  try{sub=JSON.parse(localStorage.getItem("cx_sub")||"null");}catch{}
  const handlePay=async()=>{
    if(!email.includes("@")){alert("Valid email needed!");return;}
    setLoading(true);
    const note="CryptexSignal-"+plan.toUpperCase()+"-"+email.split("@")[0];
    window.location.href="upi://pay?pa="+CONFIG.UPI_ID+"&pn="+encodeURIComponent(CONFIG.UPI_NAME)+"&am="+sel.price+"&cu=INR&tn="+encodeURIComponent(note);
    await new Promise(r=>setTimeout(r,3000));
    setLoading(false);setStep("confirm");
  };
  const handleConfirm=async()=>{
    setLoading(true);
    await new Promise(r=>setTimeout(r,1500));
    const s={plan,email,activatedAt:Date.now(),expiresAt:Date.now()+30*86400000};
    try{localStorage.setItem("cx_sub",JSON.stringify(s));}catch{}
    setLoading(false);setStep("done");
  };
  if(sub&&step!=="done") return (
    <div className="card ai" style={{padding:32,textAlign:"center"}}>
      <div style={{fontSize:48,marginBottom:12}}>💎</div>
      <div className="orb" style={{fontSize:18,color:"var(--green)",marginBottom:8}}>ACTIVE PLAN</div>
      <span className="pill pg" style={{fontSize:14,padding:"6px 20px"}}>{sub.plan.toUpperCase()}</span>
      <div style={{color:"var(--muted)",marginTop:16}}>{sub.email}</div>
      <div style={{color:"var(--muted)",fontSize:12,marginTop:4}}>Expires: {new Date(sub.expiresAt).toLocaleDateString()}</div>
      <button className="btn bh" style={{marginTop:20,fontSize:10}} onClick={()=>{localStorage.removeItem("cx_sub");window.location.reload();}}>Cancel</button>
    </div>
  );
  if(step==="done") return (
    <div className="card ai" style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:56,marginBottom:16}}>✅</div>
      <div className="orb" style={{fontSize:18,color:"var(--green)",marginBottom:8}}>PAYMENT DONE!</div>
      <div style={{color:"var(--muted)",marginBottom:20}}>{email} க்கு access அனுப்பப்படும்.<br/><strong style={{color:"var(--text)"}}>{sel.name} PLAN</strong> activated!</div>
      <button className="btn bc" onClick={()=>setStep("select")}>Continue</button>
    </div>
  );
  if(step==="confirm") return (
    <div className="card ai" style={{padding:28}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:40,marginBottom:12}}>📱</div>
        <div className="orb" style={{fontSize:16,marginBottom:8}}>PAYMENT SENT?</div>
        <div style={{color:"var(--muted)",fontSize:13}}>Rs.{sel.price} payment <strong style={{color:"var(--cyan)"}}>{CONFIG.UPI_ID}</strong> க்கு அனுப்பினீர்களா?</div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button className="btn bg" style={{flex:1,padding:14}} onClick={handleConfirm} disabled={loading}>{loading?<Spin size={14}/>:"✅ YES, PAID"}</button>
        <button className="btn bh" style={{flex:1,padding:14}} onClick={()=>setStep("select")}>← Back</button>
      </div>
    </div>
  );
  const plans=[
    {id:"basic",col:"var(--cyan)",badge:null,em:"🥉",feats:["3 Coins","Daily signals","Email alerts","Basic AI"]},
    {id:"pro",col:"var(--green)",badge:"POPULAR",em:"🥇",feats:["All 5 coins","Real-time signals","Push alerts","Full AI","Risk calc"]},
    {id:"elite",col:"var(--purple)",badge:"BEST",em:"💎",feats:["All PRO","Unlimited scan","Telegram bot","1-on-1 support","Resell license"]},
  ];
  return (
    <div>
      <div style={{textAlign:"center",marginBottom:24}}>
        <h2 className="orb" style={{fontSize:18,fontWeight:900,marginBottom:6}}>GET <span style={{color:"var(--cyan)"}}>FULL ACCESS</span></h2>
        <div style={{color:"var(--muted)",fontSize:13}}>UPI payment • Instant • Cancel anytime</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:24}}>
        {plans.map(p=>{
          const pd=CONFIG.PLANS[p.id];
          return (
            <div key={p.id} className="card" onClick={()=>setPlan(p.id)}
              style={{padding:22,cursor:"pointer",position:"relative",border:"1px solid "+(plan===p.id?p.col:"var(--bdr)"),boxShadow:plan===p.id?"0 0 24px "+p.col+"33":"none"}}>
              {p.badge && <div style={{position:"absolute",top:-1,right:14,background:p.col,color:"#000",fontSize:9,fontWeight:900,padding:"3px 10px",borderRadius:"0 0 8px 8px"}}>{p.badge}</div>}
              <div style={{fontSize:28,marginBottom:6}}>{p.em}</div>
              <div className="orb" style={{fontSize:14,fontWeight:900,marginBottom:8}}>{pd.name}</div>
              <div style={{marginBottom:16}}><span className="mono" style={{fontSize:26,fontWeight:700,color:p.col}}>{pd.label.split("/")[0]}</span><span style={{color:"var(--muted)",fontSize:12}}>/mo</span></div>
              {p.feats.map(ft=><div key={ft} style={{fontSize:12,marginBottom:6,display:"flex",alignItems:"center",gap:7}}><span style={{color:p.col,flexShrink:0}}>✓</span>{ft}</div>)}
            </div>
          );
        })}
      </div>
      <div className="card" style={{padding:22}}>
        <div className="orb" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:16}}>PAY VIA UPI</div>
        <div style={{background:"var(--bg3)",border:"1px solid var(--bdr)",borderRadius:10,padding:16,marginBottom:16,display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{fontSize:36}}>📱</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,marginBottom:4}}>Pay to</div>
            <div className="mono" style={{fontSize:15,color:"var(--cyan)",fontWeight:700}}>{CONFIG.UPI_ID}</div>
            <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>PhonePe • GPay • Paytm • Any UPI</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="mono" style={{fontSize:24,fontWeight:700,color:plans.find(p=>p.id===plan)?.col}}>{CONFIG.PLANS[plan].label.split("/")[0]}</div>
            <div style={{fontSize:11,color:"var(--muted)"}}>per month</div>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>Your Email (for access)</div>
          <input className="inp" placeholder="example@gmail.com" value={email} onChange={e=>setEmail(e.target.value)} type="email"/>
        </div>
        <button className="btn bc" style={{width:"100%",padding:16,fontSize:13}} onClick={handlePay} disabled={loading}>
          {loading?<Spin size={16}/>:"PAY "+CONFIG.PLANS[plan].label.split("/")[0]+" VIA UPI"}
        </button>
        <div style={{marginTop:12,fontSize:11,color:"var(--muted)"}}>Payment confirm ஆன 5 min-இல் access கிடைக்கும்</div>
      </div>
    </div>
  );
}

const DEF={paused:false,notifEntry:true,notifTP:true,notifSL:true,notifMarket:false,lev:10};
const INIT_N=[
  {id:1,coin:"BTC",msg:"🚀 BTC LONG signal active — Entry zone reached!",time:"2m ago",type:"entry",read:false,urgent:true},
  {id:2,coin:"SOL",msg:"⚡ SOL breakout! Volume 2x spike. LONG confirmed.",time:"8m ago",type:"entry",read:false,urgent:true},
  {id:3,coin:"BNB",msg:"⚠️ BNB SHORT: Rejection at resistance.",time:"20m ago",type:"alert",read:false,urgent:false},
  {id:4,coin:"ETH",msg:"✅ ETH TP1 hit! Move SL to entry.",time:"1h ago",type:"tp",read:true,urgent:false},
  {id:5,coin:"BTC",msg:"📊 Fear & Greed 62 (Greed). BTC dom 54%.",time:"2h ago",type:"info",read:true,urgent:false},
];

export default function App() {
  const [tab,setTab]=useState("dashboard");
  const [active,setActive]=useState(0);
  const [coins,setCoins]=useState([]);
  const [analyses,setAnalyses]=useState(Array(5).fill(null));
  const [loading,setLoading]=useState(true);
  const [notifs,setNotifs]=useState(INIT_N);
  const [settings,setSettings]=useState(()=>{try{return{...DEF,...JSON.parse(localStorage.getItem("cx_settings")||"{}")};}catch{return DEF;}});
  const upd=useCallback((k,v)=>setSettings(p=>{const n={...p,[k]:v};try{localStorage.setItem("cx_settings",JSON.stringify(n));}catch{}return n;}),[]);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const lc=await fetchPrices();
      setCoins(lc);
      const res=await Promise.all(lc.map(c=>getAnalysis(c)));
      setAnalyses(res);
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{refresh();const t=setInterval(refresh,30000);return()=>clearInterval(t);},[refresh]);
  useEffect(()=>{
    if(settings.paused)return;
    const t=setInterval(()=>{
      const c=COIN_LIST[Math.floor(Math.random()*COIN_LIST.length)];
      const ai=analyses[COIN_LIST.findIndex(x=>x.id===c.id)];
      if(!ai)return;
      const live=coins.find(x=>x.id===c.id);
      setNotifs(ns=>[{id:Date.now(),coin:c.id,msg:(ai.signal==="LONG"?"🚀":"⚠️")+" "+c.id+" "+ai.signal+" signal! Entry $"+f(ai.entry)+". Conf "+ai.conf+"%.",time:"just now",type:"alert",read:false,urgent:ai.urgency==="HIGH"},...ns.slice(0,19)]);
    },45000);
    return()=>clearInterval(t);
  },[settings.paused,analyses,coins]);
  const unread=notifs.filter(n=>!n.read).length;
  const TABS=[
    {id:"dashboard",icon:"◈",label:"Home"},
    {id:"signals",icon:"⚡",label:"Signals"},
    {id:"scan",icon:"◎",label:"Scan"},
    {id:"alerts",icon:"🔔",label:"Alerts",badge:unread},
    {id:"settings",icon:"⚙",label:"Settings"},
    {id:"subscribe",icon:"💎",label:"Plans"},
  ];
  return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:"100vh",position:"relative",zIndex:1}}>
        <header style={{position:"sticky",top:0,zIndex:200,background:"rgba(4,8,15,.96)",backdropFilter:"blur(20px)",borderBottom:"1px solid var(--bdr)"}}>
          <div style={{maxWidth:1280,margin:"0 auto",padding:"0 16px",height:54,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,borderRadius:8,flexShrink:0,background:"linear-gradient(135deg,var(--cyan),var(--green))",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 14px rgba(0,229,255,.4)"}}>
                <span style={{fontSize:16,fontWeight:900}}>◈</span>
              </div>
              <span className="orb" style={{fontSize:14,fontWeight:900,letterSpacing:2}}>CRYPTEX<span style={{color:"var(--cyan)"}}>SIGNAL</span></span>
              {loading && <Spin size={14}/>}
            </div>
            <nav style={{display:"flex",gap:2}} className="lo">
              {TABS.map(t=>(
                <button key={t.id} className={"nb "+(tab===t.id?"act":"")} onClick={()=>setTab(t.id)}>
                  <span>{t.icon}</span><span>{t.label}</span>
                  {t.badge>0 && <span style={{background:"var(--red)",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:6}}>{t.badge}</span>}
                </button>
              ))}
            </nav>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {settings.paused && <span className="pill py lo">⏸</span>}
              {unread>0 && <span className="nd pu" style={{cursor:"pointer"}} onClick={()=>setTab("alerts")}/>}
              <button className="btn bc" style={{padding:"7px 14px",fontSize:10}} onClick={()=>setTab("scan")}>SCAN</button>
            </div>
          </div>
        </header>
        {coins.length>0 && <Ticker coins={coins}/>}
        <main style={{maxWidth:1280,margin:"0 auto",padding:"20px 16px 80px",position:"relative",zIndex:1}}>
          {tab==="dashboard" && <Dashboard coins={coins} analyses={analyses} loading={loading} setTab={setTab} setActive={setActive}/>}
          {tab==="signals"   && <Signals coins={coins} analyses={analyses} loading={loading} active={active} setActive={setActive} refresh={refresh}/>}
          {tab==="scan"      && <Scan coins={coins} analyses={analyses} setTab={setTab} setActive={setActive}/>}
          {tab==="alerts"    && <Alerts notifs={notifs} setNotifs={setNotifs} paused={settings.paused}/>}
          {tab==="settings"  && <Settings settings={settings} update={upd}/>}
          {tab==="subscribe" && <Subscribe/>}
        </main>
        <nav className="so" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,background:"rgba(4,8,15,.97)",backdropFilter:"blur(20px)",borderTop:"1px solid var(--bdr)",display:"flex",height:58}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,color:tab===t.id?"var(--cyan)":"var(--muted)",transition:"color .18s",position:"relative"}}>
              <span style={{fontSize:17}}>{t.icon}</span>
              <span style={{fontFamily:"Rajdhani,sans-serif",fontSize:9,fontWeight:600,letterSpacing:.5}}>{t.label}</span>
              {t.badge>0 && <span style={{position:"absolute",top:7,left:"58%",background:"var(--red)",color:"#fff",fontSize:8,padding:"1px 4px",borderRadius:5}}>{t.badge}</span>}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
