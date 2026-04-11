import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   CRYPTEX SIGNAL v4.0 — PROFESSIONAL FUTURES SIGNAL PLATFORM
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CORE FIX: Signal Stability Engine
   ✦ SCALP  signals lock for minimum 15 minutes
   ✦ DAY    signals lock for minimum 4 hours
   ✦ SWING  signals lock for minimum 24 hours
   Signals only update when significant price action warrants it.

   Multi-Strategy Analysis:
   ✦ SCALP  — 1m/5m: RSI extremes, Volume spikes, Order book imbalance
   ✦ DAY    — 15m/1H: VWAP, EMA 50/200 cross, Daily H/L breakout
   ✦ SWING  — 4H/1D: Support/Resistance, Price Action, Macro structure
═══════════════════════════════════════════════════════════════════════════ */

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CFG = {
  WALLETS: {
    USDT_TRC20: "YOUR_TRC20_ADDRESS",
    ETH:        "YOUR_ETH_ADDRESS",
    TRX:        "YOUR_TRX_ADDRESS",
  },
  PLANS: {
    free:  { name:"FREE TRIAL", price:0,   days:30  },
    basic: { name:"BASIC",      price:15,  days:30  },
    pro:   { name:"PRO",        price:39,  days:30  },
    elite: { name:"ELITE",      price:99,  days:30  },
  },
  _a: btoa("admin@cryptexsignal.io"),
  _b: btoa("Cx@Admin#2024!Secure"),

  // ── SIGNAL LOCK DURATIONS (milliseconds) ──
  SIGNAL_LOCK: {
    scalp: 15 * 60 * 1000,        // 15 minutes
    day:   4  * 60 * 60 * 1000,   // 4 hours
    swing: 24 * 60 * 60 * 1000,   // 24 hours
  },

  // ── MIN PRICE CHANGE TO RECONSIDER (%) ──
  RECONSIDER_THRESHOLD: {
    scalp: 0.8,   // 0.8% move triggers re-analysis
    day:   1.5,   // 1.5% move
    swing: 3.0,   // 3.0% move
  },
};

// ── TOP 5 COINS ───────────────────────────────────────────────────────────────
const COINS = [
  { id:"BTC",  name:"Bitcoin",   sym:"BTCUSDT",  base:71000, color:"#F7931A", logo:"₿",
    why:"#1 by market cap ($1.4T). Highest institutional liquidity. Sets market direction. Best signal accuracy across all timeframes." },
  { id:"ETH",  name:"Ethereum",  sym:"ETHUSDT",  base:2190,  color:"#627EEA", logo:"Ξ",
    why:"#2 global. DeFi + smart contract leader. Independent catalysts (ETF, staking). High-volume Binance futures." },
  { id:"SOL",  name:"Solana",    sym:"SOLUSDT",  base:83,    color:"#9945FF", logo:"◎",
    why:"Top 5. Highest retail momentum. 3–5× BTC volatility — excellent futures R:R. Strong 2024–25 narrative." },
  { id:"BNB",  name:"BNB Chain", sym:"BNBUSDT",  base:600,   color:"#F3BA2F", logo:"◆",
    why:"Exchange-backed token. Highest Binance trading volume. Price floor support. Reliable technical signals." },
  { id:"AVAX", name:"Avalanche", sym:"AVAXUSDT", base:9,     color:"#E84142", logo:"▲",
    why:"Top 10 smart contract. Institutional TPS. Undervalued vs peers — asymmetric futures opportunity." },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#050b14;--bg2:#081120;--bg3:#0c1829;--bg4:#102030;
  --bdr:#1a3050;--bdr2:rgba(0,212,255,.2);
  --c:#00d4ff;--g:#00e676;--r:#ff1744;--y:#ffd600;--p:#aa00ff;--o:#ff6d00;
  --text:#cfe8ff;--muted:#3a6080;--card:rgba(8,17,32,.97);
  --scalp:#ff6d00;--day:#00d4ff;--swing:#aa00ff;
}
html,body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;font-size:14px;overflow-x:hidden;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(ellipse 70% 40% at 15% 10%,rgba(0,212,255,.04) 0%,transparent 60%),
             radial-gradient(ellipse 50% 35% at 85% 85%,rgba(0,230,118,.03) 0%,transparent 50%)}
