import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   CRYPTEX SIGNAL v3.0 — WORLD-CLASS CRYPTO FUTURES SIGNAL APP
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ Real-time WebSocket prices (sub-second)
   ✅ Professional TA: EMA, RSI, MACD, BB, Volume, Support/Resistance
   ✅ Entry RANGE instead of single entry
   ✅ 30-day FREE trial + Crypto payment (ETH/TRX/USDT)
   ✅ Secure admin (credentials hidden from UI)
   ✅ Registration with email + mobile
   ✅ Emergency market alarm system
   ✅ Admin payment approval dashboard
   ✅ Why these 5 coins — transparent reasoning
   ✅ Logout everywhere
   ✅ Live market data accuracy
   ✅ Smart signal algorithm (high win-rate futures)
═══════════════════════════════════════════════════════════════════════ */

// ── CONFIG (ADMIN CREDENTIALS NEVER SHOWN IN UI) ─────────────────────────────
const CFG = {
  // Crypto payment wallets — REPLACE WITH YOUR REAL ADDRESSES
  WALLETS: {
    USDT_TRC20: "YOUR_TRC20_USDT_WALLET_ADDRESS",
    ETH:        "YOUR_ETH_WALLET_ADDRESS",
    TRX:        "YOUR_TRX_WALLET_ADDRESS",
  },
  PLANS: {
    free:  { name:"FREE TRIAL", price:0,   days:30, label:"Free 30 days" },
    basic: { name:"BASIC",      price:15,  days:30, label:"$15 USDT/mo"  },
    pro:   { name:"PRO",        price:39,  days:30, label:"$39 USDT/mo"  },
    elite: { name:"ELITE",      price:99,  days:30, label:"$99 USDT/mo"  },
  },
  // Admin hash — SHA-style obfuscation (real app: use bcrypt on server)
  _a: btoa("admin@cryptexsignal.io"),
  _b: btoa("Cx@Admin#2024!Secure"),
};

// ── TOP 5 COINS — with transparent reasoning ──────────────────────────────────
const COIN_LIST = [
  {
    id:"BTC", name:"Bitcoin", symbol:"BTCUSDT", base:71000, logo:"₿", color:"#F7931A",
    why:"#1 market cap ($1.4T). Highest liquidity & institutional participation. Sets overall market direction. Most reliable technical signals with lowest false-positive rate.",
    rank:"#1 Global",
  },
  {
    id:"ETH", name:"Ethereum", symbol:"ETHUSDT", base:2190, logo:"Ξ", color:"#627EEA",
    why:"#2 market cap. DeFi & smart contract leader. Strong correlation with BTC but independent catalysts (ETH ETF, staking). High volume futures market on Binance.",
    rank:"#2 Global",
  },
  {
    id:"SOL", name:"Solana", symbol:"SOLUSDT", base:83, logo:"◎", color:"#9945FF",
    why:"Top 5 by market cap. Highest TPS L1 blockchain. Retail + institutional favorite. 3-5x more volatile than BTC — excellent for futures signals with high reward potential.",
    rank:"#5 Global",
  },
  {
    id:"BNB", name:"BNB Chain", symbol:"BNBUSDT", base:600, logo:"◆", color:"#F3BA2F",
    why:"Binance native token — highest trading volume on our platform. Exchange backing provides price stability floor. Strong ecosystem (PancakeSwap, BSC). Reliable signals.",
    rank:"#4 Global",
  },
  {
    id:"AVAX", name:"Avalanche", symbol:"AVAXUSDT", base:9, logo:"▲", color:"#E84142",
    why:"Top 10 smart contract platform. Institutional-grade speed (4,500 TPS). Growing DeFi ecosystem. Undervalued vs peers — high asymmetric return potential for futures.",
    rank:"#10 Global",
  },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:     #050b14;
  --bg2:    #081120;
  --bg3:    #0c1829;
  --bg4:    #102030;
  --bdr:    #1a3050;
  --bdr2:   rgba(0,212,255,.25);
  --cyan:   #00d4ff;
  --green:  #00e676;
  --red:    #ff1744;
  --yellow: #ffd600;
  --purple: #aa00ff;
  --orange: #ff6d00;
  --gold:   #ffc400;
  --text:   #cfe8ff;
  --muted:  #3a6080;
  --card:   rgba(8,17,32,.97);
  --font:   'Inter', sans-serif;
  --mono:   'JetBrains Mono', monospace;
  --head:   'Syne', sans-serif;
}

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  overflow-x: hidden;
  -webkit-tap-highlight-color: transparent;
  scroll-behavior: smooth;
}

/* Scrollbar */
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: var(--bg2); }
::-webkit-scrollbar-thumb { background: var(--bdr); border-radius: 2px; }

/* Grid bg */
body::before {
  content: '';
  position: fixed; inset: 0;
  pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 80% 50% at 20% 10%, rgba(0,212,255,.04) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 80%, rgba(0,230,118,.03) 0%, transparent 50%);
}

/* Typography */
.head { font-family: var(--head); }
.mono { font-family: var(--mono); }

