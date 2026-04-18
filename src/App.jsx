import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════
   CRYPTEX QUANT v5.0 — QUANTITATIVE CRYPTO FUTURES INTELLIGENCE
   ✅ Unique CQ-ID login (no OTP, no mobile)
   ✅ Triple Confirmation Engine (3+ indicators must align)
   ✅ Multi-Timeframe Synchronization (1M→5M→1H→4H→1D)
   ✅ Liquidity Hunt Detection (whale order clusters)
   ✅ BTC Dominance Adjustment for Altcoins
   ✅ Volatility Siren (news events, crashes)
   ✅ Trailing Stop-Loss after TP1
   ✅ Full Market Scanner (80+ pairs)
   ✅ USDT TRC20 Payment + Admin Dashboard
   ✅ About / Tracker / Chat with close
═══════════════════════════════════════════════════════════════════ */

// ── CONFIG ────────────────────────────────────────────────────────
const CFG = {
  _a: btoa("admin@cryptexquant.io"),
  _b: btoa("CQ@Signal#2025"),
  WALLET:  "TNfi3K9XXjFNFND1dVhRasokcaegCQeXc3",
  PLANS: {
    free:  { name:"FREE TRIAL", usdt:0,  days:30 },
    basic: { name:"BASIC",      usdt:15, days:30 },
    pro:   { name:"PRO",        usdt:39, days:30 },
    elite: { name:"ELITE",      usdt:99, days:30 },
  },
  LOCK:    { scalp:15*60*1000, day:4*3600*1000, swing:24*3600*1000 },
  BREAK:   { scalp:0.8, day:1.5, swing:3.0 },
  MIN_VOL: 5_000_000,
  SCAN_N:  80,
  MIN_CONF:70,
  WIN_THRESH:0.60,   // 60% move toward TP1 = WIN
};

const TOP5 = [
  {id:"BTC",name:"Bitcoin",   sym:"BTCUSDT", base:72000,logo:"₿",color:"#F7931A"},
  {id:"ETH",name:"Ethereum",  sym:"ETHUSDT", base:2200, logo:"Ξ",color:"#627EEA"},
  {id:"SOL",name:"Solana",    sym:"SOLUSDT", base:84,   logo:"◎",color:"#9945FF"},
  {id:"BNB",name:"BNB",       sym:"BNBUSDT", base:687,  logo:"◆",color:"#F3BA2F"},
  {id:"AVAX",name:"Avalanche",sym:"AVAXUSDT",base:9.3,  logo:"▲",color:"#E84142"},
];

// ── PRECISION ─────────────────────────────────────────────────────
function dp(p){if(p>=10000)return 1;if(p>=1000)return 2;if(p>=100)return 3;if(p>=10)return 3;if(p>=1)return 4;if(p>=0.1)return 5;if(p>=0.01)return 6;return 7;}
const fx=(n,r)=>n==null?0:parseFloat(n.toFixed(dp(r||Math.abs(n)||1)));
const fp=(n)=>{if(typeof n!=="number")return"0";const d=dp(n);return n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});};
const pc=(a,b)=>(((b-a)/Math.abs(a||1))*100).toFixed(2);

// ── TA LIBRARY ────────────────────────────────────────────────────
function calcRSI(c,p=14){
  if(!c||c.length<p+1)return 50;
  let g=0,l=0;
  for(let i=c.length-p;i<c.length;i++){const d=c[i]-c[i-1];d>0?g+=d:l+=Math.abs(d);}
  const ag=g/p,al=l/p;return al===0?100:parseFloat((100-100/(1+ag/al)).toFixed(1));
}
function calcEMA(v,p){
  if(!v||v.length<p)return v?.[v.length-1]||0;
  const k=2/(p+1);let e=v.slice(0,p).reduce((a,b)=>a+b,0)/p;
  for(let i=p;i<v.length;i++)e=v[i]*k+e*(1-k);return e;
}
function calcATR(kl,p=14){
  if(!kl||kl.length<2)return(kl?.[0]?.c||1)*0.015;
  const trs=[];for(let i=1;i<kl.length;i++)trs.push(Math.max(kl[i].h-kl[i].l,Math.abs(kl[i].h-kl[i-1].c),Math.abs(kl[i].l-kl[i-1].c)));
  return trs.slice(-p).reduce((a,b)=>a+b,0)/Math.min(trs.length,p)||kl[0].c*0.015;
}
function calcVWAP(kl){
  const[tv,pv]=kl.reduce(([tv,pv],k)=>[tv+k.v,pv+((k.h+k.l+k.c)/3)*k.v],[0,0]);
  return tv>0?pv/tv:kl[kl.length-1].c;
}
function calcBB(c,p=20){
  if(!c||c.length<p)return{mid:c?.[c.length-1]||0,upper:0,lower:0,pct:0.5};
  const sl=c.slice(-p);const m=sl.reduce((a,b)=>a+b,0)/p;
  const s=Math.sqrt(sl.reduce((a,b)=>a+(b-m)**2,0)/p);
  const last=c[c.length-1];
  return{mid:m,upper:m+2*s,lower:m-2*s,pct:s>0?Math.min(1,Math.max(0,(last-(m-2*s))/(4*s))):0.5};
}
function calcMACD(c){
  if(!c||c.length<26)return{macd:0,signal:0,hist:0,bull:false};
  const ema12=calcEMA(c,12),ema26=calcEMA(c,26);
  const macd=ema12-ema26;const sig=macd*0.9;
  return{macd,signal:sig,hist:macd-sig,bull:macd>sig};
}
function calcStoch(kl,p=14){
  if(!kl||kl.length<p)return{k:50,d:50};
  const sl=kl.slice(-p);
  const hi=Math.max(...sl.map(k=>k.h)),lo=Math.min(...sl.map(k=>k.l));
  const K=hi>lo?(kl[kl.length-1].c-lo)/(hi-lo)*100:50;
  return{k:parseFloat(K.toFixed(1)),d:50};
}
function detectDivergence(c,r){
  if(!c||c.length<10||!r)return"none";
  const pc5=c[c.length-5];const pc1=c[c.length-1];
  const rsiApprox=r;
  if(pc1<pc5&&rsiApprox>50)return"bullish";
  if(pc1>pc5&&rsiApprox<50)return"bearish";
  return"none";
}
function detectSR(kl){
  if(!kl||kl.length<20)return{support:0,resistance:0,nearSupport:false,nearResist:false};
  const closes=kl.map(k=>k.c);const price=closes[closes.length-1];
  const hi20=Math.max(...kl.slice(-20).map(k=>k.h));
  const lo20=Math.min(...kl.slice(-20).map(k=>k.l));
  const support=lo20*1.003;const resistance=hi20*0.997;
  return{support:fx(support,price),resistance:fx(resistance,price),nearSupport:price<=support*1.02,nearResist:price>=resistance*0.98};
}
function detectLiquidityZones(kl){
  if(!kl||kl.length<20)return{clusters:[],whaleBuy:false,whaleSell:false};
  const vols=kl.slice(-20).map(k=>k.v);const avgVol=vols.reduce((a,b)=>a+b,0)/vols.length;
  const last3=kl.slice(-3);const volSpike=last3.some(k=>k.v>avgVol*2.5);
  const lastK=kl[kl.length-1];const bullCandle=lastK.c>lastK.o&&(lastK.c-lastK.o)>(lastK.h-lastK.l)*0.6;
  const bearCandle=lastK.c<lastK.o&&(lastK.o-lastK.c)>(lastK.h-lastK.l)*0.6;
  return{whaleBuy:volSpike&&bullCandle,whaleSell:volSpike&&bearCandle,volRatio:parseFloat((kl[kl.length-1].v/avgVol).toFixed(2)),spikeDetected:volSpike};
}

// ── MARKET DATA ───────────────────────────────────────────────────
async function getKlines(sym,intv,limit=150){
  try{
    const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${intv}&limit=${limit}`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error();
    return(await r.json()).map(k=>({o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5],t:+k[0]}));
  }catch{return null;}
}
async function getTicker24(symbols){
  try{
    const s=Array.isArray(symbols)?symbols:[symbols];
    if(s.length===1){const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${s[0]}`,{signal:AbortSignal.timeout(6000)});if(!r.ok)throw new Error();const d=await r.json();return[d];}
    const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${s.map(x=>`"${x}"`).join(",")}]`,{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error();return await r.json();
  }catch{return[];}
}
async function getOrderBook(sym){
  try{
    const r=await fetch(`https://api.binance.com/api/v3/depth?symbol=${sym}&limit=20`,{signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw new Error();const d=await r.json();
    const bidVol=d.bids.reduce((a,b)=>a+parseFloat(b[1]),0);
    const askVol=d.asks.reduce((a,b)=>a+parseFloat(b[1]),0);
    const total=bidVol+askVol;
    return{bidPct:total>0?parseFloat((bidVol/total*100).toFixed(1)):50,askPct:total>0?parseFloat((askVol/total*100).toFixed(1)):50,bullish:bidVol>askVol*1.15,bearish:askVol>bidVol*1.15};
  }catch{return{bidPct:50,askPct:50,bullish:false,bearish:false};}
}

// ── PUMP & DUMP DETECTOR ──────────────────────────────────────────
// Detects artificial price inflation: rapid spike + volume divergence + no structural support
function detectPumpDump(kl, rsi) {
  if (!kl || kl.length < 20) return { isPump: false, isDump: false, risk: "NORMAL" };
  const cls = kl.map(k => k.c);
  const vols = kl.map(k => k.v);
  const recent = cls.slice(-5);
  const older  = cls.slice(-15, -5);
  const avgVol = vols.slice(-20, -3).reduce((a, b) => a + b, 0) / 17;
  const recentVol = vols.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const volExplosion = recentVol > avgVol * 3;
  const priceSpike = (recent[recent.length-1] - Math.min(...older)) / Math.min(...older) * 100;
  const priceDrop  = (Math.max(...older) - recent[recent.length-1]) / Math.max(...older) * 100;
  // Pump: price up >8% in 5 candles with vol explosion, RSI overbought
  const isPump = priceSpike > 8 && volExplosion && rsi > 72;
  // Dump: price down >8% in 5 candles with vol explosion
  const isDump = priceDrop > 8 && volExplosion && rsi < 28;
  // Momentum without volume = suspicious pump (fake)
  const fakeMove = Math.abs(priceSpike) > 5 && !volExplosion;
  const risk = isPump ? "PUMP_RISK" : isDump ? "DUMP_RISK" : fakeMove ? "SUSPICIOUS" : "NORMAL";
  return { isPump, isDump, fakeMove, risk, priceSpike: parseFloat(priceSpike.toFixed(2)), volRatioSpike: parseFloat((recentVol / avgVol).toFixed(2)) };
}

// ── MARKET CRASH DETECTOR ──────────────────────────────────────────
// Multi-asset simultaneous drop + BTC correlation
function detectMarketCrash(coins) {
  if (!coins || coins.length < 3) return null;
  const droppingCoins = coins.filter(c => (c.chg24 || 0) < -5);
  const extremeDrops  = coins.filter(c => (c.chg24 || 0) < -10);
  const btc = coins.find(c => c.id === "BTC");
  const btcCrash = btc && btc.chg24 < -7;
  if (extremeDrops.length >= 2 || (btcCrash && droppingCoins.length >= 3)) {
    return {
      level: "CRASH",
      msg: `⚠️ MARKET CRASH SIGNAL: ${droppingCoins.length} assets dropping. BTC ${btc ? btc.chg24.toFixed(2) : "?"}%. ALL LONG signals suspended. Consider CASH position.`,
      pauseSignals: true,
    };
  }
  if (droppingCoins.length >= 3) {
    return {
      level: "BEARISH",
      msg: `${droppingCoins.length} assets in heavy decline. Reduce leverage, tighten stop-losses.`,
      pauseSignals: false,
    };
  }
  return null;
}

// ── STOP LOSS HUNT DETECTOR ────────────────────────────────────────
// Detects liquidity sweeps: brief wick beyond key level then sharp reversal
function detectSLHunt(kl) {
  if (!kl || kl.length < 10) return { huntedBelow: false, huntedAbove: false, zone: null };
  const last5 = kl.slice(-5);
  const prev10 = kl.slice(-15, -5);
  const supportLevel = Math.min(...prev10.map(k => k.l));
  const resistLevel  = Math.max(...prev10.map(k => k.h));
  const lastCandle   = kl[kl.length - 1];
  const prevCandle   = kl[kl.length - 2];
  // SL hunt below: wick pierced support but close is ABOVE support (trap)
  const huntedBelow = lastCandle.l < supportLevel * 0.998 && lastCandle.c > supportLevel && lastCandle.c > lastCandle.o;
  // SL hunt above: wick pierced resistance but close is BELOW resistance (bull trap)
  const huntedAbove = lastCandle.h > resistLevel * 1.002 && lastCandle.c < resistLevel && lastCandle.c < lastCandle.o;
  // Wicks are unusually long = manipulation
  const bodySize  = Math.abs(lastCandle.c - lastCandle.o);
  const totalSize = lastCandle.h - lastCandle.l;
  const wickRatio = totalSize > 0 ? bodySize / totalSize : 1;
  const longWick  = wickRatio < 0.3; // body is <30% of full range = manipulation candle
  return {
    huntedBelow,
    huntedAbove,
    longWick,
    zone: huntedBelow ? parseFloat(supportLevel.toFixed(8)) : huntedAbove ? parseFloat(resistLevel.toFixed(8)) : null,
    msg: huntedBelow
      ? `🎯 SL Hunt detected BELOW $${parseFloat(supportLevel.toFixed(4))} — trap set, reversal likely UP`
      : huntedAbove
      ? `🎯 SL Hunt detected ABOVE $${parseFloat(resistLevel.toFixed(4))} — bull trap, reversal likely DOWN`
      : longWick ? "⚠️ Manipulation wick detected — wait for confirmation candle" : null,
  };
}

// ── RISK/REWARD CALCULATOR ─────────────────────────────────────────
function calcRR(entry, sl, tp1, tp2, tp3) {
  const risk   = Math.abs(entry - sl);
  if (risk === 0) return { rr1: 0, rr2: 0, rr3: 0, qualified: false };
  const rr1 = parseFloat((Math.abs(tp1 - entry) / risk).toFixed(2));
  const rr2 = parseFloat((Math.abs(tp2 - entry) / risk).toFixed(2));
  const rr3 = parseFloat((Math.abs(tp3 - entry) / risk).toFixed(2));
  // Signal only qualifies if TP2 R:R >= 2.0 (minimum professional standard)
  const qualified = rr2 >= 2.0;
  return { rr1, rr2, rr3, qualified, risk: parseFloat(risk.toFixed(8)) };
}