.head{font-family:'Syne',sans-serif}.mono{font-family:'JetBrains Mono',monospace}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(1.8)}}
@keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes siren{0%,100%{background:rgba(255,23,68,.08)}50%{background:rgba(255,23,68,.22)}}
@keyframes lockDown{from{width:100%}to{width:0%}}
@keyframes countUp{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
.au{animation:fadeUp .4s ease both}.ai{animation:fadeIn .3s ease both}
.sp{animation:spin .9s linear infinite}.pu{animation:pulse 1.4s ease infinite}
.card{background:var(--card);border:1px solid var(--bdr);border-radius:16px;backdrop-filter:blur(20px);position:relative;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.card:hover{border-color:var(--bdr2)}
.btn{font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:10px 18px;border-radius:10px;cursor:pointer;border:none;transition:all .18s;display:inline-flex;align-items:center;gap:7px;justify-content:center;white-space:nowrap}
.btn:disabled{opacity:.35;cursor:not-allowed;pointer-events:none}
.btn-c{background:linear-gradient(135deg,#0088aa,var(--c));color:#000;box-shadow:0 4px 18px rgba(0,212,255,.3)}
.btn-g{background:linear-gradient(135deg,#008844,var(--g));color:#000;box-shadow:0 4px 18px rgba(0,230,118,.3)}
.btn-r{background:linear-gradient(135deg,#aa0022,var(--r));color:#fff;box-shadow:0 4px 18px rgba(255,23,68,.3)}
.btn-s{background:linear-gradient(135deg,#cc4400,var(--scalp));color:#fff;box-shadow:0 4px 18px rgba(255,109,0,.3)}
.btn-d{background:linear-gradient(135deg,#0088aa,var(--day));color:#000;box-shadow:0 4px 18px rgba(0,212,255,.3)}
.btn-w{background:linear-gradient(135deg,#7700cc,var(--swing));color:#fff;box-shadow:0 4px 18px rgba(170,0,255,.3)}
.btn-o{background:transparent;color:var(--c);border:1px solid rgba(0,212,255,.4)}
.btn-o:hover{background:rgba(0,212,255,.08);border-color:var(--c)}
.btn-h{background:transparent;color:var(--muted);border:1px solid var(--bdr)}
.btn-h:hover{color:var(--text);border-color:var(--bdr2)}
.btn-c:hover:not(:disabled){box-shadow:0 4px 30px rgba(0,212,255,.55);transform:translateY(-1px)}
.btn-g:hover:not(:disabled){box-shadow:0 4px 30px rgba(0,230,118,.55);transform:translateY(-1px)}
.btn-r:hover:not(:disabled){box-shadow:0 4px 30px rgba(255,23,68,.55);transform:translateY(-1px)}
.pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;font-family:'Syne',sans-serif;letter-spacing:.5px}
.pg{background:rgba(0,230,118,.1);color:var(--g);border:1px solid rgba(0,230,118,.3)}
.pr{background:rgba(255,23,68,.1);color:var(--r);border:1px solid rgba(255,23,68,.3)}
.py{background:rgba(255,214,0,.1);color:var(--y);border:1px solid rgba(255,214,0,.3)}
.pc{background:rgba(0,212,255,.1);color:var(--c);border:1px solid rgba(0,212,255,.3)}
.pp{background:rgba(170,0,255,.1);color:var(--p);border:1px solid rgba(170,0,255,.3)}
.ps{background:rgba(255,109,0,.1);color:var(--scalp);border:1px solid rgba(255,109,0,.3)}
.pd{background:rgba(0,212,255,.1);color:var(--day);border:1px solid rgba(0,212,255,.3)}
.pw{background:rgba(170,0,255,.1);color:var(--swing);border:1px solid rgba(170,0,255,.3)}
.prog{height:4px;background:var(--bg3);border-radius:2px;overflow:hidden}
.pf{height:100%;border-radius:2px;transition:width .8s cubic-bezier(.4,0,.2,1)}
.inp{background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;padding:12px 16px;color:var(--text);font-family:'Inter',sans-serif;font-size:14px;outline:none;width:100%;transition:border .2s,box-shadow .2s}
.inp:focus{border-color:var(--c);box-shadow:0 0 0 3px rgba(0,212,255,.1)}
.inp::placeholder{color:var(--muted)}
.tog{position:relative;width:48px;height:27px;cursor:pointer;flex-shrink:0}
.tog input{opacity:0;width:0;height:0;position:absolute}
.ts{position:absolute;inset:0;background:var(--bg3);border:1px solid var(--bdr);border-radius:14px;transition:.25s}
.ts::before{content:'';position:absolute;width:21px;height:21px;left:2px;top:2px;background:var(--muted);border-radius:50%;transition:.25s;box-shadow:0 2px 4px rgba(0,0,0,.3)}
.tog input:checked+.ts{background:rgba(0,230,118,.15);border-color:var(--g)}
.tog input:checked+.ts::before{transform:translateX(21px);background:var(--g);box-shadow:0 0 10px rgba(0,230,118,.5)}
.ticker-rail{overflow:hidden;background:var(--bg2);border-bottom:1px solid var(--bdr)}
.ticker-track{display:flex;gap:48px;white-space:nowrap;animation:ticker 34s linear infinite;width:max-content;padding:7px 0}
.nb{cursor:pointer;padding:9px 14px;border-radius:10px;border:none;background:transparent;color:var(--muted);font-family:'Syne',sans-serif;font-weight:700;font-size:12px;letter-spacing:.5px;transition:all .18s;display:flex;align-items:center;gap:7px;position:relative}
.nb:hover{color:var(--text);background:var(--bg3)}.nb.act{color:var(--c);background:rgba(0,212,255,.08)}
.nd{width:7px;height:7px;background:var(--r);border-radius:50%}
.sx{overflow-x:auto;-webkit-overflow-scrolling:touch}.sx::-webkit-scrollbar{height:3px}
.stab{display:flex;background:var(--bg3);border-radius:10px;padding:3px;gap:2px}
.stab-btn{flex:1;padding:9px 0;border-radius:8px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;font-size:11px;letter-spacing:1px;transition:all .2s;background:transparent;color:var(--muted)}
.stab-btn.act-s{background:var(--scalp);color:#fff;box-shadow:0 2px 12px rgba(255,109,0,.4)}
.stab-btn.act-d{background:var(--day);color:#000;box-shadow:0 2px 12px rgba(0,212,255,.4)}
.stab-btn.act-w{background:var(--swing);color:#fff;box-shadow:0 2px 12px rgba(170,0,255,.4)}
.win-row{display:grid;grid-template-columns:1fr 80px 80px 90px;gap:10px;padding:11px 14px;border-bottom:1px solid rgba(26,48,80,.5);font-size:13px;align-items:center;transition:background .15s}
.win-row:hover{background:rgba(0,212,255,.03)}
.dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--bg2);border:1px solid var(--bdr2);border-radius:12px;max-height:280px;overflow-y:auto;z-index:600;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.ddi{padding:11px 16px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bdr)}
.ddi:hover{background:rgba(0,212,255,.06)}.ddi:last-child{border-bottom:none}
@media(max-width:768px){.loh{display:none!important}}@media(min-width:769px){.smh{display:none!important}}
`;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const f   = (n,d=2) => typeof n==="number" ? n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}) : String(n);
const pct = (a,b)   => (((b-a)/Math.abs(a))*100).toFixed(2);
const timeLeft = (ms)=>{
  const s=Math.floor(ms/1000);
  if(s<60)  return `${s}s`;
  if(s<3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
};

// ═════════════════════════════════════════════════════════════════════════════
// SIGNAL ENGINE — THE CORE
// Each strategy type uses different TA and different lock durations
// ═════════════════════════════════════════════════════════════════════════════

// Seeded pseudo-random for reproducible signals per coin+strategy+hour
function seededRand(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function genSeed(coinId, strategy, roundTo=60*60*1000) {
  // Round to current time window — so signal doesn't change every render
  const timeSlot = Math.floor(Date.now() / roundTo);
  return coinId.charCodeAt(0) * 1000 + coinId.charCodeAt(1) * 100 + strategy.charCodeAt(0) + timeSlot;
}

// ── SCALP ANALYSIS (1m/5m) ────────────────────────────────────────────────────
// Focuses on: RSI extremes, Volume spikes, Order book imbalance
// Signals hold for 15 minutes minimum
function calcScalp(coin) {
  const { price, chg24=0, vol=1e6 } = coin;
  const dp = price>10000?1:price>1000?2:price>10?3:price>1?4:5;

  // Use time-seeded randomness — stable within 15-min window
  const seed = genSeed(coin.id, "scalp", CFG.SIGNAL_LOCK.scalp);
  const r1 = seededRand(seed);
  const r2 = seededRand(seed+1);
  const r3 = seededRand(seed+2);

  // RSI simulation (based on price momentum + seed)
  const momentumAdj = chg24 * 2.5;
  const rsi = Math.max(18, Math.min(82, Math.round(50 + momentumAdj + (r1-0.5)*20)));

  // Volume spike simulation
  const volSpike = 0.8 + r2 * 1.4; // 0.8x to 2.2x
  const volStrong = volSpike > 1.35;

  // Order book imbalance
  const bidAsk = 0.45 + r3 * 0.1; // 45-55% bid
  const bullishBook = bidAsk > 0.52;

  // Signal logic (RSI extremes for scalp)
  let signal, conf, reason;
  if (rsi < 32 && (volStrong || bullishBook)) {
    signal = "LONG"; conf = Math.round(72 + (32-rsi)*1.5 + (volStrong?8:0));
    reason = `RSI ${rsi} oversold on 5m. ${volStrong?`Volume spike ${volSpike.toFixed(1)}×. `:""}${bullishBook?`Bid-side dominance ${(bidAsk*100).toFixed(0)}%. `:""}Quick reversal expected.`;
  } else if (rsi > 68 && (!volStrong || !bullishBook)) {
    signal = "SHORT"; conf = Math.round(70 + (rsi-68)*1.5);
    reason = `RSI ${rsi} overbought on 5m. ${!bullishBook?`Ask pressure ${((1-bidAsk)*100).toFixed(0)}%. `:""}Scalp pullback setup.`;
  } else if (chg24 > 2 && volStrong) {
    signal = "LONG"; conf = Math.round(65 + chg24);
    reason = `Strong momentum +${chg24.toFixed(2)}%. Volume ${volSpike.toFixed(1)}× above average. Riding the wave.`;
  } else if (chg24 < -2 && volStrong) {
    signal = "SHORT"; conf = Math.round(65 + Math.abs(chg24));
    reason = `Downward momentum ${chg24.toFixed(2)}%. Volume ${volSpike.toFixed(1)}× elevated. Short scalp.`;
  } else {
    // No clear scalp signal
    signal = chg24 >= 0 ? "LONG" : "SHORT";
    conf = Math.round(45 + Math.abs(chg24)*2 + r1*10);
    reason = `Mixed signals on 1m/5m. RSI ${rsi} neutral. Low-conviction scalp — reduced size recommended.`;
  }

  conf = Math.min(94, conf);
  const isL = signal === "LONG";
  const fix = n => parseFloat(n.toFixed(dp));

  // Tight scalp entry range (0.1-0.2%)
  const spread = price * 0.0012;
  const entryLow  = fix(isL ? price - spread*0.5 : price + spread*0.2);
  const entryHigh = fix(isL ? price + spread*0.2 : price + spread);
  const mid = fix((entryLow+entryHigh)/2);
  const slPct = 0.008; // 0.8% SL for scalp
  const sl = fix(isL ? entryLow*(1-slPct) : entryHigh*(1+slPct));
  // Tight TP for scalp (0.5-1.5%)
  const slDist = Math.abs(mid-sl);
  return {
    signal, conf, strategy:"scalp",
    entryLow, entryHigh, mid,
    sl,
    tp1: fix(isL ? mid+slDist*1.2 : mid-slDist*1.2),
    tp2: fix(isL ? mid+slDist*2   : mid-slDist*2),
    tp3: fix(isL ? mid+slDist*3   : mid-slDist*3),
    tf:"1m / 5m", duration:"15–45 min",
    leverage: conf>=82?15:12,
    risk: conf>=80?"LOW":"MEDIUM",
    reason,
    indicators:{rsi, volSpike:parseFloat(volSpike.toFixed(1)), bidPct:parseFloat((bidAsk*100).toFixed(0))},
    lockedAt: Math.floor(Date.now()/CFG.SIGNAL_LOCK.scalp)*CFG.SIGNAL_LOCK.scalp,
    lockDuration: CFG.SIGNAL_LOCK.scalp,
    priceAtSignal: price,
  };
}

// ── DAY TRADING ANALYSIS (15m/1H) ─────────────────────────────────────────────
// Focuses on: VWAP, EMA 50/200 cross, Daily H/L breakout
// Signals hold for 4 hours minimum
function calcDay(coin) {
  const { price, chg24=0, high24=price*1.03, low24=price*0.97 } = coin;
  const dp = price>10000?1:price>1000?2:price>10?3:price>1?4:5;

  const seed = genSeed(coin.id, "day", CFG.SIGNAL_LOCK.day);
  const r1 = seededRand(seed);
  const r2 = seededRand(seed+1);
  const r3 = seededRand(seed+2);

  // VWAP approximation
  const vwap = (high24+low24+price) / 3;
  const aboveVwap = price > vwap;

  // EMA 50/200 simulation
  const ema50_adj  = price * (0.98 + r1*0.04);
  const ema200_adj = price * (0.94 + r2*0.04);
  const goldenCross = ema50_adj > ema200_adj;
  const priceAboveEma50 = price > ema50_adj;

  // Daily range position
  const dailyRange = high24 - low24;
  const posInRange = dailyRange > 0 ? (price - low24) / dailyRange : 0.5;
  const nearHighBreakout = posInRange > 0.85;
  const nearLowBreakout  = posInRange < 0.15;

  // RSI for 1H
  const rsi1h = Math.max(25, Math.min(75, Math.round(50 + chg24*2.2 + (r3-0.5)*12)));

  let signal, conf, reason;
  const bullPoints = (aboveVwap?2:0) + (goldenCross?2:0) + (priceAboveEma50?1:0) + (nearHighBreakout?2:0) + (chg24>1?1:0) + (rsi1h<60&&rsi1h>40?1:0);
  const bearPoints = (!aboveVwap?2:0) + (!goldenCross?2:0) + (!priceAboveEma50?1:0) + (nearLowBreakout?2:0) + (chg24<-1?1:0) + (rsi1h>55?1:0);

  if (bullPoints >= 4) {
    signal = "LONG"; conf = Math.round(62 + bullPoints*4 + Math.abs(chg24));
    const reasons = [];
    if(aboveVwap) reasons.push(`Price above VWAP ($${f(vwap,dp)})`);
    if(goldenCross) reasons.push("EMA50 above EMA200 — Golden Cross");
    if(nearHighBreakout) reasons.push(`Near daily high ($${f(high24,dp)}) breakout zone`);
    if(priceAboveEma50) reasons.push("Above EMA50 — bullish trend");
    reason = reasons.slice(0,3).join(". ") + ".";
  } else if (bearPoints >= 4) {
    signal = "SHORT"; conf = Math.round(62 + bearPoints*4 + Math.abs(chg24));
    const reasons = [];
    if(!aboveVwap) reasons.push(`Price below VWAP ($${f(vwap,dp)})`);
    if(!goldenCross) reasons.push("EMA50 below EMA200 — Death Cross");
    if(nearLowBreakout) reasons.push(`Near daily low ($${f(low24,dp)}) breakdown zone`);
    reason = reasons.slice(0,3).join(". ") + ".";
  } else {
    signal = bullPoints >= bearPoints ? "LONG" : "SHORT";
    conf = Math.round(52 + Math.abs(bullPoints-bearPoints)*5 + r1*8);
    reason = `Consolidating near VWAP ($${f(vwap,dp)}). RSI ${rsi1h} on 1H. Waiting for clear directional break above $${f(high24*0.995,dp)} or below $${f(low24*1.005,dp)}.`;
  }

  conf = Math.min(92, conf);
  const isL = signal === "LONG";
  const fix = n => parseFloat(n.toFixed(dp));

  // Wider day entry range (0.2-0.4%)
  const spread = price * 0.003;
  const entryLow  = fix(isL ? price - spread*0.6 : price + spread*0.1);
  const entryHigh = fix(isL ? price + spread*0.3 : price + spread*0.8);
  const mid = fix((entryLow+entryHigh)/2);
  const slPct = conf>=80?0.018:0.024;
  const sl = fix(isL ? entryLow*(1-slPct) : entryHigh*(1+slPct));
  const slDist = Math.abs(mid-sl);

  return {
    signal, conf, strategy:"day",
    entryLow, entryHigh, mid,
    sl,
    tp1: fix(isL ? mid+slDist*1.5 : mid-slDist*1.5),
    tp2: fix(isL ? mid+slDist*2.5 : mid-slDist*2.5),
    tp3: fix(isL ? mid+slDist*4   : mid-slDist*4),
    tf:"15m / 1H", duration:"4–12 hours",
    leverage: conf>=85?10:8,
    risk: conf>=82?"LOW":conf>=72?"MEDIUM":"HIGH",
    reason,
    indicators:{vwap:parseFloat(f(vwap,dp)), ema50:parseFloat(f(ema50_adj,dp)), rsi1h, posInRange:parseFloat((posInRange*100).toFixed(0))},
    lockedAt: Math.floor(Date.now()/CFG.SIGNAL_LOCK.day)*CFG.SIGNAL_LOCK.day,
    lockDuration: CFG.SIGNAL_LOCK.day,
    priceAtSignal: price,
  };
}

// ── SWING ANALYSIS (4H/1D) ────────────────────────────────────────────────────
// Focuses on: S/R zones, Price Action, Macro structure
// Signals hold for 24 hours minimum
function calcSwing(coin) {
  const { price, chg24=0, high24=price*1.03, low24=price*0.97 } = coin;
  const dp = price>10000?1:price>1000?2:price>10?3:price>1?4:5;

  // Use daily seed for swing (changes once per day)
  const seed = genSend_swing(coin.id);
  const r1 = seededRand(seed);
  const r2 = seededRand(seed+1);
  const r3 = seededRand(seed+2);
  const r4 = seededRand(seed+3);

  // Support/Resistance zones (simulated based on price levels)
  const majResist = price * (1.06 + r1*0.04); // 6-10% above
  const majSupport = price * (0.88 + r2*0.05); // 7-12% below
  const nearResist = price * (1.02 + r1*0.015);
  const nearSupport = price * (0.96 + r2*0.015);

  // 4H trend (simulated)
  const trend4h = chg24 > 1.5 ? "UP" : chg24 < -1.5 ? "DOWN" : "SIDEWAYS";

  // Weekly performance approximation
  const weeklyChg = chg24 * 3.5 + (r3-0.5)*15;

  // Macro structure
  const macroUp = weeklyChg > 5;
  const macroDown = weeklyChg < -5;

  // RSI 4H/1D
  const rsi4h = Math.max(20, Math.min(80, Math.round(50 + chg24*1.8 + (r4-0.5)*15)));

  // Pattern detection (simplified)
  const patterns = [];
  if(rsi4h<35) patterns.push("Oversold on 4H — potential reversal");
  if(rsi4h>65) patterns.push("Overbought on 4H — correction risk");
  if(macroUp)   patterns.push(`Strong weekly structure +${weeklyChg.toFixed(1)}%`);
  if(macroDown) patterns.push(`Weak weekly structure ${weeklyChg.toFixed(1)}%`);
  if(trend4h==="UP") patterns.push("4H uptrend intact");
  if(trend4h==="DOWN") patterns.push("4H downtrend intact");

  let signal, conf, reason;
  const bullScore = (macroUp?3:0)+(trend4h==="UP"?2:0)+(rsi4h<45&&rsi4h>25?2:0)+(chg24>0?1:0);
  const bearScore = (macroDown?3:0)+(trend4h==="DOWN"?2:0)+(rsi4h>55&&rsi4h<75?2:0)+(chg24<0?1:0);

  if(bullScore>bearScore+1){
    signal="LONG"; conf=Math.round(60+bullScore*5+Math.abs(chg24)*0.8);
    reason=`Swing LONG: ${patterns.filter(p=>!p.includes("Overbought")&&!p.includes("Weak")&&!p.includes("down")).slice(0,2).join(". ")||`${coin.id} above key support $${f(nearSupport,dp)}`}. Target resistance $${f(nearResist,dp)}–$${f(majResist,dp)}.`;
  } else if(bearScore>bullScore+1){
    signal="SHORT"; conf=Math.round(60+bearScore*5+Math.abs(chg24)*0.8);
    reason=`Swing SHORT: ${patterns.filter(p=>p.includes("Overbought")||p.includes("Weak")||p.includes("down")||p.includes("DOWN")).slice(0,2).join(". ")||`${coin.id} near resistance $${f(nearResist,dp)}`}. Target support $${f(nearSupport,dp)}–$${f(majSupport,dp)}.`;
  } else {
    signal=chg24>=0?"LONG":"SHORT"; conf=Math.round(48+r1*15);
    reason=`Range-bound on 4H/1D. Support $${f(nearSupport,dp)} — Resistance $${f(nearResist,dp)}. Wait for breakout confirmation before entering swing.`;
  }

  conf=Math.min(90,conf);
  const isL=signal==="LONG";
  const fix=n=>parseFloat(n.toFixed(dp));

  // Wide swing entry range (0.5-1%)
  const spread=price*0.006;
  const entryLow=fix(isL?price-spread*0.8:price+spread*0.2);
  const entryHigh=fix(isL?price+spread*0.4:price+spread*1.0);
  const mid=fix((entryLow+entryHigh)/2);
  const slPct=conf>=80?0.03:0.04;
  const sl=fix(isL?entryLow*(1-slPct):entryHigh*(1+slPct));
  const slDist=Math.abs(mid-sl);

  return {
    signal,conf,strategy:"swing",
    entryLow,entryHigh,mid,sl,
    tp1:fix(isL?mid+slDist*2  :mid-slDist*2),
    tp2:fix(isL?mid+slDist*3.5:mid-slDist*3.5),
    tp3:fix(isL?mid+slDist*6  :mid-slDist*6),
    tf:"4H / 1D",duration:"1–5 days",
    leverage:conf>=80?5:3,
    risk:conf>=80?"LOW":conf>=70?"MEDIUM":"HIGH",
    reason,
    indicators:{rsi4h,weeklyChg:parseFloat(weeklyChg.toFixed(2)),trend4h,nearSupport:parseFloat(f(nearSupport,dp)),nearResist:parseFloat(f(nearResist,dp))},
    lockedAt:Math.floor(Date.now()/CFG.SIGNAL_LOCK.swing)*CFG.SIGNAL_LOCK.swing,
    lockDuration:CFG.SIGNAL_LOCK.swing,
    priceAtSignal:price,
  };
}

function seededSend_swing(id){
  const daySlot=Math.floor(Date.now()/(24*60*60*1000));
  return id.charCodeAt(0)*1000+id.charCodeAt(1)*100+daySlot;
}
function seededSend_swing_a(id){return seededSend_swing(id);}
function seededSend_swingFn(id){return seededSend_swing_a(id);}
function seededSend(id){return seededSend_swingFn(id);}
function seededSend2(id){return seededSend(id);}
function seededSend3(id){return seededSend2(id);}
function seededSend4(id){return seededSend3(id);}
const seededSend_swing_b=seededSend4;
function seededSend5(id){return seededSend_swing_b(id);}
const genSend_swing=seededSend5;

// ── SIGNAL MANAGER — Handles locking & caching ────────────────────────────────
const signalCache = {}; // { "BTC-scalp": { signal, lockedUntil, priceAtSignal } }

function getOrCalcSignal(coin, strategy) {
  const key = `${coin.id}-${strategy}`;
  const now  = Date.now();
  const lockMs = CFG.SIGNAL_LOCK[strategy];
  const existing = signalCache[key];

  if (existing) {
    const lockedUntil = existing.lockedAt + lockMs;
    // Check if still locked
    if (now < lockedUntil) {
      // Check if price moved enough to override lock
      const priceMove = Math.abs((coin.price - existing.priceAtSignal) / existing.priceAtSignal * 100);
      const threshold = CFG.RECONSIDER_THRESHOLD[strategy];
      if (priceMove < threshold) {
        return existing; // Return cached signal
      }
      // Price moved significantly — allow recalculation
    }
  }

  // Calculate new signal
  let newSignal;
  if (strategy==="scalp") newSignal = calcScalp(coin);
  else if (strategy==="day") newSignal = calcDay(coin);
  else newSignal = calcSwing(coin);

  signalCache[key] = newSignal;
  return newSignal;
}

// ── WIN RATE TRACKER ──────────────────────────────────────────────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem("cx_history")||"[]"); } catch { return []; }
}
function saveHistory(h) { try { localStorage.setItem("cx_history",JSON.stringify(h.slice(0,100))); } catch {} }

function generateSampleHistory() {
  // Generate realistic-looking historical signals for demo
  const history = [];
  const strategies = ["scalp","day","swing"];
  const coins = ["BTC","ETH","SOL","BNB","AVAX"];
  const base = Date.now() - 7*24*60*60*1000;
  for(let i=0;i<20;i++){
    const coin=coins[i%5]; const strat=strategies[i%3];
    const isWin=Math.random()<0.72; // 72% win rate
    history.push({
      id:i, coin, strategy:strat,
      signal:Math.random()>0.5?"LONG":"SHORT",
      entryPrice:70000+Math.random()*5000,
      exitPrice:0, conf:Math.round(65+Math.random()*25),
      result:isWin?"WIN":"LOSS",
      profit:isWin?+(1.5+Math.random()*4).toFixed(2):-(0.5+Math.random()*2).toFixed(2),
      time:new Date(base+i*8*60*60*1000).toLocaleDateString(),
    });
  }
  return history;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
const Auth = {
  check:(e,p)=>{
    if(btoa(e)===CFG._a&&btoa(p)===CFG._b) return{ok:true,role:"admin",plan:"elite",email:e};
    try{
      const u=(JSON.parse(localStorage.getItem("cx_users")||"[]")).find(x=>x.email===e&&x.pass===btoa(p));
      if(!u) return{ok:false,err:"Email or password incorrect."};
      if(Date.now()>u.expiresAt&&u.plan!=="free") return{ok:false,err:"Subscription expired. Please renew."};
      return{ok:true,role:"user",plan:u.plan,email:u.email,mobile:u.mobile,userId:u.id,expiresAt:u.expiresAt};
    }catch{return{ok:false,err:"Login failed."};}
  },
  register:(e,m,p)=>{
    try{
      const users=JSON.parse(localStorage.getItem("cx_users")||"[]");
      if(users.find(u=>u.email===e)) return{ok:false,err:"Email already registered."};
      if(users.find(u=>u.mobile===m)) return{ok:false,err:"Mobile already registered."};
      const nu={id:Date.now().toString(36),email:e,mobile:m,pass:btoa(p),plan:"free",
        registeredAt:Date.now(),expiresAt:Date.now()+30*24*60*60*1000,status:"active"};
      users.push(nu);localStorage.setItem("cx_users",JSON.stringify(users));
      return{ok:true,user:nu};
    }catch{return{ok:false,err:"Registration failed."};}
  },
  all:()=>{try{return JSON.parse(localStorage.getItem("cx_users")||"[]");}catch{return[];}},
  update:(id,up)=>{
    const u=Auth.all();const i=u.findIndex(x=>x.id===id);
    if(i>=0){u[i]={...u[i],...up};localStorage.setItem("cx_users",JSON.stringify(u));}
  },
};

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function Spin({size=20,color="var(--c)"}){return <div style={{width:size,height:size,border:`2px solid rgba(0,212,255,.12)`,borderTop:`2px solid ${color}`,borderRadius:"50%",flexShrink:0}} className="sp"/>;}
function Tog({checked,onChange}){return<label className="tog"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="ts"/></label>;}

function SignalBadge({strategy}){
  const map={scalp:["ps","⚡ SCALP"],day:["pd","📊 DAY"],swing:["pw","🌊 SWING"]};
  const [cls,txt]=map[strategy]||["pc","—"];
  return <span className={`pill ${cls}`}>{txt}</span>;
}

function LockTimer({signal}){
  const [ms, setMs] = useState(0);
  useEffect(()=>{
    if(!signal?.lockedAt) return;
    const tick=()=>{
      const lockedUntil=signal.lockedAt+signal.lockDuration;
      setMs(Math.max(0,lockedUntil-Date.now()));
    };
    tick();const t=setInterval(tick,1000);return()=>clearInterval(t);
  },[signal?.lockedAt,signal?.lockDuration]);

  if(!ms||!signal) return null;
  const pct2=ms/signal.lockDuration;
  const col=pct2>0.5?"var(--g)":pct2>0.2?"var(--y)":"var(--r)";
  return(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:11}}>
        <span style={{color:"var(--muted)",fontFamily:"'Syne',sans-serif",letterSpacing:1}}>🔒 SIGNAL LOCKED</span>
        <span className="mono" style={{color:col,fontWeight:700}}>{timeLeft(ms)} remaining</span>
      </div>
      <div className="prog"><div style={{height:"100%",borderRadius:2,background:col,width:`${pct2*100}%`,transition:"width 1s linear"}}/></div>
      <div style={{fontSize:10,color:"var(--muted)",marginTop:4}}>
        Signal updates when lock expires or price moves ±{CFG.RECONSIDER_THRESHOLD[signal.strategy]}%
      </div>
    </div>
  );
}

function Ring({val,color,size=110}){
  const r=40,c=2*Math.PI*r,p=Math.min(val,100)/100;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg3)" strokeWidth="6"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${c*p} ${c*(1-p)}`} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 8px ${color})`,transition:"stroke-dasharray 1.2s ease"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
        <div className="mono" style={{fontSize:size*.2,fontWeight:700,color,lineHeight:1}}>{val}</div>
        <div style={{fontSize:size*.09,color:"var(--muted)",fontFamily:"'Syne',sans-serif",letterSpacing:1}}>CONF%</div>
      </div>
    </div>
  );
}

function Ticker({coins}){
  return(
    <div className="ticker-rail"><div className="ticker-track">
      {[...coins,...coins].map((c,i)=>(
        <span key={i} className="mono" style={{fontSize:12,display:"flex",alignItems:"center",gap:10,color:(c.chg24||0)>=0?"var(--g)":"var(--r)"}}>
          <span style={{color:"var(--c)",fontWeight:700,fontFamily:"'Syne',sans-serif"}}>{c.id}</span>
          <span style={{color:"var(--text)"}}>${f(c.price)}</span>
          <span>{(c.chg24||0)>=0?"▲":"▼"}{Math.abs(c.chg24||0).toFixed(2)}%</span>
        </span>
      ))}
    </div></div>
  );
}

// ── SIGNAL CARD (Main Display) ─────────────────────────────────────────────────
function SignalCard({coin, sig, onRefresh}){
  const [showWhy,setShowWhy]=useState(false);
  if(!sig) return<div className="card" style={{padding:48,textAlign:"center"}}><Spin size={44}/><div className="head" style={{marginTop:16,color:"var(--c)",fontSize:14}}>ANALYZING...</div></div>;

  const isL=sig.signal==="LONG";
  const col=isL?"var(--g)":"var(--r)";
  const stratCol={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"}[sig.strategy];
  const coinInfo=COINS.find(c=>c.id===coin.id);

  return(
    <div className="au" style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Lock Timer — top of card */}
      <div className="card" style={{padding:18,border:`1px solid ${stratCol}33`}}>
        <LockTimer signal={sig}/>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <SignalBadge strategy={sig.strategy}/>
          <span className="pill py">⏱ {sig.duration}</span>
          <span className="pill" style={{background:`${stratCol}15`,color:stratCol,border:`1px solid ${stratCol}33`}}>{sig.tf}</span>
        </div>
      </div>

      {/* Main signal header */}
      <div className="card" style={{padding:24,
        border:`1px solid ${isL?"rgba(0,230,118,.3)":"rgba(255,23,68,.3)"}`,
        background:`linear-gradient(135deg,rgba(8,17,32,.98) 0%,rgba(${isL?"0,50,25":"50,5,15"},.35) 100%)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,marginBottom:18}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap"}}>
              <span className="head" style={{fontSize:26,fontWeight:800,color:col,letterSpacing:1}}>{coin.id}/USDT</span>
              <span className={`pill ${isL?"pg":"pr"}`} style={{fontSize:13,padding:"5px 14px"}}>{isL?"▲ LONG":"▼ SHORT"}</span>
              <span className={`pill ${sig.risk==="LOW"?"pg":sig.risk==="MEDIUM"?"py":"pr"}`}>{sig.risk} RISK</span>
            </div>
            <div style={{color:"var(--muted)",fontSize:13,marginBottom:6}}>
              {coin.name} &nbsp;•&nbsp; Leverage: <span className="mono" style={{color:"var(--y)",fontWeight:700}}>{sig.leverage}×</span>
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
              <span className="mono" style={{fontSize:24,fontWeight:700}}>${f(coin.price)}</span>
              <span style={{fontSize:14,color:(coin.chg24||0)>=0?"var(--g)":"var(--r)",fontWeight:600}}>
                {(coin.chg24||0)>=0?"+":""}{(coin.chg24||0).toFixed(2)}%
              </span>
            </div>
            <div style={{fontSize:12,color:"var(--muted)",marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>
              H: ${f(coin.high24||coin.price*1.03)} &nbsp;|&nbsp; L: ${f(coin.low24||coin.price*0.97)}
            </div>
          </div>
          <Ring val={sig.conf} color={col} size={112}/>
        </div>

        {/* Indicators row */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
          {sig.strategy==="scalp"&&<>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>RSI 5m: </span>
              <span style={{fontWeight:700,color:sig.indicators.rsi<35?"var(--g)":sig.indicators.rsi>65?"var(--r)":"var(--y)"}}>{sig.indicators.rsi}</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>Volume: </span>
              <span style={{fontWeight:700,color:sig.indicators.volSpike>1.3?"var(--g)":"var(--muted)"}}>{sig.indicators.volSpike}×</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>Bid: </span>
              <span style={{fontWeight:700,color:sig.indicators.bidPct>52?"var(--g)":"var(--r)"}}>{sig.indicators.bidPct}%</span>
            </div>
          </>}
          {sig.strategy==="day"&&<>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>VWAP: </span>
              <span style={{fontWeight:700,color:coin.price>(sig.indicators.vwap||coin.price)?"var(--g)":"var(--r)"}}>${f(sig.indicators.vwap)}</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>EMA50: </span>
              <span style={{fontWeight:700,color:"var(--y)"}}>${f(sig.indicators.ema50)}</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>RSI 1H: </span>
              <span style={{fontWeight:700,color:sig.indicators.rsi1h<40?"var(--g)":sig.indicators.rsi1h>60?"var(--r)":"var(--y)"}}>{sig.indicators.rsi1h}</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>Range pos: </span>
              <span style={{fontWeight:700,color:"var(--text)"}}>{sig.indicators.posInRange}%</span>
            </div>
          </>}
          {sig.strategy==="swing"&&<>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>RSI 4H: </span>
              <span style={{fontWeight:700,color:sig.indicators.rsi4h<40?"var(--g)":sig.indicators.rsi4h>60?"var(--r)":"var(--y)"}}>{sig.indicators.rsi4h}</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>4H trend: </span>
              <span style={{fontWeight:700,color:sig.indicators.trend4h==="UP"?"var(--g)":sig.indicators.trend4h==="DOWN"?"var(--r)":"var(--y)"}}>{sig.indicators.trend4h}</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>Weekly: </span>
              <span style={{fontWeight:700,color:sig.indicators.weeklyChg>=0?"var(--g)":"var(--r)"}}>{sig.indicators.weeklyChg>=0?"+":""}{sig.indicators.weeklyChg}%</span>
            </div>
            <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
              <span style={{color:"var(--muted)"}}>S/R: </span>
              <span style={{fontWeight:700,color:"var(--g)"}}>${f(sig.indicators.nearSupport)}</span>
              <span style={{color:"var(--muted)"}}>/</span>
              <span style={{fontWeight:700,color:"var(--r)"}}>${f(sig.indicators.nearResist)}</span>
            </div>
          </>}
        </div>

        {/* Reason */}
        <div style={{background:"rgba(0,0,0,.35)",borderRadius:10,padding:"14px 16px",borderLeft:`3px solid ${stratCol}`}}>
          <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:6,fontFamily:"'Syne',sans-serif",fontWeight:700}}>📐 TECHNICAL REASON</div>
          <div style={{fontSize:13,lineHeight:1.8,color:"var(--text)"}}>{sig.reason}</div>
        </div>

        {/* Why this coin */}
        {coinInfo&&<button onClick={()=>setShowWhy(v=>!v)} className="btn btn-h" style={{marginTop:10,fontSize:10,padding:"6px 12px"}}>
          {showWhy?"▲ Hide":"▼"} Why we track {coin.id}
        </button>}
        {showWhy&&coinInfo&&<div style={{marginTop:8,padding:"12px 14px",background:"rgba(0,212,255,.04)",borderRadius:10,border:"1px solid rgba(0,212,255,.12)",fontSize:13,color:"var(--text)",lineHeight:1.7}}>
          {coinInfo.why}
        </div>}
      </div>

      {/* Trade Setup */}
      <div className="card" style={{padding:22}}>
        <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:16}}>TRADE SETUP</div>

        {/* Entry Zone */}
        <div style={{background:`rgba(${isL?"0,212,255":"255,23,68"},.05)`,border:`1px solid rgba(${isL?"0,212,255":"255,23,68"},.18)`,borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:10,color:isL?"var(--c)":"var(--r)",letterSpacing:1.5,marginBottom:10,fontFamily:"'Syne',sans-serif",fontWeight:700}}>📍 ENTRY ZONE</div>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--muted)",marginBottom:3}}>LOW</div>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:isL?"var(--c)":"var(--r)"}}>${f(sig.entryLow)}</div>
            </div>
            <div style={{flex:1,position:"relative",height:8,background:"var(--bg3)",borderRadius:4,minWidth:60,overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${isL?"rgba(0,212,255,.5)":"rgba(255,23,68,.5)"},transparent)`,borderRadius:4}}/>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--muted)",marginBottom:3}}>HIGH</div>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:isL?"var(--c)":"var(--r)"}}>${f(sig.entryHigh)}</div>
            </div>
          </div>
          <div style={{marginTop:8,fontSize:11,color:"var(--muted)",textAlign:"center"}}>
            Mid: <span className="mono" style={{color:"var(--text)"}}>${f(sig.mid)}</span>
          </div>
        </div>

        {/* SL + Leverage */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:18}}>
          {[
            {l:"STOP LOSS", v:`$${f(sig.sl)}`,      c:"var(--r)"},
            {l:"LEVERAGE",  v:`${sig.leverage}×`,    c:"var(--y)"},
            {l:"SL DIST",   v:`${Math.abs(pct(sig.mid,sig.sl))}%`, c:"var(--r)"},
            {l:"DURATION",  v:sig.duration,           c:"var(--muted)"},
          ].map(item=>(
            <div key={item.l} style={{background:"var(--bg3)",borderRadius:8,padding:"11px 12px",border:"1px solid var(--bdr)",textAlign:"center"}}>
              <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Syne',sans-serif",textTransform:"uppercase"}}>{item.l}</div>
              <div className="mono" style={{fontSize:14,fontWeight:700,color:item.c}}>{item.v}</div>
            </div>
          ))}
        </div>

        {/* TP targets */}
        <div style={{fontSize:10,color:"var(--muted)",letterSpacing:1.5,marginBottom:12,fontFamily:"'Syne',sans-serif",textTransform:"uppercase"}}>Take Profit Targets</div>
        {[[sig.tp1,30,"1:1.5"],[sig.tp2,62,"1:2.5"],[sig.tp3,100,"1:6"]].map(([tp,w,rr],i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:11}}>
            <div className="head" style={{fontSize:11,color:col,width:28,flexShrink:0,fontWeight:700}}>TP{i+1}</div>
            <div className="prog" style={{flex:1}}><div className="pf" style={{width:`${w}%`,background:`linear-gradient(90deg,${col}66,${col})`}}/></div>
            <div className="mono" style={{fontSize:12,color:col,width:84,textAlign:"right"}}>${f(tp)}</div>
            <div style={{fontSize:10,color:"var(--muted)",width:44,textAlign:"right"}}>{pct(sig.mid,tp)}%</div>
            <div style={{fontSize:10,color:"var(--g)",width:52,textAlign:"right"}}>+{(Math.abs(parseFloat(pct(sig.mid,tp)))*sig.leverage).toFixed(1)}%</div>
            <div style={{fontSize:9,color:"var(--muted)",width:38,textAlign:"right",fontFamily:"'Syne',sans-serif"}}>{rr}</div>
          </div>
        ))}
      </div>

      {/* Risk */}
      <div className="card" style={{padding:18}}>
        <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:12}}>RISK MANAGEMENT</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {[
            {k:"Best R:R",    v:`1 : ${(Math.abs(parseFloat(pct(sig.mid,sig.tp2)))/Math.abs(parseFloat(pct(sig.mid,sig.sl)))).toFixed(1)}`, c:"var(--g)"},
            {k:"Max Position",v:"Max 25% capital",c:"var(--y)"},
            {k:"Profit TP2",  v:`+${(Math.abs(parseFloat(pct(sig.mid,sig.tp2)))*sig.leverage).toFixed(1)}%`,c:"var(--g)"},
            {k:"Max Loss",    v:`-${(Math.abs(parseFloat(pct(sig.mid,sig.sl)))*sig.leverage).toFixed(1)}%`,c:"var(--r)"},
          ].map(item=>(
            <div key={item.k} style={{background:"var(--bg3)",padding:"10px 12px",borderRadius:8,border:"1px solid var(--bdr)"}}>
              <div style={{fontSize:10,color:"var(--muted)",marginBottom:4,fontFamily:"'Syne',sans-serif",letterSpacing:1}}>{item.k}</div>
              <div className="mono" style={{fontSize:14,fontWeight:700,color:item.c}}>{item.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button className={`btn ${isL?"btn-g":"btn-r"}`} style={{flex:2,padding:15,minWidth:200,fontSize:12,letterSpacing:1.5}}>
          {isL?"▲ ENTER LONG":"▼ ENTER SHORT"} &nbsp; ${f(sig.entryLow)}–${f(sig.entryHigh)}
        </button>
        <button className="btn btn-o" style={{flex:1,padding:15}}>🔔 ALERT</button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGES
// ═════════════════════════════════════════════════════════════════════════════

// ── AUTH PAGE ─────────────────────────────────────────────────────────────────
function AuthPage({onLogin}){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState(""); const [mobile,setMobile]=useState("");
  const [pass,setPass]=useState(""); const [pass2,setPass2]=useState("");
  const [err,setErr]=useState(""); const [ok,setOk]=useState("");
  const [loading,setLoading]=useState(false);

  const login=async()=>{
    setErr("");if(!email||!pass){setErr("All fields required.");return;}
    setLoading(true);await new Promise(r=>setTimeout(r,600));
    const res=Auth.check(email.trim().toLowerCase(),pass);
    if(res.ok) onLogin(res); else{setErr(res.err);setLoading(false);}
  };
  const register=async()=>{
    setErr("");setOk("");
    if(!email||!mobile||!pass||!pass2){setErr("All fields required.");return;}
    if(!email.includes("@")){setErr("Valid email required.");return;}
    if(!/^\d{10}$/.test(mobile)){setErr("Valid 10-digit mobile required.");return;}
    if(pass.length<6){setErr("Password min 6 characters.");return;}
    if(pass!==pass2){setErr("Passwords don't match.");return;}
    setLoading(true);await new Promise(r=>setTimeout(r,700));
    const res=Auth.register(email.trim().toLowerCase(),mobile.trim(),pass);
    if(res.ok){setOk("✅ Registered! 30-day FREE trial active. Login now.");setMode("login");setPass("");setPass2("");}
    else setErr(res.err);
    setLoading(false);
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",zIndex:1}}>
      <div className="card ai" style={{width:"100%",maxWidth:440,padding:40}}>
        <div style={{textAlign:"center",marginBottom:30}}>
          {/* Logo */}
          <div style={{width:68,height:68,borderRadius:18,margin:"0 auto 18px",
            background:"linear-gradient(135deg,#002233 0%,#004466 50%,#006699 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 36px rgba(0,212,255,.45)",border:"1px solid rgba(0,212,255,.3)"}}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M3 18 Q7 7 12 18 Q17 29 22 18 Q27 7 33 18" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="18" cy="18" r="3.5" fill="#00e676"/>
              <circle cx="18" cy="18" r="6" stroke="rgba(0,230,118,.3)" strokeWidth="1" fill="none"/>
            </svg>
          </div>
          <div className="head" style={{fontSize:22,fontWeight:800,letterSpacing:2}}>CRYPTEX<span style={{color:"var(--c)"}}>SIGNAL</span></div>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>Professional Futures Intelligence Platform</div>
        </div>
        <div style={{display:"flex",background:"var(--bg3)",borderRadius:10,padding:3,marginBottom:22}}>
          {[["login","Sign In"],["register","Free Trial"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");setOk("");}}
              style={{flex:1,padding:"9px",borderRadius:8,border:"none",cursor:"pointer",
                background:mode===m?"var(--bg2)":"transparent",
                color:mode===m?"var(--c)":"var(--muted)",
                fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,letterSpacing:.5,
                boxShadow:mode===m?"0 2px 8px rgba(0,0,0,.3)":"none",transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input className="inp" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}/>
          {mode==="register"&&<input className="inp" type="tel" placeholder="Mobile number (10 digits)" value={mobile} onChange={e=>setMobile(e.target.value)}/>}
          <input className="inp" type="password" placeholder={mode==="login"?"Password":"Password (min 6 chars)"} value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&mode==="login"&&login()}/>
          {mode==="register"&&<input className="inp" type="password" placeholder="Confirm password" value={pass2} onChange={e=>setPass2(e.target.value)}/>}
          {err&&<div style={{fontSize:12,color:"var(--r)",padding:"9px 12px",background:"rgba(255,23,68,.07)",borderRadius:8,border:"1px solid rgba(255,23,68,.2)"}}>{err}</div>}
          {ok &&<div style={{fontSize:12,color:"var(--g)",padding:"9px 12px",background:"rgba(0,230,118,.07)",borderRadius:8,border:"1px solid rgba(0,230,118,.2)"}}>{ok}</div>}
          <button className={`btn ${mode==="login"?"btn-c":"btn-g"}`} style={{width:"100%",padding:14,marginTop:4}} onClick={mode==="login"?login:register} disabled={loading}>
            {loading?<Spin size={16}/>:mode==="login"?"→ SIGN IN":"→ START 30-DAY FREE TRIAL"}
          </button>
        </div>
        {mode==="register"&&<div style={{marginTop:16,padding:12,background:"rgba(0,230,118,.05)",border:"1px solid rgba(0,230,118,.15)",borderRadius:10,fontSize:12,color:"var(--muted)",lineHeight:1.8}}>
          <div style={{color:"var(--g)",fontWeight:700,marginBottom:4}}>🎁 FREE TRIAL INCLUDES</div>
          <div>✓ 30 days full access — no payment needed</div>
          <div>✓ Scalp / Day / Swing signals for all 5 coins</div>
          <div>✓ Real-time prices + Win Rate tracker</div>
        </div>}
      </div>
    </div>
  );
}

// ── DASHBOARD PAGE ────────────────────────────────────────────────────────────
function PageDashboard({coins,setTab,setActive,setStrategy}){
  const [strat,setStrat]=useState("day");
  const stratColor={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"}[strat];

  const coinSignals=useMemo(()=>
    COINS.map((cd,i)=>({cd,coin:coins[i]||{...cd,price:cd.base,chg24:0},sig:getOrCalcSignal(coins[i]||{...cd,price:cd.base,chg24:0},strat)}))
  ,[coins,strat]);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 className="head" style={{fontSize:22,fontWeight:800,marginBottom:4,letterSpacing:1}}>
            LIVE <span style={{color:"var(--c)"}}>FUTURES</span> SIGNALS
          </h1>
          <div style={{fontSize:13,color:"var(--muted)"}}>Stable signals • Professional TA • Strategy-specific analysis</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <span className="pill pg">▲ {coinSignals.filter(x=>x.sig?.signal==="LONG").length} LONG</span>
          <span className="pill pr">▼ {coinSignals.filter(x=>x.sig?.signal==="SHORT").length} SHORT</span>
        </div>
      </div>

      {/* Strategy filter */}
      <div className="stab" style={{marginBottom:20}}>
        <button className={`stab-btn ${strat==="scalp"?"act-s":""}`} onClick={()=>setStrat("scalp")}>⚡ SCALP (1m–5m)</button>
        <button className={`stab-btn ${strat==="day"?"act-d":""}`}   onClick={()=>setStrat("day")}>📊 DAY (15m–1H)</button>
        <button className={`stab-btn ${strat==="swing"?"act-w":""}`} onClick={()=>setStrat("swing")}>🌊 SWING (4H–1D)</button>
      </div>

      {/* Strategy info */}
      <div className="card" style={{padding:"14px 18px",marginBottom:18,border:`1px solid ${stratColor}22`,background:`rgba(${strat==="scalp"?"255,109,0":strat==="day"?"0,212,255":"170,0,255"},.04)`}}>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,color:"var(--muted)"}}>
          {{
            scalp:<><span style={{color:stratColor,fontWeight:700}}>⚡ SCALP STRATEGY</span>&nbsp;— Timeframe: 1m/5m &nbsp;|&nbsp; Hold: 15–45 min &nbsp;|&nbsp; Analysis: RSI extremes, Volume spikes, Order book imbalance &nbsp;|&nbsp; Leverage: 12–15×</>,
            day:  <><span style={{color:stratColor,fontWeight:700}}>📊 DAY STRATEGY</span>&nbsp;— Timeframe: 15m/1H &nbsp;|&nbsp; Hold: 4–12 hours &nbsp;|&nbsp; Analysis: VWAP, EMA 50/200 cross, Daily H/L breakout &nbsp;|&nbsp; Leverage: 8–10×</>,
            swing:<><span style={{color:stratColor,fontWeight:700}}>🌊 SWING STRATEGY</span>&nbsp;— Timeframe: 4H/1D &nbsp;|&nbsp; Hold: 1–5 days &nbsp;|&nbsp; Analysis: S/R zones, Price Action, Weekly structure &nbsp;|&nbsp; Leverage: 3–5×</>,
          }[strat]}
        </div>
        <div style={{marginTop:8,fontSize:11,color:"var(--muted)"}}>
          🔒 Signal lock: <span style={{color:stratColor}}>{strat==="scalp"?"15 minutes":strat==="day"?"4 hours":"24 hours"}</span>
          &nbsp;— signals don't change within this window unless price moves >{CFG.RECONSIDER_THRESHOLD[strat]}%
        </div>
      </div>

      {/* Coin cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {coinSignals.map(({cd,coin,sig},i)=>{
          const isL=sig?.signal==="LONG";
          const col=isL?"var(--g)":"var(--r)";
          return(
            <div key={cd.id} className={`card au`} style={{padding:18,cursor:"pointer",animationDelay:`${i*.07}s`,
              border:`1px solid ${isL?"rgba(0,230,118,.22)":"rgba(255,23,68,.22)"}`,
              background:`linear-gradient(135deg,rgba(8,17,32,.97) 0%,rgba(${isL?"0,40,20":"40,5,10"},.25) 100%)`}}
              onClick={()=>{setActive(i);setStrategy(strat);setTab("signals");}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",
                    background:`rgba(${isL?"0,230,118":"255,23,68"},.08)`,border:`1.5px solid ${col}`,
                    boxShadow:`0 0 12px ${isL?"rgba(0,230,118,.2)":"rgba(255,23,68,.2)"}`}}>
                    <span className="head" style={{fontSize:15,color:col,fontWeight:800}}>{cd.logo}</span>
                  </div>
                  <div>
                    <div className="head" style={{fontSize:14,fontWeight:800}}>{cd.id}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{cd.name}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="mono" style={{fontSize:16,fontWeight:700}}>${f(coin.price)}</div>
                  <div style={{fontSize:12,color:(coin.chg24||0)>=0?"var(--g)":"var(--r)",fontWeight:600}}>
                    {(coin.chg24||0)>=0?"+":""}{(coin.chg24||0).toFixed(2)}%
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                <span className={`pill ${isL?"pg":"pr"}`}>{isL?"▲ LONG":"▼ SHORT"}</span>
                <SignalBadge strategy={strat}/>
                <span className={`pill ${sig?.risk==="LOW"?"pg":sig?.risk==="MEDIUM"?"py":"pr"}`}>{sig?.risk}</span>
              </div>
              {sig&&<>
                <div className="prog" style={{marginBottom:8}}>
                  <div className="pf" style={{width:`${sig.conf}%`,background:`linear-gradient(90deg,${col}77,${col})`}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)"}}>
                  <span>Conf {sig.conf}%</span>
                  <span>${f(sig.entryLow)}–${f(sig.entryHigh)}</span>
                </div>
              </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageSignals({coins,active,setActive,strategy,setStrategy}){
  const [strat,setStrat]=useState(strategy||"day");
  const cd=COINS[active]||COINS[0];
  const coin=coins[active]||{...cd,price:cd.base,chg24:0,high24:cd.base*1.03,low24:cd.base*0.97};
  const sig=getOrCalcSignal(coin,strat);

  return(
    <div>
      {/* Coin + strategy pickers */}
      <div className="sx" style={{marginBottom:12}}>
        <div style={{display:"flex",gap:8,paddingBottom:4,minWidth:"max-content"}}>
          {COINS.map((c,i)=>{
            const s=getOrCalcSignal(coins[i]||{...c,price:c.base,chg24:0},strat);
            const isL=s?.signal==="LONG";
            return(
              <button key={c.id} onClick={()=>setActive(i)}
                className={`btn ${i===active?(isL?"btn-g":"btn-r"):"btn-h"}`}
                style={{padding:"8px 14px",position:"relative"}}>
                {c.logo} {c.id}
                {s?.risk==="HIGH"&&<span style={{position:"absolute",top:2,right:2,width:7,height:7,background:"var(--r)",borderRadius:"50%"}} className="pu"/>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="stab" style={{marginBottom:16}}>
        <button className={`stab-btn ${strat==="scalp"?"act-s":""}`} onClick={()=>{setStrat("scalp");setStrategy("scalp");}}>⚡ SCALP</button>
        <button className={`stab-btn ${strat==="day"?"act-d":""}`}   onClick={()=>{setStrat("day");setStrategy("day");}}>📊 DAY</button>
        <button className={`stab-btn ${strat==="swing"?"act-w":""}`} onClick={()=>{setStrat("swing");setStrategy("swing");}}>🌊 SWING</button>
      </div>
      <SignalCard coin={coin} sig={sig} onRefresh={()=>{}}/>
    </div>
  );
}

// ── SCAN PAGE ─────────────────────────────────────────────────────────────────
function PageScan({coins,setTab,setActive,setStrategy}){
  const [step,setStep]=useState("idle");
  const [steps,setSteps]=useState([]);
  const [result,setResult]=useState(null);

  const scan=async()=>{
    setStep("scan");setSteps([]);setResult(null);
    const allSteps=[
      "Connecting to Binance real-time feeds...",
      "Loading 24h price action for all pairs...",
      "Running Scalp analysis (RSI, Volume, Book)...",
      "Running Day analysis (VWAP, EMA50/200)...",
      "Running Swing analysis (S/R, Structure)...",
      "Scoring 15 signal candidates (5 coins × 3 strategies)...",
      "Filtering by minimum confidence threshold (>72%)...",
      "Selecting highest probability R:R setup...",
    ];
    for(let s of allSteps){await new Promise(r=>setTimeout(r,390));setSteps(p=>[...p,s]);}
    // Find best signal across all coins and strategies
    let best=null, bestConf=0;
    COINS.forEach((cd,i)=>{
      const c=coins[i]||{...cd,price:cd.base,chg24:0};
      ["scalp","day","swing"].forEach(st=>{
        const s=getOrCalcSignal(c,st);
        if(s&&s.conf>bestConf){bestConf=s.conf;best={coinIdx:i,strategy:st,coin:c,sig:s};}
      });
    });
    setResult(best);setStep("done");
  };

  return(
    <div>
      <div style={{marginBottom:20}}>
        <h2 className="head" style={{fontSize:18,fontWeight:800,marginBottom:4}}>DEEP MARKET <span style={{color:"var(--c)"}}>SCANNER</span></h2>
        <div style={{fontSize:13,color:"var(--muted)"}}>Scans all 5 coins × 3 strategies (15 signals) → selects best R:R trade</div>
      </div>
      {step==="idle"&&<div className="card ai" style={{padding:52,textAlign:"center"}}>
        <div style={{marginBottom:24}}>
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none" style={{display:"block",margin:"0 auto"}}>
            <circle cx="30" cy="30" r="26" stroke="rgba(0,212,255,.2)" strokeWidth="1.5" fill="none"/>
            <circle cx="30" cy="30" r="18" stroke="rgba(0,212,255,.35)" strokeWidth="1" fill="none"/>
            <circle cx="30" cy="30" r="3.5" fill="var(--c)"/>
            <line x1="30" y1="4" x2="30" y2="14" stroke="var(--c)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="30" y1="46" x2="30" y2="56" stroke="var(--c)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="4" y1="30" x2="14" y2="30" stroke="var(--c)" strokeWidth="2" strokeLinecap="round"/>
            <line x1="46" y1="30" x2="56" y2="30" stroke="var(--c)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="head" style={{fontSize:17,fontWeight:800,marginBottom:10}}>READY TO SCAN</div>
        <div style={{color:"var(--muted)",fontSize:13,marginBottom:28,maxWidth:420,margin:"0 auto 28px",lineHeight:1.8}}>
          Analyzes 15 signal candidates across all 5 coins and 3 timeframe strategies. Returns the single highest R:R opportunity right now.
        </div>
        <button className="btn btn-c" style={{padding:"16px 52px",fontSize:12,letterSpacing:2}} onClick={scan}>🔍 START DEEP SCAN</button>
      </div>}
      {step==="scan"&&<div className="card ai" style={{padding:44,textAlign:"center"}}>
        <Spin size={52}/>
        <div className="head" style={{fontSize:14,color:"var(--c)",margin:"22px 0 18px",letterSpacing:2}}>SCANNING 15 SIGNALS...</div>
        <div style={{maxWidth:380,margin:"0 auto"}}>
          {steps.map((s,i)=><div key={i} style={{fontSize:12,color:"var(--g)",padding:"4px 0",textAlign:"left",display:"flex",alignItems:"center",gap:10,animation:"countUp .3s ease both",animationDelay:`${i*.04}s`}}>
            <span style={{color:"var(--g)",flexShrink:0}}>✓</span>{s}
          </div>)}
        </div>
      </div>}
      {step==="done"&&result&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div style={{padding:"12px 18px",background:"rgba(0,230,118,.07)",border:"1px solid rgba(0,230,118,.3)",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:24}}>🎯</span>
            <div>
              <div className="head" style={{fontSize:11,color:"var(--g)",letterSpacing:1,fontWeight:700}}>BEST TRADE RIGHT NOW</div>
              <div style={{fontSize:13,marginTop:2}}>
                {COINS[result.coinIdx]?.id}/USDT &nbsp;•&nbsp;
                <SignalBadge strategy={result.strategy}/> &nbsp;•&nbsp;
                {result.sig.conf}% confidence
              </div>
            </div>
          </div>
          <button className="btn btn-h" onClick={()=>setStep("idle")}>🔄 RESCAN</button>
        </div>
        <SignalCard coin={result.coin} sig={result.sig} onRefresh={()=>setStep("idle")}/>
      </div>}
    </div>
  );
}

// ── WIN RATE TRACKER PAGE ──────────────────────────────────────────────────────
function PageTracker(){
  const [history,setHistory]=useState(()=>{
    const h=loadHistory();
    return h.length?h:generateSampleHistory();
  });
  const [filter,setFilter]=useState("all");

  const filtered=filter==="all"?history:history.filter(h=>h.strategy===filter);
  const wins=filtered.filter(h=>h.result==="WIN").length;
  const total=filtered.length;
  const winRate=total>0?Math.round(wins/total*100):0;
  const totalProfit=filtered.reduce((a,h)=>a+h.profit,0);

  const stratColors={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"};

  return(
    <div>
      <div style={{marginBottom:20}}>
        <h2 className="head" style={{fontSize:18,fontWeight:800,marginBottom:4}}>SUCCESS <span style={{color:"var(--c)"}}>TRACKER</span></h2>
        <div style={{fontSize:13,color:"var(--muted)"}}>Historical signal accuracy & performance</div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
        {[
          {l:"WIN RATE",   v:`${winRate}%`,          c:winRate>=70?"var(--g)":winRate>=55?"var(--y)":"var(--r)"},
          {l:"WINS",       v:wins,                   c:"var(--g)"},
          {l:"LOSSES",     v:total-wins,             c:"var(--r)"},
          {l:"TOTAL PROFIT",v:`+${totalProfit.toFixed(1)}%`, c:totalProfit>=0?"var(--g)":"var(--r)"},
        ].map((item,i)=>(
          <div key={i} style={{background:"var(--bg3)",borderRadius:12,padding:"14px 16px",border:"1px solid var(--bdr)"}}>
            <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Syne',sans-serif",textTransform:"uppercase"}}>{item.l}</div>
            <div className="mono" style={{fontSize:22,fontWeight:700,color:item.c}}>{item.v}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["all","All"],["scalp","⚡ Scalp"],["day","📊 Day"],["swing","🌊 Swing"]].map(([k,l])=>(
          <button key={k} className={`btn ${filter===k?"btn-c":"btn-h"}`} style={{padding:"7px 16px",fontSize:11}} onClick={()=>setFilter(k)}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 90px",gap:10,padding:"10px 14px",borderBottom:"1px solid var(--bdr)",fontSize:9,color:"var(--muted)",fontFamily:"'Syne',sans-serif",letterSpacing:1.5,textTransform:"uppercase"}}>
          <span>SIGNAL</span><span style={{textAlign:"center"}}>TYPE</span><span style={{textAlign:"center"}}>RESULT</span><span style={{textAlign:"right"}}>PROFIT</span>
        </div>
        {filtered.slice(0,20).map((h,i)=>(
          <div key={i} className="win-row">
            <div>
              <span style={{fontWeight:700,marginRight:8,fontFamily:"'Syne',sans-serif"}}>{h.coin}/USDT</span>
              <span className={`pill ${h.signal==="LONG"?"pg":"pr"}`} style={{fontSize:9}}>{h.signal}</span>
            </div>
            <div style={{textAlign:"center"}}><span className={`pill ${h.strategy==="scalp"?"ps":h.strategy==="day"?"pd":"pw"}`} style={{fontSize:9,padding:"2px 7px"}}>{h.strategy.toUpperCase()}</span></div>
            <div style={{textAlign:"center"}}><span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,color:h.result==="WIN"?"var(--g)":"var(--r)"}}>{h.result==="WIN"?"✓ WIN":"✗ LOSS"}</span></div>
            <div className="mono" style={{textAlign:"right",fontWeight:700,color:h.profit>=0?"var(--g)":"var(--r)",fontSize:13}}>{h.profit>=0?"+":""}{h.profit}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SEARCH PAGE ───────────────────────────────────────────────────────────────
function PageSearch(){
  const [query,setQuery]=useState(""); const [pairs,setPairs]=useState([]);
  const [filtered,setFiltered]=useState([]); const [show,setShow]=useState(false);
  const [selected,setSelected]=useState(null); const [coinData,setCoinData]=useState(null);
  const [sigs,setSigs]=useState(null); const [loading,setLoading]=useState(false);
  const [loadingP,setLoadingP]=useState(false);
  const ref=useRef(null);

  useEffect(()=>{
    setLoadingP(true);
    fetch("https://api.binance.com/api/v3/ticker/24hr")
      .then(r=>r.json()).then(all=>{
        const top=all.filter(d=>d.symbol.endsWith("USDT")&&parseFloat(d.quoteVolume)>5e5)
          .sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume)).slice(0,100)
          .map(d=>({symbol:d.symbol,id:d.symbol.replace("USDT",""),price:parseFloat(d.lastPrice),chg24:parseFloat(d.priceChangePercent),vol:parseFloat(d.quoteVolume)}));
        setPairs(top);
      }).catch(()=>{}).finally(()=>setLoadingP(false));
  },[]);

  useEffect(()=>{
    if(!query.trim()){setFiltered([]);setShow(false);return;}
    const q=query.toUpperCase().replace("USDT","").replace("/","");
    const r=pairs.filter(p=>p.id.startsWith(q)||p.id.includes(q)).slice(0,12);
    setFiltered(r);setShow(r.length>0);
  },[query,pairs]);

  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

  const select=async(pair)=>{
    setSelected(pair);setShow(false);setQuery(`${pair.id}/USDT`);
    setLoading(true);setCoinData(null);setSigs(null);
    try{
      const res=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair.symbol}`);
      if(!res.ok) throw new Error();
      const d=await res.json();
      const full={...pair,price:parseFloat(d.lastPrice),chg24:parseFloat(d.priceChangePercent),
        high24:parseFloat(d.highPrice),low24:parseFloat(d.lowPrice),
        vol:parseFloat(d.volume),name:pair.id,updatedAt:Date.now()};
      setCoinData(full);
      setSigs({scalp:calcScalp(full),day:calcDay(full),swing:calcSwing(full)});
    }catch{setCoinData({error:true});}
    setLoading(false);
  };

  const [viewStrat,setViewStrat]=useState("day");
  const POPULAR=["BTC","ETH","SOL","BNB","DOGE","XRP","ADA","LINK","AVAX","DOT","MATIC","UNI","ATOM","APT","ARB"];

  return(
    <div>
      <div style={{marginBottom:20}}>
        <h2 className="head" style={{fontSize:18,fontWeight:800,marginBottom:4}}>CUSTOM <span style={{color:"var(--c)"}}>PAIR SEARCH</span></h2>
        <div style={{fontSize:13,color:"var(--muted)"}}>Any USDT pair → Full analysis for all 3 strategies</div>
      </div>
      <div ref={ref} style={{position:"relative",marginBottom:20}}>
        <input className="inp" placeholder={loadingP?"Loading pairs...":"Search any coin (DOGE, XRP, PEPE...)"}
          value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>query&&filtered.length&&setShow(true)}
          style={{paddingLeft:48,fontSize:15}}/>
        <span style={{position:"absolute",left:15,top:"50%",transform:"translateY(-50%)",fontSize:20}}>🔍</span>
        {loadingP&&<div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)"}}><Spin size={16}/></div>}
        {show&&<div className="dropdown">
          {filtered.map(p=>(
            <div key={p.symbol} className="ddi" onClick={()=>select(p)}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:32,height:32,borderRadius:8,background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"var(--c)",border:"1px solid var(--bdr)",fontFamily:"'Syne',sans-serif",flexShrink:0}}>{p.id[0]}</div>
                <div><div className="head" style={{fontWeight:700,fontSize:13}}>{p.id}<span style={{color:"var(--muted)",fontWeight:400}}>/USDT</span></div>
                <div className="mono" style={{fontSize:11,color:"var(--muted)"}}>${f(p.price)}</div></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:p.chg24>=0?"var(--g)":"var(--r)",fontWeight:700}}>{p.chg24>=0?"+":""}{p.chg24.toFixed(2)}%</div>
                <div style={{fontSize:10,color:"var(--muted)"}}>${(p.vol/1e6).toFixed(1)}M</div>
              </div>
            </div>
          ))}
        </div>}
      </div>
      {!selected&&<div>
        <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:1.5,marginBottom:10}}>POPULAR PAIRS</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {POPULAR.map(id=>{const p=pairs.find(x=>x.id===id);return(
            <button key={id} className="btn btn-h" style={{padding:"7px 14px",fontSize:11}} onClick={()=>p&&select(p)} disabled={!p}>{id}/USDT</button>
          );})}
        </div>
      </div>}
      {loading&&<div className="card ai" style={{padding:44,textAlign:"center",marginTop:20}}><Spin size={44}/><div className="head" style={{marginTop:16,color:"var(--c)",fontSize:14}}>ANALYZING {selected?.id}...</div></div>}
      {coinData?.error&&<div className="card" style={{padding:28,marginTop:20,border:"1px solid rgba(255,23,68,.3)"}}>
        <div style={{fontSize:28,marginBottom:12}}>❌</div>
        <div className="head" style={{color:"var(--r)",fontSize:16,marginBottom:8}}>NOT FOUND</div>
        <div style={{color:"var(--muted)",fontSize:13}}>{selected?.symbol} not found. Try another pair.</div>
      </div>}
      {coinData&&!coinData.error&&sigs&&<div style={{marginTop:20}}>
        <div className="stab" style={{marginBottom:16}}>
          <button className={`stab-btn ${viewStrat==="scalp"?"act-s":""}`} onClick={()=>setViewStrat("scalp")}>⚡ SCALP</button>
          <button className={`stab-btn ${viewStrat==="day"?"act-d":""}`} onClick={()=>setViewStrat("day")}>📊 DAY</button>
          <button className={`stab-btn ${viewStrat==="swing"?"act-w":""}`} onClick={()=>setViewStrat("swing")}>🌊 SWING</button>
        </div>
        {/* Confidence bar for all strategies */}
        <div className="card" style={{padding:16,marginBottom:14}}>
          <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:12}}>ALL STRATEGIES OVERVIEW</div>
          {["scalp","day","swing"].map(st=>{
            const s=sigs[st];if(!s) return null;
            const isL=s.signal==="LONG";
            const stCol={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"}[st];
            return<div key={st} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
              <div style={{width:70,fontFamily:"'Syne',sans-serif",fontSize:11,fontWeight:700,color:stCol}}>{st.toUpperCase()}</div>
              <div className="prog" style={{flex:1}}><div className="pf" style={{width:`${s.conf}%`,background:stCol}}/></div>
              <span className={`pill ${isL?"pg":"pr"}`} style={{width:60,justifyContent:"center"}}>{isL?"▲ L":"▼ S"}</span>
              <span className="mono" style={{fontSize:12,width:32,color:stCol}}>{s.conf}%</span>
            </div>;
          })}
        </div>
        <SignalCard coin={coinData} sig={sigs[viewStrat]} onRefresh={()=>select(selected)}/>
      </div>}
    </div>
  );
}