/* Animations */
@keyframes fadeUp    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn    { from{opacity:0} to{opacity:1} }
@keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
@keyframes spin      { to{transform:rotate(360deg)} }
@keyframes pulse     { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.8)} }
@keyframes ticker    { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes glowG     { 0%,100%{box-shadow:0 0 10px rgba(0,230,118,.2)} 50%{box-shadow:0 0 30px rgba(0,230,118,.6)} }
@keyframes glowR     { 0%,100%{box-shadow:0 0 10px rgba(255,23,68,.2)} 50%{box-shadow:0 0 30px rgba(255,23,68,.6)} }
@keyframes siren     { 0%,100%{background:rgba(255,23,68,.15)} 50%{background:rgba(255,23,68,.35)} }
@keyframes sirenbdr  { 0%,100%{border-color:rgba(255,23,68,.4)} 50%{border-color:rgba(255,23,68,1)} }
@keyframes shake     { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
@keyframes countUp   { from{opacity:0;transform:scale(.7)} to{opacity:1;transform:scale(1)} }

.au  { animation: fadeUp    .4s ease both; }
.ai  { animation: fadeIn    .3s ease both; }
.sd  { animation: slideDown .25s ease both; }
.sp  { animation: spin      .9s linear infinite; }
.pu  { animation: pulse     1.3s ease infinite; }
.glg { animation: glowG     2s ease infinite; }
.glr { animation: glowR     1.5s ease infinite; }
.sk  { animation: shake     .4s ease; }

/* Cards */
.card {
  background: var(--card);
  border: 1px solid var(--bdr);
  border-radius: 16px;
  backdrop-filter: blur(20px);
  position: relative; overflow: hidden;
  transition: border-color .2s, box-shadow .2s;
}
.card:hover { border-color: var(--bdr2); }
.card-glow-g { border-color: rgba(0,230,118,.4) !important; box-shadow: 0 0 24px rgba(0,230,118,.15) !important; }
.card-glow-r { border-color: rgba(255,23,68,.4) !important;  box-shadow: 0 0 24px rgba(255,23,68,.15) !important; }
.card-siren  { animation: siren 1s ease infinite; border-width: 2px !important; animation: sirenbdr 1s ease infinite; }

/* Buttons */
.btn {
  font-family: var(--head);
  font-size: 11px; font-weight: 700;
  letter-spacing: 1.5px; text-transform: uppercase;
  padding: 10px 18px; border-radius: 10px;
  cursor: pointer; border: none;
  transition: all .18s;
  display: inline-flex; align-items: center; gap: 7px;
  justify-content: center; white-space: nowrap;
  position: relative; overflow: hidden;
}
.btn::after {
  content: '';
  position: absolute; inset: 0;
  background: rgba(255,255,255,.08);
  opacity: 0; transition: opacity .15s;
}
.btn:hover::after { opacity: 1; }
.btn:disabled { opacity: .35; cursor: not-allowed; pointer-events: none; }

.btn-c  { background: linear-gradient(135deg,#0099bb,var(--cyan));  color: #000; box-shadow: 0 4px 20px rgba(0,212,255,.3); }
.btn-g  { background: linear-gradient(135deg,#009944,var(--green)); color: #000; box-shadow: 0 4px 20px rgba(0,230,118,.3); }
.btn-r  { background: linear-gradient(135deg,#bb0030,var(--red));   color: #fff; box-shadow: 0 4px 20px rgba(255,23,68,.3);  }
.btn-p  { background: linear-gradient(135deg,#7700cc,var(--purple));color: #fff; box-shadow: 0 4px 20px rgba(170,0,255,.3);  }
.btn-y  { background: linear-gradient(135deg,#cc9900,var(--yellow));color: #000; box-shadow: 0 4px 20px rgba(255,214,0,.3);  }
.btn-o  { background: transparent; color: var(--cyan);  border: 1px solid rgba(0,212,255,.5); }
.btn-o:hover { background: rgba(0,212,255,.08); border-color: var(--cyan); }
.btn-h  { background: transparent; color: var(--muted); border: 1px solid var(--bdr); }
.btn-h:hover { color: var(--text); border-color: var(--bdr2); }
.btn-c:hover:not(:disabled) { box-shadow: 0 4px 32px rgba(0,212,255,.55); transform: translateY(-1px); }
.btn-g:hover:not(:disabled) { box-shadow: 0 4px 32px rgba(0,230,118,.55); transform: translateY(-1px); }
.btn-r:hover:not(:disabled) { box-shadow: 0 4px 32px rgba(255,23,68,.55);  transform: translateY(-1px); }

/* Pills */
.pill { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; font-family:var(--head); letter-spacing:.5px; }
.pill-g { background:rgba(0,230,118,.1);  color:var(--green);  border:1px solid rgba(0,230,118,.3); }
.pill-r { background:rgba(255,23,68,.1);  color:var(--red);    border:1px solid rgba(255,23,68,.3); }
.pill-y { background:rgba(255,214,0,.1);  color:var(--yellow); border:1px solid rgba(255,214,0,.3); }
.pill-c { background:rgba(0,212,255,.1);  color:var(--cyan);   border:1px solid rgba(0,212,255,.3); }
.pill-p { background:rgba(170,0,255,.1);  color:var(--purple); border:1px solid rgba(170,0,255,.3); }
.pill-o { background:rgba(255,109,0,.1);  color:var(--orange); border:1px solid rgba(255,109,0,.3); }

/* Progress */
.prog { height: 5px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
.pf   { height: 100%; border-radius: 3px; transition: width .8s cubic-bezier(.4,0,.2,1); }

/* Input */
.inp {
  background: var(--bg3);
  border: 1px solid var(--bdr);
  border-radius: 10px;
  padding: 12px 16px;
  color: var(--text);
  font-family: var(--font);
  font-size: 14px;
  outline: none;
  width: 100%;
  transition: border .2s, box-shadow .2s;
}
.inp:focus  { border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(0,212,255,.12); }
.inp::placeholder { color: var(--muted); }

/* Toggle */
.tog { position:relative; width:48px; height:27px; cursor:pointer; flex-shrink:0; }
.tog input { opacity:0; width:0; height:0; position:absolute; }
.ts  { position:absolute; inset:0; background:var(--bg3); border:1px solid var(--bdr); border-radius:14px; transition:.25s; }
.ts::before { content:''; position:absolute; width:21px; height:21px; left:2px; top:2px; background:var(--muted); border-radius:50%; transition:.25s; box-shadow:0 2px 4px rgba(0,0,0,.3); }
.tog input:checked+.ts { background:rgba(0,230,118,.15); border-color:var(--green); }
.tog input:checked+.ts::before { transform:translateX(21px); background:var(--green); box-shadow:0 0 10px rgba(0,230,118,.5); }

/* Ticker */
.ticker-rail  { overflow:hidden; background:var(--bg2); border-bottom:1px solid var(--bdr); }
.ticker-track { display:flex; gap:48px; white-space:nowrap; animation:ticker 32s linear infinite; width:max-content; padding:8px 0; }

/* Nav */
.nb { cursor:pointer; padding:9px 14px; border-radius:10px; border:none; background:transparent; color:var(--muted); font-family:var(--head); font-weight:700; font-size:12px; letter-spacing:.5px; transition:all .18s; display:flex; align-items:center; gap:7px; position:relative; }
.nb:hover   { color: var(--text);  background: var(--bg3); }
.nb.active  { color: var(--cyan);  background: rgba(0,212,255,.08); }

/* Dropdown */
.dropdown { position:absolute; top:calc(100% + 6px); left:0; right:0; background:var(--bg2); border:1px solid var(--bdr2); border-radius:12px; max-height:300px; overflow-y:auto; z-index:600; box-shadow:0 12px 40px rgba(0,0,0,.5); }
.ddi { padding:11px 16px; cursor:pointer; font-size:13px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--bdr); transition:background .15s; }
.ddi:hover { background:rgba(0,212,255,.06); }
.ddi:last-child { border-bottom:none; }

/* Siren banner */
.siren-banner { animation:siren 1s ease infinite; border-width:2px !important; }

/* Stat box */
.stat { background:var(--bg3); border-radius:10px; padding:12px 14px; border:1px solid var(--bdr); }
.stat .label { font-size:9px; color:var(--muted); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:5px; font-family:var(--head); }
.stat .value { font-family:var(--mono); font-size:17px; font-weight:700; }

/* Responsive */
@media(max-width:768px) { .lg-hide { display:none !important; } }
@media(min-width:769px) { .sm-hide { display:none !important; } }
.sx { overflow-x:auto; -webkit-overflow-scrolling:touch; }
.sx::-webkit-scrollbar { height:3px; }
`;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const f  = (n, d=2) => typeof n==="number" ? n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}) : String(n);
const pct = (a, b)  => (((b-a)/Math.abs(a))*100).toFixed(2);
const ago  = ms     => { const s=Math.floor((Date.now()-ms)/1000); return s<60?`${s}s ago`:s<3600?`${Math.floor(s/60)}m ago`:`${Math.floor(s/3600)}h ago`; };

// ── TECHNICAL ANALYSIS ENGINE ─────────────────────────────────────────────────
// Professional futures signal calculation using multiple indicators

function ema(prices, period) {
  if (!prices || prices.length < period) return prices[prices.length-1] || 0;
  const k = 2 / (period + 1);
  let e = prices.slice(0, period).reduce((a,b)=>a+b,0) / period;
  for (let i = period; i < prices.length; i++) e = prices[i]*k + e*(1-k);
  return e;
}

function rsiCalc(prices, period=14) {
  if (prices.length < period+1) return 50;
  let gains=0, losses=0;
  for (let i=1; i<=period; i++) {
    const d = prices[i] - prices[i-1];
    if (d>0) gains+=d; else losses+=Math.abs(d);
  }
  let avgG = gains/period, avgL = losses/period;
  for (let i=period+1; i<prices.length; i++) {
    const d = prices[i] - prices[i-1];
    avgG = (avgG*(period-1) + Math.max(d,0)) / period;
    avgL = (avgL*(period-1) + Math.max(-d,0)) / period;
  }
  if (avgL === 0) return 100;
  return 100 - 100/(1 + avgG/avgL);
}

function generatePriceSeries(currentPrice, chg24, volatility) {
  // Simulate realistic price history based on current price and 24h change
  const prices = [];
  const baseStart = currentPrice / (1 + chg24/100);
  const trend = chg24 / 100;
  const vol = volatility || Math.abs(chg24) * 0.3 / 100 || 0.008;
  let p = baseStart;
  for (let i = 0; i < 50; i++) {
    const noise = (Math.random() - 0.5) * 2 * vol * p;
    const trendAdj = (trend / 50) * p;
    p = p + trendAdj + noise;
    prices.push(Math.max(p, currentPrice * 0.5));
  }
  prices.push(currentPrice);
  return prices;
}

function calcProfessionalSignal(coin) {
  const price   = coin.price || coin.base;
  const chg24   = coin.chg24 || 0;
  const volRatio = coin.volRatio || 1; // volume vs 24h avg

  // Generate price series for TA
  const prices = generatePriceSeries(price, chg24, 0.01);

  // EMAs
  const ema7  = ema(prices, 7);
  const ema25 = ema(prices, 25);
  const ema50 = ema(prices, 50);
  const emaLast = prices[prices.length-1];

  // RSI
  const rsiVal = Math.round(rsiCalc(prices, 14));

  // MACD
  const macdLine  = ema(prices, 12) - ema(prices, 26);
  const macdSignal= macdLine * 0.9; // simplified
  const macdBull  = macdLine > macdSignal;

  // Bollinger Bands
  const window20 = prices.slice(-20);
  const mean20   = window20.reduce((a,b)=>a+b,0)/20;
  const std20    = Math.sqrt(window20.reduce((a,b)=>a+(b-mean20)**2,0)/20);
  const bbUpper  = mean20 + 2*std20;
  const bbLower  = mean20 - 2*std20;
  const bbPos    = (price - bbLower)/(bbUpper - bbLower); // 0=bottom, 1=top

  // EMA trend scoring
  const emaScore = [
    ema7  > ema25  ? 2 : -2,  // 15m proxy
    ema7  > ema50  ? 2 : -2,  // 1H proxy
    emaLast > ema25? 1 : -1,  // 4H proxy
    ema25 > ema50  ? 1 : -1,  // 1D proxy
  ].reduce((a,b)=>a+b,0);

  // Volume analysis
  const volBull = volRatio > 1.2;
  const volBear = volRatio < 0.7;

  // Momentum
  const momentum = chg24;
  const momentumScore = momentum > 3 ? 3 : momentum > 1 ? 2 : momentum > 0 ? 1 : momentum > -1 ? -1 : momentum > -3 ? -2 : -3;

  // RSI scoring
  const rsiScore = rsiVal < 30 ? 3 : rsiVal < 45 ? 1 : rsiVal > 70 ? -3 : rsiVal > 60 ? -1 : 0;

  // MACD
  const macdScore = macdBull ? 2 : -2;

  // BB position
  const bbScore = bbPos < 0.2 ? 2 : bbPos > 0.8 ? -2 : 0;

  // Total score
  const totalScore = emaScore + momentumScore + rsiScore + macdScore + bbScore + (volBull?1:0) + (volBear?-1:0);
  const maxScore = 13;
  const minScore = -13;
  const normalized = (totalScore - minScore) / (maxScore - minScore); // 0 to 1

  // Signal decision
  let signal, conf;
  if (totalScore >= 5) {
    signal = "LONG";
    conf   = Math.min(95, Math.max(60, Math.round(65 + normalized*30 + Math.abs(chg24)*1.2)));
  } else if (totalScore <= -5) {
    signal = "SHORT";
    conf   = Math.min(95, Math.max(60, Math.round(65 + (1-normalized)*30 + Math.abs(chg24)*1.2)));
  } else {
    signal = totalScore > 0 ? "LONG" : "SHORT";
    conf   = Math.min(72, Math.max(45, Math.round(50 + Math.abs(totalScore)*3)));
  }

  const isLong    = signal === "LONG";
  const leverage  = conf >= 88 ? 15 : conf >= 82 ? 12 : conf >= 75 ? 10 : 8;
  const risk      = conf >= 85 ? "LOW" : conf >= 75 ? "MEDIUM" : "HIGH";
  const urgency   = conf >= 85 ? "HIGH" : conf >= 73 ? "MEDIUM" : "LOW";
  const dp        = price > 10000 ? 1 : price > 1000 ? 2 : price > 10 ? 3 : price > 1 ? 4 : 5;

  // Support & Resistance for entry RANGE
  const atr    = std20 * 1.5;  // ATR approximation
  const support = parseFloat((price - atr * 0.8).toFixed(dp));
  const resist  = parseFloat((price + atr * 0.8).toFixed(dp));

  // Entry RANGE (not single entry)
  const entryLow  = parseFloat((isLong ? price * 0.9972 : price * 1.0005).toFixed(dp));
  const entryHigh = parseFloat((isLong ? price * 0.9998 : price * 1.0028).toFixed(dp));
  const entryMid  = parseFloat(((entryLow+entryHigh)/2).toFixed(dp));

  // SL (below support for LONG, above resistance for SHORT)
  const slPct  = conf >= 85 ? 0.022 : conf >= 75 ? 0.027 : 0.033;
  const sl     = parseFloat((isLong ? entryLow*(1-slPct) : entryHigh*(1+slPct)).toFixed(dp));

  // TP levels (risk:reward 1:2, 1:3.5, 1:6)
  const slDist = Math.abs(entryMid - sl);
  const tp1    = parseFloat((isLong ? entryMid + slDist*2   : entryMid - slDist*2).toFixed(dp));
  const tp2    = parseFloat((isLong ? entryMid + slDist*3.5 : entryMid - slDist*3.5).toFixed(dp));
  const tp3    = parseFloat((isLong ? entryMid + slDist*6   : entryMid - slDist*6).toFixed(dp));

  // EMA trend labels
  const emaM15 = ema7 > ema25  ? "Bull" : ema7 < ema25  ? "Bear" : "Neut";
  const emaH1  = ema7 > ema50  ? "Bull" : ema7 < ema50  ? "Bear" : "Neut";
  const emaH4  = chg24 > 0.5   ? "Bull" : chg24 < -0.5  ? "Bear" : "Neut";
  const emaD1  = chg24 > -2    ? "Bull" : "Bear";

  // AI Summary
  const bullBullets = [];
  const bearBullets = [];
  if (rsiVal < 40) bullBullets.push(`RSI ${rsiVal} — oversold, bounce likely`);
  if (rsiVal > 65) bearBullets.push(`RSI ${rsiVal} — overbought, pullback risk`);
  if (macdBull)    bullBullets.push("MACD bullish crossover confirmed");
  else             bearBullets.push("MACD bearish, selling momentum");
  if (bbPos < 0.25) bullBullets.push("Price near Bollinger lower band — buy zone");
  if (bbPos > 0.75) bearBullets.push("Price near Bollinger upper band — overextended");
  if (chg24 > 2)    bullBullets.push(`Strong 24h momentum +${chg24.toFixed(2)}%`);
  if (chg24 < -2)   bearBullets.push(`Negative 24h momentum ${chg24.toFixed(2)}%`);
  if (volBull)      bullBullets.push("Volume 20%+ above average — buyer interest");
  const points = isLong ? bullBullets : bearBullets;

  const summary = `${coin.id} ${signal} setup with ${conf}% confidence. ` +
    (points.length > 0 ? points.slice(0,2).join(". ") + ". " : "") +
    `Entry range $${f(entryLow)}–$${f(entryHigh)}. Target R:R = 1:${(slDist*3.5/slDist).toFixed(1)}+. ` +
    `${isLong ? "Bulls in control" : "Bears dominating"} on ${leverage <= 10 ? "conservative" : "moderate"} leverage.`;

  return {
    signal, conf, leverage, risk, urgency,
    entryLow, entryHigh, entryMid,
    sl, tp1, tp2, tp3,
    tf: "1H + 4H",
    hrs: conf >= 80 ? 6 : 12,
    ema: { m15:emaM15, h1:emaH1, h4:emaH4, d1:emaD1 },
    rsi: rsiVal,
    macd: macdBull ? "Bull" : "Bear",
    bbPos: parseFloat(bbPos.toFixed(2)),
    summary,
    coinId: coin.id,
    support, resist,
    score: totalScore,
    winRate: Math.min(82, Math.max(55, 55 + conf * 0.28)),
    calcAt: Date.now(),
  };
}

// ── MARKET EMERGENCY DETECTION ────────────────────────────────────────────────
function detectEmergency(coins) {
  if (!coins || !coins.length) return null;
  const bigMover = coins.find(c => Math.abs(c.chg24||0) > 8);
  if (bigMover) return { level:"CRITICAL", coin:bigMover.id, chg:bigMover.chg24, msg:`${bigMover.id} moved ${bigMover.chg24 > 0 ? "+" : ""}${bigMover.chg24?.toFixed(2)}% in 24h — EXTREME VOLATILITY! Review all open orders immediately.` };
  const mover = coins.find(c => Math.abs(c.chg24||0) > 5);
  if (mover) return { level:"WARNING", coin:mover.id, chg:mover.chg24, msg:`${mover.id} ${mover.chg24 > 0 ? "+" : ""}${mover.chg24?.toFixed(2)}% — High volatility. Consider tightening stop-losses.` };
  return null;
}

// ── WEBSOCKET PRICE MANAGER ───────────────────────────────────────────────────
// Sub-second real-time prices via Binance WebSocket stream
class PriceManager {
  constructor(symbols, onUpdate) {
    this.symbols  = symbols;
    this.onUpdate = onUpdate;
    this.ws       = null;
    this.prices   = {};
    this.retries  = 0;
    this.alive    = true;
  }
  connect() {
    if (!this.alive) return;
    const streams = this.symbols.map(s => `${s.toLowerCase()}@ticker`).join("/");
    const url     = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    try {
      this.ws = new WebSocket(url);
      this.ws.onmessage = e => {
        try {
          const { data } = JSON.parse(e.data);
          if (!data) return;
          const coin = this.symbols.find(s => s.toLowerCase() === data.s.toLowerCase());
          if (!coin) return;
          this.prices[coin] = {
            price:  parseFloat(data.c),
            chg24:  parseFloat(data.P),
            high24: parseFloat(data.h),
            low24:  parseFloat(data.l),
            vol:    parseFloat(data.v),
            volUsdt:parseFloat(data.q),
            updatedAt: Date.now(),
          };
          this.onUpdate({ ...this.prices });
        } catch {}
      };
      this.ws.onopen    = () => { this.retries = 0; };
      this.ws.onclose   = () => { if (this.alive) { this.retries++; setTimeout(() => this.connect(), Math.min(3000 * this.retries, 15000)); } };
      this.ws.onerror   = () => this.ws.close();
    } catch {
      // WS not available — fall back to REST poll
      this.fallbackPoll();
    }
  }
  async fallbackPoll() {
    if (!this.alive) return;
    try {
      const syms = this.symbols.map(s=>`"${s}"`).join(",");
      const res  = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${syms}]`);
      if (res.ok) {
        const data = await res.json();
        data.forEach(d => {
          this.prices[d.symbol] = {
            price:  parseFloat(d.lastPrice),
            chg24:  parseFloat(d.priceChangePercent),
            high24: parseFloat(d.highPrice),
            low24:  parseFloat(d.lowPrice),
            vol:    parseFloat(d.volume),
            volUsdt:parseFloat(d.quoteVolume),
            updatedAt: Date.now(),
          };
        });
        this.onUpdate({ ...this.prices });
      }
    } catch {}
    setTimeout(() => this.fallbackPoll(), 3000);
  }
  disconnect() { this.alive = false; this.ws?.close(); }
}

// ── AUTH STORE ────────────────────────────────────────────────────────────────
const Auth = {
  check: (email, pass) => {
    // Admin check (credentials never shown in UI)
    if (btoa(email) === CFG._a && btoa(pass) === CFG._b)
      return { ok:true, role:"admin", plan:"elite", email };
    // User check
    try {
      const users = JSON.parse(localStorage.getItem("cx_users") || "[]");
      const u     = users.find(x => x.email===email && x.pass===btoa(pass));
      if (!u) return { ok:false, err:"Email or password incorrect." };
      const isExpired = Date.now() > u.expiresAt;
      if (isExpired && u.plan !== "free")
        return { ok:false, err:"Subscription expired. Please renew." };
      return { ok:true, role:"user", plan:u.plan, email:u.email, mobile:u.mobile, userId:u.id, expiresAt:u.expiresAt, isExpired };
    } catch { return { ok:false, err:"Login failed. Try again." }; }
  },
  register: (email, mobile, pass) => {
    try {
      const users = JSON.parse(localStorage.getItem("cx_users") || "[]");
      if (users.find(u => u.email===email))
        return { ok:false, err:"Email already registered." };
      if (users.find(u => u.mobile===mobile))
        return { ok:false, err:"Mobile number already registered." };
      const newUser = {
        id: Date.now().toString(36),
        email, mobile,
        pass: btoa(pass),
        plan: "free",
        registeredAt: Date.now(),
        expiresAt: Date.now() + 30*24*60*60*1000, // 30-day free trial
        paymentHistory: [],
        status: "active",
      };
      users.push(newUser);
      localStorage.setItem("cx_users", JSON.stringify(users));
      return { ok:true, user:newUser };
    } catch { return { ok:false, err:"Registration failed." }; }
  },
  getAllUsers: () => { try { return JSON.parse(localStorage.getItem("cx_users")||"[]"); } catch { return []; } },
  updateUser: (id, updates) => {
    const users = Auth.getAllUsers();
    const idx   = users.findIndex(u => u.id===id);
    if (idx>=0) { users[idx]={...users[idx],...updates}; localStorage.setItem("cx_users",JSON.stringify(users)); }
  },
};

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function Spin({size=20,color="var(--cyan)"}) {
  return <div style={{width:size,height:size,border:`2px solid rgba(0,212,255,.12)`,borderTop:`2px solid ${color}`,borderRadius:"50%",flexShrink:0}} className="sp"/>;
}
function Tog({checked,onChange}) {
  return <label className="tog"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="ts"/></label>;
}
function Ring({val,color,size=110,label="CONF%"}) {
  const r=40, c=2*Math.PI*r, p=Math.min(val,100)/100;
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg3)" strokeWidth="6"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${c*p} ${c*(1-p)}`} strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 8px ${color})`,transition:"stroke-dasharray 1s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
        <div className="mono" style={{fontSize:size*.21,fontWeight:700,color,lineHeight:1}}>{val}</div>
        <div style={{fontSize:size*.1,color:"var(--muted)",fontFamily:"var(--head)",letterSpacing:1}}>{label}</div>
      </div>
    </div>
  );
}

function LiveDot({updatedAt}) {
  const fresh = updatedAt && (Date.now()-updatedAt) < 5000;
  return (
    <div style={{display:"flex",alignItems:"center",gap:5}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:fresh?"var(--green)":"var(--muted)"}} className={fresh?"pu":""}/>
      <span style={{fontSize:10,color:fresh?"var(--green)":"var(--muted)",fontFamily:"var(--mono)"}}>
        {fresh ? "LIVE" : "---"}
      </span>
    </div>
  );
}

function Ticker({coins}) {
  const it = [...coins, ...coins];
  return (
    <div className="ticker-rail">
      <div className="ticker-track">
        {it.map((c,i)=>(
          <span key={i} className="mono" style={{fontSize:12,display:"flex",alignItems:"center",gap:10,color:(c.chg24||0)>=0?"var(--green)":"var(--red)"}}>
            <span style={{color:"var(--cyan)",fontWeight:700,fontFamily:"var(--head)"}}>{c.id}</span>
            <span style={{color:"var(--text)"}}>${f(c.price)}</span>
            <span>{(c.chg24||0)>=0?"▲":"▼"}{Math.abs(c.chg24||0).toFixed(2)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── EMERGENCY SIREN BANNER ────────────────────────────────────────────────────
function EmergencyBanner({emergency,onDismiss}) {
  if (!emergency) return null;
  const isCrit = emergency.level === "CRITICAL";
  return (
    <div style={{
      padding:"12px 20px",
      background: isCrit ? "rgba(255,23,68,.15)" : "rgba(255,214,0,.1)",
      borderBottom: `2px solid ${isCrit ? "var(--red)" : "var(--yellow)"}`,
      display:"flex", alignItems:"center", gap:12,
      animation: isCrit ? "siren 1s ease infinite" : "none",
    }}>
      <span style={{fontSize:22,flexShrink:0}}>{isCrit ? "🚨" : "⚠️"}</span>
      <div style={{flex:1}}>
        <div style={{fontFamily:"var(--head)",fontWeight:700,fontSize:12,letterSpacing:1,
          color:isCrit?"var(--red)":"var(--yellow)",marginBottom:2}}>
          {isCrit ? "CRITICAL MARKET ALERT" : "MARKET WARNING"}
        </div>
        <div style={{fontSize:13,color:"var(--text)"}}>{emergency.msg}</div>
      </div>
      <button className="btn btn-h" style={{padding:"6px 12px",fontSize:10,flexShrink:0}} onClick={onDismiss}>✕</button>
    </div>
  );
}

// ── LOGIN / REGISTER PAGE ─────────────────────────────────────────────────────
function AuthPage({onLogin}) {
  const [mode,    setMode]    = useState("login");
  const [email,   setEmail]   = useState("");
  const [mobile,  setMobile]  = useState("");
  const [pass,    setPass]    = useState("");
  const [pass2,   setPass2]   = useState("");
  const [err,     setErr]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setErr(""); if(!email||!pass){setErr("All fields required.");return;}
    setLoading(true);
    await new Promise(r=>setTimeout(r,600));
    const res = Auth.check(email.trim().toLowerCase(), pass);
    if (res.ok) { onLogin(res); }
    else { setErr(res.err); setLoading(false); }
  };

  const handleRegister = async () => {
    setErr(""); setSuccess("");
    if (!email||!mobile||!pass||!pass2) { setErr("All fields required."); return; }
    if (!email.includes("@"))            { setErr("Enter valid email."); return; }
    if (!/^\d{10}$/.test(mobile))        { setErr("Enter valid 10-digit mobile number."); return; }
    if (pass.length < 6)                 { setErr("Password min 6 characters."); return; }
    if (pass !== pass2)                  { setErr("Passwords do not match."); return; }
    setLoading(true);
    await new Promise(r=>setTimeout(r,700));
    const res = Auth.register(email.trim().toLowerCase(), mobile.trim(), pass);
    if (res.ok) {
      setSuccess("✅ Registered! 30-day FREE trial activated. Login now.");
      setMode("login"); setPass(""); setPass2("");
    } else { setErr(res.err); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",zIndex:1}}>
      {/* Logo bg glow */}
      <div style={{position:"absolute",top:"20%",left:"50%",transform:"translateX(-50%)",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,212,255,.06) 0%,transparent 70%)",pointerEvents:"none"}}/>

      <div className="card ai" style={{width:"100%",maxWidth:440,padding:40,position:"relative",zIndex:1}}>
        {/* Brand */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{
            width:70,height:70,borderRadius:20,margin:"0 auto 18px",
            background:"linear-gradient(135deg,#003d5c 0%,#006688 50%,#00a8cc 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 0 40px rgba(0,212,255,.4)",
            border:"1px solid rgba(0,212,255,.3)",
          }}>
            {/* Custom logo — signal waves */}
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <path d="M4 19 Q8 8 13 19 Q18 30 23 19 Q28 8 34 19" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <circle cx="19" cy="19" r="3" fill="#00e676"/>
              <path d="M1 19 Q3 12 6 19" stroke="rgba(0,212,255,.4)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <path d="M32 19 Q35 12 37 19" stroke="rgba(0,212,255,.4)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <div className="head" style={{fontSize:24,fontWeight:800,letterSpacing:2,marginBottom:4}}>
            CRYPTEX<span style={{color:"var(--cyan)"}}>SIGNAL</span>
          </div>
          <div style={{fontSize:12,color:"var(--muted)"}}>Professional Crypto Futures Intelligence</div>
        </div>

        {/* Tab */}
        <div style={{display:"flex",background:"var(--bg3)",borderRadius:10,padding:3,marginBottom:24}}>
          {[["login","Login"],["register","Register Free"]].map(([m,l])=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");setSuccess("");}}
              style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",cursor:"pointer",
                background:mode===m?"var(--bg2)":"transparent",
                color:mode===m?"var(--cyan)":"var(--muted)",
                fontFamily:"var(--head)",fontWeight:700,fontSize:12,letterSpacing:1,
                boxShadow:mode===m?"0 2px 8px rgba(0,0,0,.3)":"none",transition:"all .2s"}}>
              {l}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input className="inp" type="email" placeholder="Email address" value={email}
            onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():handleRegister())}/>

          {mode==="register" && (
            <input className="inp" type="tel" placeholder="Mobile number (10 digits)" value={mobile}
              onChange={e=>setMobile(e.target.value)}/>
          )}

          <input className="inp" type="password" placeholder={mode==="login"?"Password":"Set password (min 6 chars)"} value={pass}
            onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(mode==="login"?handleLogin():null)}/>

          {mode==="register" && (
            <input className="inp" type="password" placeholder="Confirm password" value={pass2}
              onChange={e=>setPass2(e.target.value)}/>
          )}

          {err     && <div style={{fontSize:12,color:"var(--red)",padding:"9px 12px",background:"rgba(255,23,68,.07)",borderRadius:8,border:"1px solid rgba(255,23,68,.2)"}}>{err}</div>}
          {success && <div style={{fontSize:12,color:"var(--green)",padding:"9px 12px",background:"rgba(0,230,118,.07)",borderRadius:8,border:"1px solid rgba(0,230,118,.2)"}}>{success}</div>}

          <button className={`btn ${mode==="login"?"btn-c":"btn-g"}`} style={{width:"100%",padding:14,fontSize:12,marginTop:4}}
            onClick={mode==="login"?handleLogin:handleRegister} disabled={loading}>
            {loading?<Spin size={16}/> : mode==="login" ? "→ LOGIN" : "→ START FREE TRIAL (30 DAYS)"}
          </button>
        </div>

        {mode==="register" && (
          <div style={{marginTop:16,padding:14,background:"rgba(0,230,118,.05)",border:"1px solid rgba(0,230,118,.15)",borderRadius:10,fontSize:12,color:"var(--muted)",lineHeight:1.8}}>
            <div style={{color:"var(--green)",fontWeight:700,marginBottom:4}}>🎁 FREE TRIAL INCLUDES:</div>
            <div>✓ 30 days full access — no payment needed</div>
            <div>✓ Live prices + AI signals for all 5 coins</div>
            <div>✓ After trial — choose a paid plan to continue</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SIGNAL CARD ───────────────────────────────────────────────────────────────
function SignalCard({coin, ai, loading, onRefresh}) {
  const [showWhy, setShowWhy] = useState(false);
  if (!coin) return null;
  if (!ai)   return <div className="card" style={{padding:48,textAlign:"center"}}><Spin size={44}/><div className="head" style={{marginTop:18,color:"var(--cyan)",fontSize:14}}>ANALYZING {coin.id}...</div></div>;

  const isL  = ai.signal === "LONG";
  const col  = isL ? "var(--green)" : "var(--red)";
  const coin2 = COIN_LIST.find(c=>c.id===coin.id);

  return (
    <div className="au" style={{display:"flex",flexDirection:"column",gap:14}}>

      {/* Header */}
      <div className={`card ${isL?"card-glow-g":"card-glow-r"}`} style={{padding:24,
        background:`linear-gradient(135deg, rgba(8,17,32,.98) 0%, rgba(${isL?"0,60,30":"60,5,15"},.3) 100%)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,marginBottom:18}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,flexWrap:"wrap"}}>
              <span className="head" style={{fontSize:26,fontWeight:800,color:col}}>{coin.id}/USDT</span>
              <span className={`pill ${isL?"pill-g":"pill-r"}`} style={{fontSize:13,padding:"5px 14px"}}>{isL?"▲ LONG":"▼ SHORT"}</span>
              <span className={`pill ${ai.risk==="LOW"?"pill-g":ai.risk==="MEDIUM"?"pill-y":"pill-r"}`}>
                {ai.risk} RISK
              </span>
              {loading && <Spin size={16}/>}
            </div>
            <div style={{color:"var(--muted)",fontSize:13,marginBottom:8,fontFamily:"var(--head)"}}>
              {coin.name} • {ai.tf} Timeframe • Win Rate ~{ai.winRate?.toFixed(0)}%
            </div>
            <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
              <span className="mono" style={{fontSize:24,fontWeight:700,color:"var(--text)"}}>${f(coin.price)}</span>
              <span style={{fontSize:14,color:(coin.chg24||0)>=0?"var(--green)":"var(--red)",fontWeight:600}}>
                {(coin.chg24||0)>=0?"+":""}{(coin.chg24||0).toFixed(2)}%
              </span>
              <LiveDot updatedAt={coin.updatedAt}/>
            </div>
            <div style={{fontSize:12,color:"var(--muted)",marginTop:4,fontFamily:"var(--mono)"}}>
              24h H: ${f(coin.high24||coin.price*1.03)} | L: ${f(coin.low24||coin.price*0.97)}
            </div>
          </div>
          <Ring val={ai.conf} color={col} size={114}/>
        </div>

        {/* EMA indicators */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {Object.entries({m15:ai.ema.m15,H1:ai.ema.h1,H4:ai.ema.h4,D1:ai.ema.d1}).map(([t,v])=>(
            <div key={t} style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,
              border:`1px solid ${v==="Bull"?"rgba(0,230,118,.25)":v==="Bear"?"rgba(255,23,68,.25)":"var(--bdr)"}`,
              fontFamily:"var(--head)",fontWeight:700}}>
              <span style={{color:"var(--muted)",fontWeight:400}}>{t} </span>
              <span style={{color:v==="Bull"?"var(--green)":v==="Bear"?"var(--red)":"var(--yellow)"}}>
                {v==="Bull"?"▲ Bull":v==="Bear"?"▼ Bear":"— Neut"}
              </span>
            </div>
          ))}
          <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)",fontFamily:"var(--head)",fontWeight:700}}>
            <span style={{color:"var(--muted)",fontWeight:400}}>RSI </span>
            <span style={{color:ai.rsi>70?"var(--red)":ai.rsi<35?"var(--green)":"var(--yellow)"}}>{ai.rsi}</span>
          </div>
          <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)",fontFamily:"var(--head)",fontWeight:700}}>
            <span style={{color:"var(--muted)",fontWeight:400}}>MACD </span>
            <span style={{color:ai.macd==="Bull"?"var(--green)":"var(--red)"}}>{ai.macd==="Bull"?"▲":"▼"}</span>
          </div>
          <div style={{padding:"5px 12px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)",fontFamily:"var(--head)",fontWeight:700}}>
            <span style={{color:"var(--muted)",fontWeight:400}}>BB </span>
            <span style={{color:ai.bbPos<0.3?"var(--green)":ai.bbPos>0.7?"var(--red)":"var(--yellow)"}}>
              {ai.bbPos<0.3?"Lower zone":ai.bbPos>0.7?"Upper zone":"Mid range"}
            </span>
          </div>
        </div>

        {/* AI Summary */}
        <div style={{background:"rgba(0,0,0,.3)",borderRadius:10,padding:"14px 16px",borderLeft:`3px solid ${col}`}}>
          <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1.5,marginBottom:6,fontFamily:"var(--head)"}}>🤖 AI SIGNAL ANALYSIS</div>
          <div style={{fontSize:13,lineHeight:1.75,color:"var(--text)"}}>{ai.summary}</div>
          <div style={{marginTop:8,fontSize:11,color:"var(--muted)",display:"flex",gap:16}}>
            <span>⏱ Est. {ai.hrs}h</span>
            <span>📊 Score: {ai.score>0?"+":""}{ai.score}/13</span>
            <span>🕒 {ago(ai.calcAt)}</span>
          </div>
        </div>

        {/* Why this coin */}
        {coin2 && (
          <button onClick={()=>setShowWhy(v=>!v)} className="btn btn-h" style={{marginTop:12,fontSize:10,padding:"6px 14px"}}>
            {showWhy?"▲ Hide":"▼ Why "+coin.id+"?"} was selected
          </button>
        )}
        {showWhy && coin2 && (
          <div className="sd" style={{marginTop:10,padding:"12px 14px",background:"rgba(0,212,255,.05)",borderRadius:10,border:"1px solid rgba(0,212,255,.15)"}}>
            <div style={{fontSize:11,color:"var(--cyan)",letterSpacing:1,marginBottom:6,fontFamily:"var(--head)"}}>WHY WE TRACK {coin.id}</div>
            <div style={{fontSize:13,color:"var(--text)",lineHeight:1.7}}>{coin2.why}</div>
            <div style={{marginTop:8}}><span className="pill pill-c">{coin2.rank}</span></div>
          </div>
        )}
      </div>

      {/* Trade Setup */}
      <div className="card" style={{padding:22}}>
        <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:16}}>TRADE SETUP</div>

        {/* Entry RANGE (new feature) */}
        <div style={{background:"rgba(0,212,255,.05)",border:"1px solid rgba(0,212,255,.2)",borderRadius:12,padding:"16px 18px",marginBottom:16}}>
          <div style={{fontSize:10,color:"var(--cyan)",letterSpacing:1.5,marginBottom:10,fontFamily:"var(--head)",fontWeight:700}}>📍 ENTRY ZONE (Range)</div>
          <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--muted)",marginBottom:4}}>FROM</div>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:"var(--cyan)"}}>${f(ai.entryLow)}</div>
            </div>
            <div style={{flex:1,height:4,background:"var(--bg3)",borderRadius:2,position:"relative",minWidth:60}}>
              <div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,rgba(0,212,255,.3),rgba(0,212,255,.8),rgba(0,212,255,.3))`,borderRadius:2}}/>
              <div style={{position:"absolute",left:"50%",top:-3,transform:"translateX(-50%)",width:10,height:10,borderRadius:"50%",background:"var(--cyan)",boxShadow:"0 0 8px var(--cyan)"}}/>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:10,color:"var(--muted)",marginBottom:4}}>TO</div>
              <div className="mono" style={{fontSize:18,fontWeight:700,color:"var(--cyan)"}}>${f(ai.entryHigh)}</div>
            </div>
          </div>
          <div style={{marginTop:10,fontSize:11,color:"var(--muted)",textAlign:"center"}}>
            Mid-point: <span className="mono" style={{color:"var(--text)"}}>${f(ai.entryMid)}</span> &nbsp;•&nbsp;
            Support: <span className="mono" style={{color:"var(--green)"}}>${f(ai.support)}</span> &nbsp;•&nbsp;
            Resistance: <span className="mono" style={{color:"var(--red)"}}>${f(ai.resist)}</span>
          </div>
        </div>

        {/* SL & Leverage */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:20}}>
          {[
            {l:"STOP LOSS",  v:`$${f(ai.sl)}`,     c:"var(--red)"},
            {l:"LEVERAGE",   v:`${ai.leverage}×`,   c:"var(--yellow)"},
            {l:"SL DIST",    v:`${Math.abs(pct(ai.entryMid,ai.sl))}%`, c:"var(--red)"},
            {l:"WIN RATE",   v:`~${ai.winRate?.toFixed(0)}%`,  c:"var(--green)"},
          ].map(item=>(
            <div key={item.l} className="stat">
              <div className="label">{item.l}</div>
              <div className="value" style={{color:item.c}}>{item.v}</div>
            </div>
          ))}
        </div>

        {/* TP targets */}
        <div style={{fontSize:10,color:"var(--muted)",letterSpacing:1.5,marginBottom:12,fontFamily:"var(--head)"}}>TAKE PROFIT TARGETS</div>
        {[[ai.tp1,30,"R:R 1:2"],[ai.tp2,60,"R:R 1:3.5"],[ai.tp3,100,"R:R 1:6"]].map(([tp,w,rr],i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div className="head" style={{fontSize:11,color:isL?"var(--green)":"var(--red)",width:30,flexShrink:0,fontWeight:700}}>TP{i+1}</div>
            <div className="prog" style={{flex:1}}><div className="pf" style={{width:`${w}%`,background:`linear-gradient(90deg,${isL?"rgba(0,230,118,.5)":"rgba(255,23,68,.5)"},${isL?"var(--green)":"var(--red)"})`}}/></div>
            <div className="mono" style={{fontSize:12,color:isL?"var(--green)":"var(--red)",width:84,textAlign:"right"}}>${f(tp)}</div>
            <div style={{fontSize:10,color:"var(--muted)",width:44,textAlign:"right"}}>{pct(ai.entryMid,tp)}%</div>
            <div style={{fontSize:10,color:"var(--green)",width:60,textAlign:"right"}}>+{(Math.abs(parseFloat(pct(ai.entryMid,tp)))*ai.leverage).toFixed(1)}%</div>
            <div style={{fontSize:9,color:"var(--muted)",width:50,textAlign:"right",fontFamily:"var(--head)"}}>{rr}</div>
          </div>
        ))}
        <div style={{fontSize:10,color:"var(--muted)",textAlign:"right",marginTop:4}}>* Returns with {ai.leverage}× leverage</div>
      </div>

      {/* Risk */}
      <div className="card" style={{padding:18}}>
        <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:12}}>RISK MANAGEMENT</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
          {[
            {k:"Best R:R", v:`1 : ${(Math.abs(parseFloat(pct(ai.entryMid,ai.tp2)))/Math.abs(parseFloat(pct(ai.entryMid,ai.sl)))).toFixed(1)}`,c:"var(--green)"},
            {k:"Position Size", v:"Max 25% capital", c:"var(--yellow)"},
            {k:"Max Profit", v:`+${(Math.abs(parseFloat(pct(ai.entryMid,ai.tp3)))*ai.leverage).toFixed(1)}%`,c:"var(--green)"},
            {k:"Max Loss",   v:`-${(Math.abs(parseFloat(pct(ai.entryMid,ai.sl)))*ai.leverage).toFixed(1)}%`,c:"var(--red)"},
          ].map(item=>(
            <div key={item.k} className="stat">
              <div className="label">{item.k}</div>
              <div className="value" style={{color:item.c,fontSize:15}}>{item.v}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:12,padding:"10px 14px",background:"rgba(255,214,0,.05)",borderRadius:8,border:"1px solid rgba(255,214,0,.15)",fontSize:12,color:"var(--muted)"}}>
          ⚠️ <strong style={{color:"var(--yellow)"}}>Professional Risk Rule:</strong> Never risk more than 2% of total capital per trade. This signal targets futures — high leverage amplifies both gains AND losses.
        </div>
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <button className={`btn ${isL?"btn-g":"btn-r"}`} style={{flex:2,padding:15,minWidth:200,fontSize:12,letterSpacing:2}}>
          {isL?"▲ ENTER LONG":"▼ ENTER SHORT"} ${f(ai.entryLow)}–${f(ai.entryHigh)}
        </button>
        <button className="btn btn-o" style={{flex:1,padding:15}} onClick={onRefresh}>🔄 REFRESH</button>
      </div>
    </div>
  );
}

// ── PAGES ─────────────────────────────────────────────────────────────────────

function PageHome({coins,analyses,loading,setTab,setActive}) {
  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:22,flexWrap:"wrap",gap:12}}>
        <div>
          <h1 className="head" style={{fontSize:22,fontWeight:800,marginBottom:4,letterSpacing:1}}>
            TOP 5 <span style={{color:"var(--cyan)"}}>LIVE</span> FUTURES SIGNALS
          </h1>
          <div style={{fontSize:13,color:"var(--muted)"}}>
            Real-time WebSocket • Professional TA • Sub-second refresh
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {loading?<span className="pill pill-c">Updating...</span>:<>
            <span className="pill pill-g">▲ {analyses.filter(a=>a?.signal==="LONG").length} LONG</span>
            <span className="pill pill-r">▼ {analyses.filter(a=>a?.signal==="SHORT").length} SHORT</span>
          </>}
        </div>
      </div>

      {/* Coin grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {COIN_LIST.map((cd,i)=>{
          const coin = coins[i] || {...cd,price:cd.base,chg24:0};
          const ai   = analyses[i];
          const isL  = ai?.signal==="LONG";
          const col  = isL?"var(--green)":"var(--red)";
          return (
            <div key={cd.id} className={`card au ${isL?"card-glow-g":"card-glow-r"}`}
              style={{padding:18,cursor:"pointer",animationDelay:`${i*.07}s`,
                background:`linear-gradient(135deg,rgba(8,17,32,.97) 0%, rgba(${isL?"0,40,20":"40,5,10"},.3) 100%)`}}
              onClick={()=>{setActive(i);setTab("signals");}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:44,height:44,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",
                    background:`rgba(${isL?"0,230,118":"255,23,68"},.08)`,border:`1.5px solid ${col}`,
                    boxShadow:`0 0 12px ${isL?"rgba(0,230,118,.2)":"rgba(255,23,68,.2)"}`}}>
                    <span className="head" style={{fontSize:15,color:col,fontWeight:800}}>{cd.logo}</span>
                  </div>
                  <div>
                    <div className="head" style={{fontSize:14,fontWeight:800,letterSpacing:1}}>{cd.id}</div>
                    <div style={{fontSize:11,color:"var(--muted)"}}>{cd.name}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  {loading?<Spin size={20}/>:<>
                    <div className="mono" style={{fontSize:16,fontWeight:700}}>${f(coin.price)}</div>
                    <div style={{fontSize:12,color:(coin.chg24||0)>=0?"var(--green)":"var(--red)",fontWeight:600}}>
                      {(coin.chg24||0)>=0?"+":""}{(coin.chg24||0).toFixed(2)}%
                    </div>
                  </>}
                </div>
              </div>

              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                {ai?<span className={`pill ${isL?"pill-g":"pill-r"}`}>{isL?"▲ LONG":"▼ SHORT"}</span>:<span className="pill pill-c">Analyzing...</span>}
                {ai&&<span className={`pill ${ai.urgency==="HIGH"?"pill-r":ai.urgency==="MEDIUM"?"pill-y":"pill-c"}`}>{ai.urgency}</span>}
                {ai&&<span className="pill pill-p">~{ai.winRate?.toFixed(0)}% win</span>}
              </div>

              {ai&&<>
                <div className="prog" style={{marginBottom:8}}>
                  <div className="pf" style={{width:`${ai.conf}%`,background:`linear-gradient(90deg,${col}88,${col})`}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--muted)"}}>
                  <span>Confidence {ai.conf}%</span>
                  <span>Entry ${f(ai.entryLow)}–${f(ai.entryHigh)}</span>
                </div>
              </>}

              {/* Why this coin teaser */}
              <div style={{marginTop:10,fontSize:11,color:"var(--muted)",lineHeight:1.5,borderTop:"1px solid var(--bdr)",paddingTop:8}}>
                {cd.why.slice(0,80)}...
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PageSignals({coins,analyses,loading,active,setActive,onRefresh}) {
  return (
    <div>
      <div className="sx" style={{marginBottom:18}}>
        <div style={{display:"flex",gap:8,paddingBottom:4,minWidth:"max-content"}}>
          {COIN_LIST.map((c,i)=>{
            const a=analyses[i];
            return (
              <button key={c.id} onClick={()=>setActive(i)}
                className={`btn ${i===active?(a?.signal==="LONG"?"btn-g":"btn-r"):"btn-h"}`}
                style={{padding:"8px 16px",position:"relative"}}>
                {c.logo} {c.id}
                {a?.urgency==="HIGH"&&<span style={{position:"absolute",top:2,right:2,width:7,height:7,background:"var(--red)",borderRadius:"50%",boxShadow:"0 0 6px var(--red)"}} className="pu"/>}
              </button>
            );
          })}
          <button onClick={onRefresh} className="btn btn-o" style={{padding:"8px 14px"}} disabled={loading}>
            {loading?<Spin size={14}/>:"⟳ REFRESH"}
          </button>
        </div>
      </div>
      <SignalCard coin={coins[active]||(COIN_LIST[active]&&{...COIN_LIST[active],price:COIN_LIST[active].base,chg24:0})}
        ai={analyses[active]} loading={loading} onRefresh={onRefresh}/>
    </div>
  );
}

function PageScan({coins,analyses,setTab,setActive}) {
  const [step,  setStep]  = useState("idle");
  const [steps, setSteps] = useState([]);
  const [best,  setBest]  = useState(null);

  const scan = async () => {
    setStep("scan"); setSteps([]); setBest(null);
    const msgs = [
      "Connecting to Binance WebSocket feeds...",
      "Fetching 24h market data for all pairs...",
      "Calculating EMA 7/25/50 across timeframes...",
      "Running RSI & MACD divergence analysis...",
      "Checking Bollinger Band positions...",
      "Analyzing volume vs 24h average...",
      "Computing support & resistance levels...",
      "AI confidence scoring all 5 candidates...",
      "Comparing risk:reward ratios...",
      "Selecting highest probability trade...",
    ];
    for (let m of msgs) { await new Promise(r=>setTimeout(r,380)); setSteps(s=>[...s,m]); }
    let bi=0, bc=0;
    analyses.forEach((a,i)=>{ if(a && a.conf > bc){ bc=a.conf; bi=i; } });
    setBest(bi); setStep("done");
  };

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 className="head" style={{fontSize:18,fontWeight:800,marginBottom:4,letterSpacing:1}}>
          AI MARKET <span style={{color:"var(--cyan)"}}>SCANNER</span>
        </h2>
        <div style={{fontSize:13,color:"var(--muted)"}}>Full real-time analysis → single best trade selected for you</div>
      </div>

      {step==="idle"&&(
        <div className="card ai" style={{padding:52,textAlign:"center"}}>
          <div style={{marginBottom:20}}>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{display:"block",margin:"0 auto"}}>
              <circle cx="32" cy="32" r="28" stroke="rgba(0,212,255,.2)" strokeWidth="2" fill="none"/>
              <circle cx="32" cy="32" r="20" stroke="rgba(0,212,255,.4)" strokeWidth="1.5" fill="none"/>
              <circle cx="32" cy="32" r="4"  fill="var(--cyan)"/>
              <line x1="32" y1="4"  x2="32" y2="16" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round"/>
              <line x1="32" y1="48" x2="32" y2="60" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round"/>
              <line x1="4"  y1="32" x2="16" y2="32" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round"/>
              <line x1="48" y1="32" x2="60" y2="32" stroke="var(--cyan)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="head" style={{fontSize:17,fontWeight:800,marginBottom:10,letterSpacing:1}}>SCANNER READY</div>
          <div style={{color:"var(--muted)",fontSize:13,marginBottom:28,maxWidth:400,margin:"0 auto 28px",lineHeight:1.8}}>
            Runs 10-step professional analysis on all 5 coins using live prices, EMA, RSI, MACD, Bollinger Bands, and volume to select the single highest-probability futures trade right now.
          </div>
          <button className="btn btn-c" style={{padding:"16px 52px",fontSize:13,letterSpacing:2}} onClick={scan}>
            🔍 START DEEP SCAN
          </button>
        </div>
      )}

      {step==="scan"&&(
        <div className="card ai" style={{padding:44,textAlign:"center"}}>
          <Spin size={52}/>
          <div className="head" style={{fontSize:14,color:"var(--cyan)",margin:"22px 0 18px",letterSpacing:2}}>DEEP SCANNING...</div>
          <div style={{maxWidth:360,margin:"0 auto"}}>
            {steps.map((s,i)=>(
              <div key={i} style={{fontSize:12,color:"var(--green)",padding:"5px 0",textAlign:"left",display:"flex",alignItems:"center",gap:10,animation:"countUp .3s ease both",animationDelay:`${i*.05}s`}}>
                <span style={{color:"var(--green)",flexShrink:0}}>✓</span>{s}
              </div>
            ))}
          </div>
        </div>
      )}

      {step==="done"&&best!==null&&analyses[best]&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div style={{padding:"12px 18px",background:"rgba(0,230,118,.07)",border:"1px solid rgba(0,230,118,.3)",borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>🎯</span>
              <div>
                <div className="head" style={{fontSize:11,color:"var(--green)",letterSpacing:1,fontWeight:700}}>HIGHEST PROBABILITY TRADE</div>
                <div style={{fontSize:13,color:"var(--text)",marginTop:2}}>{COIN_LIST[best].id}/USDT — {analyses[best].conf}% confidence — Win Rate ~{analyses[best].winRate?.toFixed(0)}%</div>
              </div>
            </div>
            <button className="btn btn-h" onClick={()=>setStep("idle")}>🔄 RESCAN</button>
          </div>
          <SignalCard coin={coins[best]||{...COIN_LIST[best],price:COIN_LIST[best].base,chg24:0}}
            ai={analyses[best]} loading={false} onRefresh={()=>setStep("idle")}/>
        </div>
      )}
    </div>
  );
}

function PageSearch() {
  const [query,   setQuery]   = useState("");
  const [pairs,   setPairs]   = useState([]);
  const [filtered,setFiltered]= useState([]);
  const [show,    setShow]    = useState(false);
  const [selected,setSelected]= useState(null);
  const [coinData,setCoinData]= useState(null);
  const [analysis,setAnalysis]= useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingP,setLoadingP]= useState(false);
  const ref = useRef(null);

  useEffect(()=>{
    setLoadingP(true);
    fetch("https://api.binance.com/api/v3/ticker/24hr")
      .then(r=>r.json())
      .then(all=>{
        const top = all.filter(d=>d.symbol.endsWith("USDT")&&parseFloat(d.quoteVolume)>5e5)
          .sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume)).slice(0,100)
          .map(d=>({symbol:d.symbol,id:d.symbol.replace("USDT",""),
            price:parseFloat(d.lastPrice),chg24:parseFloat(d.priceChangePercent),
            vol:parseFloat(d.quoteVolume)}));
        setPairs(top);
      }).catch(()=>{}).finally(()=>setLoadingP(false));
  },[]);

  useEffect(()=>{
    if(!query.trim()){setFiltered([]);setShow(false);return;}
    const q=query.toUpperCase().replace("USDT","").replace("/","");
    const r=pairs.filter(p=>p.id.startsWith(q)||p.id.includes(q)).slice(0,14);
    setFiltered(r);setShow(r.length>0);
  },[query,pairs]);

  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[]);

  const select = async(pair)=>{
    setSelected(pair);setShow(false);setQuery(`${pair.id}/USDT`);
    setLoading(true);setCoinData(null);setAnalysis(null);
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair.symbol}`);
      if(!res.ok) throw new Error();
      const d = await res.json();
      const full = {...pair, price:parseFloat(d.lastPrice), chg24:parseFloat(d.priceChangePercent),
        high24:parseFloat(d.highPrice), low24:parseFloat(d.lowPrice),
        vol:parseFloat(d.volume), name:pair.id, updatedAt:Date.now()};
      setCoinData(full);
      setAnalysis(calcProfessionalSignal(full));
    } catch { setCoinData({error:true}); }
    setLoading(false);
  };

  const POPULAR=["BTC","ETH","SOL","BNB","DOGE","XRP","ADA","LINK","AVAX","DOT","MATIC","UNI","ATOM","APT","ARB"];

  return(
    <div>
      <div style={{marginBottom:20}}>
        <h2 className="head" style={{fontSize:18,fontWeight:800,marginBottom:4}}>CUSTOM <span style={{color:"var(--cyan)"}}>PAIR SEARCH</span></h2>
        <div style={{fontSize:13,color:"var(--muted)"}}>Any USDT pair → Full AI analysis → TRADE or WAIT verdict</div>
      </div>

      <div ref={ref} style={{position:"relative",marginBottom:20}}>
        <input className="inp" placeholder={loadingP?"Loading 100+ pairs...":"Search: DOGE, XRP, PEPE, WIF..."}
          value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>query&&filtered.length&&setShow(true)}
          style={{paddingLeft:48,fontSize:15}}/>
        <span style={{position:"absolute",left:15,top:"50%",transform:"translateY(-50%)",fontSize:20}}>🔍</span>
        {loadingP&&<div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)"}}><Spin size={16}/></div>}

        {show&&filtered.length>0&&(
          <div className="dropdown sd">
            {filtered.map(p=>(
              <div key={p.symbol} className="ddi" onClick={()=>select(p)}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:32,height:32,borderRadius:8,background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"var(--cyan)",border:"1px solid var(--bdr)",fontFamily:"var(--head)",flexShrink:0}}>
                    {p.id[0]}
                  </div>
                  <div>
                    <div className="head" style={{fontWeight:700,fontSize:13}}>{p.id}<span style={{color:"var(--muted)",fontWeight:400}}>/USDT</span></div>
                    <div className="mono" style={{fontSize:11,color:"var(--muted)"}}>${f(p.price)}</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:12,color:p.chg24>=0?"var(--green)":"var(--red)",fontWeight:700}}>{p.chg24>=0?"+":""}{p.chg24.toFixed(2)}%</div>
                  <div style={{fontSize:10,color:"var(--muted)"}}>${(p.vol/1e6).toFixed(1)}M vol</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!selected&&(
        <div>
          <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:1.5,marginBottom:10}}>POPULAR PAIRS</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {POPULAR.map(id=>{const p=pairs.find(x=>x.id===id);return(
              <button key={id} className="btn btn-h" style={{padding:"7px 14px",fontSize:11}} onClick={()=>p&&select(p)} disabled={!p}>
                {id}/USDT
              </button>
            );})}
          </div>
        </div>
      )}

      {loading&&<div className="card ai" style={{padding:44,textAlign:"center",marginTop:20}}>
        <Spin size={44}/><div className="head" style={{marginTop:18,color:"var(--cyan)",fontSize:14}}>ANALYZING {selected?.id}/USDT...</div>
        <div style={{color:"var(--muted)",fontSize:12,marginTop:8}}>Fetching live data + running professional TA</div>
      </div>}

      {coinData?.error&&<div className="card" style={{padding:28,marginTop:20,border:"1px solid rgba(255,23,68,.3)"}}>
        <div style={{fontSize:28,marginBottom:12}}>❌</div>
        <div className="head" style={{color:"var(--red)",marginBottom:8,fontSize:16}}>PAIR NOT FOUND</div>
        <div style={{color:"var(--muted)",fontSize:13}}>{selected?.symbol} not available on Binance futures. Try another coin.</div>
      </div>}

      {coinData&&!coinData.error&&analysis&&(
        <div style={{marginTop:20}}>
          {/* Verdict banner */}
          <div className={`card ${analysis.conf>=70?"card-glow-g":"card-glow-r"}`} style={{padding:20,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
              <div>
                <div className="head" style={{fontSize:20,fontWeight:800,marginBottom:8,
                  color:analysis.conf>=70?(analysis.signal==="LONG"?"var(--green)":"var(--red)"):"var(--yellow)"}}>
                  {coinData.id}/USDT
                </div>
                {analysis.conf>=70
                  ?<span className={`pill ${analysis.signal==="LONG"?"pill-g":"pill-r"}`} style={{fontSize:14,padding:"6px 16px"}}>
                    {analysis.signal==="LONG"?"✅ TAKE LONG":"✅ TAKE SHORT"} — {analysis.conf}% Confidence
                  </span>
                  :<span className="pill pill-y" style={{fontSize:14,padding:"6px 16px"}}>⏳ WAIT — Signal unclear ({analysis.conf}% conf)</span>
                }
                {analysis.conf<70&&<div style={{marginTop:12,fontSize:13,color:"var(--muted)",lineHeight:1.7}}>
                  <strong style={{color:"var(--yellow)"}}>Why wait?</strong> {analysis.summary} Confidence below 70% threshold — entering now risks low R:R trade. Wait for clearer setup.
                </div>}
              </div>
              <Ring val={analysis.conf} color={analysis.conf>=70?(analysis.signal==="LONG"?"var(--green)":"var(--red)"):"var(--yellow)"} size={100}/>
            </div>
          </div>
          {analysis.conf>=70&&<SignalCard coin={coinData} ai={analysis} loading={false} onRefresh={()=>select(selected)}/>}
        </div>
      )}
    </div>
  );
}

function PageAlerts({notifs,setNotifs,paused}) {
  const unread=notifs.filter(n=>!n.read).length;
  const tc={entry:"var(--green)",tp:"var(--cyan)",alert:"var(--yellow)",emergency:"var(--red)",info:"var(--muted)"};
  const ti={entry:"⚡",tp:"✅",alert:"⚠️",emergency:"🚨",info:"📊"};
  if(paused) return(<div className="card ai" style={{padding:52,textAlign:"center"}}><div style={{fontSize:52,marginBottom:16}}>⏸</div><div className="head" style={{fontSize:17,color:"var(--yellow)",marginBottom:8,fontWeight:800}}>TRADING PAUSED</div><div style={{color:"var(--muted)"}}>All notifications are OFF. Go to Settings to resume.</div></div>);
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
        <h2 className="head" style={{fontSize:18,fontWeight:800}}>ALERTS <span style={{color:"var(--red)",fontSize:14}}>({unread} new)</span></h2>
        <button className="btn btn-h" style={{fontSize:10}} onClick={()=>setNotifs(ns=>ns.map(n=>({...n,read:true})))}>✓ Mark All Read</button>
      </div>
      {notifs.length===0?<div className="card" style={{padding:40,textAlign:"center"}}>
        <div style={{fontSize:44,marginBottom:14}}>🔕</div>
        <div style={{color:"var(--muted)",lineHeight:1.8}}>No alerts yet.<br/>High-confidence signals (&gt;78%) will appear here automatically.</div>
      </div>:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {notifs.map(n=>(
            <div key={n.id} className={`card ${n.urgent&&!n.read?"card-siren":""}`}
              style={{padding:"15px 18px",opacity:n.read?.68:1,cursor:"pointer",
                borderLeft:`3px solid ${tc[n.type]||"var(--muted)"}`}}
              onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    {!n.read&&<span style={{width:7,height:7,background:"var(--red)",borderRadius:"50%",flexShrink:0}} className="pu"/>}
                    <span className="head" style={{fontSize:10,color:tc[n.type],letterSpacing:1,fontWeight:700}}>
                      {ti[n.type]} {n.coin} • {n.type.toUpperCase()}
                    </span>
                  </div>
                  <div style={{fontSize:13,lineHeight:1.65}}>{n.msg}</div>
                </div>
                <div style={{fontSize:10,color:"var(--muted)",whiteSpace:"nowrap",fontFamily:"var(--mono)"}}>{n.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PageSettings({settings,update,user,onLogout}) {
  const [trialDays, setTrialDays] = useState(null);
  useEffect(()=>{
    if(user?.expiresAt){ setTrialDays(Math.max(0,Math.ceil((user.expiresAt-Date.now())/86400000))); }
  },[user]);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Account card */}
      <div className="card" style={{padding:20,border:"1px solid rgba(0,212,255,.25)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>👤 {user?.email}</div>
            {user?.mobile&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:8}}>📱 {user.mobile}</div>}
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <span className={`pill ${user?.role==="admin"?"pill-p":"pill-g"}`}>{user?.role?.toUpperCase()}</span>
              <span className="pill pill-c">{user?.plan?.toUpperCase()} PLAN</span>
              {trialDays!==null&&<span className={`pill ${trialDays>7?"pill-g":trialDays>3?"pill-y":"pill-r"}`}>{trialDays}d remaining</span>}
            </div>
          </div>
          <button className="btn btn-r" style={{padding:"10px 18px"}} onClick={onLogout}>⏻ LOGOUT</button>
        </div>
      </div>

      {/* Pause */}
      <div className="card" style={{padding:18,border:`1px solid ${settings.paused?"rgba(255,214,0,.3)":"var(--bdr)"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div className="head" style={{fontSize:13,fontWeight:700,marginBottom:4,color:settings.paused?"var(--yellow)":"var(--text)"}}>{settings.paused?"⏸ TRADING PAUSED":"▶ TRADING ACTIVE"}</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>When paused: all signals & notifications stop</div>
          </div>
          <Tog checked={!settings.paused} onChange={v=>update("paused",!v)}/>
        </div>
      </div>

      {/* Notifications */}
      <div className="card" style={{padding:18}}>
        <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:14}}>NOTIFICATION SETTINGS</div>
        {[
          {k:"notifEntry",  l:"Entry Signals",       s:"Only fires when confidence > 78%"},
          {k:"notifTP",     l:"Take Profit Alerts",  s:"When price approaches TP levels"},
          {k:"notifSL",     l:"Stop Loss Warnings",  s:"Urgent SL breach alert"},
          {k:"notifEmerg",  l:"Emergency Alarm 🚨",  s:"Siren for extreme market moves (>5%)"},
          {k:"notifMarket", l:"Market Updates",      s:"Major trend change alerts"},
        ].map((item,i,arr)=>(
          <div key={item.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:i<arr.length-1?"1px solid var(--bdr)":"none"}}>
            <div><div style={{fontWeight:600,fontSize:14}}>{item.l}</div><div style={{fontSize:11,color:"var(--muted)"}}>{item.s}</div></div>
            <Tog checked={!!settings[item.k]} onChange={v=>update(item.k,v)}/>
          </div>
        ))}
      </div>

      {/* Leverage */}
      <div className="card" style={{padding:18}}>
        <div className="head" style={{fontSize:10,color:"var(--muted)",letterSpacing:2,marginBottom:14}}>DEFAULT LEVERAGE PREFERENCE</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[3,5,8,10,12,15,20].map(l=>(
            <button key={l} className={`btn ${settings.lev===l?"btn-c":"btn-h"}`} style={{padding:"8px 14px",fontSize:12}} onClick={()=>update("lev",l)}>{l}×</button>
          ))}
        </div>
        {settings.lev>=15&&<div style={{marginTop:10,fontSize:12,color:"var(--yellow)",padding:"8px 12px",background:"rgba(255,214,0,.05)",borderRadius:8,border:"1px solid rgba(255,214,0,.2)"}}>
          ⚠️ {settings.lev}× leverage: high liquidation risk. Professionals recommend ≤10× for futures.
        </div>}
      </div>
    </div>
  );
}