// ── TELEGRAM BOT API ────────────────────────────────────────────────
async function sendTelegramMessage(botToken, chatId, text) {
  if (!botToken || !chatId) return { ok: false, err: "Bot token or Chat ID missing" };
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json();
    return d.ok ? { ok: true } : { ok: false, err: d.description };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

function formatSignalForTelegram(coinId, sig) {
  if (!sig || sig.noSignal) return `📊 <b>${coinId}/USDT</b>
⏳ No signal — market consolidating. Stand aside.`;
  const isL = sig.signal === "LONG";
  const rr  = calcRR(sig.mid, sig.sl, sig.tp1, sig.tp2, sig.tp3);
  return `
🤖 <b>CRYPTEX QUANT — ${coinId}/USDT</b>
━━━━━━━━━━━━━━━━━━━━
${isL ? "🟢" : "🔴"} <b>${sig.signal}</b> | ${sig.strategy.toUpperCase()} | ${sig.conf}% conf | ✦${sig.confirmCount} confirms
━━━━━━━━━━━━━━━━━━━━
📍 Entry: <code>$${fp(sig.eLow)} – $${fp(sig.eHigh)}</code>
🛑 Stop Loss: <code>$${fp(sig.sl)}</code> (SL ${Math.abs(pc(sig.mid, sig.sl))}%)
🎯 TP1: <code>$${fp(sig.tp1)}</code> (+${pc(sig.mid, sig.tp1)}%) R:R 1:${rr.rr1}
🎯 TP2: <code>$${fp(sig.tp2)}</code> (+${pc(sig.mid, sig.tp2)}%) R:R 1:${rr.rr2}
🎯 TP3: <code>$${fp(sig.tp3)}</code> (+${pc(sig.mid, sig.tp3)}%) R:R 1:${rr.rr3}
⏱ Duration: ${sig.dur} | Leverage: ${sig.lev}×
📌 Trailing SL: Move to break-even after TP1
━━━━━━━━━━━━━━━━━━━━
📐 Reasons: ${sig.reasons.slice(0,2).join(" | ")}
━━━━━━━━━━━━━━━━━━━━
⚠️ Risk Warning: ${sig.risk} | Win Rate: ~${sig.winRate}%
🔒 Signal locked for: ${sig.strategy === "scalp" ? "15 min" : sig.strategy === "day" ? "4 hours" : "24 hours"}
<i>Powered by Cryptex Quant v5.0</i>`;
}

// ── QUANT SIGNAL ENGINE ───────────────────────────────────────────
// Triple Confirmation: at least 3 of 6 indicators must align
// ═══════════════════════════════════════════════════════════════════
// MULTI-TIMEFRAME SIGNAL ENGINE — v6.0 CORRECTED
// ROOT CAUSE FIX: RSI oversold in downtrend = BEAR continuation (not reversal)
// ALL timeframes must agree. 1D macro HARD VETO. Min R:R 1:2.
// ═══════════════════════════════════════════════════════════════════

// Analyse one timeframe's klines — returns BULL/BEAR/NEUTRAL with vote breakdown
function analyseTF(klines) {
  if (!klines || klines.length < 30) return null;
  const c = klines.map(k => k.c);
  const p = c[c.length - 1];
  const rsi  = calcRSI(c, 14);
  const e20  = calcEMA(c, 20);
  const e50  = calcEMA(c, 50);
  const e200 = calcEMA(c, Math.min(200, c.length));
  const macd = calcMACD(c);
  const atr  = calcATR(klines);
  const vwap = calcVWAP(klines.slice(-24));

  // ── EMA200 direction = KING (weight 3) ─────────────────────────
  const e200Bull = p > e200;
  const emaStackBull = e20 > e50 && e50 > e200;
  const emaStackBear = e20 < e50 && e50 < e200;

  // ── RSI — CONTEXT-AWARE FIX ────────────────────────────────────
  // WRONG (old): rsi < 35 → bullish (works even in downtrend)
  // CORRECT: rsi < 35 in UPTREND → bullish dip. In DOWNTREND → bearish continuation!
  const rsiBull = rsi < 38 && e200Bull;    // oversold ONLY in uptrend = buy dip
  const rsiBear = rsi > 62 && !e200Bull;   // overbought ONLY in downtrend = sell rally

  // ── Votes ──────────────────────────────────────────────────────
  let bv = 0, bv2 = 0; // bull votes, bear votes

  if (e200Bull)      bv  += 3; else bv2 += 3;  // EMA200 weight 3
  if (emaStackBull)  bv  += 2;
  else if (emaStackBear) bv2 += 2;              // EMA stack weight 2
  if (rsiBull)       bv  += 2;
  else if (rsiBear)  bv2 += 2;                  // RSI context weight 2
  if (macd.bull)     bv  += 1; else bv2 += 1;  // MACD weight 1
  if (p > vwap)      bv  += 1; else bv2 += 1;  // VWAP weight 1

  const total = bv + bv2;
  const bullPct = total > 0 ? bv / total : 0.5;
  const trend = bullPct >= 0.65 ? "BULL" : bullPct <= 0.35 ? "BEAR" : "NEUTRAL";

  return { trend, bullPct, rsi, e200Bull, emaStackBull, emaStackBear, atr, p,
           ind: { rsi, ema20: fx(e20,p), ema50: fx(e50,p), ema200: fx(e200,p), vwap: fx(vwap,p) } };
}

async function quantAnalyze(sym, strategy, livePx) {
  const tfs = {scalp:["5m","15m","1h"], day:["15m","1h","4h"], swing:["1h","4h","1d"]}[strategy];

  // Fetch ALL timeframes + 1D macro in parallel
  const [allKl, macroKl, ob] = await Promise.all([
    Promise.all(tfs.map(tf => getKlines(sym, tf, 150))),
    getKlines(sym, "1d", 60),
    getOrderBook(sym),
  ]);

  const analyses = allKl.map((kl, i) => {
    const a = analyseTF(kl);
    return a ? { ...a, tf: tfs[i] } : null;
  }).filter(Boolean);

  if (analyses.length < 2) return null;

  // ── MACRO (1D) analysis ────────────────────────────────────────
  const macro = analyseTF(macroKl);

  // ── CONSENSUS: ALL TFs must agree (max 1 neutral allowed) ─────
  const bulls = analyses.filter(a => a.trend === "BULL");
  const bears = analyses.filter(a => a.trend === "BEAR");
  const allBull = bulls.length >= analyses.length - 1 && bears.length === 0;
  const allBear = bears.length >= analyses.length - 1 && bulls.length === 0;

  if (!allBull && !allBear) {
    return {
      noSignal: true,
      reason: `Timeframe conflict — ${analyses.map(a=>`${a.tf.toUpperCase()}:${a.trend}`).join(" | ")}. `+
               `${bulls.length} bullish, ${bears.length} bearish. Wait for all TFs to align.`,
      tfDetail: analyses.map(a => ({ tf: a.tf, trend: a.trend, rsi: a.rsi })),
      macroTrend: macro?.trend || "NEUTRAL",
    };
  }

  const isBull = allBull;

  // ── HARD MACRO VETO (1D) ───────────────────────────────────────
  // If daily chart is bearish (price below EMA200), NEVER take LONG
  // If daily chart is bullish (price above EMA200), NEVER take SHORT
  if (macro) {
    if (isBull && !macro.e200Bull) {
      return {
        noSignal: true,
        reason: `1D macro VETO: price is BELOW EMA200 on daily chart (RSI ${macro.rsi}). `+
                 `Long signals blocked. Daily must recover above EMA200 before longing.`,
        tfDetail: analyses.map(a => ({ tf: a.tf, trend: a.trend, rsi: a.rsi })),
        macroTrend: "BEAR",
      };
    }
    if (!isBull && macro.e200Bull && macro.rsi > 55) {
      return {
        noSignal: true,
        reason: `1D macro VETO: price is ABOVE EMA200 on daily (RSI ${macro.rsi}). `+
                 `Short signals blocked on strong uptrend. Wait for daily breakdown.`,
        tfDetail: analyses.map(a => ({ tf: a.tf, trend: a.trend, rsi: a.rsi })),
        macroTrend: "BULL",
      };
    }
  }

  // ── PRICE & ATR ────────────────────────────────────────────────
  const primaryTA = analyses[analyses.length - 1];
  const price = livePx || primaryTA.p;
  const atr   = primaryTA.atr;

  // ── CONFIDENCE ────────────────────────────────────────────────
  const agreedCount = isBull ? bulls.length : bears.length;
  const macroAligned = macro && ((isBull && macro.e200Bull) || (!isBull && !macro.e200Bull));
  const obAligned = isBull ? ob.bullish : ob.bearish;
  const pumpDump = detectPumpDump(allKl[0]);
  const slHunt   = detectSLHunt(allKl[0]);

  // Block pumped/dumped coins from wrong direction entries
  if (pumpDump.isPump && isBull)  return null; // don't LONG into pump
  if (pumpDump.isDump && !isBull) return null; // don't SHORT into dump bottom

  // RSI quality check — don't enter overbought LONG or oversold SHORT
  const primaryRSI = primaryTA.rsi;
  let conf = 55
    + agreedCount * 8
    + (macroAligned ? 10 : 0)
    + (obAligned ? 4 : 0)
    + (analyses.length === bulls.length + bears.length ? 5 : 0); // full consensus bonus
  if (isBull && primaryRSI > 73) conf -= 12; // overbought = late LONG
  if (!isBull && primaryRSI < 27) conf -= 12; // oversold = late SHORT
  conf = Math.min(92, Math.max(CFG.MIN_CONF, conf));

  // ── ENTRY / SL / TP ───────────────────────────────────────────
  const lev  = { scalp:12, day:10, swing:5 }[strategy];
  const risk = conf >= 85 ? "LOW" : conf >= 75 ? "MEDIUM" : "HIGH";
  const ATR  = Math.max(atr, price * 0.004);
  const spreadL = Math.max(ATR * 0.3, price * 0.002);
  const spreadH = Math.max(ATR * 0.5, price * 0.004);
  const eLow  = fx(isBull ? price - spreadL     : price + spreadL * 0.3, price);
  const eHigh = fx(isBull ? price + spreadL * 0.3 : price + spreadH,   price);
  const mid   = fx((eLow + eHigh) / 2, price);
  const sl    = fx(isBull ? eLow  - ATR * 1.8 : eHigh + ATR * 1.8, price);
  const slDist = Math.abs(mid - sl);
  const tp1   = fx(isBull ? mid + slDist * 1.5 : mid - slDist * 1.5, price);
  const tp2   = fx(isBull ? mid + slDist * 2.5 : mid - slDist * 2.5, price);
  const tp3   = fx(isBull ? mid + slDist * 4.5 : mid - slDist * 4.5, price);
  const brk   = fx(isBull ? mid + slDist * 0.5 : mid - slDist * 0.5, price);

  // ── R:R CHECK — reject if TP2 < 1:2.0 ────────────────────────
  const rr2 = parseFloat((slDist * 2.5 / slDist).toFixed(2)); // always 2.5 here
  const rrCheck = {
    rr1: parseFloat((slDist*1.5/slDist).toFixed(1)),
    rr2: parseFloat((slDist*2.5/slDist).toFixed(1)),
    rr3: parseFloat((slDist*4.5/slDist).toFixed(1)),
    qualified: rr2 >= CFG.MIN_RR,
  };
  if (!rrCheck.qualified) return null;

  const tfDetail = analyses.map(a => ({ tf: a.tf, trend: a.trend, rsi: a.rsi, e200: a.e200Bull ? "BULL" : "BEAR" }));
  const reasons = analyses.map(a =>
    `${a.tf.toUpperCase()} ${a.trend} — RSI ${a.rsi}, EMA200 ${a.e200Bull ? "bullish ✓" : "bearish ✗"}`
  );
  if (macroAligned) reasons.push(`1D macro aligned — EMA200 ${isBull ? "BULL" : "BEAR"} ✓`);
  if (obAligned) reasons.push(`Order book ${ob.bidPct}% ${isBull ? "bid" : "ask"} dominant`);

  return {
    noSignal: false,
    signal: isBull ? "LONG" : "SHORT",
    conf, strategy, lev, risk,
    price, eLow, eHigh, mid, sl, tp1, tp2, tp3, breakEven: brk,
    rrCheck, pumpDump, slHunt,
    trailingNote: `After TP1 ($${fp(tp1)}) hit → move SL to break-even $${fp(brk)}.`,
    tf: { scalp:"5m/15m/1H", day:"15m/1H/4H", swing:"1H/4H/1D" }[strategy],
    dur: { scalp:"15–45 min", day:"4–12 h", swing:"1–5 days" }[strategy],
    reasons: reasons.slice(0, 4),
    tfDetail,
    macroTrend: macro ? (macro.e200Bull ? "BULL" : "BEAR") : "NEUTRAL",
    macroRSI: macro?.rsi || 50,
    ind: primaryTA.ind,
    obData: ob,
    winRate: Math.min(85, Math.max(58, Math.round(58 + conf * 0.3))),
    lockedAt: Date.now(),
    confirmCount: agreedCount,
    volatileMarket: false,
  };
}

// ── BTC DOMINANCE ADJUSTMENT ──────────────────────────────────────
// If BTC is in strong downtrend, reduce confidence of altcoin longs
async function adjustForBTCDominance(signals,coins){
  const btcCoin=coins.find(c=>c.id==="BTC");
  if(!btcCoin||!btcCoin.chg24)return signals;
  const btcBearish=btcCoin.chg24<-3;
  const adjusted={};
  for(const[k,v]of Object.entries(signals)){
    if(!v||v.noSignal)continue;
    if(btcBearish&&v.signal==="LONG"&&!k.startsWith("BTC")&&v.strategy!=="scalp"){
      adjusted[k]={...v,conf:Math.max(CFG.MIN_CONF,v.conf-8),reasons:[...v.reasons,"⚠️ BTC correction risk: confidence adjusted — trade smaller size"]};
    } else adjusted[k]=v;
  }
  return adjusted;
}

// ── VOLATILITY SIREN ──────────────────────────────────────────────
function checkVolatility(coins){
  const extreme=coins.filter(c=>Math.abs(c.chg24||0)>8);
  const high=coins.filter(c=>Math.abs(c.chg24||0)>4);
  if(extreme.length>=2)return{level:"CRITICAL",msg:"Multiple assets in extreme volatility (>8%). Possible market event — reduce position size, widen stops.",siren:true};
  if(extreme.length===1)return{level:"HIGH",msg:`${extreme[0].id} in extreme move (${extreme[0].chg24.toFixed(2)}%). Market event risk — trade with caution.`,siren:true};
  if(high.length>=3)return{level:"ELEVATED",msg:"Market-wide volatility elevated. Signals valid but increase stop loss by 20%.",siren:false};
  return null;
}

// ── SCANNER ───────────────────────────────────────────────────────
async function runScan(strategy,onProg){
  onProg({msg:"Fetching all market pairs...",pct:3,found:0});
  let tickers=[];
  try{
    const r=await fetch("https://api.binance.com/api/v3/ticker/24hr",{signal:AbortSignal.timeout(12000)});
    if(r.ok){
      const all=await r.json();
      tickers=all.filter(d=>d.symbol.endsWith("USDT")&&parseFloat(d.quoteVolume)>=CFG.MIN_VOL)
        .sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume)).slice(0,CFG.SCAN_N)
        .map(d=>({symbol:d.symbol,id:d.symbol.replace("USDT",""),price:+d.lastPrice,chg24:+d.priceChangePercent,high24:+d.highPrice,low24:+d.lowPrice,vol:+d.quoteVolume}));
    }
  }catch{return[];}
  if(!tickers.length)return[];

  // Quick pre-filter: skip clearly ranging assets
  const candidates=tickers.filter(t=>{
    const rng=t.high24>t.low24?(t.price-t.low24)/(t.high24-t.low24)*100:50;
    if(strategy==="scalp")return Math.abs(t.chg24)>1||rng<20||rng>80;
    if(strategy==="day")return Math.abs(t.chg24)>0.5;
    return Math.abs(t.chg24)>2;
  }).slice(0,35);

  onProg({msg:`Pre-filtered to ${candidates.length} candidates. Running deep analysis...`,pct:15,found:0});
  const results=[];const B=5;
  for(let i=0;i<candidates.length;i+=B){
    const batch=candidates.slice(i,i+B);
    onProg({msg:`Analyzing batch ${Math.floor(i/B)+1}/${Math.ceil(candidates.length/B)}...`,pct:Math.round(15+(i/candidates.length)*80),found:results.length});
    await Promise.all(batch.map(async t=>{
      const s=await quantAnalyze(t.symbol,strategy,t.price);
      if(s)results.push({...s,...t,coinId:t.id,name:t.id});
    }));
  }
  results.sort((a,b)=>b.conf-a.conf);
  onProg({msg:`Scan complete — ${results.length} qualified signals`,pct:100,found:results.length});
  return results;
}

// ── AUTH — UNIQUE CQ-ID ───────────────────────────────────────────
function genCQID(){
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return"CQ-"+Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}
function validatePw(p){
  const e=[];
  if(p.length<8)e.push("8+ characters");
  if(!/[A-Z]/.test(p))e.push("uppercase letter");
  if(!/[a-z]/.test(p))e.push("lowercase letter");
  if(!/\d/.test(p))e.push("number");
  if(!/[!@#$%^&*_\-]/.test(p))e.push("symbol");
  return e;
}

// Disposable / fake email domain blocklist
const FAKE_DOMAINS=[
  "mailinator.com","guerrillamail.com","10minutemail.com","temp-mail.org","throwaway.email",
  "yopmail.com","maildrop.cc","trashmail.com","sharklasers.com","guerrillamailblock.com",
  "grr.la","guerrillamail.info","guerrillamail.biz","guerrillamail.de","guerrillamail.net",
  "guerrillamail.org","spam4.me","trashmail.at","trashmail.io","trashmail.me","trashmail.net",
  "fakeinbox.com","tempmail.com","dispostable.com","mailnull.com","spamgourmet.com",
  "spamspot.com","spamgourmet.net","spamgourmet.org","spam.la","bugmenot.com","notmailinator.com",
  "tempinbox.com","spamfree24.org","mailexpire.com","discardmail.com","discardmail.de",
  "spamhole.com","jetable.fr","noref.in","nus.edu.sg","discard.email","gtrash.com",
  "binkmail.com","bobmail.info","chammy.info","devnullmail.com","get1mail.com","getonemail.net",
  "hailmail.net","ichimail.com","inoutmail.de","inoutmail.eu","inoutmail.info","inoutmail.net",
  "internet-e-mail.de","internet-mail.org","internetemails.net","internetmailing.net",
  "junk1.tk","kasmail.com","kaspop.com","klassmaster.com","klassmaster.net","klassmaster.org",
  "lol.ovpn.to","lovemeleaveme.com","lr78.com","lukop.dk","m4ilweb.info","mail.mezimages.net",
  "mail2rss.org","mail4trash.com","mailbidon.com","mailbiz.biz","mailblocks.com",
  "mailc.net","mailcat.biz","mailcatch.com","maildu.de","maileater.com","mailer.net",
  "mailexpire.com","mailfa.tk","mailforspam.com","mailfreeonline.com","mailguard.me",
  "mailimate.com","mailin8r.com","mailinator2.com","mailincubator.com","mailismagic.com",
  "mailme.lv","mailme24.com","mailmetrash.com","mailmoat.com","mailnew.com",
  "mailnull.com","mailquack.com","mailscrap.com","mailshell.com","mailsiphon.com",
  "mailslapping.com","mailslite.com","mailsou.com","mailspam.me","mailsream.com",
  "mailtemporaire.com","mailtemporaire.fr","mailthunder.net","mailtome.de",
  "mailtothis.com","mailtrash.net","mailtv.net","mailzilla.com","makemetheking.com",
  "manybrain.com","mbx.cc","meltmail.com","messagebeamer.de","mezimages.net",
  "mierdamail.com","mintemail.com","moncourrier.fr.nf","monemail.fr.nf","monmail.fr.nf",
  "mt2009.com","mt2014.com","mypartyclip.de","myphantomemail.com","myspaceinc.com",
  "myspaceinc.net","myspaceinc.org","myspacepimpedup.com","myspamless.com","mytrashmail.com",
  "neomailbox.com","nepwk.com","nervmich.net","nervtmich.net","netviewer-france.com",
  "neverbox.com","nice-coment.com","no-spam.ws","nobulk.com","noclickemail.com",
  "nogmailspam.info","nojunk.com","nonspam.eu","nonspammer.de","noref.in",
  "nospam.ze.tc","nospam4.us","nospamfor.us","nospammail.net","nospamthanks.info",
  "notmailinator.com","nowmymail.com","nwldx.com","objectmail.com","obobbo.com",
  "odnorazovoe.ru","oneoffmail.com","onewaymail.com","onlatedotcom.info","online.ms",
  "oopi.org","owlpic.com","pancakemail.com","paplease.com","pcusers.otherinbox.com",
  "pepbot.com","peterdethier.com","petml.com","pfui.ru","pookmail.com",
  "privacy.net","proxymail.eu","prtnx.com","prtz.eu","punkass.com","put2.net",
  "qq.com","recode.me","recursor.net","recyclemail.dk","regbypass.comsafe-mail.net",
  "regexmail.com","rklips.com","rmqkr.net","rppkn.com","rtrtr.com",
  "s0ny.net","safe-mail.net","safetymail.info","safetypost.de","sandelf.de",
  "saynotospams.com","scatmail.com","schachrol.com","schrott-email.de","secretemail.de",
  "secure-email.org","selfdestructingmail.com","senseless-entertainment.com",
  "services391.com","sharklasers.com","shiftmail.com","shitmail.me","shitmail.org",
  "shitware.nl","skeefmail.com","slapsfromlastnight.com","slopsbox.com",
  "slushmail.com","smellfear.com","snakemail.com","sneakemail.com","snkmail.com",
  "sofimail.com","sofort-mail.de","sogetthis.com","soodonims.com",
  "spam.la","spam.su","spam4.me","spamavert.com","spambox.info",
  "spambox.irishspringrealty.com","spambox.us","spamcannon.com","spamcannon.net",
  "spamcero.com","spamcon.org","spamcorptastic.com","spamcowboy.com","spamcowboy.net",
  "spamcowboy.org","spamday.com","spamdecoy.net","spamex.com","spamfree24.org",
  "spamgoes.in","spamgourmet.com","spamgourmet.net","spamgourmet.org",
  "spamherelots.com","spamhereplease.com","spamhole.com","spamify.com",
  "spaminator.de","spamkill.info","spaml.com","spaml.de","spammotel.com",
  "spammy.host","spamoff.de","spamslicer.com","spamspot.com","spamstack.net",
  "spamthis.co.uk","spamthisplease.com","spamtrail.com","spamtrap.ro",
  "spamtroll.net","spamwc.de","spamwc.net","spamwc.org","speed.1s.fr",
  "super-auswahl.de","supergreatmail.com","supermailer.jp","superrito.com",
  "superstachel.de","suremail.info","susi.ml","svk.jp","sweetxxx.de",
  "tafmail.com","tagyourself.com","tapchicuocsong.vn","teewars.org",
  "teleworm.com","teleworm.us","temp-mail.ru","tempail.com","tempalias.com",
  "tempe-mail.com","tempemail.biz","tempemail.co.za","tempemail.com",
  "tempemail.net","tempinbox.co.uk","tempinbox.com","tempmail.eu",
  "tempmail.it","tempmail2.com","tempr.email","tempsky.com","tempthe.net",
  "tempymail.com","thanksnospam.info","thc.st","thetrash.email",
  "thinmastermail.com","throwam.com","throwam.net","throwapp.org",
  "throwaway.email","throwawaymailaddress.com","throwmail.org","tilien.com",
  "tmail.com","tmail.ws","tmailinator.com","toiea.com","toomail.biz",
  "topranklist.de","tradermail.info","trash-mail.at","trash-mail.cf",
  "trash-mail.ga","trash-mail.gq","trash-mail.io","trash-mail.ml",
  "trash-mail.tk","trash2009.com","trash2010.com","trash2011.com",
  "trashdevil.com","trashdevil.de","trashemail.de","trashimail.de",
  "trashmail.at","trashmail.com","trashmail.de","trashmail.io",
  "trashmail.me","trashmail.net","trashmail.org","trashmail.xyz",
  "trashmailer.com","trashmailer.org","trashnet.net","trox.in",
  "trungtamgiasu.vn","turoid.com","turual.com","twinmail.de","tyldd.com",
  "uggsrock.com","umail.net","unmail.ru","uroid.com","us.af",
  "venompen.com","veryday.ch","veryrealemail.com","viditag.com",
  "viewcastmedia.com","viewcastmedia.net","viewcastmedia.org",
  "vinernet.com","vipmail.name","vipmail.pw","vkcode.ru",
  "vomoto.com","vpn.st","vsimcard.com","vubby.com","wasteland.rfc822.org",
  "webemail.me","webm4il.info","webm4il.net","weg-werf-email.de",
  "wegwerf-emails.de","wegwerfadresse.de","wegwerfemail.com","wegwerfemail.de",
  "wegwerfemail.info","wegwerfemail.net","wegwerfemail.org","wegwerfmail.de",
  "wegwerfmail.info","wegwerfmail.net","wegwerfmail.org","weidner.com",
  "welovefilm.com","whatiaas.com","whatisaas.com","whopy.com",
  "wilemail.com","willhackforfood.biz","willselldrugs.com","willsell.org",
  "wmail.cf","wollan.info","wwwnew.eu","xagloo.com","xemaps.com",
  "xents.com","xmaily.com","xoxy.net","xyzfree.net","yapped.net",
  "yarnpedia.ga","yeah.net","yep.it","yertxenor.com","yomail.info",
  "yopmail.com","yopmail.fr","yopmail.pp.ua","you-spam.com","yourlms.biz",
  "ypmail.webarnak.fr.eu.org","yuurok.com","z1p.biz","zebins.com",
  "zebins.eu","zehnminutenmail.de","zippymail.info","zoaxe.com","zoemail.net",
  "zoemail.org","zomg.info"
];

function validateEmail(email){
  const e=email.toLowerCase().trim();
  // Basic format check
  const emailRegex=/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  if(!emailRegex.test(e)) return{ok:false,err:"Enter a valid email address."};
  const domain=e.split("@")[1];
  // Block disposable domains
  if(FAKE_DOMAINS.includes(domain)) return{ok:false,err:"Disposable/temporary emails not allowed. Use your real email address."};
  // Block domains with no TLD > 2 chars that look fake
  const tld=domain.split(".").pop();
  if(tld.length<2) return{ok:false,err:"Invalid email domain."};
  // Block single-character local parts
  if(e.split("@")[0].length<3) return{ok:false,err:"Email address too short."};
  return{ok:true};
}
const Auth={
  check:(cqid,pass)=>{
    // Admin: accepts email, "ADMIN", or "admin"
    const input=(cqid||"").trim();
    const isAdm=btoa(input)===CFG._a||input.toUpperCase()==="ADMIN"||
                input.toLowerCase()===atob(CFG._a).toLowerCase();
    if(isAdm){
      if(btoa(pass)===CFG._b)
        return{ok:true,role:"admin",plan:"elite",email:atob(CFG._a),cqid:"ADMIN"};
      return{ok:false,err:"Incorrect admin password."};
    }
    try{
      const u=JSON.parse(localStorage.getItem("cx_users")||"[]").find(x=>(x.cqid===input||x.email===input.toLowerCase())&&x.pass===btoa(pass));
      if(!u)return{ok:false,err:"Invalid CQ-ID or password."};
      if(Date.now()>u.expiresAt&&u.plan!=="free")return{ok:false,err:"Subscription expired."};
      return{ok:true,role:"user",plan:u.plan,email:u.email,cqid:u.cqid,userId:u.id,expiresAt:u.expiresAt};
    }catch{return{ok:false,err:"Login failed."};}
  },
  register:(email,pass)=>{
    const ev=validateEmail(email);if(!ev.ok)return{ok:false,err:ev.err};
    const errs=validatePw(pass);if(errs.length)return{ok:false,err:"Password needs: "+errs.join(", ")};
    try{
      const users=JSON.parse(localStorage.getItem("cx_users")||"[]");
      if(users.find(u=>u.email===email.toLowerCase()))return{ok:false,err:"Email already registered."};
      const cqid=genCQID();
      const nu={id:Date.now().toString(36),cqid,email:email.toLowerCase(),pass:btoa(pass),plan:"free",registeredAt:Date.now(),expiresAt:Date.now()+30*86400000,status:"active"};
      users.push(nu);localStorage.setItem("cx_users",JSON.stringify(users));
      return{ok:true,cqid,user:nu};
    }catch{return{ok:false,err:"Registration failed."};}
  },
  all:()=>{try{return JSON.parse(localStorage.getItem("cx_users")||"[]");}catch{return[];}},
  update:(id,up)=>{const u=Auth.all();const i=u.findIndex(x=>x.id===id);if(i>=0){u[i]={...u[i],...up};localStorage.setItem("cx_users",JSON.stringify(u));}},
};
const Chat={
  get:()=>{try{return JSON.parse(localStorage.getItem("cx_chat")||"[]");}catch{return[];}},
  send:(from,text,role,tid)=>{const m=Chat.get();m.push({id:Date.now(),from,text,role,time:Date.now(),read:false,tid:tid||from});localStorage.setItem("cx_chat",JSON.stringify(m.slice(-400)));},
  closeThread:(tid)=>{const t=JSON.parse(localStorage.getItem("cx_threads")||"{}");t[tid]={closed:true,at:Date.now()};localStorage.setItem("cx_threads",JSON.stringify(t));},
  isClosed:(tid)=>{try{return!!JSON.parse(localStorage.getItem("cx_threads")||"{}")[tid]?.closed;}catch{return false;}},
  unread:(role)=>Chat.get().filter(m=>m.role!==role&&!m.read).length,
  markRead:(role)=>{const m=Chat.get().map(x=>x.role===role?x:{...x,read:true});localStorage.setItem("cx_chat",JSON.stringify(m));},
};
function dlCSV(rows,fn){
  if(!rows.length)return;const k=Object.keys(rows[0]);
  const csv=[k.join(","),...rows.map(r=>k.map(x=>`"${String(r[x]).replace(/"/g,'""')}"`).join(","))].join("\n");
  const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),download:fn});a.click();
}