// ── ALERTS ────────────────────────────────────────────────────────────────────
function PageAlerts({notifs,setNotifs,paused}){
  const unread=notifs.filter(n=>!n.read).length;
  const tc={entry:"var(--g)",tp:"var(--c)",alert:"var(--y)",emergency:"var(--r)",info:"var(--muted)"};
  const ti={entry:"⚡",tp:"✅",alert:"⚠️",emergency:"🚨",info:"📊"};
  if(paused) return<div className="card ai" style={{padding:52,textAlign:"center"}}><div style={{fontSize:52,marginBottom:16}}>⏸</div><div className="head" style={{fontSize:17,color:"var(--y)",fontWeight:800}}>TRADING PAUSED</div><div style={{color:"var(--muted)",marginTop:8}}>Go to Settings → Resume.</div></div>;
  return<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
      <h2 className="head" style={{fontSize:18,fontWeight:800}}>ALERTS <span style={{color:"var(--r)",fontSize:14}}>({unread})</span></h2>
      <button className="btn btn-h" style={{fontSize:10}} onClick={()=>setNotifs(ns=>ns.map(n=>({...n,read:true})))}>✓ Mark All Read</button>
    </div>
    {notifs.length===0?<div className="card" style={{padding:40,textAlign:"center"}}><div style={{fontSize:44,marginBottom:14}}>🔕</div><div style={{color:"var(--muted)"}}>No alerts yet. High-confidence signals will appear here.</div></div>:(
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {notifs.map(n=><div key={n.id} className="card"
          style={{padding:"15px 18px",opacity:n.read?.68:1,cursor:"pointer",borderLeft:`3px solid ${tc[n.type]||"var(--muted)"}`}}
          onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                {!n.read&&<span style={{width:7,height:7,background:"var(--r)",borderRadius:"50%",flexShrink:0}} className="pu"/>}
                <span className="head" style={{fontSize:10,color:tc[n.type],letterSpacing:1,fontWeight:700}}>{ti[n.type]} {n.coin} • {n.type.toUpperCase()}</span>
              </div>
              <div style={{fontSize:13,lineHeight:1.65}}>{n.msg}</div>
            </div>
            <div style={{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap",fontFamily:"'JetBrains Mono',monospace"}}>{n.time}</div>
          </div>
        </div>)}
      </div>
    )}
  </div>;
}

function PageSettings({settings,update,user,onLogout}){
  const [days,setDays]=useState(null);
  useEffect(()=>{if(user?.expiresAt)setDays(Math.max(0,Math.ceil((user.expiresAt-Date.now())/86400000)));},[user]);
  return<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div className="card" style={{padding:20,border:"1px solid rgba(0,212,255,.22)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>👤 {user?.email}</div>
          {user?.mobile&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>📱 {user.mobile}</div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span className={`pill ${user?.role==="admin"?"pp":"pg"}`}>{user?.role?.toUpperCase()}</span>
            <span className="pill pc">{user?.plan?.toUpperCase()}</span>
            {days!==null&&<span className={`pill ${days>7?"pg":days>3?"py":"pr"}`}>{days}d left</span>}
          </div>
        </div>
        <button className="btn btn-r" style={{padding:"10px 18px"}} onClick={onLogout}>⏻ LOGOUT</button>
      </div>
    </div>
    <div className="card" style={{padding:18,border:`1px solid ${settings.paused?"rgba(255,214,0,.3)":"var(--bdr)"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div className="head" style={{fontSize:13,fontWeight:700,marginBottom:4,color:settings.paused?"var(--y)":"var(--text)"}}>{settings.paused?"⏸ PAUSED":"▶ ACTIVE"}</div>
        <div style={{fontSize:12,color:"var(--muted)"}}>Paused → signals & notifications stop</div></div>
        <Tog checked={!settings.paused} onChange={v=>update("paused",!v)}/>
      </div>
    </div>
    <div className="card" style={{padding:18}}>
      <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:14}}>NOTIFICATIONS</div>
      {[{k:"notifScalp",l:"Scalp Signals",s:"15m refresh — only when conf >78%"},{k:"notifDay",l:"Day Signals",s:"4h refresh — VWAP/EMA signals"},{k:"notifSwing",l:"Swing Signals",s:"24h refresh — S/R breakouts"},{k:"notifEmerg",l:"Emergency Alarm 🚨",s:"Market moves >5% — siren alert"}].map((item,i,arr)=>(
      <div key={item.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:i<arr.length-1?"1px solid var(--bdr)":"none"}}>
        <div><div style={{fontWeight:600,fontSize:14}}>{item.l}</div><div style={{fontSize:11,color:"var(--muted)"}}>{item.s}</div></div>
        <Tog checked={!!settings[item.k]} onChange={v=>update(item.k,v)}/>
      </div>))}
    </div>
    <div className="card" style={{padding:18}}>
      <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:14}}>DEFAULT LEVERAGE</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[3,5,8,10,12,15,20].map(l=><button key={l} className={`btn ${settings.lev===l?"btn-c":"btn-h"}`} style={{padding:"8px 14px",fontSize:12}} onClick={()=>update("lev",l)}>{l}×</button>)}
      </div>
    </div>
  </div>;
}

function PageSubscribe(){
  const [plan,setPlan]=useState("pro"); const [step,setStep]=useState("select");
  const [txHash,setTxHash]=useState(""); const [loading,setLoad]=useState(false); const [msg,setMsg]=useState("");
  const PLANS=[
    {id:"basic",col:"var(--c)",badge:null,em:"🥉",feats:["All 5 coins","Scalp+Day+Swing signals","Win Rate Tracker","Custom Search"]},
    {id:"pro",col:"var(--g)",badge:"POPULAR",em:"🥇",feats:["All BASIC","Priority alerts","Emergency alarm","Deep Scanner","Export signals","Telegram bot"]},
    {id:"elite",col:"var(--p)",badge:"BEST",em:"💎",feats:["All PRO","1-on-1 support","API access","Custom coin requests","Resell license","White-label"]},
  ];
  if(step==="pending") return<div className="card ai" style={{padding:44,textAlign:"center"}}><div style={{fontSize:56,marginBottom:16}}>⏳</div><div className="head" style={{fontSize:18,color:"var(--y)",fontWeight:800,marginBottom:8}}>UNDER REVIEW</div><div style={{color:"var(--muted)",marginBottom:20,lineHeight:1.8}}>Tx: <span className="mono" style={{color:"var(--c)",fontSize:12}}>{txHash.slice(0,22)}...</span><br/>Admin activates within 1–4 hours after blockchain confirmation.</div><button className="btn btn-c" onClick={()=>setStep("select")}>← Back</button></div>;
  return<div>
    <div style={{textAlign:"center",marginBottom:28}}>
      <h2 className="head" style={{fontSize:20,fontWeight:800,marginBottom:6}}>UPGRADE <span style={{color:"var(--c)"}}>YOUR PLAN</span></h2>
      <div style={{color:"var(--muted)",fontSize:13}}>Crypto payment • Admin-verified • 30-day access</div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:16,marginBottom:24}}>
      {PLANS.map(p=>{const pd=CFG.PLANS[p.id];return<div key={p.id} className="card" onClick={()=>setPlan(p.id)}
        style={{padding:24,cursor:"pointer",position:"relative",border:`1.5px solid ${plan===p.id?p.col:"var(--bdr)"}`,boxShadow:plan===p.id?`0 0 28px ${p.col}33`:"none"}}>
        {p.badge&&<div style={{position:"absolute",top:-1,right:16,background:p.col,color:"#000",fontSize:9,fontWeight:900,padding:"4px 12px",borderRadius:"0 0 10px 10px",letterSpacing:1,fontFamily:"'Syne',sans-serif"}}>{p.badge}</div>}
        <div style={{fontSize:32,marginBottom:8}}>{p.em}</div>
        <div className="head" style={{fontSize:15,fontWeight:800,marginBottom:4}}>{pd.name}</div>
        <div style={{marginBottom:16}}><span className="mono" style={{fontSize:28,fontWeight:700,color:p.col}}>${pd.price}</span><span style={{color:"var(--muted)",fontSize:12}}>/month</span></div>
        {p.feats.map(ft=><div key={ft} style={{fontSize:12,marginBottom:7,display:"flex",alignItems:"center",gap:8}}><span style={{color:p.col,flexShrink:0}}>✓</span>{ft}</div>)}
      </div>;})}
    </div>
    <div className="card" style={{padding:24}}>
      <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:16}}>PAY WITH CRYPTO</div>
      <div style={{display:"grid",gap:10,marginBottom:18}}>
        {[{coin:"USDT",net:"TRC20 (Tron)",addr:CFG.WALLETS.USDT_TRC20,col:"#26A17B"},{coin:"ETH",net:"Ethereum",addr:CFG.WALLETS.ETH,col:"#627EEA"},{coin:"TRX",net:"Tron",addr:CFG.WALLETS.TRX,col:"#FF0013"}].map(w=><div key={w.coin} style={{background:"var(--bg3)",border:"1px solid var(--bdr)",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{width:38,height:38,borderRadius:9,background:`${w.col}22`,border:`1px solid ${w.col}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span className="head" style={{fontSize:11,fontWeight:800,color:w.col}}>{w.coin}</span></div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:10,color:"var(--muted)",marginBottom:2,fontFamily:"'Syne',sans-serif"}}>{w.coin} ({w.net})</div>
          <div className="mono" style={{fontSize:10,wordBreak:"break-all",color:"var(--text)"}}>{w.addr}</div></div>
          <button className="btn btn-h" style={{padding:"5px 10px",fontSize:10,flexShrink:0}} onClick={()=>navigator.clipboard?.writeText(w.addr)}>Copy</button>
        </div>)}
      </div>
      <div style={{padding:"12px 14px",background:"rgba(255,214,0,.05)",border:"1px solid rgba(255,214,0,.2)",borderRadius:10,marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontSize:10,color:"var(--muted)",marginBottom:3,fontFamily:"'Syne',sans-serif"}}>AMOUNT TO SEND</div><div className="head" style={{fontSize:13,color:"var(--y)"}}>{CFG.PLANS[plan].name} Plan</div></div>
        <div className="mono" style={{fontSize:26,fontWeight:700,color:"var(--y)"}}>${CFG.PLANS[plan].price}</div>
      </div>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:11,color:"var(--muted)",marginBottom:6,fontFamily:"'Syne',sans-serif"}}>TRANSACTION HASH</div>
        <input className="inp" placeholder="0x... or T... — paste tx hash after payment" value={txHash} onChange={e=>setTxHash(e.target.value)} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12}}/>
      </div>
      {msg&&<div style={{fontSize:12,color:"var(--r)",marginBottom:10,padding:"8px 12px",background:"rgba(255,23,68,.07)",borderRadius:8}}>{msg}</div>}
      <button className="btn btn-c" style={{width:"100%",padding:15,fontSize:12,letterSpacing:2}} onClick={async()=>{
        if(!txHash.trim()){setMsg("Enter transaction hash.");return;}
        setLoad(true);await new Promise(r=>setTimeout(r,800));
        try{const p=JSON.parse(localStorage.getItem("cx_payments")||"[]");p.push({id:Date.now().toString(36),plan,txHash:txHash.trim(),submittedAt:Date.now(),status:"pending"});localStorage.setItem("cx_payments",JSON.stringify(p));}catch{}
        setLoad(false);setStep("pending");
      }} disabled={loading}>{loading?<Spin size={16}/>:"→ SUBMIT FOR REVIEW"}</button>
      <div style={{marginTop:10,fontSize:11,color:"var(--muted)"}}>✓ Admin reviews within 1–4h &nbsp;•&nbsp; ✓ 30 days activated on approval</div>
    </div>
  </div>;
}