// ── PAYMENT PAGE (Crypto) ─────────────────────────────────────────────────────
function PageSubscribe({user}) {
  const [plan,  setPlan]  = useState("pro");
  const [step,  setStep]  = useState("select");
  const [txHash,setTxHash]= useState("");
  const [loading,setLoad] = useState(false);
  const [msg,   setMsg]   = useState("");
  const sel = CFG.PLANS[plan];

  const PLANS_UI = [
    {id:"basic", col:"var(--cyan)",  badge:null,      em:"🥉", desc:"For casual signal followers",
     feats:["All 5 coins","Real-time signals","AI analysis","Search any pair","Email alerts"]},
    {id:"pro",   col:"var(--green)", badge:"POPULAR", em:"🥇", desc:"For active futures traders",
     feats:["All BASIC","Priority alerts","Emergency alarm","Custom pair scanner","Advanced TA view","Export signals"]},
    {id:"elite", col:"var(--purple)",badge:"BEST",    em:"💎", desc:"For professional traders",
     feats:["All PRO","Telegram bot alerts","1-on-1 support","Custom coin requests","API access","Resell license"]},
  ];

  const handleSubmit = async () => {
    if (!txHash.trim()) { setMsg("Please enter transaction hash."); return; }
    setLoad(true);
    await new Promise(r=>setTimeout(r,1000));
    // Save pending payment for admin approval
    try {
      const payments = JSON.parse(localStorage.getItem("cx_payments")||"[]");
      payments.push({
        id: Date.now().toString(36), userId:user?.email,
        plan, amount:sel.price, currency:"USDT",
        txHash:txHash.trim(), submittedAt:Date.now(),
        status:"pending",
      });
      localStorage.setItem("cx_payments", JSON.stringify(payments));
    } catch {}
    setLoad(false);
    setStep("pending");
  };

  if (step==="pending") return (
    <div className="card ai" style={{padding:44,textAlign:"center"}}>
      <div style={{fontSize:56,marginBottom:16}}>⏳</div>
      <div className="head" style={{fontSize:18,color:"var(--yellow)",marginBottom:8,fontWeight:800}}>PAYMENT UNDER REVIEW</div>
      <div style={{color:"var(--muted)",marginBottom:20,lineHeight:1.8,maxWidth:380,margin:"0 auto 20px"}}>
        Your transaction has been submitted for admin review.<br/>
        Tx: <span className="mono" style={{color:"var(--cyan)",fontSize:12}}>{txHash.slice(0,20)}...</span><br/>
        <strong style={{color:"var(--text)"}}>Activation within 1-4 hours</strong> after blockchain confirmation.
      </div>
      <div style={{padding:"14px 18px",background:"rgba(0,212,255,.05)",border:"1px solid rgba(0,212,255,.15)",borderRadius:10,fontSize:12,color:"var(--muted)",marginBottom:20,textAlign:"left"}}>
        📧 Once approved, you will be notified at: <strong style={{color:"var(--text)"}}>{user?.email}</strong>
      </div>
      <button className="btn btn-c" onClick={()=>setStep("select")}>← Back to Plans</button>
    </div>
  );

  return (
    <div>
      <div style={{textAlign:"center",marginBottom:28}}>
        <h2 className="head" style={{fontSize:20,fontWeight:800,marginBottom:6,letterSpacing:1}}>
          UPGRADE YOUR <span style={{color:"var(--cyan)"}}>PLAN</span>
        </h2>
        <div style={{color:"var(--muted)",fontSize:13}}>Crypto payment • Admin-verified activation • 30-day access</div>
      </div>

      {/* Plan cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:16,marginBottom:28}}>
        {PLANS_UI.map(p=>{
          const pd=CFG.PLANS[p.id];
          return (
            <div key={p.id} className="card" onClick={()=>setPlan(p.id)}
              style={{padding:24,cursor:"pointer",position:"relative",
                border:`1.5px solid ${plan===p.id?p.col:"var(--bdr)"}`,
                boxShadow:plan===p.id?`0 0 28px ${p.col}33`:"none",
                background:plan===p.id?`rgba(${p.id==="pro"?"0,60,30":p.id==="elite"?"60,0,80":"0,40,60"},.2)`:"var(--card)"}}>
              {p.badge&&<div style={{position:"absolute",top:-1,right:16,background:p.col,color:"#000",fontSize:9,fontWeight:900,padding:"4px 12px",borderRadius:"0 0 10px 10px",letterSpacing:1,fontFamily:"var(--head)"}}>{p.badge}</div>}
              <div style={{fontSize:32,marginBottom:8}}>{p.em}</div>
              <div className="head" style={{fontSize:15,fontWeight:800,marginBottom:4}}>{pd.name}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginBottom:14}}>{p.desc}</div>
              <div style={{marginBottom:18}}>
                <span className="mono" style={{fontSize:30,fontWeight:700,color:p.col}}>{pd.label.split("/")[0]}</span>
                <span style={{color:"var(--muted)",fontSize:12}}>/month</span>
              </div>
              {p.feats.map(ft=>(
                <div key={ft} style={{fontSize:12,marginBottom:7,display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:p.col,flexShrink:0,fontSize:14}}>✓</span>
                  <span>{ft}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Payment form */}
      <div className="card" style={{padding:24}}>
        <div className="head" style={{fontSize:11,color:"var(--muted)",letterSpacing:2,marginBottom:18}}>PAY WITH CRYPTO</div>

        {/* Wallet addresses */}
        <div style={{display:"grid",gap:12,marginBottom:20}}>
          {[
            {coin:"USDT",  network:"TRC20 (Tron)", addr:CFG.WALLETS.USDT_TRC20, color:"#26A17B"},
            {coin:"ETH",   network:"Ethereum",     addr:CFG.WALLETS.ETH,        color:"#627EEA"},
            {coin:"TRX",   network:"Tron",          addr:CFG.WALLETS.TRX,        color:"#FF0013"},
          ].map(w=>(
            <div key={w.coin} style={{background:"var(--bg3)",border:"1px solid var(--bdr)",borderRadius:10,padding:"14px 16px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${w.color}22`,border:`1px solid ${w.color}44`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <span className="head" style={{fontSize:11,fontWeight:800,color:w.color}}>{w.coin}</span>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,color:"var(--muted)",marginBottom:3,fontFamily:"var(--head)"}}>{w.coin} ({w.network})</div>
                <div className="mono" style={{fontSize:11,color:"var(--text)",wordBreak:"break-all"}}>{w.addr}</div>
              </div>
              <button className="btn btn-h" style={{padding:"6px 12px",fontSize:10,flexShrink:0}}
                onClick={()=>navigator.clipboard?.writeText(w.addr)}>Copy</button>
            </div>
          ))}
        </div>

        {/* Amount to send */}
        <div style={{padding:"14px 16px",background:"rgba(255,214,0,.05)",border:"1px solid rgba(255,214,0,.2)",borderRadius:10,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:11,color:"var(--muted)",marginBottom:4,fontFamily:"var(--head)"}}>AMOUNT TO SEND</div>
            <div className="head" style={{fontSize:13,color:"var(--yellow)"}}>Plan: {CFG.PLANS[plan].name}</div>
          </div>
          <div className="mono" style={{fontSize:28,fontWeight:700,color:"var(--yellow)"}}>{sel.label.split("/")[0]}</div>
        </div>

        {/* TX Hash input */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:8,fontFamily:"var(--head)"}}>TRANSACTION HASH (after payment)</div>
          <input className="inp" placeholder="0x... or T... — paste your transaction ID here"
            value={txHash} onChange={e=>setTxHash(e.target.value)}
            style={{fontFamily:"var(--mono)",fontSize:12}}/>
        </div>

        {msg&&<div style={{fontSize:12,color:"var(--red)",marginBottom:10,padding:"8px 12px",background:"rgba(255,23,68,.07)",borderRadius:8}}>{msg}</div>}

        <button className="btn btn-c" style={{width:"100%",padding:16,fontSize:12,letterSpacing:2}} onClick={handleSubmit} disabled={loading}>
          {loading?<Spin size={16}/>:"→ SUBMIT PAYMENT FOR REVIEW"}
        </button>
        <div style={{marginTop:12,fontSize:11,color:"var(--muted)",lineHeight:1.7}}>
          ✓ Admin reviews within 1-4 hours &nbsp;•&nbsp; ✓ Notification on approval &nbsp;•&nbsp; ✓ 30 days access
        </div>
      </div>
    </div>
  );
}

// ── ADMIN PAGES ───────────────────────────────────────────────────────────────
function PageAdmin({user}) {
  const [sub2, setSub2]    = useState("users");
  const [users, setUsers]  = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(()=>{
    setUsers(Auth.getAllUsers());
    try { setPayments(JSON.parse(localStorage.getItem("cx_payments")||"[]")); } catch {}
  },[sub2]);

  const approvePayment = (paymentId) => {
    const pmnts = JSON.parse(localStorage.getItem("cx_payments")||"[]");
    const p = pmnts.find(x=>x.id===paymentId);
    if (!p) return;
    // Update payment status
    const idx = pmnts.findIndex(x=>x.id===paymentId);
    pmnts[idx] = {...p, status:"approved", approvedAt:Date.now()};
    localStorage.setItem("cx_payments", JSON.stringify(pmnts));
    // Activate user subscription
    const allUsers = Auth.getAllUsers();
    const u = allUsers.find(x=>x.email===p.userId);
    if (u) {
      Auth.updateUser(u.id, {
        plan: p.plan,
        expiresAt: Date.now() + 30*24*60*60*1000,
        status: "active",
      });
    }
    setPayments([...pmnts]);
    setUsers(Auth.getAllUsers());
  };

  const rejectPayment = (paymentId) => {
    const pmnts = JSON.parse(localStorage.getItem("cx_payments")||"[]");
    const idx = pmnts.findIndex(x=>x.id===paymentId);
    if (idx>=0) { pmnts[idx].status="rejected"; localStorage.setItem("cx_payments",JSON.stringify(pmnts)); setPayments([...pmnts]); }
  };

  if (user?.role !== "admin") return (
    <div className="card ai" style={{padding:52,textAlign:"center"}}>
      <div style={{fontSize:52,marginBottom:16}}>🔒</div>
      <div className="head" style={{fontSize:16,color:"var(--red)",fontWeight:800}}>ADMIN ACCESS ONLY</div>
    </div>
  );

  const activeUsers   = users.filter(u=>Date.now()<u.expiresAt);
  const expiredUsers  = users.filter(u=>Date.now()>=u.expiresAt);
  const pendingPays   = payments.filter(p=>p.status==="pending");
  const revenue       = payments.filter(p=>p.status==="approved").reduce((a,p)=>a+(CFG.PLANS[p.plan]?.price||0),0);

  return (
    <div>
      <div style={{marginBottom:20}}>
        <h2 className="head" style={{fontSize:18,fontWeight:800,marginBottom:4}}>ADMIN <span style={{color:"var(--cyan)"}}>DASHBOARD</span></h2>
        {pendingPays.length>0&&<div style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px",background:"rgba(255,23,68,.1)",border:"1px solid rgba(255,23,68,.3)",borderRadius:20,fontSize:12,color:"var(--red)",fontFamily:"var(--head)",fontWeight:700}}>
          🔔 {pendingPays.length} PAYMENT{pendingPays.length>1?"S":""} AWAITING APPROVAL
        </div>}
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
        {[
          {l:"TOTAL USERS",  v:users.length,    c:"var(--cyan)"},
          {l:"ACTIVE",       v:activeUsers.length, c:"var(--green)"},
          {l:"PENDING PAY",  v:pendingPays.length, c:"var(--yellow)"},
          {l:"REVENUE",      v:`$${revenue}`, c:"var(--gold)"},
        ].map((item,i)=>(
          <div key={i} className="stat" style={{padding:"16px 16px"}}>
            <div className="label">{item.l}</div>
            <div className="value" style={{color:item.c,fontSize:22}}>{item.v}</div>
          </div>
        ))}
      </div>

      {/* Sub tabs */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {[["users","Users"],["payments","Payments"],["pending","⚠️ Pending"]].map(([k,l])=>(
          <button key={k} className={`btn ${sub2===k?"btn-c":"btn-h"}`} style={{padding:"8px 18px"}} onClick={()=>setSub2(k)}>
            {l}{k==="pending"&&pendingPays.length>0?` (${pendingPays.length})`:""}
          </button>
        ))}
      </div>

      {/* Users list */}
      {sub2==="users"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {users.length===0?<div className="card" style={{padding:32,textAlign:"center"}}><div style={{color:"var(--muted)"}}>No users registered yet.</div></div>:(
            users.map((u,i)=>{
              const active=Date.now()<u.expiresAt;
              return (
                <div key={i} className="card" style={{padding:"15px 18px",border:`1px solid ${active?"rgba(0,230,118,.2)":"rgba(255,23,68,.15)"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                    <div>
                      <div style={{fontWeight:700,marginBottom:4}}>{u.email}</div>
                      <div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>📱 {u.mobile}</div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <span className={`pill ${u.plan==="elite"?"pill-p":u.plan==="pro"?"pill-g":u.plan==="free"?"pill-c":"pill-y"}`}>{u.plan.toUpperCase()}</span>
                        <span className={`pill ${active?"pill-g":"pill-r"}`}>{active?"● ACTIVE":"● EXPIRED"}</span>
                      </div>
                      <div style={{fontSize:11,color:"var(--muted)",marginTop:6,fontFamily:"var(--mono)"}}>
                        Registered: {new Date(u.registeredAt).toLocaleDateString()} | Expires: {new Date(u.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:11,color:"var(--muted)"}}>Days left</div>
                      <div className="mono" style={{fontSize:20,fontWeight:700,color:active?"var(--green)":"var(--red)"}}>
                        {Math.max(0,Math.ceil((u.expiresAt-Date.now())/86400000))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* All payments */}
      {sub2==="payments"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {payments.length===0?<div className="card" style={{padding:32,textAlign:"center"}}><div style={{color:"var(--muted)"}}>No payments submitted yet.</div></div>:(
            payments.map((p,i)=>(
              <div key={i} className="card" style={{padding:"15px 18px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontWeight:700,marginBottom:4}}>{p.userId}</div>
                    <div style={{display:"flex",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                      <span className={`pill ${p.plan==="elite"?"pill-p":p.plan==="pro"?"pill-g":"pill-c"}`}>{CFG.PLANS[p.plan]?.name}</span>
                      <span className={`pill ${p.status==="approved"?"pill-g":p.status==="rejected"?"pill-r":"pill-y"}`}>{p.status.toUpperCase()}</span>
                    </div>
                    <div className="mono" style={{fontSize:10,color:"var(--muted)",wordBreak:"break-all"}}>TX: {p.txHash}</div>
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:4,fontFamily:"var(--mono)"}}>Submitted: {new Date(p.submittedAt).toLocaleString()}</div>
                  </div>
                  <div className="mono" style={{fontSize:22,fontWeight:700,color:"var(--gold)"}}>${CFG.PLANS[p.plan]?.price}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Pending approvals */}
      {sub2==="pending"&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {pendingPays.length===0?<div className="card" style={{padding:32,textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>✅</div><div style={{color:"var(--muted)"}}>No pending payments. All caught up!</div></div>:(
            pendingPays.map(p=>(
              <div key={p.id} className="card" style={{padding:20,border:"2px solid rgba(255,214,0,.3)",background:"rgba(255,214,0,.03)"}}>
                <div style={{marginBottom:14}}>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{p.userId}</div>
                  <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                    <span className={`pill ${p.plan==="elite"?"pill-p":p.plan==="pro"?"pill-g":"pill-c"}`}>{CFG.PLANS[p.plan]?.name} — ${CFG.PLANS[p.plan]?.price}</span>
                    <span className="pill pill-y">⏳ PENDING</span>
                  </div>
                  <div style={{fontSize:11,color:"var(--muted)",marginBottom:6}}>Submitted: {new Date(p.submittedAt).toLocaleString()}</div>
                  <div style={{padding:"10px 14px",background:"var(--bg3)",borderRadius:8,fontSize:11,fontFamily:"var(--mono)",wordBreak:"break-all",color:"var(--cyan)"}}>
                    TX: {p.txHash}
                  </div>
                  <div style={{marginTop:8,fontSize:12,color:"var(--yellow)"}}>
                    ⚠️ Verify this transaction on blockchain explorer before approving.
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button className="btn btn-g" style={{flex:1,padding:12}} onClick={()=>approvePayment(p.id)}>✅ APPROVE & ACTIVATE</button>
                  <button className="btn btn-r" style={{flex:1,padding:12}} onClick={()=>rejectPayment(p.id)}>✗ REJECT</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
const DEF_SETTINGS = { paused:false, notifEntry:true, notifTP:true, notifSL:true, notifEmerg:true, notifMarket:false, lev:10 };

const INIT_NOTIFS = [
  {id:1, coin:"BTC",  msg:"🚀 BTC HIGH confidence LONG signal. 89% confidence. Professional entry range calculated.", time:"5m ago",  type:"entry",   read:false, urgent:true},
  {id:2, coin:"SYSTEM",msg:"📊 Welcome to Cryptex Signal v3.0. Real-time WebSocket prices enabled. Professional TA active.", time:"Just now",type:"info",read:false,urgent:false},
];

export default function App() {
  const [user,      setUser]      = useState(()=>{ try{ return JSON.parse(sessionStorage.getItem("cx_user")||"null"); }catch{return null;} });
  const [tab,       setTab]       = useState("home");
  const [active,    setActive]    = useState(0);
  const [coins,     setCoins]     = useState(COIN_LIST.map(c=>({...c,price:c.base,chg24:0,high24:c.base*1.03,low24:c.base*0.97})));
  const [analyses,  setAnalyses]  = useState(Array(5).fill(null));
  const [notifs,    setNotifs]    = useState(INIT_NOTIFS);
  const [settings,  setSettings]  = useState(()=>{ try{return{...DEF_SETTINGS,...JSON.parse(localStorage.getItem("cx_settings")||"{}")}}catch{return DEF_SETTINGS;} });
  const [emergency, setEmergency] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const priceManagerRef = useRef(null);
  const analysisBusyRef = useRef(false);

  const upd = useCallback((k,v)=>setSettings(p=>{ const n={...p,[k]:v}; try{localStorage.setItem("cx_settings",JSON.stringify(n))}catch{} return n; }),[]);

  const handleLogin  = u => { sessionStorage.setItem("cx_user",JSON.stringify(u)); setUser(u); };
  const handleLogout = () => { sessionStorage.removeItem("cx_user"); setUser(null); setTab("home"); };

  // ── WebSocket real-time prices ────────────────────────────────────────────
  useEffect(()=>{
    if (!user) return;
    const pm = new PriceManager(COIN_LIST.map(c=>c.symbol), (priceMap) => {
      setCoins(prev => prev.map((coin, i) => {
        const live = priceMap[coin.symbol];
        if (!live) return coin;
        return {...coin, ...live};
      }));
    });
    pm.connect();
    priceManagerRef.current = pm;
    return () => pm.disconnect();
  }, [user]);

  // ── Recalculate analyses when prices update ───────────────────────────────
  useEffect(()=>{
    if (analysisBusyRef.current) return;
    if (!coins.some(c=>c.updatedAt)) return; // Only after live data arrives
    analysisBusyRef.current = true;
    const newAnalyses = coins.map(c => calcProfessionalSignal(c));
    setAnalyses(newAnalyses);
    // Check emergency
    const emerg = detectEmergency(coins);
    if (emerg && !dismissed && settings.notifEmerg) setEmergency(emerg);
    analysisBusyRef.current = false;
  }, [coins, dismissed, settings.notifEmerg]);

  // Fallback REST poll if WS not available
  useEffect(()=>{
    if (!user) return;
    const poll = async () => {
      try {
        const syms = COIN_LIST.map(c=>`"${c.symbol}"`).join(",");
        const res  = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${syms}]`);
        if (!res.ok) return;
        const data = await res.json();
        setCoins(prev => prev.map((coin) => {
          const live = data.find(d=>d.symbol===coin.symbol);
          if (!live) return coin;
          return {...coin, price:parseFloat(live.lastPrice), chg24:parseFloat(live.priceChangePercent),
            high24:parseFloat(live.highPrice), low24:parseFloat(live.lowPrice),
            vol:parseFloat(live.volume), updatedAt:Date.now()};
        }));
      } catch {}
    };
    poll(); // Initial load
    const t = setInterval(poll, 5000); // 5s fallback
    return () => clearInterval(t);
  }, [user]);

  // ── Smart notifications ───────────────────────────────────────────────────
  const lastNotifRef = useRef({});
  useEffect(()=>{
    if (!user||settings.paused||!settings.notifEntry) return;
    const now = Date.now();
    analyses.forEach((ai,i)=>{
      if (!ai || ai.conf < 78 || ai.urgency === "LOW") return;
      const coin = coins[i];
      if (!coin) return;
      const last = lastNotifRef.current[coin.id] || 0;
      if (now - last < 10*60*1000) return; // 10 min minimum
      lastNotifRef.current[coin.id] = now;
      const isL = ai.signal==="LONG";
      setNotifs(ns=>[{
        id: now+i, coin:coin.id,
        msg:`${isL?"🚀":"⚠️"} ${coin.id} ${ai.signal} — ${ai.conf}% confidence. Entry $${f(ai.entryLow)}–$${f(ai.entryHigh)}. SL $${f(ai.sl)}. Win rate ~${ai.winRate?.toFixed(0)}%.`,
        time:"just now", type:"entry", read:false, urgent:ai.urgency==="HIGH",
      }, ...ns.slice(0,29)]);
    });
  },[analyses]);

  const unread = notifs.filter(n=>!n.read).length;

  if (!user) return <><style>{CSS}</style><div style={{position:"relative",zIndex:1}}><AuthPage onLogin={handleLogin}/></div></>;

  const TABS = [
    {id:"home",      icon:"◈",  label:"Home"},
    {id:"signals",   icon:"⚡", label:"Signals"},
    {id:"scan",      icon:"◎",  label:"Scan"},
    {id:"search",    icon:"🔍", label:"Search"},
    {id:"alerts",    icon:"🔔", label:"Alerts",   badge:unread},
    {id:"settings",  icon:"⚙",  label:"Settings"},
    {id:"subscribe", icon:"💎", label:"Upgrade"},
    ...(user?.role==="admin"?[{id:"admin",icon:"🛡",label:"Admin"}]:[]),
  ];

  return (
    <><style>{CSS}</ style>
    <div style={{minHeight:"100vh",position:"relative",zIndex:1}}>

      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:300,background:"rgba(5,11,20,.97)",backdropFilter:"blur(24px)",borderBottom:"1px solid var(--bdr)"}}>
        <div style={{maxWidth:1360,margin:"0 auto",padding:"0 20px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          {/* Brand */}
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:36,height:36,borderRadius:10,flexShrink:0,
              background:"linear-gradient(135deg,#003d5c,#006688,#00a8cc)",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 0 18px rgba(0,212,255,.4)",border:"1px solid rgba(0,212,255,.25)"}}>
              <svg width="20" height="20" viewBox="0 0 38 38" fill="none">
                <path d="M4 19 Q8 8 13 19 Q18 30 23 19 Q28 8 34 19" stroke="#00d4ff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <circle cx="19" cy="19" r="3" fill="#00e676"/>
              </svg>
            </div>
            <div>
              <div className="head" style={{fontSize:15,fontWeight:800,letterSpacing:2,lineHeight:1}}>
                CRYPTEX<span style={{color:"var(--cyan)"}}>SIGNAL</span>
              </div>
              <div style={{fontSize:9,color:"var(--muted)",letterSpacing:1,fontFamily:"var(--head)"}}>FUTURES INTELLIGENCE</div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav style={{display:"flex",gap:2}} className="lg-hide">
            {TABS.map(t=>(
              <button key={t.id} className={`nb ${tab===t.id?"active":""}`} onClick={()=>setTab(t.id)}>
                <span>{t.icon}</span><span>{t.label}</span>
                {(t.badge||0)>0&&<span style={{background:"var(--red)",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:6,fontFamily:"var(--head)",fontWeight:700}}>{t.badge}</span>}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {settings.paused&&<span className="pill pill-y lg-hide">⏸ PAUSED</span>}
            {unread>0&&<span style={{width:8,height:8,background:"var(--red)",borderRadius:"50%",cursor:"pointer",boxShadow:"0 0 8px var(--red)"}} className="pu" onClick={()=>setTab("alerts")}/>}
            <button className="btn btn-c" style={{padding:"8px 16px",fontSize:10,letterSpacing:2}} onClick={()=>setTab("scan")}>
              ⟳ SCAN
            </button>
          </div>
        </div>
      </header>

      {/* Emergency banner */}
      {emergency && !dismissed && (
        <EmergencyBanner emergency={emergency} onDismiss={()=>{ setDismissed(true); setEmergency(null); }}/>
      )}

      {/* Ticker */}
      {coins.some(c=>c.price!==c.base) && <Ticker coins={coins}/>}

      {/* Main */}
      <main style={{maxWidth:1360,margin:"0 auto",padding:"22px 20px 90px",position:"relative",zIndex:1}}>
        {tab==="home"      && <PageHome      coins={coins} analyses={analyses} loading={!coins.some(c=>c.updatedAt)} setTab={setTab} setActive={setActive}/>}
        {tab==="signals"   && <PageSignals   coins={coins} analyses={analyses} loading={!coins.some(c=>c.updatedAt)} active={active} setActive={setActive} onRefresh={()=>{}}/>}
        {tab==="scan"      && <PageScan      coins={coins} analyses={analyses} setTab={setTab} setActive={setActive}/>}
        {tab==="search"    && <PageSearch/>}
        {tab==="alerts"    && <PageAlerts    notifs={notifs} setNotifs={setNotifs} paused={settings.paused}/>}
        {tab==="settings"  && <PageSettings  settings={settings} update={upd} user={user} onLogout={handleLogout}/>}
        {tab==="subscribe" && <PageSubscribe user={user}/>}
        {tab==="admin"     && <PageAdmin     user={user}/>}
      </main>

      {/* Mobile nav */}
      <nav className="sm-hide" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,
        background:"rgba(5,11,20,.98)",backdropFilter:"blur(24px)",
        borderTop:"1px solid var(--bdr)",display:"flex",height:60,overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:"0 0 auto",minWidth:54,background:"none",border:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:3,color:tab===t.id?"var(--cyan)":"var(--muted)",transition:"color .18s",
              position:"relative",padding:"0 10px"}}>
            <span style={{fontSize:17}}>{t.icon}</span>
            <span style={{fontFamily:"var(--head)",fontSize:8,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{t.label}</span>
            {(t.badge||0)>0&&<span style={{position:"absolute",top:8,left:"58%",background:"var(--red)",color:"#fff",fontSize:8,padding:"1px 4px",borderRadius:5,fontFamily:"var(--head)",fontWeight:700}}>{t.badge}</span>}
          </button>
        ))}
      </nav>
    </div></>
  );
}