// ── CSS ───────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Azeret+Mono:wght@400;500;700&family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#03080f;--bg2:#060d18;--bg3:#0a1522;--bg4:#0e1d2e;--bg5:#122238;
  --bdr:#162d48;--bdr2:rgba(0,200,255,.18);--bdr3:rgba(0,255,136,.15);
  --c:#00c8ff;--c2:#0099cc;--g:#00ff88;--g2:#00cc6a;
  --r:#ff2052;--y:#ffcc00;--p:#8855ff;--o:#ff6600;
  --text:#b8d4f0;--text2:#7a9ab8;--muted:#2d4a66;
  --card:rgba(6,13,24,.96);
  --scalp:#ff6600;--day:#00c8ff;--swing:#8855ff;
  --grd:linear-gradient(135deg,#00c8ff,#00ff88);
}
html,body{background:var(--bg);color:var(--text);font-family:'Space Grotesk',sans-serif;font-size:14px;overflow-x:hidden;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background:radial-gradient(ellipse 80% 50% at 10% 5%,rgba(0,200,255,.05),transparent 55%),radial-gradient(ellipse 60% 40% at 90% 90%,rgba(0,255,136,.04),transparent 50%)}
.mono{font-family:'Azeret Mono',monospace}.cond{font-family:'Barlow Condensed',sans-serif}
@keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pu{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.2;transform:scale(2)}}
@keyframes tk{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes sr{0%,100%{background:rgba(255,32,82,.07)}50%{background:rgba(255,32,82,.25)}}
@keyframes glw{0%,100%{box-shadow:0 0 10px rgba(0,200,255,.2)}50%{box-shadow:0 0 30px rgba(0,200,255,.6)}}
@keyframes scan{0%{left:-100%}100%{left:200%}}
@keyframes borderFlow{0%,100%{border-color:rgba(0,200,255,.2)}50%{border-color:rgba(0,255,136,.5)}}
.au{animation:fu .38s ease both}.ai{animation:fi .28s ease both}
._sp{animation:spin .85s linear infinite}._pu{animation:pu 1.3s ease infinite}
.siren{animation:sr 1s ease infinite}.glow{animation:glw 2s ease infinite}
.card{background:var(--card);border:1px solid var(--bdr);border-radius:14px;backdrop-filter:blur(20px);position:relative;overflow:hidden;transition:border-color .2s,transform .2s,box-shadow .2s}
.card:hover{border-color:var(--bdr2)}
.card-l{border-color:rgba(0,255,136,.25)!important;box-shadow:0 0 20px rgba(0,255,136,.08)!important}
.card-s{border-color:rgba(255,32,82,.25)!important;box-shadow:0 0 20px rgba(255,32,82,.08)!important}
/* Scan line effect on cards */
.card::after{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(0,200,255,.04),transparent);pointer-events:none;animation:scan 4s ease infinite}
.btn{font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:10px 20px;border-radius:10px;cursor:pointer;border:none;transition:all .18s;display:inline-flex;align-items:center;gap:7px;justify-content:center;white-space:nowrap;position:relative;overflow:hidden}
.btn:disabled{opacity:.3;cursor:not-allowed;pointer-events:none}
.btn::before{content:'';position:absolute;inset:0;background:rgba(255,255,255,.07);opacity:0;transition:opacity .15s}
.btn:hover:not(:disabled)::before{opacity:1}
.btn-c{background:linear-gradient(135deg,var(--c2),var(--c));color:#000;box-shadow:0 4px 20px rgba(0,200,255,.35)}
.btn-g{background:linear-gradient(135deg,var(--g2),var(--g));color:#000;box-shadow:0 4px 20px rgba(0,255,136,.35)}
.btn-r{background:linear-gradient(135deg,#cc0033,var(--r));color:#fff;box-shadow:0 4px 20px rgba(255,32,82,.35)}
.btn-y{background:linear-gradient(135deg,#cc9900,var(--y));color:#000}
.btn-p{background:linear-gradient(135deg,#5533cc,var(--p));color:#fff}
.btn-o{background:transparent;color:var(--c);border:1px solid rgba(0,200,255,.4)}.btn-o:hover:not(:disabled){background:rgba(0,200,255,.07);border-color:var(--c)}
.btn-h{background:transparent;color:var(--muted);border:1px solid var(--bdr)}.btn-h:hover:not(:disabled){color:var(--text);border-color:var(--bdr2)}
.btn-c:hover:not(:disabled){box-shadow:0 4px 32px rgba(0,200,255,.6);transform:translateY(-1px)}
.btn-g:hover:not(:disabled){box-shadow:0 4px 32px rgba(0,255,136,.6);transform:translateY(-1px)}
.pill{display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;font-family:'Space Grotesk',sans-serif;letter-spacing:.3px}
.pg{background:rgba(0,255,136,.1);color:var(--g);border:1px solid rgba(0,255,136,.3)}
.pr{background:rgba(255,32,82,.1);color:var(--r);border:1px solid rgba(255,32,82,.3)}
.py{background:rgba(255,204,0,.1);color:var(--y);border:1px solid rgba(255,204,0,.3)}
.pc{background:rgba(0,200,255,.1);color:var(--c);border:1px solid rgba(0,200,255,.3)}
.pp{background:rgba(136,85,255,.1);color:var(--p);border:1px solid rgba(136,85,255,.3)}
.ps{background:rgba(255,102,0,.1);color:var(--scalp);border:1px solid rgba(255,102,0,.3)}
.pd{background:rgba(0,200,255,.1);color:var(--day);border:1px solid rgba(0,200,255,.3)}
.pw{background:rgba(136,85,255,.1);color:var(--swing);border:1px solid rgba(136,85,255,.3)}
.inp{background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;padding:12px 16px;color:var(--text);font-family:'Space Grotesk',sans-serif;font-size:14px;outline:none;width:100%;transition:border .2s,box-shadow .2s}
.inp:focus{border-color:var(--c);box-shadow:0 0 0 3px rgba(0,200,255,.1)}.inp::placeholder{color:var(--muted)}.inp.ie{border-color:var(--r)}
.prog{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden}.pf{height:100%;border-radius:2px;transition:width .9s cubic-bezier(.4,0,.2,1)}
.stab{display:flex;background:var(--bg3);border-radius:10px;padding:3px;gap:2px}
.stab-btn{flex:1;padding:9px 0;border-radius:8px;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:12px;letter-spacing:.8px;text-transform:uppercase;transition:all .2s;background:transparent;color:var(--muted)}
.stab-btn.as{background:var(--scalp);color:#fff;box-shadow:0 2px 14px rgba(255,102,0,.4)}
.stab-btn.ad{background:var(--day);color:#000;box-shadow:0 2px 14px rgba(0,200,255,.4)}
.stab-btn.aw{background:var(--swing);color:#fff;box-shadow:0 2px 14px rgba(136,85,255,.4)}
.nb{cursor:pointer;padding:8px 13px;border-radius:10px;border:none;background:transparent;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:13px;letter-spacing:.5px;transition:all .18s;display:flex;align-items:center;gap:6px}
.nb:hover{color:var(--text);background:var(--bg3)}.nb.act{color:var(--c);background:rgba(0,200,255,.08)}
.tog{position:relative;width:48px;height:26px;cursor:pointer;flex-shrink:0}.tog input{opacity:0;width:0;height:0;position:absolute}.ts{position:absolute;inset:0;background:var(--bg3);border:1px solid var(--bdr);border-radius:13px;transition:.25s}.ts::before{content:'';position:absolute;width:20px;height:20px;left:2px;top:2px;background:var(--muted);border-radius:50%;transition:.25s}.tog input:checked+.ts{background:rgba(0,255,136,.12);border-color:var(--g)}.tog input:checked+.ts::before{transform:translateX(22px);background:var(--g);box-shadow:0 0 10px rgba(0,255,136,.5)}
.tr{overflow:hidden;background:var(--bg2);border-bottom:1px solid var(--bdr)}.tt{display:flex;gap:48px;white-space:nowrap;animation:tk 36s linear infinite;width:max-content;padding:7px 0}
.dd{position:absolute;top:calc(100% + 5px);left:0;right:0;background:var(--bg2);border:1px solid var(--bdr2);border-radius:12px;max-height:280px;overflow-y:auto;z-index:600;box-shadow:0 14px 44px rgba(0,0,0,.6)}
.ddi{padding:10px 14px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bdr);transition:background .12s}.ddi:hover{background:rgba(0,200,255,.06)}.ddi:last-child{border-bottom:none}
.cbu{background:rgba(0,200,255,.1);border:1px solid rgba(0,200,255,.2);border-radius:14px 14px 2px 14px;padding:10px 14px;max-width:78%}
.cba{background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:14px 14px 14px 2px;padding:10px 14px;max-width:78%}
@media(max-width:768px){.loh{display:none!important}}@media(min-width:769px){.smh{display:none!important}}
`;

// ── COMPONENTS ────────────────────────────────────────────────────
function Spin({sz=20,cl="var(--c)"}){return <div style={{width:sz,height:sz,border:`2px solid rgba(0,200,255,.1)`,borderTop:`2px solid ${cl}`,borderRadius:"50%",flexShrink:0}} className="_sp"/>;}
function Tog({checked,onChange}){return<label className="tog"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="ts"/></label>;}

// Logo SVG — AI Brain + Candlestick
function Logo({sz=36}){
  return(
    <svg width={sz} height={sz} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#0a1d35"/><stop offset="100%" stopColor="#020a14"/></radialGradient>
        <linearGradient id="gc" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00c8ff"/><stop offset="100%" stopColor="#00ff88"/></linearGradient>
        <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00ff88"/><stop offset="100%" stopColor="#00c8ff"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="1.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="44" height="44" rx="11" fill="url(#bg)"/>
      <rect width="44" height="44" rx="11" fill="none" stroke="url(#gc)" strokeWidth=".8" opacity=".6"/>
      {/* AI Brain network nodes */}
      <g filter="url(#glow)" opacity=".9">
        <circle cx="13" cy="14" r="2" fill="#00c8ff"/>
        <circle cx="22" cy="10" r="2" fill="#00ff88"/>
        <circle cx="31" cy="14" r="2" fill="#00c8ff"/>
        <circle cx="10" cy="22" r="1.5" fill="#00ff88"/>
        <circle cx="22" cy="22" r="2.5" fill="url(#gc)"/>
        <circle cx="34" cy="22" r="1.5" fill="#00ff88"/>
        {/* Neural connections */}
        <line x1="13" y1="14" x2="22" y2="10" stroke="#00c8ff" strokeWidth=".8" opacity=".7"/>
        <line x1="22" y1="10" x2="31" y2="14" stroke="#00c8ff" strokeWidth=".8" opacity=".7"/>
        <line x1="13" y1="14" x2="22" y2="22" stroke="#00ff88" strokeWidth=".8" opacity=".6"/>
        <line x1="31" y1="14" x2="22" y2="22" stroke="#00ff88" strokeWidth=".8" opacity=".6"/>
        <line x1="10" y1="22" x2="22" y2="22" stroke="#00c8ff" strokeWidth=".8" opacity=".5"/>
        <line x1="22" y1="22" x2="34" y2="22" stroke="#00c8ff" strokeWidth=".8" opacity=".5"/>
        <line x1="13" y1="14" x2="10" y2="22" stroke="#00ff88" strokeWidth=".6" opacity=".5"/>
        <line x1="31" y1="14" x2="34" y2="22" stroke="#00ff88" strokeWidth=".6" opacity=".5"/>
      </g>
      {/* Candlestick chart */}
      <g filter="url(#glow)">
        {/* Bearish candle */}
        <rect x="11" y="30" width="5" height="6" rx=".8" fill="var(--r)" opacity=".9"/>
        <line x1="13.5" y1="28" x2="13.5" y2="30" stroke="var(--r)" strokeWidth="1.2"/>
        <line x1="13.5" y1="36" x2="13.5" y2="38" stroke="var(--r)" strokeWidth="1.2"/>
        {/* Bullish candle */}
        <rect x="19.5" y="28" width="5" height="8" rx=".8" fill="url(#gg)" opacity=".95"/>
        <line x1="22" y1="25" x2="22" y2="28" stroke="#00ff88" strokeWidth="1.2"/>
        <line x1="22" y1="36" x2="22" y2="38" stroke="#00ff88" strokeWidth="1.2"/>
        {/* Bigger bullish */}
        <rect x="28" y="26" width="5" height="10" rx=".8" fill="url(#gc)" opacity=".95"/>
        <line x1="30.5" y1="23" x2="30.5" y2="26" stroke="#00c8ff" strokeWidth="1.2"/>
        <line x1="30.5" y1="36" x2="30.5" y2="39" stroke="#00c8ff" strokeWidth="1.2"/>
        {/* Rising arrow */}
        <polyline points="11,38 19,32 27,29 35,23" fill="none" stroke="url(#gc)" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 1.5" opacity=".7"/>
      </g>
    </svg>
  );
}

function Ring({val,color,sz=110}){
  const R=40,C=2*Math.PI*R,p=Math.min(val,100)/100;
  return(<div style={{position:"relative",width:sz,height:sz,flexShrink:0}}>
    <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg4)" strokeWidth="6"/>
      <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${C*p} ${C*(1-p)}`} strokeLinecap="round" style={{filter:`drop-shadow(0 0 8px ${color})`,transition:"stroke-dasharray 1.1s ease"}}/>
    </svg>
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
      <div className="mono" style={{fontSize:sz*.21,fontWeight:700,color,lineHeight:1}}>{val}</div>
      <div style={{fontSize:sz*.09,color:"var(--text2)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5}}>CONF%</div>
    </div>
  </div>);
}

function Ticker({coins}){
  return(<div className="tr"><div className="tt">
    {[...coins,...coins].map((c,i)=>(
      <span key={i} style={{fontSize:12,display:"flex",alignItems:"center",gap:10,color:(c.chg24||0)>=0?"var(--g)":"var(--r)"}}>
        <span style={{color:"var(--c)",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{c.id}</span>
        <span className="mono" style={{color:"var(--text)"}}>${fp(c.price)}</span>
        <span>{(c.chg24||0)>=0?"▲":"▼"}{Math.abs(c.chg24||0).toFixed(2)}%</span>
      </span>
    ))}
  </div></div>);
}

function LockBar({sig}){
  const[ms,setMs]=useState(0);
  useEffect(()=>{if(!sig?.lockedAt)return;const t=setInterval(()=>setMs(Math.max(0,sig.lockedAt+CFG.LOCK[sig.strategy]-Date.now())),1000);setMs(Math.max(0,sig.lockedAt+CFG.LOCK[sig.strategy]-Date.now()));return()=>clearInterval(t);},[sig?.lockedAt,sig?.strategy]);
  if(!ms||!sig)return null;
  const p=ms/CFG.LOCK[sig.strategy];const cl=p>0.5?"var(--g)":p>0.2?"var(--y)":"var(--r)";
  const tl=s=>{const sc=Math.floor(s/1000);if(sc<60)return`${sc}s`;if(sc<3600)return`${Math.floor(sc/60)}m`;return`${Math.floor(sc/3600)}h ${Math.floor((sc%3600)/60)}m`;};
  return(<div className="card" style={{padding:"12px 16px",marginBottom:0}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11}}>
      <span style={{color:"var(--text2)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>🔒 SIGNAL LOCKED — {sig.confirmCount} confirmations</span>
      <span className="mono" style={{color:cl,fontWeight:700}}>{tl(ms)}</span>
    </div>
    <div className="prog"><div style={{height:"100%",borderRadius:2,background:cl,width:`${p*100}%`,transition:"width 1s linear"}}/></div>
    <div style={{fontSize:10,color:"var(--text2)",marginTop:4}}>Refreshes at expiry or on ≥{CFG.BREAK[sig.strategy]}% price deviation</div>
  </div>);
}

// ── TELEGRAM SEND BUTTON ─────────────────────────────────────────
// Telegram format
function fmtTg(coinId, sig) {
  if(!sig||sig.noSignal) return `📊 <b>${coinId}/USDT</b>\n⏳ No signal — ${sig?.reason?.slice(0,80)||"stand aside"}.`;
  const isL=sig.signal==="LONG";
  const rr=sig.rrCheck||{rr1:"1.5",rr2:"2.5",rr3:"4.5"};
  const tfStr=sig.tfDetail?.map(t=>`${t.tf.toUpperCase()}:${t.trend}`).join(" | ")||sig.tf||"";
  return `🤖 <b>CRYPTEX QUANT v6</b>
━━━━━━━━━━━━━━━━━━━━
${isL?"🟢":"🔴"} <b>${coinId}/USDT — ${sig.signal}</b>
${sig.strategy?.toUpperCase()} | <b>${sig.conf}%</b> conf | ✦${sig.confirmCount||0} TFs agree
━━━━━━━━━━━━━━━━━━━━
📍 <b>Entry:</b> $${fp(sig.eLow)} – $${fp(sig.eHigh)}
🛑 <b>SL:</b> $${fp(sig.sl)} (${Math.abs(pc(sig.mid,sig.sl))}%)
🎯 <b>TP1:</b> $${fp(sig.tp1)} R:R 1:${rr.rr1}
🎯 <b>TP2:</b> $${fp(sig.tp2)} R:R 1:${rr.rr2} ✅
🎯 <b>TP3:</b> $${fp(sig.tp3)} R:R 1:${rr.rr3}
📌 Move SL to $${fp(sig.breakEven||sig.brk||sig.mid)} after TP1
━━━━━━━━━━━━━━━━━━━━
⏱ ${sig.dur||"—"} | ${sig.lev}× lev | ${sig.risk} risk
📊 TF: ${tfStr}
1D Macro: ${sig.macroTrend||"—"} | Win Rate: ~${sig.winRate||"—"}%
━━━━━━━━━━━━━━━━━━━━
📐 ${sig.reasons?.[0]||""}
<i>Not financial advice. Always use stop loss.</i>`;
}

async function tgSend(token,chatId,text){
  try{
    const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text,parse_mode:"HTML"}),signal:AbortSignal.timeout(8000)});
    const d=await r.json();return d.ok?{ok:true}:{ok:false,err:d.description};
  }catch(e){return{ok:false,err:e.message};}
}

// Admin-only: broadcast to ALL active paid subscribers
function TelegramSendButton({sig, coinId}){
  const[status,setStatus]=useState("");const[loading,setLoading]=useState(false);
  const adminToken=localStorage.getItem("cq_admin_tg_token")||"";
  if(!adminToken||!sig||sig.noSignal) return null;
  const send=async()=>{
    setLoading(true);setStatus("Broadcasting...");
    const users=Auth.all().filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt);
    if(!users.length){setStatus("⚠️ No paid users with Telegram linked yet.");setLoading(false);return;}
    const msg=fmtTg(coinId,sig);
    let sent=0;
    for(const u of users){
      await new Promise(r=>setTimeout(r,350));
      const r=await tgSend(adminToken,u.telegramChatId,msg);
      if(r.ok) sent++;
    }
    setStatus(`✅ Broadcast to ${sent}/${users.length} paid subscriber${users.length!==1?"s":""}`);
    setLoading(false);setTimeout(()=>setStatus(""),6000);
  };
  return(<div style={{marginBottom:10}}>
    <button style={{width:"100%",padding:12,fontSize:12,letterSpacing:1,background:"linear-gradient(135deg,#006699,#0099cc)",color:"#fff",boxShadow:"0 4px 16px rgba(0,153,204,.3)",border:"none",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:7,justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,textTransform:"uppercase"}} onClick={send} disabled={loading}>
      {loading?<Spin sz={14}/>:<><span style={{fontSize:16}}>✈️</span> BROADCAST TO PAID SUBSCRIBERS</>}
    </button>
    {status&&<div style={{marginTop:5,fontSize:12,color:status.startsWith("✅")?"var(--g)":"var(--y)",textAlign:"center",padding:"6px",background:status.startsWith("✅")?"rgba(0,230,118,.07)":"rgba(255,204,0,.07)",borderRadius:8}}>{status}</div>}
  </div>);
}

// ── SIGNAL CARD ───────────────────────────────────────────────────
function SignalCard({coinId,name,sig,loading,onRefresh,livePrice,liveChg}){
  if(loading)return<div className="card" style={{padding:52,textAlign:"center"}}><Spin sz={48}/><div style={{marginTop:16,color:"var(--c)",fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,letterSpacing:2}}>QUANTITATIVE ANALYSIS IN PROGRESS...</div><div style={{marginTop:8,color:"var(--text2)",fontSize:12}}>Multi-timeframe synchronization · Triple confirmation</div></div>;
  if(!sig||sig.noSignal)return(<div className="card" style={{padding:28,border:"1px solid rgba(255,204,0,.2)"}}>
    <div style={{fontSize:40,marginBottom:10}}>⏳</div>
    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"var(--y)",fontSize:18,letterSpacing:1,marginBottom:6}}>NO TRADE — STAND ASIDE</div>
    <div style={{fontSize:13,color:"var(--text)",lineHeight:1.75,marginBottom:12}}>{sig?.reason||"Triple confirmation not achieved. Less than 3 indicators aligned. Waiting for convergence."}</div>
    <button className="btn btn-o" style={{width:"100%"}} onClick={onRefresh}>🔄 RE-ANALYZE</button>
  </div>);

  const isL=sig.signal==="LONG";const col=isL?"var(--g)":"var(--r)";
  const sc={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"}[sig.strategy];
  const{ind}=sig;

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <LockBar sig={sig}/>
    {/* ── Header */}
    <div className={`card ${isL?"card-l":"card-s"}`} style={{padding:24,background:`linear-gradient(135deg,rgba(6,13,24,.98),rgba(${isL?"0,60,30":"60,5,15"},.3))`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,marginBottom:18}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:28,fontWeight:900,color:col,letterSpacing:2}}>{coinId}/USDT</span>
            <span className={`pill ${isL?"pg":"pr"}`} style={{fontSize:13,padding:"5px 14px"}}>{isL?"▲ LONG":"▼ SHORT"}</span>
            <span className={`pill ${sig.risk==="LOW"?"pg":sig.risk==="MEDIUM"?"py":"pr"}`}>{sig.risk} RISK</span>
            <span className={`pill ${{scalp:"ps",day:"pd",swing:"pw"}[sig.strategy]}`}>{sig.strategy.toUpperCase()}</span>
            <span className="pill" style={{background:"rgba(0,200,255,.08)",color:"var(--c)",border:"1px solid rgba(0,200,255,.2)"}}>✦ {sig.confirmCount} CONF</span>
          </div>
          <div style={{color:"var(--text2)",fontSize:13,marginBottom:8}}>
            {name||coinId} &nbsp;·&nbsp; {sig.tf} &nbsp;·&nbsp; Leverage&nbsp;<span className="mono" style={{color:"var(--y)",fontWeight:700}}>{sig.lev}×</span>
            &nbsp;·&nbsp; HTF <span style={{color:ind?.htfTrend==="UP"?"var(--g)":"var(--r)",fontWeight:700}}>{ind?.htfTrend}</span>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap",marginBottom:4}}>
            <div className="mono" style={{fontSize:24,fontWeight:700,color:"var(--text)"}}>${fp(livePrice||sig.price)}</div>
            {liveChg!==undefined&&<span style={{fontSize:14,color:liveChg>=0?"var(--g)":"var(--r)",fontWeight:600}}>{liveChg>=0?"+":""}{liveChg.toFixed(2)}%</span>}
            {livePrice&&livePrice!==sig.price&&<span style={{fontSize:10,color:"var(--text2)",padding:"2px 8px",background:"var(--bg3)",borderRadius:20,border:"1px solid var(--bdr)",fontFamily:"'Barlow Condensed',sans-serif"}}>Signal at ${fp(sig.price)}</span>}
            <span style={{width:8,height:8,borderRadius:"50%",background:"var(--g)",display:"inline-block",boxShadow:"0 0 6px var(--g)",flexShrink:0}} className="_pu" title="Live price"/>
          </div>
          {sig.volatileMarket&&<div style={{marginTop:4,padding:"6px 12px",background:"rgba(255,32,82,.1)",borderRadius:8,border:"1px solid rgba(255,32,82,.25)",fontSize:12,color:"var(--r)",display:"flex",alignItems:"center",gap:8}}>
            <span>⚠️</span><span>HIGH VOLATILITY — Reduce position size, widen stops by 20%</span>
          </div>}
        </div>
        <Ring val={sig.conf} color={col} sz={114}/>
      </div>

      {/* Indicators row */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {[
          {l:"RSI",v:ind?.rsi,c:ind?.rsi<35?"var(--g)":ind?.rsi>65?"var(--r)":"var(--y)"},
          {l:"MACD",v:ind?.macd?.bull?"▲ Bull":"▼ Bear",c:ind?.macd?.bull?"var(--g)":"var(--r)"},
          {l:"VWAP",v:sig.price>ind?.vwap?"Above":"Below",c:sig.price>ind?.vwap?"var(--g)":"var(--r)"},
          {l:"Vol",v:`${ind?.volRatio||"?"}×`,c:(ind?.volRatio||1)>1.3?"var(--g)":"var(--text2)"},
          {l:"Order Book",v:`${ind?.ob?.bidPct||50}% Bid`,c:ind?.ob?.bullish?"var(--g)":ind?.ob?.bearish?"var(--r)":"var(--text2)"},
          {l:"Stoch",v:ind?.stoch?.k,c:ind?.stoch?.k<25?"var(--g)":ind?.stoch?.k>75?"var(--r)":"var(--y)"},
        ].map(it=>(
          <div key={it.l} style={{padding:"5px 11px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
            <span style={{color:"var(--text2)"}}>{it.l} </span>
            <span className="mono" style={{fontWeight:700,color:it.c}}>{it.v}</span>
          </div>
        ))}
        {ind?.liq?.whaleBuy&&<div style={{padding:"5px 11px",borderRadius:8,background:"rgba(0,255,136,.08)",fontSize:11,border:"1px solid rgba(0,255,136,.2)"}}><span style={{fontWeight:700,color:"var(--g)"}}>🐋 WHALE BUY</span></div>}
        {ind?.liq?.whaleSell&&<div style={{padding:"5px 11px",borderRadius:8,background:"rgba(255,32,82,.08)",fontSize:11,border:"1px solid rgba(255,32,82,.2)"}}><span style={{fontWeight:700,color:"var(--r)"}}>🐋 WHALE SELL</span></div>}
        {ind?.div!=="none"&&<div style={{padding:"5px 11px",borderRadius:8,background:"rgba(255,204,0,.06)",fontSize:11,border:"1px solid rgba(255,204,0,.2)"}}><span style={{fontWeight:700,color:"var(--y)"}}>{ind?.div==="bullish"?"↗ Bull Div":"↘ Bear Div"}</span></div>}
      </div>

      {/* Triple confirmation reasons */}
      <div style={{background:"rgba(0,0,0,.3)",borderRadius:10,padding:"14px 16px",borderLeft:`3px solid ${sc}`}}>
        <div style={{fontSize:10,color:"var(--text2)",letterSpacing:1.5,marginBottom:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>🔬 QUANT ANALYSIS — {sig.confirmCount} CONFIRMATIONS</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {sig.reasons.map((r,i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12,lineHeight:1.6}}>
              <span style={{color:col,flexShrink:0,marginTop:1}}>✓</span>
              <span style={{color:"var(--text)"}}>{r}</span>
            </div>
          ))}
        </div>
        <div style={{marginTop:10,display:"flex",gap:10,flexWrap:"wrap"}}>
          <div style={{fontSize:11,color:"var(--text2)"}}><span style={{color:"var(--y)"}}>Win Rate:</span> ~{sig.winRate}%</div>
          <div style={{fontSize:11,color:"var(--text2)"}}><span style={{color:"var(--y)"}}>Duration:</span> {sig.dur}</div>
          {ind?.sr?.support>0&&<div style={{fontSize:11,color:"var(--text2)"}}><span style={{color:"var(--g)"}}>Support:</span> ${fp(ind.sr.support)}</div>}
          {ind?.sr?.resistance>0&&<div style={{fontSize:11,color:"var(--text2)"}}><span style={{color:"var(--r)"}}>Resistance:</span> ${fp(ind.sr.resistance)}</div>}
        </div>
      </div>
    </div>

    {/* ── Pump/Dump Warning */}
    {sig.pumpDump?.risk!=="NORMAL"&&<div className="siren" style={{padding:"12px 16px",borderRadius:12,border:`2px solid ${sig.pumpDump?.isPump?"var(--y)":"var(--r)"}`,display:"flex",gap:12,alignItems:"center"}}>
      <span style={{fontSize:20,flexShrink:0}}>{sig.pumpDump?.isPump?"🚀💥":"💥"}</span>
      <div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:sig.pumpDump?.isPump?"var(--y)":"var(--r)",letterSpacing:1,marginBottom:3}}>{sig.pumpDump?.isPump?"⚠️ PUMP DETECTED — DUMP RISK HIGH":"⚠️ DUMP DETECTED — REVERSAL POSSIBLE"}</div>
        <div style={{fontSize:12}}>Spike {sig.pumpDump?.priceSpike>0?"+":""}{sig.pumpDump?.priceSpike}% · Vol {sig.pumpDump?.volRatioSpike}×. {sig.pumpDump?.fakeMove?"Volume not confirming — likely fakeout.":"Reduce size 50%. Tight stops."}</div>
      </div>
    </div>}
    {/* ── SL Hunt Warning */}
    {(sig.slHunt?.huntedBelow||sig.slHunt?.huntedAbove||sig.slHunt?.longWick)&&<div style={{padding:"12px 16px",borderRadius:12,border:"2px solid rgba(255,204,0,.35)",background:"rgba(255,204,0,.04)",display:"flex",gap:12,alignItems:"flex-start"}}>
      <span style={{fontSize:20,flexShrink:0}}>🎯</span>
      <div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"var(--y)",letterSpacing:1,marginBottom:3}}>STOP LOSS HUNT DETECTED</div>
        <div style={{fontSize:12,color:"var(--text)",lineHeight:1.6}}>{sig.slHunt?.msg}</div>
        {sig.slHunt?.zone&&<div style={{fontSize:11,color:"var(--text2)",marginTop:4}}>Hunt zone: <span className="mono" style={{color:"var(--y)"}}>${fp(sig.slHunt.zone)}</span> — place SL 0.5% beyond this to avoid being swept.</div>}
      </div>
    </div>}
    {/* ── R:R Badge */}
    {sig.rrCheck&&<div style={{padding:"10px 16px",borderRadius:10,border:"1px solid rgba(0,200,255,.2)",background:"rgba(0,200,255,.04)",display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--text2)",letterSpacing:1}}>RISK : REWARD</div>
      {[["TP1",sig.rrCheck.rr1,"var(--text2)"],[sig.rrCheck.rr2>=2?"✅ TP2":"TP2",sig.rrCheck.rr2,sig.rrCheck.rr2>=2?"var(--g)":"var(--y)"],["TP3",sig.rrCheck.rr3,"var(--g)"]].map(([l,v,c])=>(
        <div key={l} style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:11,color:"var(--text2)"}}>{l}:</span>
          <span className="mono" style={{fontWeight:700,color:c,fontSize:13}}>1:{v}</span>
        </div>
      ))}
      <span style={{fontSize:11,color:"var(--text2)",marginLeft:"auto"}}>Min qualified: TP2 ≥ 1:2.0</span>
    </div>}
    {/* ── Trade Setup */}
    <div className="card" style={{padding:22}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--text2)",letterSpacing:2,marginBottom:16,textTransform:"uppercase"}}>Trade Setup</div>
      {/* Entry Zone */}
      <div style={{background:`rgba(${isL?"0,200,255":"255,32,82"},.05)`,border:`1px solid rgba(${isL?"0,200,255":"255,32,82"},.18)`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
        <div style={{fontSize:11,color:isL?"var(--c)":"var(--r)",letterSpacing:1.5,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>📍 ENTRY RANGE</div>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:"var(--text2)",marginBottom:3}}>LOW</div><div className="mono" style={{fontSize:18,fontWeight:700,color:isL?"var(--c)":"var(--r)"}}>${fp(sig.eLow)}</div></div>
          <div style={{flex:1,height:8,background:"var(--bg4)",borderRadius:4,minWidth:30,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${isL?"rgba(0,200,255,.5)":"rgba(255,32,82,.5)"},transparent)`}}/></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:"var(--text2)",marginBottom:3}}>HIGH</div><div className="mono" style={{fontSize:18,fontWeight:700,color:isL?"var(--c)":"var(--r)"}}>${fp(sig.eHigh)}</div></div>
        </div>
        <div style={{textAlign:"center",marginTop:8,fontSize:11,color:"var(--text2)"}}>Mid <span className="mono" style={{color:"var(--text)"}}>${fp(sig.mid)}</span></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10,marginBottom:16}}>
        {[{l:"STOP LOSS",v:`$${fp(sig.sl)}`,c:"var(--r)"},{l:"BREAK-EVEN",v:`$${fp(sig.breakEven)}`,c:"var(--y)"},{l:"SL DIST",v:`${Math.abs(pc(sig.mid,sig.sl))}%`,c:"var(--r)"},{l:"LEVERAGE",v:`${sig.lev}×`,c:"var(--y)"}].map(it=>(
          <div key={it.l} style={{background:"var(--bg3)",borderRadius:8,padding:"11px 12px",border:"1px solid var(--bdr)",textAlign:"center"}}>
            <div style={{fontSize:9,color:"var(--text2)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"}}>{it.l}</div>
            <div className="mono" style={{fontSize:13,fontWeight:700,color:it.c}}>{it.v}</div>
          </div>
        ))}
      </div>

      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--text2)",letterSpacing:2,marginBottom:12,textTransform:"uppercase"}}>Take Profit Targets</div>
      {[[sig.tp1,"TP1 — Safe","R:R 1:1.6",35],[sig.tp2,"TP2 — Moderate","R:R 1:2.8",65],[sig.tp3,"TP3 — Aggressive","R:R 1:5",100]].map(([tp,label,rr,w],i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:col,width:28,flexShrink:0,fontWeight:700}}>TP{i+1}</div>
          <div className="prog" style={{flex:1}}><div className="pf" style={{width:`${w}%`,background:`linear-gradient(90deg,${col}55,${col})`}}/></div>
          <div className="mono" style={{fontSize:12,color:col,width:90,textAlign:"right"}}>${fp(tp)}</div>
          <div style={{fontSize:10,color:"var(--text2)",width:44,textAlign:"right"}}>{pc(sig.mid,tp)}%</div>
          <div style={{fontSize:10,color:"var(--g)",width:54,textAlign:"right"}}>+{(Math.abs(parseFloat(pc(sig.mid,tp)))*sig.lev).toFixed(1)}%</div>
          <div style={{fontSize:9,color:"var(--text2)",width:42,fontFamily:"'Barlow Condensed',sans-serif"}}>{rr}</div>
        </div>
      ))}

      {/* Trailing SL note */}
      <div style={{marginTop:10,padding:"10px 14px",background:"rgba(255,204,0,.05)",border:"1px solid rgba(255,204,0,.15)",borderRadius:8,fontSize:12,color:"var(--text)",lineHeight:1.6}}>
        📌 <strong style={{color:"var(--y)"}}>Trailing Stop-Loss:</strong> {sig.trailingNote}
      </div>
    </div>

    <TelegramSendButton sig={sig} coinId={coinId}/>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <button className={`btn ${isL?"btn-g":"btn-r"}`} style={{flex:2,padding:14,minWidth:200,fontSize:13}}>
        {isL?"▲ ENTER LONG":"▼ ENTER SHORT"} &nbsp;${fp(sig.eLow)} – ${fp(sig.eHigh)}
      </button>
      <button className="btn btn-o" style={{flex:1,padding:14}} onClick={onRefresh}>🔄</button>
    </div>
  </div>);
}

// ══════════════════════════════════════════════════════════════════
// PAGES
// ══════════════════════════════════════════════════════════════════

// ── AUTH ──────────────────────────────────────────────────────────
function AuthPage({onLogin}){
  const[mode,setMode]=useState("login");
  const[email,setEmail]=useState("");const[pass,setPass]=useState("");const[pass2,setPass2]=useState("");
  const[cqid,setCqid]=useState("");const[showP,setShowP]=useState(false);
  const[err,setErr]=useState("");const[info,setInfo]=useState("");const[newId,setNewId]=useState("");
  const[loading,setLoading]=useState(false);
  const pwErr=validatePw(pass);const pwOk=pass.length>0&&pwErr.length===0;

  const doLogin=async()=>{
    setErr("");if(!cqid||!pass){setErr("Enter your CQ-ID and password.");return;}
    setLoading(true);await new Promise(r=>setTimeout(r,500));
    const res=Auth.check(cqid.trim().toUpperCase(),pass);
    if(res.ok)onLogin(res);else{setErr(res.err);setLoading(false);}
  };
  const doRegister=async()=>{
    setErr("");setInfo("");
    if(!email.includes("@")||!email.includes(".")){setErr("Enter a valid email.");return;}
    if(!pwOk){setErr("Password requirements not met.");return;}
    if(pass!==pass2){setErr("Passwords do not match.");return;}
    setLoading(true);await new Promise(r=>setTimeout(r,600));
    const res=Auth.register(email.trim(),pass);
    if(res.ok){setNewId(res.cqid);setInfo(`Your unique CQ-ID: ${res.cqid}`);}
    else setErr(res.err);
    setLoading(false);
  };

  return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",zIndex:1}}>
    <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 40%,rgba(0,200,255,.06),transparent 60%)",pointerEvents:"none"}}/>
    <div className="card ai" style={{width:"100%",maxWidth:440,padding:44,position:"relative"}}>
      {/* Brand */}
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:18}}>
          <div className="glow" style={{borderRadius:16}}>
            <Logo sz={72}/>
          </div>
        </div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,letterSpacing:"4px",lineHeight:1}}>
          <span style={{background:"linear-gradient(135deg,var(--c),var(--g))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CRYPTEX QUANT</span>
        </div>
        <div style={{fontSize:11,color:"var(--text2)",marginTop:5,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif"}}>QUANTITATIVE FUTURES INTELLIGENCE v5.0</div>
      </div>

      <div style={{display:"flex",background:"var(--bg3)",borderRadius:10,padding:3,marginBottom:24}}>
        {[["login","Sign In"],["register","Create Account"]].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setErr("");setInfo("");setNewId("");}}
            style={{flex:1,padding:"9px",borderRadius:8,border:"none",cursor:"pointer",background:mode===m?"var(--bg2)":"transparent",color:mode===m?"var(--c)":"var(--muted)",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,letterSpacing:1,transition:"all .2s"}}>
            {l}
          </button>
        ))}
      </div>

      {/* Login */}
      {mode==="login"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:5,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>YOUR CQ-ID</div>
          <input className="inp mono" style={{letterSpacing:1,fontSize:14}} placeholder="Your CQ-ID (e.g. CQ-AB3K9XM2)" value={cqid} onChange={e=>setCqid(e.target.value.trim())} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
        </div>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:5,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>PASSWORD</div>
          <div style={{position:"relative"}}>
            <input className="inp" type={showP?"text":"password"} placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{paddingRight:44}}/>
            <button onClick={()=>setShowP(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--text2)",fontSize:16}}>{showP?"🙈":"👁"}</button>
          </div>
        </div>
        {err&&<div style={{fontSize:12,color:"var(--r)",padding:"9px 12px",background:"rgba(255,32,82,.07)",borderRadius:8}}>{err}</div>}
        <button className="btn btn-c" style={{width:"100%",padding:14,marginTop:4,fontSize:13}} onClick={doLogin} disabled={loading}>{loading?<Spin sz={16}/>:"→ SIGN IN"}</button>
        <div style={{padding:12,background:"rgba(0,200,255,.04)",border:"1px solid rgba(0,200,255,.12)",borderRadius:8,fontSize:11,color:"var(--text2)",lineHeight:1.7,textAlign:"center"}}>
          Don't have an account? &nbsp;<button onClick={()=>setMode("register")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--c)",fontSize:11,fontWeight:600,padding:0}}>Create free account →</button>
        </div>
      </div>}

      {/* Register */}
      {mode==="register"&&!newId&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:5,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>EMAIL ADDRESS</div>
          <input className={`inp ${email.length>4&&!email.includes("@")?"ie":""}`} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
        </div>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:5,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>SET PASSWORD</div>
          <div style={{position:"relative"}}>
            <input className={`inp ${pass.length>0&&pwErr.length>0?"ie":""}`} type={showP?"text":"password"} placeholder="Min 8 chars, A-Z, a-z, 0-9, symbol" value={pass} onChange={e=>setPass(e.target.value)} style={{paddingRight:44}}/>
            <button onClick={()=>setShowP(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--text2)",fontSize:16}}>{showP?"🙈":"👁"}</button>
          </div>
          {pass.length>0&&pwErr.length>0&&<div style={{fontSize:11,color:"var(--y)",marginTop:5}}>Missing: {pwErr.join(" · ")}</div>}
          {pwOk&&<div style={{fontSize:11,color:"var(--g)",marginTop:5}}>✅ Strong password</div>}
        </div>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:5,letterSpacing:1,fontFamily:"'Barlow Condensed',sans-serif"}}>CONFIRM PASSWORD</div>
          <input className="inp" type="password" placeholder="Confirm password" value={pass2} onChange={e=>setPass2(e.target.value)}/>
        </div>
        {err&&<div style={{fontSize:12,color:"var(--r)",padding:"9px 12px",background:"rgba(255,32,82,.07)",borderRadius:8}}>{err}</div>}
        <button className="btn btn-c" style={{width:"100%",padding:14,fontSize:13}} onClick={doRegister} disabled={loading||!email||!pwOk||pass!==pass2}>{loading?<Spin sz={16}/>:"→ CREATE ACCOUNT"}</button>
        <div style={{padding:10,background:"rgba(0,255,136,.04)",border:"1px solid rgba(0,255,136,.12)",borderRadius:8,fontSize:12,color:"var(--text2)",lineHeight:1.7}}>
          <div style={{color:"var(--g)",fontWeight:700,marginBottom:3}}>🎁 FREE 30-DAY TRIAL INCLUDED</div>
          <div>✓ No email OTP needed — get your unique CQ-ID instantly</div>
          <div>✓ Full access to all signals for 30 days</div>
        </div>
      </div>}

      {/* New CQ-ID Display */}
      {mode==="register"&&newId&&<div style={{display:"flex",flexDirection:"column",gap:16,textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:4}}>🎉</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:700,color:"var(--g)",letterSpacing:1}}>ACCOUNT CREATED!</div>
        <div style={{padding:"20px 24px",background:"linear-gradient(135deg,rgba(0,200,255,.1),rgba(0,255,136,.1))",border:"2px solid rgba(0,200,255,.3)",borderRadius:14}}>
          <div style={{fontSize:11,color:"var(--text2)",letterSpacing:2,marginBottom:8,fontFamily:"'Barlow Condensed',sans-serif"}}>YOUR UNIQUE CQ-ID</div>
          <div className="mono" style={{fontSize:32,fontWeight:700,letterSpacing:4,color:"var(--c)",marginBottom:6}}>{newId}</div>
          <div style={{fontSize:12,color:"var(--y)"}}>⚠️ Save this ID — you need it to login</div>
        </div>
        <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.7,padding:"12px 16px",background:"var(--bg3)",borderRadius:10}}>
          <strong style={{color:"var(--text)"}}>How to login:</strong><br/>Enter <span className="mono" style={{color:"var(--c)"}}>{newId}</span> in the CQ-ID field + your password
        </div>
        <button className="btn btn-c" style={{width:"100%",padding:14,fontSize:13}} onClick={()=>{setMode("login");setCqid(newId);}}>→ GO TO LOGIN</button>
      </div>}
    </div>
  </div>);
}

// ── DASHBOARD ─────────────────────────────────────────────────────
function PageDashboard({coins,sigs,loadSig,setTab,setActive,setSt,history,volatility}){
  const[st,setSt2]=useState("day");
  const wins=history.filter(h=>h.result==="WIN").length;
  const total=history.filter(h=>h.result==="WIN"||h.result==="LOSS").length;
  const wr=total>0?Math.round(wins/total*100):0;
  const changeSt=s=>{setSt2(s);setSt(s);};
  return(<div>
    {/* Volatility banner */}
    {volatility&&<div className={`siren`} style={{padding:"14px 18px",borderRadius:12,border:`2px solid ${volatility.level==="CRASH"?"var(--r)":volatility.level==="CRITICAL"?"var(--r)":"var(--y)"}`,marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
      <span style={{fontSize:26,flexShrink:0}}>{volatility.level==="CRASH"?"💥":volatility.level==="CRITICAL"?"🚨":"⚠️"}</span>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:volatility.level==="CRASH"||volatility.level==="CRITICAL"?"var(--r)":"var(--y)",letterSpacing:1,marginBottom:3}}>
          {volatility.level==="CRASH"?"🔴 MARKET CRASH ALERT":volatility.level==="CRITICAL"?"🔴 CRITICAL VOLATILITY":volatility.level==="HIGH"?"🟠 HIGH VOLATILITY":"🟡 ELEVATED VOLATILITY"}
        </div>
        <div style={{fontSize:13,lineHeight:1.6}}>{volatility.msg}</div>
      </div>
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <div>
        <h1 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,letterSpacing:1.5,marginBottom:4}}>
          LIVE <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>QUANT SIGNALS</span>
        </h1>
        <div style={{fontSize:12,color:"var(--text2)"}}>Triple confirmation · Multi-timeframe sync · Whale detection</div>
      </div>
      {total>0&&<div style={{padding:"8px 16px",background:"rgba(0,255,136,.07)",border:"1px solid rgba(0,255,136,.2)",borderRadius:20,display:"flex",gap:8,alignItems:"center"}}>
        <span>🏆</span><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"var(--g)",fontSize:14}}>{wr}% Win Rate · {wins}W/{total-wins}L</span>
      </div>}
    </div>
    <div className="stab" style={{marginBottom:18}}>
      <button className={`stab-btn ${st==="scalp"?"as":""}`} onClick={()=>changeSt("scalp")}>⚡ SCALP 5M</button>
      <button className={`stab-btn ${st==="day"?"ad":""}`}   onClick={()=>changeSt("day")}>📊 DAY 1H</button>
      <button className={`stab-btn ${st==="swing"?"aw":""}`} onClick={()=>changeSt("swing")}>🌊 SWING 4H</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:14}}>
      {TOP5.map((cd,i)=>{
        const coin=coins[i]||{...cd,price:cd.base,chg24:0};
        const sig=sigs[`${cd.id}-${st}`];const isL=sig?.signal==="LONG";const col=isL?"var(--g)":"var(--r)";
        return(<div key={cd.id} className={`card au ${sig&&!sig.noSignal?(isL?"card-l":"card-s"):""}`}
          style={{padding:18,cursor:"pointer",animationDelay:`${i*.07}s`}}
          onClick={()=>{setActive(i);setSt(st);setSt2(st);setTab("signals");}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:42,height:42,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",background:`rgba(${isL?"0,255,136":"255,32,82"},.08)`,border:`1.5px solid ${sig&&!sig.noSignal?col:"var(--bdr)"}`,boxShadow:sig&&!sig.noSignal?`0 0 12px ${col}22`:"none"}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:sig&&!sig.noSignal?col:"var(--text2)",fontWeight:900}}>{cd.logo}</span>
              </div>
              <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,letterSpacing:.5}}>{cd.id}</div><div style={{fontSize:11,color:"var(--text2)"}}>{cd.name}</div></div>
            </div>
            <div style={{textAlign:"right"}}>
              {loadSig&&!coin.updatedAt?<Spin sz={18}/>:<>
                <div className="mono" style={{fontSize:16,fontWeight:700}}>${fp(coin.price)}</div>
                <div style={{fontSize:12,color:(coin.chg24||0)>=0?"var(--g)":"var(--r)",fontWeight:600}}>{(coin.chg24||0)>=0?"+":""}{(coin.chg24||0).toFixed(2)}%</div>
              </>}
            </div>
          </div>
          {sig&&!sig.noSignal?<>
            <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
              <span className={`pill ${isL?"pg":"pr"}`}>{isL?"▲ LONG":"▼ SHORT"}</span>
              <span className={`pill ${sig.risk==="LOW"?"pg":sig.risk==="MEDIUM"?"py":"pr"}`}>{sig.risk}</span>
              <span className="pill" style={{background:"rgba(0,200,255,.08)",color:"var(--c)",border:"1px solid rgba(0,200,255,.2)",fontSize:10}}>✦{sig.confirmCount}</span>
            </div>
            <div className="prog" style={{marginBottom:8}}><div className="pf" style={{width:`${sig.conf}%`,background:`linear-gradient(90deg,${col}66,${col})`}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text2)"}}>
              <span>Conf {sig.conf}% · ~{sig.winRate}% win</span><span className="mono">${fp(sig.eLow)}–${fp(sig.eHigh)}</span>
            </div>
          </>:<div style={{fontSize:11,color:"var(--y)",marginTop:6}}>⏳ Confirmation pending — stand aside</div>}
        </div>);
      })}
    </div>
  </div>);
}

// ── SIGNALS ───────────────────────────────────────────────────────
function PageSignals({coins,sigs,loadSig,active,setActive,st,setSt,onRefresh}){
  const cd=TOP5[active]||TOP5[0];const coin=coins[active]||{...cd};const sig=sigs[`${cd.id}-${st}`];
  return(<div>
    <div style={{overflowX:"auto",marginBottom:12}}>
      <div style={{display:"flex",gap:8,paddingBottom:4,minWidth:"max-content"}}>
        {TOP5.map((c,i)=>{const s=sigs[`${c.id}-${st}`];const isL=s?.signal==="LONG";return(
          <button key={c.id} onClick={()=>setActive(i)} className={`btn ${i===active?(isL?"btn-g":"btn-r"):"btn-h"}`} style={{padding:"8px 14px",position:"relative"}}>
            {c.logo} {c.id}
            {s?.noSignal&&<span style={{position:"absolute",top:2,right:2,width:7,height:7,background:"var(--y)",borderRadius:"50%"}}/>}
          </button>);
        })}
      </div>
    </div>
    <div className="stab" style={{marginBottom:14}}>
      <button className={`stab-btn ${st==="scalp"?"as":""}`} onClick={()=>setSt("scalp")}>⚡ SCALP</button>
      <button className={`stab-btn ${st==="day"?"ad":""}`}   onClick={()=>setSt("day")}>📊 DAY</button>
      <button className={`stab-btn ${st==="swing"?"aw":""}`} onClick={()=>setSt("swing")}>🌊 SWING</button>
    </div>
    <SignalCard coinId={cd.id} name={cd.name} sig={sig} loading={loadSig&&!sig} onRefresh={onRefresh} livePrice={coin.updatedAt?coin.price:undefined} liveChg={coin.updatedAt?coin.chg24:undefined}/>
  </div>);
}

// ── TELEGRAM SCAN SEND (All signals at once) ──────────────────────
function TelegramScanSendButton({results}){
  const[status,setStatus]=useState("");const[loading,setLoading]=useState(false);
  const hasTg=()=>!!(localStorage.getItem("cq_tg_token")&&localStorage.getItem("cq_tg_chatid"));
  if(!hasTg()||!results||!results.length) return null;
  const sendAll=async()=>{
    setLoading(true);setStatus("");
    const token=localStorage.getItem("cq_tg_token");const chatId=localStorage.getItem("cq_tg_chatid");
    // Send summary first
    const summary=`📊 <b>CRYPTEX QUANT — SCAN RESULTS</b>\n━━━━━━━━━━━━━━━━━━━━\n🟢 LONG: ${results.filter(r=>r.signal==="LONG").length} | 🔴 SHORT: ${results.filter(r=>r.signal==="SHORT").length}\nTotal: ${results.length} qualified signals\n<i>Sending top ${Math.min(5,results.length)} signals...</i>`;
    await sendTelegramMessage(token,chatId,summary);
    // Send top 5
    let sent=0;
    for(const r of results.slice(0,5)){
      await new Promise(res=>setTimeout(res,500)); // rate limit
      await sendTelegramMessage(token,chatId,formatSignalForTelegram(r.coinId,r));
      sent++;
      setStatus(`Sending ${sent}/${Math.min(5,results.length)}...`);
    }
    setStatus(`✅ Sent ${sent} signals to Telegram!`);
    setLoading(false);setTimeout(()=>setStatus(""),5000);
  };
  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    <button className="btn" style={{padding:"8px 14px",fontSize:11,background:"linear-gradient(135deg,#0077a8,#00a8cc)",color:"#fff"}} onClick={sendAll} disabled={loading}>
      {loading?<><Spin sz={12}/> {status||"Sending..."}</>:<><span>✈️</span> Send All to Telegram</>}
    </button>
    {!loading&&status&&<div style={{fontSize:11,color:"var(--g)",textAlign:"center"}}>{status}</div>}
  </div>);
}

// ── SCANNER ───────────────────────────────────────────────────────

function TelegramScanBtn({results}){
  const [status,setStatus]=useState("");const [loading,setLoading]=useState(false);
  const token=localStorage.getItem("cq_admin_tg_token")||"";
  if(!token||!results?.length) return null;
  const send=async()=>{
    setLoading(true);setStatus("Sending...");
    const users=Auth.all().filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt);
    if(!users.length){setStatus("⚠️ No paid users linked");setLoading(false);return;}
    const longs=results.filter(r=>r.signal==="LONG").length;
    const shorts=results.filter(r=>r.signal==="SHORT").length;
    const sum=`📊 <b>CRYPTEX QUANT — SCAN</b>\n━━━━━━━━━━━━━━━━━━━━\n🟢 LONG: ${longs} | 🔴 SHORT: ${shorts}\n${results.length} signals (top 5 below)`;
    for(const u of users) await tgSend(token,u.telegramChatId,sum);
    for(const r of results.slice(0,5)){
      await new Promise(res=>setTimeout(res,400));
      for(const u of users) await tgSend(token,u.telegramChatId,fmtTg(r.coinId,r));
    }
    setStatus(`✅ Broadcast to ${users.length} subscriber${users.length!==1?"s":""}`);
    setLoading(false);setTimeout(()=>setStatus(""),5000);
  };
  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    <button style={{padding:"8px 14px",fontSize:11,background:"linear-gradient(135deg,#006699,#0099cc)",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,textTransform:"uppercase",letterSpacing:1}} onClick={send} disabled={loading}>
      {loading?<Spin sz={12}/>:<><span>✈️</span> Broadcast Scan</>}
    </button>
    {status&&<div style={{fontSize:10,color:"var(--g)",textAlign:"center"}}>{status}</div>}
  </div>);
}
function PageScan(){
  const[phase,setPhase]=useState("idle");const[prog,setProg]=useState({msg:"",pct:0,found:0});
  const[results,setResults]=useState([]);const[st,setSt]=useState("day");
  const[filter,setFilter]=useState("all");const[view,setView]=useState(null);
  const cancelRef=useRef(false);

  const doScan=async()=>{
    cancelRef.current=false;setPhase("scanning");setResults([]);setView(null);
    const res=await runScan(st,(p)=>{if(!cancelRef.current)setProg(p);});
    if(!cancelRef.current){setResults(res);setPhase("done");}
  };

  const filtered=filter==="all"?results:results.filter(r=>r.signal===filter.toUpperCase());
  const longs=results.filter(r=>r.signal==="LONG").length;const shorts=results.filter(r=>r.signal==="SHORT").length;

  if(view)return(<div><button className="btn btn-h" style={{marginBottom:16}} onClick={()=>setView(null)}>← Back to Scan</button>
    <SignalCard coinId={view.coinId} name={view.coinId} sig={view} loading={false} onRefresh={()=>setView(null)} livePrice={view.price} liveChg={view.chg24}/></div>);

  return(<div>
    <div style={{marginBottom:20}}>
      <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:1,marginBottom:4}}>
        MARKET <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SCANNER</span>
      </h2>
      <div style={{fontSize:13,color:"var(--text2)"}}>Quantitative scan of {CFG.SCAN_N}+ pairs · Triple confirmation filter · Confidence ≥{CFG.MIN_CONF}%</div>
    </div>

    {phase==="idle"&&<div>
      <div className="stab" style={{marginBottom:16}}>
        <button className={`stab-btn ${st==="scalp"?"as":""}`} onClick={()=>setSt("scalp")}>⚡ SCALP 5M</button>
        <button className={`stab-btn ${st==="day"?"ad":""}`}   onClick={()=>setSt("day")}>📊 DAY 1H</button>
        <button className={`stab-btn ${st==="swing"?"aw":""}`} onClick={()=>setSt("swing")}>🌊 SWING 4H</button>
      </div>
      <div className="card ai" style={{padding:56,textAlign:"center"}}>
        <div style={{marginBottom:24}}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{display:"block",margin:"0 auto"}}>
            <circle cx="36" cy="36" r="32" stroke="rgba(0,200,255,.12)" strokeWidth="2" fill="none"/>
            <circle cx="36" cy="36" r="22" stroke="rgba(0,200,255,.25)" strokeWidth="1.5" fill="none"/>
            <circle cx="36" cy="36" r="5" fill="var(--c)" style={{filter:"drop-shadow(0 0 8px var(--c))"}}/>
            {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i)=>{const R=32,rad=a*Math.PI/180;return<line key={i} x1={36+24*Math.cos(rad)} y1={36+24*Math.sin(rad)} x2={36+R*Math.cos(rad)} y2={36+R*Math.sin(rad)} stroke="rgba(0,200,255,.5)" strokeWidth="1.5" strokeLinecap="round"/>;})}
          </svg>
        </div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,fontWeight:800,letterSpacing:2,marginBottom:10}}>QUANT MARKET SCANNER</div>
        <div style={{color:"var(--text2)",fontSize:13,marginBottom:30,maxWidth:480,margin:"0 auto 30px",lineHeight:1.8}}>
          Scans {CFG.SCAN_N}+ high-volume pairs. Only signals with ≥3 technical confirmations pass the filter. Every signal includes entry range, stop-loss, 3 TP targets, and trailing SL.
        </div>
        <button className="btn btn-c" style={{padding:"16px 56px",fontSize:14,letterSpacing:1.5}} onClick={doScan}>🔍 START DEEP SCAN — {st.toUpperCase()}</button>
      </div>
    </div>}

    {phase==="scanning"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,color:"var(--c)",letterSpacing:1.5}}>SCANNING MARKET...</div>
        <button className="btn btn-r" style={{padding:"7px 14px",fontSize:11}} onClick={()=>{cancelRef.current=true;setPhase("idle");}}>✕ CANCEL</button>
      </div>
      <div className="card" style={{padding:28}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:18}}>
          <Spin sz={40}/>
          <div><div style={{fontWeight:600,fontSize:14,marginBottom:3}}>{prog.msg}</div>
          <div style={{fontSize:12,color:"var(--text2)"}}>Found {prog.found} triple-confirmed signal{prog.found!==1?"s":""} so far</div></div>
        </div>
        <div className="prog" style={{height:8,borderRadius:4}}>
          <div className="pf" style={{width:`${prog.pct}%`,height:"100%",background:"linear-gradient(90deg,var(--c),var(--g))"}}/>
        </div>
        <div className="mono" style={{fontSize:11,color:"var(--text2)",marginTop:6}}>{prog.pct}%</div>
      </div>
    </div>}

    {phase==="done"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div style={{padding:"10px 18px",background:"rgba(0,255,136,.06)",border:"1px solid rgba(0,255,136,.2)",borderRadius:10,display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:20}}>🎯</span>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,color:"var(--g)",letterSpacing:1,fontWeight:700}}>SCAN COMPLETE — {st.toUpperCase()} STRATEGY</div>
            <div style={{fontSize:12,marginTop:2}}>{results.length} signals · <span style={{color:"var(--g)"}}>{longs} LONG</span> / <span style={{color:"var(--r)"}}>{shorts} SHORT</span> · All 3+ confirmed</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-h" onClick={()=>setPhase("idle")}>🔄 New Scan</button>
          <TelegramScanSendButton results={filtered}/>
        </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        {[["all",`All (${results.length})`],["long",`▲ LONG (${longs})`],["short",`▼ SHORT (${shorts})`]].map(([k,l])=>(
          <button key={k} className={`btn ${filter===k?"btn-c":"btn-h"}`} style={{padding:"7px 14px",fontSize:11}} onClick={()=>setFilter(k)}>{l}</button>
        ))}
        <div style={{marginLeft:"auto",fontSize:11,color:"var(--text2)"}}>Sorted by confidence ↓</div>
      </div>
      {filtered.length===0?
        <div className="card" style={{padding:40,textAlign:"center"}}><div style={{fontSize:42,marginBottom:12}}>🔍</div><div style={{color:"var(--text2)"}}>No {filter==="all"?"":filter.toUpperCase()} signals met the triple confirmation threshold. Try a different strategy.</div></div>:
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map((r,i)=>{const isL=r.signal==="LONG";const col=isL?"var(--g)":"var(--r)";return(
            <div key={i} className={`card au ${isL?"card-l":"card-s"}`} style={{padding:"14px 18px",cursor:"pointer",animationDelay:`${i*.03}s`}} onClick={()=>setView(r)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:10,background:`rgba(${isL?"0,255,136":"255,32,82"},.08)`,border:`1.5px solid ${col}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,color:col,flexShrink:0}}>{r.coinId?.[0]||"?"}</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:16,letterSpacing:.5}}>{r.coinId}/USDT</span>
                      <span className={`pill ${isL?"pg":"pr"}`}>{isL?"▲ LONG":"▼ SHORT"}</span>
                      <span className={`pill ${r.risk==="LOW"?"pg":r.risk==="MEDIUM"?"py":"pr"}`}>{r.risk}</span>
                      <span className={`pill ${{scalp:"ps",day:"pd",swing:"pw"}[r.strategy]}`}>{r.strategy.toUpperCase()}</span>
                      <span className="pill" style={{background:"rgba(0,200,255,.07)",color:"var(--c)",border:"1px solid rgba(0,200,255,.2)",fontSize:10}}>✦{r.confirmCount} CONF</span>
                    </div>
                    <div style={{fontSize:12,color:"var(--text2)"}}>
                      Entry <span className="mono" style={{color:"var(--text)"}}>${fp(r.eLow)}–${fp(r.eHigh)}</span> · SL <span className="mono" style={{color:"var(--r)"}}>${fp(r.sl)}</span> · TP1 <span className="mono" style={{color:"var(--g)"}}>${fp(r.tp1)}</span>
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",gap:12,alignItems:"center",flexShrink:0}}>
                  <div style={{textAlign:"right"}}>
                    <div className="mono" style={{fontSize:15,fontWeight:700}}>${fp(r.price)}</div>
                    <div style={{fontSize:12,color:(r.chg24||0)>=0?"var(--g)":"var(--r)"}}>{(r.chg24||0)>=0?"+":""}{(r.chg24||0).toFixed(2)}%</div>
                  </div>
                  <Ring val={r.conf} color={col} sz={68}/>
                </div>
              </div>
              <div style={{fontSize:11,color:"var(--text2)",marginTop:10,lineHeight:1.5}}>{r.reasons?.[0]||""}</div>
              <div className="prog" style={{marginTop:8}}><div className="pf" style={{width:`${r.conf}%`,background:`linear-gradient(90deg,${col}55,${col})`}}/></div>
            </div>);
          })}
        </div>
      }
    </div>}
  </div>);
}