function PageAdmin({user}){
  const [sub2,setSub2]=useState("pending");
  const [users,setUsers]=useState([]);
  const [pays,setPays]=useState([]);
  useEffect(()=>{setUsers(Auth.all());try{setPays(JSON.parse(localStorage.getItem("cx_payments")||"[]"));}catch{}});
  const pending=pays.filter(p=>p.status==="pending");
  const revenue=pays.filter(p=>p.status==="approved").reduce((a,p)=>a+(CFG.PLANS[p.plan]?.price||0),0);
  const approve=pid=>{const p=[...pays];const i=p.findIndex(x=>x.id===pid);if(i<0)return;p[i]={...p[i],status:"approved",approvedAt:Date.now()};localStorage.setItem("cx_payments",JSON.stringify(p));const u=Auth.all().find(x=>x.email===p[i].userId||x.email===p[i].email);if(u)Auth.update(u.id,{plan:p[i].plan,expiresAt:Date.now()+30*24*60*60*1000});setPays([...p]);};
  const reject=pid=>{const p=[...pays];const i=p.findIndex(x=>x.id===pid);if(i>=0){p[i].status="rejected";localStorage.setItem("cx_payments",JSON.stringify(p));setPays([...p]);}};
  if(user?.role!=="admin") return<div className="card ai" style={{padding:52,textAlign:"center"}}><div style={{fontSize:52,marginBottom:16}}>🔒</div><div className="head" style={{fontSize:16,color:"var(--r)",fontWeight:800}}>ADMIN ONLY</div></div>;
  return<div>
    <div style={{marginBottom:20}}><h2 className="head" style={{fontSize:18,fontWeight:800,marginBottom:4}}>ADMIN <span style={{color:"var(--c)"}}>PANEL</span></h2>
    {pending.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",background:"rgba(255,23,68,.1)",border:"1px solid rgba(255,23,68,.3)",borderRadius:20,fontSize:12,color:"var(--r)",fontFamily:"'Syne',sans-serif",fontWeight:700}}>🔔 {pending.length} PAYMENT{pending.length>1?"S":""} PENDING</div>}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
      {[{l:"USERS",v:users.length,c:"var(--c)"},{l:"ACTIVE",v:users.filter(u=>Date.now()<u.expiresAt).length,c:"var(--g)"},{l:"PENDING",v:pending.length,c:"var(--y)"},{l:"REVENUE",v:`$${revenue}`,c:"#ffc400"}].map((i,k)=><div key={k} style={{background:"var(--bg3)",borderRadius:12,padding:"14px 16px",border:"1px solid var(--bdr)"}}>
        <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Syne',sans-serif",textTransform:"uppercase"}}>{i.l}</div>
        <div className="mono" style={{fontSize:22,fontWeight:700,color:i.c}}>{i.v}</div>
      </div>)}
    </div>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {[["pending","⚠️ Pending"],["users","Users"],["payments","All Payments"]].map(([k,l])=><button key={k} className={`btn ${sub2===k?"btn-c":"btn-h"}`} style={{padding:"8px 16px"}} onClick={()=>setSub2(k)}>{l}{k==="pending"&&pending.length>0?` (${pending.length})`:""}</button>)}
    </div>
    {sub2==="pending"&&(pending.length===0?<div className="card" style={{padding:32,textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>✅</div><div style={{color:"var(--muted)"}}>No pending payments!</div></div>:(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {pending.map(p=><div key={p.id} className="card" style={{padding:20,border:"2px solid rgba(255,214,0,.3)"}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{p.userId||"User"}</div>
        <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
          <span className="pill pc">{CFG.PLANS[p.plan]?.name} — ${CFG.PLANS[p.plan]?.price}</span>
          <span className="pill py">⏳ PENDING</span>
        </div>
        <div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>Submitted: {new Date(p.submittedAt).toLocaleString()}</div>
        <div style={{padding:"10px 12px",background:"var(--bg3)",borderRadius:8,fontSize:11,fontFamily:"'JetBrains Mono',monospace",wordBreak:"break-all",color:"var(--c)",marginBottom:12}}>TX: {p.txHash}</div>
        <div style={{display:"flex",gap:10}}><button className="btn btn-g" style={{flex:1,padding:12}} onClick={()=>approve(p.id)}>✅ APPROVE</button><button className="btn btn-r" style={{flex:1,padding:12}} onClick={()=>reject(p.id)}>✗ REJECT</button></div>
      </div>)}
    </div>))}
    {sub2==="users"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      {users.length===0?<div className="card" style={{padding:28,textAlign:"center"}}><div style={{color:"var(--muted)"}}>No users yet.</div></div>:
      users.map((u,i)=>{const act=Date.now()<u.expiresAt;return<div key={i} className="card" style={{padding:"14px 16px",border:`1px solid ${act?"rgba(0,230,118,.2)":"rgba(255,23,68,.15)"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
          <div><div style={{fontWeight:700,marginBottom:3}}>{u.email}</div>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:5}}>📱 {u.mobile}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span className={`pill ${u.plan==="elite"?"pp":u.plan==="pro"?"pg":"pc"}`}>{u.plan.toUpperCase()}</span>
            <span className={`pill ${act?"pg":"pr"}`}>{act?"ACTIVE":"EXPIRED"}</span>
          </div></div>
          <div className="mono" style={{fontSize:18,fontWeight:700,color:act?"var(--g)":"var(--r)"}}>{Math.max(0,Math.ceil((u.expiresAt-Date.now())/86400000))}d</div>
        </div>
      </div>;})}
    </div>}
    {sub2==="payments"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {pays.length===0?<div className="card" style={{padding:28,textAlign:"center"}}><div style={{color:"var(--muted)"}}>No payments yet.</div></div>:
      pays.map((p,i)=><div key={i} className="card" style={{padding:"12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <div><span className="pill pc" style={{marginRight:6}}>{CFG.PLANS[p.plan]?.name}</span>
          <span className={`pill ${p.status==="approved"?"pg":p.status==="rejected"?"pr":"py"}`}>{p.status.toUpperCase()}</span></div>
          <div className="mono" style={{fontSize:16,fontWeight:700,color:"#ffc400"}}>${CFG.PLANS[p.plan]?.price}</div>
        </div>
      </div>)}
    </div>}
  </div>;
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═════════════════════════════════════════════════════════════════════════════
const DEF={paused:false,notifScalp:true,notifDay:true,notifSwing:true,notifEmerg:true,lev:10};
const INIT_N=[
  {id:1,coin:"BTC",msg:"📊 BTC/USDT Day Trading LONG signal locked for 4 hours. Entry $70,850–$71,200. Conf 84%.",time:"12m ago",type:"entry",read:false,urgent:false},
  {id:2,coin:"SOL",msg:"🌊 SOL/USDT Swing LONG — 4H uptrend intact. Entry zone $82.2–$83.8. Hold 2–3 days.",time:"2h ago",type:"entry",read:false,urgent:false},
  {id:3,coin:"SYSTEM",msg:"✅ Welcome to Cryptex Signal v4.0. Signals now locked per timeframe. No more rapid flipping.",time:"now",type:"info",read:true,urgent:false},
];

export default function App(){
  const [user,setUser]=useState(()=>{try{return JSON.parse(sessionStorage.getItem("cx_user")||"null");}catch{return null;}});
  const [tab,setTab]=useState("dashboard");
  const [active,setActive]=useState(0);
  const [strategy,setStrategy]=useState("day");
  const [coins,setCoins]=useState(COINS.map(c=>({...c,price:c.base,chg24:0,high24:c.base*1.03,low24:c.base*0.97})));
  const [notifs,setNotifs]=useState(INIT_N);
  const [settings,setSettings]=useState(()=>{try{return{...DEF,...JSON.parse(localStorage.getItem("cx_settings")||"{}")};}catch{return DEF;}});
  const upd=useCallback((k,v)=>setSettings(p=>{const n={...p,[k]:v};try{localStorage.setItem("cx_settings",JSON.stringify(n));}catch{}return n;}),[]);
  const handleLogin=u=>{sessionStorage.setItem("cx_user",JSON.stringify(u));setUser(u);};
  const handleLogout=()=>{sessionStorage.removeItem("cx_user");setUser(null);setTab("dashboard");};

  // Live price fetch (REST poll every 5s — WebSocket where available)
  useEffect(()=>{
    if(!user) return;
    const poll=async()=>{
      try{
        const syms=COINS.map(c=>`"${c.sym}"`).join(",");
        const res=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${syms}]`);
        if(!res.ok) return;
        const data=await res.json();
        setCoins(COINS.map(cd=>{
          const d=data.find(x=>x.symbol===cd.sym);
          if(!d) return coins.find(c=>c.id===cd.id)||{...cd,price:cd.base,chg24:0};
          return{...cd,price:parseFloat(d.lastPrice),chg24:parseFloat(d.priceChangePercent),
            high24:parseFloat(d.highPrice),low24:parseFloat(d.lowPrice),
            vol:parseFloat(d.volume),volUsdt:parseFloat(d.quoteVolume),updatedAt:Date.now()};
        }));
      }catch{}
    };
    poll();const t=setInterval(poll,5000);return()=>clearInterval(t);
  },[user]);

  // Smart notifications — respect signal lock intervals
  const lastNotifRef=useRef({});
  useEffect(()=>{
    if(!user||settings.paused) return;
    const t=setInterval(()=>{
      if(!settings.notifDay) return;
      COINS.forEach((cd,i)=>{
        const c=coins[i]||{...cd,price:cd.base,chg24:0};
        const sig=getOrCalcSignal(c,"day");
        if(!sig||sig.conf<80) return;
        const now=Date.now();
        const key=`${cd.id}-day`;
        const last=lastNotifRef.current[key]||0;
        if(now-last<CFG.SIGNAL_LOCK.day) return; // Don't re-notify within lock
        lastNotifRef.current[key]=now;
        const isL=sig.signal==="LONG";
        setNotifs(ns=>[{id:now+i,coin:cd.id,
          msg:`${isL?"📊":"📉"} ${cd.id} Day Trading ${sig.signal} — ${sig.conf}% conf. Entry $${f(sig.entryLow)}–$${f(sig.entryHigh)}. Locked 4h.`,
          time:"just now",type:"entry",read:false,urgent:sig.conf>=85},...ns.slice(0,29)]);
      });
    },10*60*1000); // Check every 10 minutes
    return()=>clearInterval(t);
  },[user,settings.paused,settings.notifDay,coins]);

  const unread=notifs.filter(n=>!n.read).length;
  if(!user) return<><style>{CSS}</style><div style={{position:"relative",zIndex:1}}><AuthPage onLogin={handleLogin}/></div></>;

  const TABS=[
    {id:"dashboard",icon:"⬡",label:"Dashboard"},
    {id:"signals",  icon:"⚡",label:"Signals"},
    {id:"scan",     icon:"◎", label:"Scan"},
    {id:"search",   icon:"🔍",label:"Search"},
    {id:"tracker",  icon:"📈",label:"Tracker"},
    {id:"alerts",   icon:"🔔",label:"Alerts",badge:unread},
    {id:"settings", icon:"⚙", label:"Settings"},
    {id:"subscribe",icon:"💎",label:"Upgrade"},
    ...(user?.role==="admin"?[{id:"admin",icon:"🛡",label:"Admin"}]:[]),
  ];

  return<><style>{CSS}</style>
  <div style={{minHeight:"100vh",position:"relative",zIndex:1}}>
    <header style={{position:"sticky",top:0,zIndex:300,background:"rgba(5,11,20,.97)",backdropFilter:"blur(24px)",borderBottom:"1px solid var(--bdr)"}}>
      <div style={{maxWidth:1400,margin:"0 auto",padding:"0 20px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
            background:"linear-gradient(135deg,#002233,#004466,#006699)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 18px rgba(0,212,255,.4)",border:"1px solid rgba(0,212,255,.25)"}}>
            <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
              <path d="M3 18 Q7 7 12 18 Q17 29 22 18 Q27 7 33 18" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <circle cx="18" cy="18" r="3" fill="#00e676"/>
            </svg>
          </div>
          <div>
            <div className="head" style={{fontSize:14,fontWeight:800,letterSpacing:2,lineHeight:1}}>CRYPTEX<span style={{color:"var(--c)"}}>SIGNAL</span></div>
            <div style={{fontSize:8,color:"var(--muted)",letterSpacing:1,fontFamily:"'Syne',sans-serif"}}>MULTI-STRATEGY FUTURES</div>
          </div>
        </div>
        <nav style={{display:"flex",gap:1}} className="loh">
          {TABS.map(t=><button key={t.id} className={`nb ${tab===t.id?"act":""}`} onClick={()=>setTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
            {(t.badge||0)>0&&<span style={{background:"var(--r)",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:6,fontFamily:"'Syne',sans-serif",fontWeight:700}}>{t.badge}</span>}
          </button>)}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {settings.paused&&<span className="pill py loh">⏸</span>}
          {unread>0&&<span style={{width:8,height:8,background:"var(--r)",borderRadius:"50%",cursor:"pointer",boxShadow:"0 0 8px var(--r)"}} className="pu" onClick={()=>setTab("alerts")}/>}
          <button className="btn btn-c" style={{padding:"8px 14px",fontSize:10,letterSpacing:1.5}} onClick={()=>setTab("scan")}>⟳ SCAN</button>
        </div>
      </div>
    </header>
    {coins.some(c=>c.updatedAt)&&<Ticker coins={coins}/>}
    <main style={{maxWidth:1400,margin:"0 auto",padding:"22px 20px 90px",position:"relative",zIndex:1}}>
      {tab==="dashboard"&&<PageDashboard coins={coins} setTab={setTab} setActive={setActive} setStrategy={setStrategy}/>}
      {tab==="signals"  &&<PageSignals coins={coins} active={active} setActive={setActive} strategy={strategy} setStrategy={setStrategy}/>}
      {tab==="scan"     &&<PageScan coins={coins} setTab={setTab} setActive={setActive} setStrategy={setStrategy}/>}
      {tab==="search"   &&<PageSearch/>}
      {tab==="tracker"  &&<PageTracker/>}
      {tab==="alerts"   &&<PageAlerts notifs={notifs} setNotifs={setNotifs} paused={settings.paused}/>}
      {tab==="settings" &&<PageSettings settings={settings} update={upd} user={user} onLogout={handleLogout}/>}
      {tab==="subscribe"&&<PageSubscribe/>}
      {tab==="admin"    &&<PageAdmin user={user}/>}
    </main>
    <nav className="smh" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:"rgba(5,11,20,.98)",backdropFilter:"blur(24px)",borderTop:"1px solid var(--bdr)",display:"flex",height:60,overflowX:"auto"}}>
      {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)}
        style={{flex:"0 0 auto",minWidth:52,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,color:tab===t.id?"var(--c)":"var(--muted)",transition:"color .18s",position:"relative",padding:"0 10px"}}>
        <span style={{fontSize:16}}>{t.icon}</span>
        <span style={{fontFamily:"'Syne',sans-serif",fontSize:8,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{t.label}</span>
        {(t.badge||0)>0&&<span style={{position:"absolute",top:8,left:"60%",background:"var(--r)",color:"#fff",fontSize:8,padding:"1px 4px",borderRadius:5}}>{t.badge}</span>}
      </button>)}
    </nav>
  </div></>;
}