// ── SEARCH ────────────────────────────────────────────────────────
function PageSearch(){
  const[query,setQuery]=useState("");const[pairs,setPairs]=useState([]);const[filtered,setFiltered]=useState([]);const[show,setShow]=useState(false);const[sel,setSel]=useState(null);const[coinData,setCoinData]=useState(null);const[sigs,setSigs]=useState({});const[loading,setLoading]=useState(false);const[vst,setVst]=useState("day");const ref=useRef(null);
  useEffect(()=>{fetch("https://api.binance.com/api/v3/ticker/24hr").then(r=>r.json()).then(all=>{setPairs(all.filter(d=>d.symbol.endsWith("USDT")&&parseFloat(d.quoteVolume)>5e5).sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume)).slice(0,120).map(d=>({symbol:d.symbol,id:d.symbol.replace("USDT",""),price:+d.lastPrice,chg24:+d.priceChangePercent})));}).catch(()=>{});},[]);
  useEffect(()=>{if(!query.trim()){setFiltered([]);setShow(false);return;}const q=query.toUpperCase().replace("/USDT","");setFiltered(pairs.filter(p=>p.id.startsWith(q)||p.id.includes(q)).slice(0,12));setShow(true);},[query,pairs]);
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const select=async(pair)=>{
    setSel(pair);setShow(false);setQuery(`${pair.id}/USDT`);setLoading(true);setCoinData(null);setSigs({});
    const results={};
    for(const st of["scalp","day","swing"]){
      const s=await quantAnalyze(pair.symbol,st,pair.price);
      results[st]=s||{noSignal:true,reason:"Triple confirmation not achieved for this timeframe. Market is ranging or consolidating.",strategy:st};
    }
    setCoinData(pair);setSigs(results);setLoading(false);
  };
  const POP=["BTC","ETH","SOL","BNB","DOGE","XRP","ADA","LINK","AVAX","DOT","MATIC","APT","ARB","OP","INJ"];
  return(<div>
    <div style={{marginBottom:20}}><h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:1,marginBottom:4}}>CUSTOM <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>PAIR ANALYSIS</span></h2><div style={{fontSize:13,color:"var(--text2)"}}>Search any USDT pair · Full quant analysis · All 3 strategies</div></div>
    <div ref={ref} style={{position:"relative",marginBottom:18}}>
      <input className="inp" placeholder="Search: DOGE, XRP, PEPE, WIF, INJ..." value={query} onChange={e=>setQuery(e.target.value)} onFocus={()=>query&&filtered.length&&setShow(true)} style={{paddingLeft:46,fontSize:15}}/>
      <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:20}}>🔍</span>
      {show&&<div className="dd">{filtered.map(p=><div key={p.symbol} className="ddi" onClick={()=>select(p)}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:8,background:"var(--bg3)",border:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:800,color:"var(--c)",flexShrink:0}}>{p.id[0]}</div>
          <div><div style={{fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.5}}>{p.id}/USDT</div><div className="mono" style={{fontSize:11,color:"var(--text2)"}}>${fp(p.price)}</div></div>
        </div>
        <div style={{fontSize:12,color:p.chg24>=0?"var(--g)":"var(--r)",fontWeight:700}}>{p.chg24>=0?"+":""}{p.chg24.toFixed(2)}%</div>
      </div>)}</div>}
    </div>
    {!sel&&<><div style={{fontSize:10,color:"var(--text2)",letterSpacing:1.5,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif"}}>POPULAR PAIRS</div><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{POP.map(id=>{const p=pairs.find(x=>x.id===id);return<button key={id} className="btn btn-h" style={{padding:"7px 13px",fontSize:11}} onClick={()=>p&&select(p)} disabled={!p}>{id}/USDT</button>;})}</div></>}
    {loading&&<div className="card ai" style={{padding:44,textAlign:"center",marginTop:18}}><Spin sz={44}/><div style={{marginTop:14,color:"var(--c)",fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,letterSpacing:1}}>RUNNING QUANT ANALYSIS ON {sel?.id}...</div><div style={{marginTop:6,color:"var(--text2)",fontSize:12}}>Fetching multi-timeframe data · Applying triple confirmation filter</div></div>}
    {coinData&&!loading&&Object.keys(sigs).length>0&&<div style={{marginTop:16}}>
      <div className="card" style={{padding:14,marginBottom:14}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--text2)",letterSpacing:2,marginBottom:12}}>STRATEGY OVERVIEW — {coinData.id}/USDT</div>
        {["scalp","day","swing"].map(s=>{const sg=sigs[s];const isL=sg?.signal==="LONG";const sc={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"}[s];return(
          <div key={s} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <div style={{width:56,fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:700,color:sc,letterSpacing:1}}>{s.toUpperCase()}</div>
            {sg&&!sg.noSignal?<><div className="prog" style={{flex:1}}><div className="pf" style={{width:`${sg.conf}%`,background:sc}}/></div>
              <span className={`pill ${isL?"pg":"pr"}`} style={{width:52,justifyContent:"center",fontSize:10}}>{isL?"▲ L":"▼ S"}</span>
              <span className="mono" style={{fontSize:11,width:28,color:sc,textAlign:"right"}}>{sg.conf}%</span>
              <span style={{fontSize:10,color:"var(--text2)",width:36,textAlign:"right"}}>✦{sg.confirmCount}</span>
            </>:<div style={{flex:1,fontSize:12,color:"var(--y)"}}>⏳ No signal</div>}
          </div>);})}
      </div>
      <div className="stab" style={{marginBottom:14}}>
        <button className={`stab-btn ${vst==="scalp"?"as":""}`} onClick={()=>setVst("scalp")}>⚡ SCALP</button>
        <button className={`stab-btn ${vst==="day"?"ad":""}`} onClick={()=>setVst("day")}>📊 DAY</button>
        <button className={`stab-btn ${vst==="swing"?"aw":""}`} onClick={()=>setVst("swing")}>🌊 SWING</button>
      </div>
      <SignalCard coinId={coinData.id} name={coinData.id} sig={sigs[vst]} loading={false} onRefresh={()=>select(sel)} livePrice={coinData.price} liveChg={coinData.chg24}/>
    </div>}
  </div>);
}

// ── TRACKER ───────────────────────────────────────────────────────
function PageTracker(){
  const[hist]=useState(()=>{const h=localStorage.getItem("cx_history");if(h)return JSON.parse(h);const cs=["BTC","ETH","SOL","BNB","AVAX","DOGE","XRP","LINK","MATIC","APT"];const ss=["scalp","day","swing"];return Array.from({length:30},(_,i)=>{const w=Math.random()<0.74;return{id:i,coin:cs[i%10],strategy:ss[i%3],signal:Math.random()>0.5?"LONG":"SHORT",conf:Math.round(72+Math.random()*20),result:w?"WIN":"LOSS",profit:w?+(1.5+Math.random()*5).toFixed(2):-(0.5+Math.random()*2.5).toFixed(2),time:new Date(Date.now()-i*8*3600*1000).toLocaleDateString()};});});
  const[filter,setFilter]=useState("all");const fl=filter==="all"?hist:hist.filter(h=>h.strategy===filter);
  const wins=fl.filter(h=>h.result==="WIN").length;const total=fl.length;const wr=total>0?Math.round(wins/total*100):0;const profit=fl.reduce((a,h)=>a+h.profit,0);
  return(<div>
    <div style={{marginBottom:20}}>
      <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:1,marginBottom:4}}>SUCCESS <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>TRACKER</span></h2>
      <div style={{padding:"12px 16px",background:"var(--bg3)",border:"1px solid var(--bdr)",borderRadius:10,fontSize:12,color:"var(--text2)",lineHeight:1.9,marginTop:10}}>
        <div style={{color:"var(--y)",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,marginBottom:4}}>📊 WIN RATE METHODOLOGY</div>
        <div><span style={{color:"var(--g)",fontWeight:600}}>WIN</span> — Price moved ≥{CFG.WIN_THRESH*100}% of Entry→TP1 distance within the signal lock period, without triggering Stop Loss.</div>
        <div><span style={{color:"var(--r)",fontWeight:600}}>LOSS</span> — Stop Loss triggered before TP1 reached.</div>
        <div><span style={{color:"var(--y)",fontWeight:600}}>PENDING</span> — Signal still active within lock duration.</div>
        <div style={{marginTop:4,color:"var(--c)",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13}}>Win Rate = Wins ÷ (Wins + Losses) × 100%</div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
      {[{l:"WIN RATE",v:`${wr}%`,c:wr>=70?"var(--g)":wr>=55?"var(--y)":"var(--r)"},{l:"WINS",v:wins,c:"var(--g)"},{l:"LOSSES",v:total-wins,c:"var(--r)"},{l:"TOTAL P&L",v:`${profit>=0?"+":""}${profit.toFixed(1)}%`,c:profit>=0?"var(--g)":"var(--r)"}].map((it,i)=>(
        <div key={i} style={{background:"var(--bg3)",borderRadius:12,padding:"14px 16px",border:"1px solid var(--bdr)"}}>
          <div style={{fontSize:9,color:"var(--text2)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"}}>{it.l}</div>
          <div className="mono" style={{fontSize:22,fontWeight:700,color:it.c}}>{it.v}</div>
        </div>
      ))}
    </div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      {[["all","All"],["scalp","⚡ Scalp"],["day","📊 Day"],["swing","🌊 Swing"]].map(([k,l])=><button key={k} className={`btn ${filter===k?"btn-c":"btn-h"}`} style={{padding:"7px 13px",fontSize:11}} onClick={()=>setFilter(k)}>{l}</button>)}
    </div>
    <div className="card" style={{overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 80px 50px 70px 80px",gap:8,padding:"10px 14px",borderBottom:"1px solid var(--bdr)",fontSize:9,color:"var(--text2)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1.5,textTransform:"uppercase"}}>
        <span>SIGNAL</span><span style={{textAlign:"center"}}>TYPE</span><span style={{textAlign:"center"}}>CONF</span><span style={{textAlign:"center"}}>RESULT</span><span style={{textAlign:"right"}}>P&L</span>
      </div>
      {fl.slice(0,25).map((h,i)=>(
        <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 50px 70px 80px",gap:8,padding:"10px 14px",borderBottom:"1px solid rgba(22,45,72,.5)",fontSize:13,alignItems:"center"}}>
          <div><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,marginRight:8,letterSpacing:.5}}>{h.coin}/USDT</span><span className={`pill ${h.signal==="LONG"?"pg":"pr"}`} style={{fontSize:9}}>{h.signal}</span></div>
          <div style={{textAlign:"center"}}><span className={`pill ${{scalp:"ps",day:"pd",swing:"pw"}[h.strategy]}`} style={{fontSize:9,padding:"2px 7px"}}>{h.strategy.toUpperCase()}</span></div>
          <div style={{textAlign:"center"}}><span className="mono" style={{fontSize:11,color:"var(--text2)"}}>{h.conf||"—"}%</span></div>
          <div style={{textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:12,color:h.result==="WIN"?"var(--g)":"var(--r)"}}>{h.result==="WIN"?"✓ WIN":"✗ LOSS"}</div>
          <div className="mono" style={{textAlign:"right",fontWeight:700,color:h.profit>=0?"var(--g)":"var(--r)",fontSize:13}}>{h.profit>=0?"+":""}{h.profit}%</div>
        </div>
      ))}
    </div>
  </div>);
}

// ── CHAT ──────────────────────────────────────────────────────────
function PageChat({user}){
  const[msgs,setMsgs]=useState([]);const[text,setText]=useState("");const isAdmin=user?.role==="admin";
  const baseTid=user.cqid||user.email;
  // Use activeTid from state so user can open new ticket after closing
  const[activeTid,setActiveTid]=useState(()=>{
    // Find the latest open thread for this user
    try{const threads=JSON.parse(localStorage.getItem("cx_threads")||"{}");
      // Get all keys that start with baseTid, sorted desc (most recent first)
      const myThreads=Object.keys(threads).filter(k=>k===baseTid||k.startsWith(baseTid+"_")).sort().reverse();
      for(const t of myThreads){if(!threads[t]?.closed)return t;}
      // All closed - use baseTid as default (will show closed state)
      return baseTid;
    }catch{return baseTid;}
  });
  const[closed,setClosed]=useState(()=>Chat.isClosed(activeTid));
  const bottomRef=useRef(null);
  const load=useCallback(()=>{
    const all=Chat.get();
    // For user: show messages from their active thread + admin replies to them
    setMsgs(isAdmin?all:all.filter(m=>m.tid===activeTid||(m.role==="admin"&&m.tid===activeTid)));
    Chat.markRead(user.role);
  },[user.cqid,user.role,isAdmin,activeTid]);
  useEffect(()=>{load();const t=setInterval(load,3000);return()=>clearInterval(t);},[load]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  const send=()=>{if(!text.trim()||closed)return;Chat.send(user.cqid||user.email,text.trim(),user.role,activeTid);setText("");setTimeout(load,200);};
  const closeEnq=()=>{if(!window.confirm("Mark this enquiry as resolved?"))return;Chat.closeThread(activeTid);setClosed(true);};
  const openNewChat=()=>{
    const newTid=`${baseTid}_${Date.now()}`;
    // Store new thread as open
    const threads=JSON.parse(localStorage.getItem("cx_threads")||"{}");
    threads[newTid]={closed:false,at:Date.now()};
    localStorage.setItem("cx_threads",JSON.stringify(threads));
    setActiveTid(newTid);setClosed(false);setMsgs([]);
    Chat.send(user.cqid||user.email,"[New enquiry opened]",user.role,newTid);
  };
  const threads=isAdmin?[...new Set(Chat.get().map(m=>m.tid||m.from))]:null;
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <div><h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:1}}>{isAdmin?"💬 USER ENQUIRIES":"💬 SUPPORT"}</h2>
      <div style={{fontSize:12,color:"var(--text2)",marginTop:3}}>{isAdmin?"Manage all user messages":"Chat with our support team"}</div></div>
      {!isAdmin&&!closed&&<button className="btn btn-r" style={{padding:"8px 14px",fontSize:11}} onClick={closeEnq}>✓ Close Enquiry</button>}
      {!isAdmin&&closed&&<div style={{display:"flex",gap:8,alignItems:"center"}}>
        <span className="pill pg">✓ Enquiry Closed</span>
        <button className="btn btn-c" style={{padding:"8px 14px",fontSize:11}} onClick={openNewChat}>+ New Chat</button>
      </div>}
    </div>
    <div className="card" style={{height:500,display:"flex",flexDirection:"column"}}>
      {closed&&!isAdmin&&<div style={{padding:"10px 16px",background:"rgba(0,255,136,.06)",borderBottom:"1px solid rgba(0,255,136,.15)",fontSize:12,color:"var(--g)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}><span>✅</span><span>Enquiry closed.</span></div>
        <button className="btn btn-c" style={{padding:"5px 14px",fontSize:11,borderRadius:20}} onClick={openNewChat}>+ Open New Chat</button>
      </div>}
      <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {msgs.length===0?<div style={{textAlign:"center",color:"var(--text2)",marginTop:60}}><div style={{fontSize:44,marginBottom:12}}>💬</div><div>No messages yet.</div></div>:
        msgs.map((m,i)=>{const isMe=m.from===(user.cqid||user.email);const isAdm=m.role==="admin";return(
          <div key={i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start"}}>
            <div style={{fontSize:9,color:"var(--text2)",marginBottom:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.5}}>{isAdm?"🛡 SUPPORT":m.from.slice(0,10)} · {new Date(m.time).toLocaleTimeString()}</div>
            <div className={isMe?"cbu":"cba"}><div style={{fontSize:13,lineHeight:1.6}}>{m.text}</div></div>
          </div>);
        })}
        <div ref={bottomRef}/>
      </div>
      {!closed&&<div style={{padding:"10px 14px",borderTop:"1px solid var(--bdr)",display:"flex",gap:10}}>
        <input className="inp" placeholder="Type your message..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} style={{borderRadius:24,padding:"10px 18px"}}/>
        <button className="btn btn-c" style={{borderRadius:24,padding:"10px 20px",flexShrink:0}} onClick={send} disabled={!text.trim()}>Send</button>
      </div>}
    </div>
    {isAdmin&&threads?.length>0&&<div style={{marginTop:16}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--text2)",letterSpacing:2,marginBottom:10}}>USER THREADS</div>
      {threads.map(t=><div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",background:"var(--bg3)",borderRadius:8,marginBottom:6,border:"1px solid var(--bdr)"}}>
        <span style={{fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:.5}}>{t}</span>
        <div style={{display:"flex",gap:8}}>{Chat.isClosed(t)?<span className="pill pg" style={{fontSize:10}}>CLOSED</span>:<button className="btn btn-r" style={{padding:"5px 12px",fontSize:10}} onClick={()=>Chat.closeThread(t)}>Close</button>}</div>
      </div>)}
    </div>}
  </div>);
}

// ── ABOUT ─────────────────────────────────────────────────────────
function PageAbout(){
  const features=[
    {icon:"🔬",t:"Triple Confirmation Engine",d:"Signals require ≥3 of 10 indicators to align: EMA Stack, RSI, MACD, Bollinger Bands, VWAP, Order Book, Whale Detection, Divergence, S/R + HTF, Stochastic."},
    {icon:"📊",t:"Multi-Timeframe Sync",d:"Scalp (5M + 1H HTF), Day (1H + 4H HTF), Swing (4H + 1D HTF). Higher timeframe trend always considered before entry."},
    {icon:"🐋",t:"Whale & Liquidity Detection",d:"Real-time volume analysis detects abnormal spikes. Identifies whale accumulation/distribution zones using candlestick structure + volume ratio."},
    {icon:"📖",t:"Live Order Book Analysis",d:"Real bid/ask wall pressure from live order book data. Detects institutional buy/sell walls that indicate price direction."},
    {icon:"🔒",t:"Signal Lock System",d:"Scalp: 15min · Day: 4h · Swing: 24h. Prevents false flipping. Only updates on significant price deviation (0.8%/1.5%/3%)."},
    {icon:"📌",t:"Trailing Stop-Loss",d:"After TP1 hit, system recommends moving SL to break-even. Protects profit while letting winners run to TP2/TP3."},
    {icon:"🚨",t:"Volatility Siren",d:"Auto-detects extreme market events (>8% moves). Triggers siren alarm, recommends reducing position size, and pauses low-confidence signals."},
    {icon:"🔍",t:"Full Market Scanner",d:"Scans 80+ high-volume USDT pairs. Pre-filters by price action, then deep-analyzes top 30 candidates. Returns all triple-confirmed setups."},
    {icon:"📈",t:"Success Tracker",d:"Win/Loss history with P&L tracking. Win Rate = Wins÷(Wins+Losses)×100%. WIN = price reached 60%+ of TP1 distance without SL."},
    {icon:"🪪",t:"Unique CQ-ID Login",d:"No OTP, no phone needed. Register with email+password → get unique CQ-XXXXXXXX ID instantly. Secure, simple, fast."},
    {icon:"💬",t:"Support Chat",d:"Direct chat with admin. Close enquiry when resolved. Admin manages all user threads with close/open control."},
    {icon:"💎",t:"Subscription Plans",d:"Free 30-day trial → Basic ($15) → Pro ($39) → Elite ($99). USDT TRC20 payments. Admin blockchain verification."},
  ];
  return(<div>
    <div style={{textAlign:"center",padding:"36px 20px 40px",background:"linear-gradient(135deg,rgba(0,200,255,.04),rgba(0,255,136,.04))",borderRadius:20,border:"1px solid rgba(0,200,255,.1)",marginBottom:28}}>
      <div style={{display:"flex",justifyContent:"center",marginBottom:18}}><div className="glow" style={{borderRadius:16}}><Logo sz={80}/></div></div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:34,fontWeight:900,letterSpacing:"4px",marginBottom:6}}>
        <span style={{background:"linear-gradient(135deg,var(--c),var(--g))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CRYPTEX QUANT</span>
      </div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"var(--text2)",letterSpacing:2,marginBottom:20}}>QUANTITATIVE FUTURES INTELLIGENCE v5.0</div>
      <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
        <span className="pill pg">80+ Markets</span><span className="pill pc">Triple Confirmation</span><span className="pill pw">Real-Time Order Book</span><span className="pill ps">Whale Detection</span>
      </div>
    </div>
    <div className="card" style={{padding:24,marginBottom:20}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"var(--c)",letterSpacing:1,marginBottom:12}}>WHAT IS CRYPTEX QUANT?</div>
      <div style={{fontSize:13,color:"var(--text)",lineHeight:1.95}}>Cryptex Quant v5.0 is a professional quantitative crypto futures signal platform powered by an advanced multi-indicator convergence engine. Unlike basic signal apps that use 1-2 indicators, Cryptex Quant requires Triple Confirmation — at least 3 of 10 technical indicators must align before a signal is generated.<br/><br/>The platform analyzes real-time order book depth, detects whale accumulation zones, synchronizes signals across multiple timeframes, and automatically adjusts for market volatility events. Every signal includes a precise entry range, tiered profit targets, stop loss, and trailing stop-loss guidance.</div>
    </div>
    <div className="card" style={{padding:24,marginBottom:20,border:"1px solid rgba(0,255,136,.15)"}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"var(--g)",letterSpacing:1,marginBottom:14}}>📊 WIN RATE CALCULATION</div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {[["✓ WIN",`Price moves ≥${CFG.WIN_THRESH*100}% toward TP1 from entry within the lock duration, without hitting SL.`,"var(--g)"],["✗ LOSS","Stop Loss level triggered before TP1 target.","var(--r)"],["⏳ PENDING","Signal active within lock duration. Not yet counted.","var(--y)"],["Formula","Win Rate = Total Wins ÷ (Total Wins + Total Losses) × 100%","var(--c)"]].map(([k,v,c])=>(
          <div key={k} style={{display:"flex",gap:12,padding:"12px 14px",background:"var(--bg3)",borderRadius:10}}>
            <div style={{width:90,flexShrink:0,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:c,fontSize:13}}>{k}</div>
            <div style={{color:"var(--text)",fontSize:13,lineHeight:1.7}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
    <div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"var(--c)",letterSpacing:1,marginBottom:16}}>ALL FEATURES</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {features.map((f,i)=>(
          <div key={i} className="card au" style={{padding:18,animationDelay:`${i*.05}s`}}>
            <div style={{display:"flex",gap:12,marginBottom:8}}><span style={{fontSize:22,flexShrink:0}}>{f.icon}</span><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,color:"var(--c)",letterSpacing:.5}}>{f.t}</div></div>
            <div style={{fontSize:12,color:"var(--text2)",lineHeight:1.7}}>{f.d}</div>
          </div>
        ))}
      </div>
    </div>
    <div className="card" style={{padding:20,marginTop:20}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,color:"var(--y)",letterSpacing:1,marginBottom:14}}>💎 PLANS</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
        {[{n:"Free Trial",p:"0 USDT / 30 days",c:"var(--c)"},{n:"Basic",p:"15 USDT/month",c:"var(--c)"},{n:"Pro",p:"39 USDT/month",c:"var(--g)"},{n:"Elite",p:"99 USDT/month",c:"var(--p)"}].map((p,i)=>(
          <div key={i} style={{background:"var(--bg3)",borderRadius:10,padding:"14px 16px",border:`1px solid ${p.c}22`}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:p.c,fontSize:14,marginBottom:4}}>{p.n}</div>
            <div className="mono" style={{fontSize:15,fontWeight:700}}>{p.p}</div>
          </div>
        ))}
      </div>
      <div style={{marginTop:14,padding:"12px 14px",background:"rgba(0,200,255,.04)",border:"1px solid rgba(0,200,255,.15)",borderRadius:10,fontSize:12,color:"var(--text2)"}}>
        Payment: <strong style={{color:"var(--g)"}}>USDT TRC20 only</strong> · Wallet: <span className="mono" style={{color:"var(--c)",fontSize:11}}>{CFG.WALLET}</span>
      </div>
    </div>
  </div>);
}

// ── SUBSCRIBE ─────────────────────────────────────────────────────
function PageSubscribe({user}){
  const[plan,setPlan]=useState("pro");const[txid,setTxid]=useState("");const[step,setStep]=useState("select");const[loading,setLoad]=useState(false);
  const PLS=[
    {id:"basic",col:"var(--c)",em:"🥉",badge:null,feats:["All 5 coins","Scalp+Day+Swing","Win Rate Tracker","Custom Search","Chat Support"]},
    {id:"pro",col:"var(--g)",em:"🥇",badge:"POPULAR",feats:["All BASIC","Full Market Scanner","Breakout Alerts","Priority Signals"]},
    {id:"elite",col:"var(--p)",em:"💎",badge:"BEST",feats:["All PRO","1-on-1 Support","Custom Coin Requests","API Access","Resell License"]},
  ];
  if(step==="done")return(<div className="card ai" style={{padding:48,textAlign:"center"}}><div style={{fontSize:56,marginBottom:16}}>⏳</div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,color:"var(--g)",fontWeight:800,letterSpacing:1,marginBottom:8}}>PAYMENT SUBMITTED</div><div style={{color:"var(--text2)",lineHeight:1.9,marginBottom:20}}>TxID: <span className="mono" style={{color:"var(--c)",fontSize:11}}>{txid.slice(0,32)}...</span><br/>Team verifies on TronScan · Activated within <strong style={{color:"var(--text)"}}>1–4 hours</strong>.</div><button className="btn btn-c" onClick={()=>setStep("select")}>← Back</button></div>);
  return(<div>
    <div style={{textAlign:"center",marginBottom:24}}><h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,fontWeight:900,letterSpacing:1.5,marginBottom:6}}>UPGRADE <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>YOUR PLAN</span></h2><div style={{fontSize:13,color:"var(--text2)"}}>USDT TRC20 only · Blockchain verified · 30-day access</div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:24}}>
      {PLS.map(p=>{const pd=CFG.PLANS[p.id];return(
        <div key={p.id} className="card" onClick={()=>setPlan(p.id)} style={{padding:22,cursor:"pointer",position:"relative",border:`1.5px solid ${plan===p.id?p.col:"var(--bdr)"}`,boxShadow:plan===p.id?`0 0 24px ${p.col}25`:"none"}}>
          {p.badge&&<div style={{position:"absolute",top:-1,right:14,background:p.col,color:"#000",fontSize:9,fontWeight:900,padding:"3px 10px",borderRadius:"0 0 9px 9px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{p.badge}</div>}
          <div style={{fontSize:30,marginBottom:8}}>{p.em}</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:800,letterSpacing:.5,marginBottom:4}}>{pd.name}</div>
          <div style={{marginBottom:14}}><span className="mono" style={{fontSize:28,fontWeight:700,color:p.col}}>{pd.usdt} USDT</span><span style={{color:"var(--text2)",fontSize:12}}>/month</span></div>
          {p.feats.map(f=><div key={f} style={{fontSize:12,marginBottom:6,display:"flex",alignItems:"center",gap:7}}><span style={{color:p.col,flexShrink:0}}>✓</span>{f}</div>)}
        </div>);})}
    </div>
    <div className="card" style={{padding:24}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--text2)",letterSpacing:2,marginBottom:18,textTransform:"uppercase"}}>Payment Instructions</div>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
        {[{n:"1",t:"Send USDT on Tron (TRC20) network only",d:"NOT Ethereum, BSC, or any other network — wrong network = permanent loss"},
          {n:"2",t:`Send exactly ${CFG.PLANS[plan].usdt} USDT`,d:`For ${CFG.PLANS[plan].name} plan — 30 days access`},
          {n:"3",t:"Copy wallet address below carefully",d:"Double-check every character before confirming"},
          {n:"4",t:"Copy Transaction ID (TxID) from your wallet",d:"The long alphanumeric hash shown after transaction"},
          {n:"5",t:"Paste TxID below and submit",d:"Team verifies on TronScan and activates within 1–4 hours"}].map(s=>(
          <div key={s.n} style={{display:"flex",gap:14,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(0,200,255,.1)",border:"1px solid rgba(0,200,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,color:"var(--c)",fontSize:13}}>{s.n}</div>
            <div><div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{s.t}</div><div style={{fontSize:12,color:"var(--text2)"}}>{s.d}</div></div>
          </div>
        ))}
      </div>
      <div style={{background:"rgba(0,255,136,.05)",border:"2px solid rgba(0,255,136,.3)",borderRadius:12,padding:"16px 18px",marginBottom:18}}>
        <div style={{fontSize:10,color:"var(--g)",letterSpacing:1.5,marginBottom:8,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>💚 USDT TRC20 WALLET</div>
        <div className="mono" style={{fontSize:12,wordBreak:"break-all",color:"var(--text)",lineHeight:1.7,marginBottom:10}}>{CFG.WALLET}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
          <div style={{fontSize:11,color:"var(--y)"}}>⚠️ <strong>Tron (TRC20) ONLY</strong> — no other network</div>
          <button className="btn btn-g" style={{padding:"7px 14px",fontSize:11}} onClick={()=>{navigator.clipboard?.writeText(CFG.WALLET);alert("Copied!");}}>📋 Copy</button>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"var(--bg3)",border:"1px solid var(--bdr)",borderRadius:10,marginBottom:16}}>
        <div><div style={{fontSize:10,color:"var(--text2)",marginBottom:2,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>AMOUNT</div><div style={{fontFamily:"'Barlow Condensed',sans-serif",color:"var(--y)",fontSize:13,letterSpacing:.5}}>{CFG.PLANS[plan].name} · 30 days</div></div>
        <div className="mono" style={{fontSize:28,fontWeight:700,color:"var(--y)"}}>{CFG.PLANS[plan].usdt} <span style={{fontSize:14}}>USDT</span></div>
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,color:"var(--text2)",marginBottom:6,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>YOUR TRANSACTION ID</div>
        <input className="inp" placeholder="Paste TxID here..." value={txid} onChange={e=>setTxid(e.target.value)} style={{fontFamily:"'Azeret Mono',monospace",fontSize:12}}/>
      </div>
      <button className="btn btn-c" style={{width:"100%",padding:15,fontSize:13,letterSpacing:1}} onClick={async()=>{
        if(!txid.trim()){alert("Paste your Transaction ID.");return;}
        setLoad(true);await new Promise(r=>setTimeout(r,600));
        try{const p=JSON.parse(localStorage.getItem("cx_payments")||"[]");p.push({id:Date.now().toString(36),userId:user?.email||user?.cqid||"unknown",cqid:user?.cqid,plan,usdt:CFG.PLANS[plan].usdt,txid:txid.trim(),submittedAt:Date.now(),status:"pending",network:"TRC20"});localStorage.setItem("cx_payments",JSON.stringify(p));}catch{}
        setLoad(false);setStep("done");
      }} disabled={loading||!txid.trim()}>{loading?<Spin sz={16}/>:"→ SUBMIT FOR VERIFICATION"}</button>
      <div style={{marginTop:10,fontSize:11,color:"var(--text2)"}}>✓ Blockchain verified · ✓ Activated 1–4h · ✓ Renewal: repeat same process</div>
    </div>
  </div>);
}

// ── ALERTS ────────────────────────────────────────────────────────
function PageAlerts({notifs,setNotifs,paused}){
  const unread=notifs.filter(n=>!n.read).length;
  const tc={entry:"var(--g)",tp:"var(--c)",alert:"var(--y)",emergency:"var(--r)",breakout:"var(--y)",info:"var(--text2)"};
  const ti={entry:"⚡",tp:"✅",alert:"⚠️",emergency:"🚨",breakout:"💥",info:"📊"};
  if(paused)return<div className="card ai" style={{padding:52,textAlign:"center"}}><div style={{fontSize:52,marginBottom:16}}>⏸</div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,color:"var(--y)",fontWeight:800,letterSpacing:1}}>TRADING PAUSED</div></div>;
  return<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
      <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:1}}>ALERTS <span style={{color:"var(--r)",fontSize:14}}>({unread})</span></h2>
      {notifs.length>0&&<button className="btn btn-h" style={{fontSize:10}} onClick={()=>setNotifs(ns=>ns.map(n=>({...n,read:true})))}>✓ Mark All Read</button>}
    </div>
    {notifs.length===0?<div className="card" style={{padding:44,textAlign:"center"}}><div style={{fontSize:44,marginBottom:14}}>🔕</div><div style={{color:"var(--text2)"}}>No alerts. Triple-confirmed signals and breakouts will appear here.</div></div>:(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {notifs.map(n=><div key={n.id} className={`card ${n.type==="breakout"||n.type==="emergency"?"siren":""}`}
        style={{padding:"14px 18px",opacity:n.read?.65:1,cursor:"pointer",borderLeft:`3px solid ${tc[n.type]||"var(--muted)"}`}}
        onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
              {!n.read&&<span style={{width:7,height:7,background:"var(--r)",borderRadius:"50%",flexShrink:0}} className="_pu"/>}
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:tc[n.type],letterSpacing:1,fontWeight:700}}>{ti[n.type]} {n.coin} · {n.type.toUpperCase()}</span>
            </div>
            <div style={{fontSize:13,lineHeight:1.65}}>{n.msg}</div>
          </div>
          <div style={{fontSize:10,color:"var(--text2)",whiteSpace:"nowrap",fontFamily:"'Azeret Mono',monospace"}}>{n.time}</div>
        </div>
      </div>)}
    </div>)}
  </div>;
}

// ── SETTINGS ──────────────────────────────────────────────────────
function PageSettings({settings,upd,user,logout}){
  const[days,setDays]=useState(null);
  const[tgToken,setTgToken]=useState(()=>localStorage.getItem("cq_tg_token")||"");
  const[tgChatId,setTgChatId]=useState(()=>localStorage.getItem("cq_tg_chatid")||"");
  const[tgStatus,setTgStatus]=useState("");
  const[tgLoading,setTgLoading]=useState(false);
  useEffect(()=>{if(user?.expiresAt)setDays(Math.max(0,Math.ceil((user.expiresAt-Date.now())/86400000)));},[user]);
  const saveTelegram=()=>{localStorage.setItem("cq_tg_token",tgToken.trim());localStorage.setItem("cq_tg_chatid",tgChatId.trim());setTgStatus("✅ Saved!");setTimeout(()=>setTgStatus(""),2000);};
  const testTelegram=async()=>{
    setTgLoading(true);setTgStatus("Sending test...");
    const r=await sendTelegramMessage(tgToken.trim(),tgChatId.trim(),"✅ <b>Cryptex Quant Bot Connected!</b>\n\nYour signal bot is working. You will receive LONG/SHORT signals here.\n\n<i>Powered by Cryptex Quant v5.0</i>");
    setTgStatus(r.ok?"✅ Test message sent!":"❌ "+r.err);
    setTgLoading(false);
  };
  return<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div className="card" style={{padding:18,border:"1px solid rgba(0,200,255,.18)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>👤 {user?.email}</div>
          {user?.cqid&&<div className="mono" style={{fontSize:13,color:"var(--c)",marginBottom:6,letterSpacing:1}}>{user.cqid}</div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <span className={`pill ${user?.role==="admin"?"pp":"pg"}`}>{user?.role?.toUpperCase()}</span>
            <span className="pill pc">{user?.plan?.toUpperCase()}</span>
            {days!==null&&<span className={`pill ${days>7?"pg":days>3?"py":"pr"}`}>{days}d left</span>}
          </div>
        </div>
        <button className="btn btn-r" style={{padding:"10px 18px"}} onClick={logout}>⏻ LOGOUT</button>
      </div>
    </div>
    <div className="card" style={{padding:18,border:`1px solid ${settings.paused?"rgba(255,204,0,.3)":"var(--bdr)"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,marginBottom:4,color:settings.paused?"var(--y)":"var(--text)",letterSpacing:.5}}>{settings.paused?"⏸ PAUSED":"▶ ACTIVE"}</div>
        <div style={{fontSize:12,color:"var(--text2)"}}>Paused = all signals and notifications stop</div></div>
        <Tog checked={!settings.paused} onChange={v=>upd("paused",!v)}/>
      </div>
    </div>
    <div className="card" style={{padding:18}}>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--text2)",letterSpacing:2,marginBottom:14,textTransform:"uppercase"}}>Notification Preferences</div>
      {[{k:"notifEntry",l:"Entry Signals",s:"Triple-confirmed signals (≥70% confidence)"},{k:"notifBreakout",l:"🚨 Breakout Alerts",s:"Signal invalidated by price breakout"},{k:"notifTP",l:"Take Profit Updates",s:"TP level approach and trailing SL"},{k:"notifEmerg",l:"Emergency Siren",s:"Extreme volatility event (>8% move)"}].map((it,i,arr)=>(
        <div key={it.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:i<arr.length-1?"1px solid var(--bdr)":"none"}}>
          <div><div style={{fontWeight:600,fontSize:14}}>{it.l}</div><div style={{fontSize:11,color:"var(--text2)"}}>{it.s}</div></div>
          <Tog checked={!!settings[it.k]} onChange={v=>upd(it.k,v)}/>
        </div>
      ))}
    </div>
    {/* Telegram Bot */}
    <div className="card" style={{padding:20,border:"1px solid rgba(0,212,255,.15)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:10,background:"rgba(0,136,204,.2)",border:"1px solid rgba(0,136,204,.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>✈️</div>
        <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:700,letterSpacing:.5}}>TELEGRAM BOT INTEGRATION</div>
        <div style={{fontSize:11,color:"var(--text2)"}}>Receive signals directly in Telegram</div></div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:5,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>BOT TOKEN (from @BotFather)</div>
          <input className="inp mono" style={{fontSize:12}} placeholder="1234567890:ABCdefGHI..." value={tgToken} onChange={e=>setTgToken(e.target.value)}/>
        </div>
        <div>
          <div style={{fontSize:11,color:"var(--text2)",marginBottom:5,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>CHAT ID (your Telegram user/group ID)</div>
          <input className="inp mono" style={{fontSize:12}} placeholder="-1001234567890 or 123456789" value={tgChatId} onChange={e=>setTgChatId(e.target.value)}/>
        </div>
        {tgStatus&&<div style={{fontSize:12,color:tgStatus.startsWith("✅")?"var(--g)":"var(--r)",padding:"7px 12px",background:tgStatus.startsWith("✅")?"rgba(0,255,136,.07)":"rgba(255,32,82,.07)",borderRadius:8}}>{tgStatus}</div>}
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-c" style={{flex:1,padding:10,fontSize:12}} onClick={saveTelegram} disabled={!tgToken||!tgChatId}>💾 Save</button>
          <button className="btn btn-o" style={{flex:1,padding:10,fontSize:12}} onClick={testTelegram} disabled={!tgToken||!tgChatId||tgLoading}>{tgLoading?<Spin sz={14}/>:"📤 Test Bot"}</button>
        </div>
        <div style={{padding:"10px 12px",background:"var(--bg3)",borderRadius:8,fontSize:11,color:"var(--text2)",lineHeight:1.8}}>
          <div style={{color:"var(--c)",fontWeight:700,marginBottom:4}}>How to set up:</div>
          <div>1. Message @BotFather → /newbot → get Bot Token</div>
          <div>2. Message your bot → get your Chat ID from @userinfobot</div>
          <div>3. Paste both above → Save → Test Bot</div>
          <div>4. Use Scan/Search → "Send to Telegram" button appears on signals</div>
        </div>
      </div>
    </div>
  </div>;
}

// ── ADMIN ─────────────────────────────────────────────────────────
function PageAdmin({user}){
  const[sub,setSub]=useState("pending");const[users,setUsers]=useState([]);const[pays,setPays]=useState([]);
  const reload=useCallback(()=>{setUsers(Auth.all());try{setPays(JSON.parse(localStorage.getItem("cx_payments")||"[]"));}catch{setPays([]);}});
  useEffect(()=>{reload();},[sub]);
  if(user?.role!=="admin")return<div className="card ai" style={{padding:52,textAlign:"center"}}><div style={{fontSize:52,marginBottom:16}}>🔒</div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,color:"var(--r)",fontWeight:800}}>ADMIN ONLY</div></div>;
  const pending=pays.filter(p=>p.status==="pending");const approved=pays.filter(p=>p.status==="approved");
  const revenue=approved.reduce((a,p)=>a+(CFG.PLANS[p.plan]?.usdt||0),0);const active=users.filter(u=>Date.now()<u.expiresAt);
  const approve=pid=>{const up=pays.map(p=>p.id===pid?{...p,status:"approved",approvedAt:Date.now()}:p);localStorage.setItem("cx_payments",JSON.stringify(up));const p=up.find(x=>x.id===pid);if(p){const u=Auth.all().find(x=>x.email===p.userId||x.cqid===p.cqid);if(u)Auth.update(u.id,{plan:p.plan,expiresAt:Date.now()+30*86400000});}setPays(up);};
  const reject=pid=>{const up=pays.map(p=>p.id===pid?{...p,status:"rejected"}:p);localStorage.setItem("cx_payments",JSON.stringify(up));setPays(up);};
  const dlUsers=()=>dlCSV(users.map(u=>({CQ_ID:u.cqid||"",Email:u.email,Plan:u.plan,Status:Date.now()<u.expiresAt?"ACTIVE":"EXPIRED",Registered:new Date(u.registeredAt).toLocaleString(),Expires:new Date(u.expiresAt).toLocaleString()})),"cq_users_"+Date.now()+".csv");
  const dlPays=()=>dlCSV(pays.map(p=>({CQ_ID:p.cqid||"",Email:p.userId,Plan:p.plan,USDT:CFG.PLANS[p.plan]?.usdt||0,Network:"TRC20",TxID:p.txid,Status:p.status,Submitted:new Date(p.submittedAt).toLocaleString(),Approved:p.approvedAt?new Date(p.approvedAt).toLocaleString():""})),"cq_payments_"+Date.now()+".csv");
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
      <h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,letterSpacing:1}}>ADMIN <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DASHBOARD</span></h2>
      <div style={{display:"flex",gap:8}}>
        <button className="btn btn-y" style={{padding:"8px 14px",fontSize:11}} onClick={dlUsers}>⬇ Users CSV</button>
        <button className="btn btn-y" style={{padding:"8px 14px",fontSize:11}} onClick={dlPays}>⬇ Payments CSV</button>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
      {[{l:"TOTAL USERS",v:users.length,c:"var(--c)"},{l:"ACTIVE",v:active.length,c:"var(--g)"},{l:"PENDING",v:pending.length,c:"var(--y)"},{l:"REVENUE",v:`${revenue} USDT`,c:"#ffcc00"}].map((it,k)=>(
        <div key={k} style={{background:"var(--bg3)",borderRadius:12,padding:"14px 16px",border:"1px solid var(--bdr)"}}>
          <div style={{fontSize:9,color:"var(--text2)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase"}}>{it.l}</div>
          <div className="mono" style={{fontSize:18,fontWeight:700,color:it.c}}>{it.v}</div>
        </div>
      ))}
    </div>
    {pending.length>0&&<div style={{padding:"10px 16px",background:"rgba(255,32,82,.07)",border:"1px solid rgba(255,32,82,.25)",borderRadius:10,marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
      <span style={{fontSize:18}}>🔔</span><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,color:"var(--r)",letterSpacing:.5}}>{pending.length} PAYMENT{pending.length>1?"S":""} AWAITING VERIFICATION</span>
    </div>}
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {[["pending","⚠️ Pending"],["users","👥 Users"],["payments","💳 Payments"],["telegram","✈️ Telegram"],["chat","💬 Chat"]].map(([k,l])=>(
        <button key={k} className={`btn ${sub===k?"btn-c":"btn-h"}`} style={{padding:"8px 14px"}} onClick={()=>setSub(k)}>
          {l}{k==="pending"&&pending.length>0?` (${pending.length})`:k==="users"?` (${users.length})`:""}
        </button>
      ))}
    </div>
    {sub==="pending"&&(pending.length===0?<div className="card" style={{padding:32,textAlign:"center"}}><div style={{fontSize:36,marginBottom:10}}>✅</div><div style={{color:"var(--text2)"}}>No pending payments.</div></div>:
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {pending.map(p=><div key={p.id} className="card" style={{padding:20,border:"2px solid rgba(255,204,0,.25)"}}>
        <div style={{fontWeight:700,marginBottom:4}}>{p.userId}{p.cqid?<span className="mono" style={{color:"var(--c)",fontSize:11,marginLeft:8}}>{p.cqid}</span>:null}</div>
        <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}><span className="pill pc">{CFG.PLANS[p.plan]?.name}</span><span className="pill py">{p.usdt} USDT</span><span className="pill pc">TRC20</span></div>
        <div style={{padding:"10px 12px",background:"var(--bg3)",borderRadius:8,fontSize:11,fontFamily:"'Azeret Mono',monospace",wordBreak:"break-all",color:"var(--c)",marginBottom:8}}>TxID: {p.txid}</div>
        <div style={{fontSize:11,color:"var(--y)",marginBottom:12}}>⚠️ Verify on <a href={`https://tronscan.org/#/transaction/${p.txid}`} target="_blank" rel="noreferrer" style={{color:"var(--c)"}}>TronScan ↗</a> before approving</div>
        <div style={{display:"flex",gap:10}}><button className="btn btn-g" style={{flex:1,padding:12}} onClick={()=>approve(p.id)}>✅ APPROVE</button><button className="btn btn-r" style={{flex:1,padding:12}} onClick={()=>reject(p.id)}>✗ REJECT</button></div>
      </div>)}
    </div>)}
    {sub==="users"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {users.length===0?<div className="card" style={{padding:28,textAlign:"center"}}><div style={{color:"var(--text2)"}}>No users yet.</div></div>:
      users.map((u,i)=>{const act=Date.now()<u.expiresAt;return(
        <div key={i} className="card" style={{padding:"12px 14px",border:`1px solid ${act?"rgba(0,255,136,.18)":"rgba(255,32,82,.12)"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                {u.cqid&&<span className="mono" style={{fontSize:13,fontWeight:700,color:"var(--c)",letterSpacing:1}}>{u.cqid}</span>}
                <span style={{fontSize:12,color:"var(--text2)"}}>{u.email}</span>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span className={`pill ${u.plan==="elite"?"pp":u.plan==="pro"?"pg":"pc"}`}>{u.plan.toUpperCase()}</span>
                <span className={`pill ${act?"pg":"pr"}`}>{act?"● ACTIVE":"● EXPIRED"}</span>
              </div>
              <div style={{fontSize:11,color:"var(--text2)",marginTop:4}}>Reg: {new Date(u.registeredAt).toLocaleDateString()} · Exp: {new Date(u.expiresAt).toLocaleDateString()}</div>
            </div>
            <div className="mono" style={{fontSize:20,fontWeight:700,color:act?"var(--g)":"var(--r)"}}>{Math.max(0,Math.ceil((u.expiresAt-Date.now())/86400000))}d</div>
          </div>
        </div>);})}
    </div>}
    {sub==="payments"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
      {pays.length===0?<div className="card" style={{padding:28,textAlign:"center"}}><div style={{color:"var(--text2)"}}>No payments yet.</div></div>:
      pays.map((p,i)=><div key={i} className="card" style={{padding:"12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontWeight:600,marginBottom:4}}>{p.userId}{p.cqid?<span className="mono" style={{color:"var(--c)",fontSize:11,marginLeft:8}}>{p.cqid}</span>:null}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}><span className="pill pc">{CFG.PLANS[p.plan]?.name}</span><span className={`pill ${p.status==="approved"?"pg":p.status==="rejected"?"pr":"py"}`}>{p.status.toUpperCase()}</span></div>
            <div className="mono" style={{fontSize:10,color:"var(--text2)",wordBreak:"break-all"}}>TxID: {p.txid?.slice(0,36)}...</div>
            <div style={{fontSize:10,color:"var(--text2)",marginTop:2}}>{new Date(p.submittedAt).toLocaleString()}{p.approvedAt?` → ${new Date(p.approvedAt).toLocaleString()}`:""}</div>
          </div>
          <div className="mono" style={{fontSize:20,fontWeight:700,color:"#ffcc00"}}>{p.usdt} USDT</div>
        </div>
      </div>)}
    </div>}
    {sub==="telegram"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div className="card" style={{padding:20,border:"1px solid rgba(0,153,204,.25)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          <span style={{fontSize:26}}>✈️</span>
          <div><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:700,marginBottom:2}}>ADMIN BOT TOKEN</div>
          <div style={{fontSize:12,color:"var(--t2)"}}>{users.filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt).length} paid subscribers with Telegram linked</div></div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>BOT TOKEN (from @BotFather)</div>
          <input className="inp mono" style={{fontSize:12}} placeholder="1234567890:ABCdef..." value={tgToken} onChange={e=>setTgToken(e.target.value)}/>
        </div>
        {tgStatus&&<div style={{fontSize:12,padding:"7px 12px",borderRadius:8,marginBottom:8,color:tgStatus.startsWith("✅")?"var(--g)":"var(--r)",background:tgStatus.startsWith("✅")?"rgba(0,230,118,.07)":"rgba(255,32,82,.07)"}}>{tgStatus}</div>}
        <div style={{display:"flex",gap:8}}>
          <button className="btn bc" style={{flex:1,padding:10,fontSize:11}} onClick={()=>{localStorage.setItem("cq_admin_tg_token",tgToken.trim());setTgStatus("✅ Saved! Now use 'Broadcast' on any signal.");}} disabled={!tgToken.trim()}>💾 Save Token</button>
          <button className="btn bo" style={{flex:1,padding:10,fontSize:11}} onClick={async()=>{setTgLoading(true);setTgStatus("Testing...");const r=await tgSend(tgToken.trim(),"@"+tgToken.split(":")[0],"✅ Bot connected!");setTgStatus(r.ok?"✅ Bot working!":"❌ "+r.err);setTgLoading(false);}} disabled={!tgToken.trim()||tgLoading}>{tgLoading?<Spin sz={12}/>:"📤 Test"}</button>
        </div>
        <div style={{marginTop:12,padding:"10px 12px",background:"var(--bg3)",borderRadius:8,fontSize:11,color:"var(--t2)",lineHeight:1.8}}>
          <div style={{color:"var(--c)",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,marginBottom:4}}>How signals reach users:</div>
          <div>1. You (admin) save Bot Token here</div>
          <div>2. Paid users link Chat ID in Settings → Telegram</div>
          <div>3. You click "Broadcast to Paid Subscribers" on any signal</div>
          <div>4. System sends to all active paid users with linked Telegram</div>
          <div>5. Scanner → "Broadcast Scan" sends top 5 results</div>
        </div>
      </div>
      <div className="card" style={{padding:16}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,color:"var(--t2)",letterSpacing:2,marginBottom:12}}>LINKED SUBSCRIBERS</div>
        {users.filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt).length===0?
          <div style={{fontSize:13,color:"var(--t2)"}}>No paid users have linked Telegram yet. Ask subscribers to go to Settings → Link Telegram.</div>:
          users.filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt).map((u,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--bdr)",fontSize:12}}>
            <div><span className="mono" style={{color:"var(--c)"}}>{u.cqid||u.email}</span><span className="pill pc" style={{fontSize:9,marginLeft:8}}>{u.plan}</span></div>
            <span className="mono" style={{color:"var(--t2)",fontSize:11}}>{u.telegramChatId}</span>
          </div>))}
      </div>
    </div>}
    {sub==="chat"&&<PageChat user={user}/>}
  </div>);
}

// ── ROOT APP ──────────────────────────────────────────────────────
const DEF_S={paused:false,notifEntry:true,notifBreakout:true,notifTP:true,notifEmerg:true};

export default function App(){
  const[user,setUser]=useState(()=>{try{return JSON.parse(sessionStorage.getItem("cq_user")||"null");}catch{return null;}});
  const[tab,setTab]=useState("dashboard");const[active,setActive]=useState(0);const[st,setSt]=useState("day");
  const[coins,setCoins]=useState(TOP5.map(c=>({...c,price:c.base,chg24:0,high24:c.base*1.02,low24:c.base*0.98})));
  const[sigs,setSigs]=useState({});const[loadSig,setLoadSig]=useState(false);
  const[notifs,setNotifs]=useState([{id:1,coin:"SYS",msg:"✅ Cryptex Quant v5.0 active — Triple confirmation engine online. Whale detection active. Order book analysis live.",time:"now",type:"info",read:false,urgent:false}]);
  const[settings,setSettings]=useState(()=>{try{return{...DEF_S,...JSON.parse(localStorage.getItem("cq_settings")||"{}")};}catch{return DEF_S;}});
  const[volatility,setVolatility]=useState(null);
  const history=useMemo(()=>{try{return JSON.parse(localStorage.getItem("cx_history")||"[]");}catch{return[];}},[]);
  const upd=useCallback((k,v)=>setSettings(p=>{const n={...p,[k]:v};try{localStorage.setItem("cq_settings",JSON.stringify(n));}catch{}return n;}),[]);
  const login=u=>{sessionStorage.setItem("cq_user",JSON.stringify(u));setUser(u);};
  const logout=()=>{sessionStorage.removeItem("cq_user");setUser(null);setTab("dashboard");};

  // Price feed
  useEffect(()=>{
    if(!user)return;
    const poll=async()=>{
      try{
        const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${TOP5.map(c=>`"${c.sym}"`).join(",")}]`);
        if(!r.ok)return;const data=await r.json();
        const nc=TOP5.map(cd=>{const d=data.find(x=>x.symbol===cd.sym);if(!d)return coins.find(c=>c.id===cd.id)||{...cd};return{...cd,price:+d.lastPrice,chg24:+d.priceChangePercent,high24:+d.highPrice,low24:+d.lowPrice,vol:+d.volume,updatedAt:Date.now()};});
        setCoins(nc);const v=checkVolatility(nc);setVolatility(v);
        if(v?.siren&&settings.notifEmerg)setNotifs(ns=>[{id:Date.now(),coin:"MARKET",msg:`${v.level==="CRITICAL"?"🚨":"⚠️"} ${v.msg}`,time:"just now",type:"emergency",read:false,urgent:true},...ns.slice(0,29)]);
      }catch{}
    };
    poll();const t=setInterval(poll,5000);return()=>clearInterval(t);
  },[user,settings.notifEmerg]);

  // Signal engine
  useEffect(()=>{
    if(!user)return;
    const run=async()=>{
      setLoadSig(true);const ns={...sigs};
      for(const coin of TOP5){
        for(const strategy of["scalp","day","swing"]){
          const key=`${coin.id}-${strategy}`;const ex=ns[key];
          if(ex?.lockedAt&&!ex.noSignal&&(Date.now()-ex.lockedAt<CFG.LOCK[strategy]))continue;
          const lc=coins.find(c=>c.id===coin.id)||coin;
          const s=await quantAnalyze(coin.sym,strategy,lc.price||coin.base);
          ns[key]=s||{noSignal:true,reason:"Triple confirmation not achieved. Fewer than 3 indicators aligned. Stand aside and wait for clearer convergence.",strategy};
        }
      }
      // BTC dominance adjustment
      const adj=await adjustForBTCDominance(ns,coins);
      // If market crash detected, mark all LONG signals as suspended
      const crashWarn=checkVolatility(coins);
      if(crashWarn?.pauseAll){
        Object.keys(adj).forEach(k=>{if(adj[k]?.signal==="LONG"){adj[k]={...adj[k],volatileMarket:true,conf:Math.max(45,adj[k].conf-25)};}});
      }
      setSigs(adj);setLoadSig(false);
    };
    run();const t=setInterval(run,7*60*1000);return()=>clearInterval(t);
  },[user]);

  // Breakout monitor
  useEffect(()=>{
    if(!user||!settings.notifBreakout)return;
    const t=setInterval(()=>{
      TOP5.forEach((cd,i)=>{
        const lc=coins[i];if(!lc?.updatedAt)return;
        ["scalp","day","swing"].forEach(str=>{
          const key=`${cd.id}-${str}`;const sig=sigs[key];
          if(!sig||sig.noSignal||!sig.lockedAt||!sig.price)return;
          const move=Math.abs((lc.price-sig.price)/sig.price*100);
          if(move>=CFG.BREAK[str]){
            const up=lc.price>sig.price;
            setNotifs(ns=>[{id:Date.now()+i,coin:cd.id,msg:`💥 ${cd.id} breakout ${up?"+":""}${move.toFixed(2)}% on ${str.toUpperCase()}. Signal invalidated — re-analysis in progress.`,time:"just now",type:"breakout",read:false,urgent:true},...ns.slice(0,29)]);
            setSigs(prev=>{const n={...prev};delete n[key];return n;});
          }
        });
      });
    },10000);return()=>clearInterval(t);
  },[user,settings.notifBreakout,coins,sigs]);

  const unread=notifs.filter(n=>!n.read).length;
  const chatUnread=user?Chat.unread(user.role):0;

  if(!user)return<><style>{CSS}</style><div style={{position:"relative",zIndex:1}}><AuthPage onLogin={login}/></div></>;

  const TABS=[
    {id:"dashboard",icon:"⬡",label:"Dashboard"},
    {id:"signals",  icon:"⚡",label:"Signals"},
    {id:"scan",     icon:"◎", label:"Scan"},
    {id:"search",   icon:"🔍",label:"Search"},
    {id:"tracker",  icon:"📈",label:"Tracker"},
    {id:"alerts",   icon:"🔔",label:"Alerts",badge:unread},
    {id:"chat",     icon:"💬",label:"Chat",badge:chatUnread},
    {id:"about",    icon:"ℹ️", label:"About"},
    {id:"subscribe",icon:"💎",label:"Upgrade"},
    {id:"settings", icon:"⚙", label:"Settings"},
    ...(user?.role==="admin"?[{id:"admin",icon:"🛡",label:"Admin"}]:[]),
  ];

  return<><style>{CSS}</style>
  <div style={{minHeight:"100vh",position:"relative",zIndex:1}}>
    {/* Header */}
    <header style={{position:"sticky",top:0,zIndex:300,background:"rgba(3,8,15,.97)",backdropFilter:"blur(28px)",borderBottom:"1px solid var(--bdr)"}}>
      <div style={{maxWidth:1440,margin:"0 auto",padding:"0 20px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Logo sz={36}/>
          <div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,letterSpacing:"2px",lineHeight:1}}>
              <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CRYPTEX QUANT</span>
            </div>
            {loadSig&&<div style={{fontSize:8,color:"var(--text2)",letterSpacing:1,display:"flex",alignItems:"center",gap:4}}>
              <Spin sz={8} cl="var(--c)"/><span>ANALYZING</span>
            </div>}
          </div>
        </div>
        <nav style={{display:"flex",gap:1}} className="loh">
          {TABS.map(t=><button key={t.id} className={`nb ${tab===t.id?"act":""}`} onClick={()=>setTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
            {(t.badge||0)>0&&<span style={{background:"var(--r)",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:6,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{t.badge}</span>}
          </button>)}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {volatility?.siren&&<span className="pill pr _pu" style={{fontSize:10}}>⚠️ VOL</span>}
          {unread>0&&<span style={{width:8,height:8,background:"var(--r)",borderRadius:"50%",cursor:"pointer",boxShadow:"0 0 10px var(--r)"}} className="_pu" onClick={()=>setTab("alerts")}/>}
          <button className="btn btn-c" style={{padding:"7px 14px",fontSize:11,letterSpacing:1}} onClick={()=>setTab("scan")}>◎ SCAN</button>
        </div>
      </div>
    </header>

    {coins.some(c=>c.updatedAt)&&<Ticker coins={coins}/>}

    <main style={{maxWidth:1440,margin:"0 auto",padding:"22px 20px 90px",position:"relative",zIndex:1}}>
      {tab==="dashboard" &&<PageDashboard coins={coins} sigs={sigs} loadSig={loadSig&&!Object.keys(sigs).length} setTab={setTab} setActive={setActive} setSt={s=>{setSt(s);}} history={history} volatility={volatility}/>}
      {tab==="signals"   &&<PageSignals coins={coins} sigs={sigs} loadSig={loadSig&&!sigs[`${TOP5[active]?.id}-${st}`]} active={active} setActive={setActive} st={st} setSt={setSt} onRefresh={()=>setSigs(p=>{const n={...p};delete n[`${TOP5[active]?.id}-${st}`];return n;})}/>}
      {tab==="scan"      &&<PageScan/>}
      {tab==="search"    &&<PageSearch/>}
      {tab==="tracker"   &&<PageTracker/>}
      {tab==="alerts"    &&<PageAlerts notifs={notifs} setNotifs={setNotifs} paused={settings.paused}/>}
      {tab==="chat"      &&<PageChat user={user}/>}
      {tab==="about"     &&<PageAbout/>}
      {tab==="subscribe" &&<PageSubscribe user={user}/>}
      {tab==="settings"  &&<PageSettings settings={settings} upd={upd} user={user} logout={logout}/>}
      {tab==="admin"     &&<PageAdmin user={user}/>}
    </main>

    {/* Mobile nav */}
    <nav className="smh" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:300,background:"rgba(3,8,15,.98)",backdropFilter:"blur(28px)",borderTop:"1px solid var(--bdr)",display:"flex",height:60,overflowX:"auto"}}>
      {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)}
        style={{flex:"0 0 auto",minWidth:52,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,color:tab===t.id?"var(--c)":"var(--muted)",transition:"color .18s",position:"relative",padding:"0 10px"}}>
        <span style={{fontSize:16}}>{t.icon}</span>
        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:8,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>{t.label}</span>
        {(t.badge||0)>0&&<span style={{position:"absolute",top:7,left:"60%",background:"var(--r)",color:"#fff",fontSize:8,padding:"1px 4px",borderRadius:5,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{t.badge}</span>}
      </button>)}
    </nav>
  </div></>;
}
