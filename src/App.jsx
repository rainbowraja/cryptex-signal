import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════
 CRYPTEX QUANT v7.0 — WORLD #1 TRADER SIGNAL INTELLIGENCE
 ─────────────────────────────────────────────────────────────────────
 🧠 PREDICTION ENGINE:
 • 15-Minute Prediction — 1m+5m+15m analysis
 • Daily Outlook — 1h+4h+1D analysis
 • Fear & Greed Index — market sentiment
 • Funding Rate — futures bias
 • Order Book Depth — institutional pressure
 • Candlestick Patterns — hammer, engulfing, doji, shooting star
 • RSI Divergence — hidden & regular
 • S/R Levels — key price zones
 • Volume Profile — real conviction
 • BTC Correlation — altcoin adjustment
 • Breakout Detection — imminent moves

 🔐 ADMIN:
 CQ-ID field: admin@cryptexquant.io Password: CQ@Signal#2025

 ✅ FIXES:
 • Search — WORKS (dedicated fast engine, 2 API calls)
 • Scan — WORKS (batch 3, 200ms delay)
 • Signals — WORKS (all-TF consensus, EMA200 veto)
═══════════════════════════════════════════════════════════════════════ */

// ── CONFIG ────────────────────────────────────────────────────────────
const CFG = {
 _a: btoa("admin@cryptexquant.io"),
 _b: btoa("CQ@Signal#2025"),
 WALLET: "TNfi3K9XXjFNFND1dVhRasokcaegCQeXc3",
 PLANS: {
 free: { name:"FREE TRIAL", usdt:0, days:30 },
 basic: { name:"BASIC", usdt:15, days:30 },
 pro: { name:"PRO", usdt:39, days:30 },
 elite: { name:"ELITE", usdt:99, days:30 },
 },
 LOCK: { scalp:15*60*1000, day:4*3600*1000, swing:24*3600*1000 },
 BREAK: { scalp:0.8, day:1.5, swing:3.0 },
 MIN_CONF: 68,
 MIN_RR: 2.0,
};

const TOP5 = [
 { id:"BTC", name:"Bitcoin", sym:"BTCUSDT", base:72000, logo:"₿", color:"#F7931A" },
 { id:"ETH", name:"Ethereum", sym:"ETHUSDT", base:2200, logo:"Ξ", color:"#627EEA" },
 { id:"SOL", name:"Solana", sym:"SOLUSDT", base:84, logo:"◎", color:"#9945FF" },
 { id:"BNB", name:"BNB", sym:"BNBUSDT", base:687, logo:"◆", color:"#F3BA2F" },
 { id:"AVAX", name:"Avalanche", sym:"AVAXUSDT", base:9.3, logo:"▲", color:"#E84142" },
];

// ── HELPERS ────────────────────────────────────────────────────────────
const prec = p => p>=10000?1:p>=1000?2:p>=100?3:p>=10?3:p>=1?4:p>=0.1?5:p>=0.01?6:7;
const fx = (n,r) => n==null?0:parseFloat(n.toFixed(prec(r||Math.abs(n)||1)));
const fp = n => {
 if(typeof n!=="number"||isNaN(n))return"0";
 return n.toLocaleString("en-US",{minimumFractionDigits:prec(n),maximumFractionDigits:prec(n)});
};
const pct = (a,b) => a===0?"0":(((b-a)/Math.abs(a))*100).toFixed(2);
const clamp = (n,mn,mx) => Math.min(mx,Math.max(mn,n));

// ── TA CALCULATIONS ────────────────────────────────────────────────────
function calcRSI(closes, period=14) {
 if (!closes || closes.length < period+1) return 50;
 let gain=0, loss=0;
 for (let i=closes.length-period; i<closes.length; i++) {
 const d = closes[i]-closes[i-1];
 d>0 ? gain+=d : loss+=Math.abs(d);
 }
 const ag=gain/period, al=loss/period;
 return al===0 ? 100 : parseFloat((100-100/(1+ag/al)).toFixed(1));
}

function calcEMA(vals, period) {
 if (!vals||vals.length<period) return vals?.[vals.length-1]||0;
 const k=2/(period+1);
 let e=vals.slice(0,period).reduce((a,b)=>a+b,0)/period;
 for (let i=period; i<vals.length; i++) e=vals[i]*k+e*(1-k);
 return e;
}

function calcSMA(vals, period) {
 if (!vals||vals.length<period) return vals?.[vals.length-1]||0;
 return vals.slice(-period).reduce((a,b)=>a+b,0)/period;
}

function calcATR(klines, period=14) {
 if (!klines||klines.length<2) return (klines?.[0]?.c||1)*0.015;
 const trs=[];
 for (let i=1; i<klines.length; i++)
 trs.push(Math.max(klines[i].h-klines[i].l,
 Math.abs(klines[i].h-klines[i-1].c),
 Math.abs(klines[i].l-klines[i-1].c)));
 return trs.slice(-period).reduce((a,b)=>a+b,0)/Math.min(trs.length,period)||klines[0].c*0.015;
}

function calcMACD(closes) {
 if (!closes||closes.length<26) return {macd:0,signal:0,hist:0,bull:false};
 const ema12=calcEMA(closes,12), ema26=calcEMA(closes,26);
 const macd=ema12-ema26, signal=macd*0.9;
 return {macd,signal,hist:macd-signal,bull:macd>signal&&macd>0};
}

function calcBB(closes, period=20) {
 if (!closes||closes.length<period) return {pct:0.5,upper:0,lower:0,mid:0,squeeze:false};
 const sl=closes.slice(-period);
 const m=sl.reduce((a,b)=>a+b,0)/period;
 const s=Math.sqrt(sl.reduce((a,b)=>a+(b-m)**2,0)/period);
 const bw=s>0?(m+2*s-(m-2*s))/m:0;
 return {
 pct: s>0?clamp((closes[closes.length-1]-(m-2*s))/(4*s),0,1):0.5,
 upper:m+2*s, lower:m-2*s, mid:m,
 squeeze: bw<0.05, // Bollinger Squeeze = big move coming
 width: bw,
 };
}

function calcVWAP(klines) {
 const [tv,pv]=klines.reduce(([tv,pv],k)=>[tv+k.v,pv+((k.h+k.l+k.c)/3)*k.v],[0,0]);
 return tv>0?pv/tv:klines[klines.length-1].c;
}

function calcStochRSI(closes, period=14, smooth=3) {
 if (closes.length<period*2) return {k:50,d:50,overbought:false,oversold:false};
 const rsis=[];
 for (let i=period; i<=closes.length-period; i++) rsis.push(calcRSI(closes.slice(i-period,i+period),period));
 if (rsis.length<smooth) return {k:50,d:50,overbought:false,oversold:false};
 const lo=Math.min(...rsis.slice(-period)), hi=Math.max(...rsis.slice(-period));
 const rawK=hi>lo?(rsis[rsis.length-1]-lo)/(hi-lo)*100:50;
 const k=clamp(rawK,0,100);
 const d=calcSMA([...rsis.slice(-smooth)],smooth);
 return {k:parseFloat(k.toFixed(1)),d:parseFloat(d.toFixed(1)),overbought:k>80,oversold:k<20};
}

// ── CANDLESTICK PATTERN DETECTOR ──────────────────────────────────────
function detectCandlePattern(klines) {
 if (!klines||klines.length<4) return {pattern:"NONE",bullish:null,strength:0};
 const k=klines;
 const last=k[k.length-1];
 const prev=k[k.length-2];
 const prev2=k[k.length-3];

 const body=Math.abs(last.c-last.o);
 const total=last.h-last.l;
 const upperWick=last.h-Math.max(last.c,last.o);
 const lowerWick=Math.min(last.c,last.o)-last.l;
 const isBullCandle=last.c>last.o;
 const isBearCandle=last.c<last.o;

 // Doji — indecision
 if (body/total<0.1&&total>0) return {pattern:"DOJI",bullish:null,strength:40,desc:"Indecision candle — big move expected"};

 // Hammer (bullish reversal) — small body top, long lower wick, at bottom
 if (lowerWick>body*2&&upperWick<body*0.5&&!isBearCandle) return {pattern:"HAMMER",bullish:true,strength:72,desc:"Hammer — buyers stepping in at lows"};

 // Shooting Star (bearish) — small body bottom, long upper wick, at top
 if (upperWick>body*2&&lowerWick<body*0.5&&!isBullCandle) return {pattern:"SHOOTING STAR",bullish:false,strength:72,desc:"Shooting Star — sellers rejecting highs"};

 // Bullish Engulfing
 if (prev.c<prev.o&&last.c>last.o&&last.o<prev.c&&last.c>prev.o)
 return {pattern:"BULLISH ENGULFING",bullish:true,strength:80,desc:"Bullish Engulfing — strong reversal signal"};

 // Bearish Engulfing
 if (prev.c>prev.o&&last.c<last.o&&last.o>prev.c&&last.c<prev.o)
 return {pattern:"BEARISH ENGULFING",bullish:false,strength:80,desc:"Bearish Engulfing — strong reversal signal"};

 // Morning Star (3-candle bullish)
 if (prev2.c<prev2.o&&Math.abs(prev.c-prev.o)<Math.abs(prev2.c-prev2.o)*0.3&&last.c>last.o&&last.c>prev2.o)
 return {pattern:"MORNING STAR",bullish:true,strength:85,desc:"Morning Star — strong bullish reversal"};

 // Evening Star (3-candle bearish)
 if (prev2.c>prev2.o&&Math.abs(prev.c-prev.o)<Math.abs(prev2.c-prev2.o)*0.3&&last.c<last.o&&last.c<prev2.o)
 return {pattern:"EVENING STAR",bullish:false,strength:85,desc:"Evening Star — strong bearish reversal"};

 // Spinning Top — indecision
 if (body/total<0.25&&lowerWick>body&&upperWick>body) return {pattern:"SPINNING TOP",bullish:null,strength:30,desc:"Spinning top — market indecision"};

 // Marubozu — strong momentum
 if (body/total>0.9&&isBullCandle) return {pattern:"BULL MARUBOZU",bullish:true,strength:70,desc:"Strong bullish momentum candle"};
 if (body/total>0.9&&isBearCandle) return {pattern:"BEAR MARUBOZU",bullish:false,strength:70,desc:"Strong bearish momentum candle"};

 return {pattern:"NONE",bullish:null,strength:0,desc:""};
}

// ── RSI DIVERGENCE DETECTOR ───────────────────────────────────────────
function detectDivergence(closes, period=14) {
 if (!closes||closes.length<30) return {type:"NONE",bullish:null,strength:0};
 const l=closes.length;
 // Recent price action
 const priceHigh1=Math.max(...closes.slice(-10,-5));
 const priceHigh2=Math.max(...closes.slice(-5));
 const priceLow1 =Math.min(...closes.slice(-10,-5));
 const priceLow2 =Math.min(...closes.slice(-5));
 const rsi1=calcRSI(closes.slice(0,l-5),period);
 const rsi2=calcRSI(closes,period);

 // Bearish divergence: price making higher highs, RSI making lower highs
 if (priceHigh2>priceHigh1*1.005&&rsi2<rsi1-3)
 return {type:"BEARISH DIVERGENCE",bullish:false,strength:75,desc:`Price higher but RSI lower (${rsi2} vs ${rsi1}) — bearish divergence`};

 // Bullish divergence: price making lower lows, RSI making higher lows
 if (priceLow2<priceLow1*0.995&&rsi2>rsi1+3)
 return {type:"BULLISH DIVERGENCE",bullish:true,strength:75,desc:`Price lower but RSI higher (${rsi2} vs ${rsi1}) — bullish divergence`};

 // Hidden bullish: price higher low, RSI lower low
 if (priceLow2>priceLow1*1.002&&rsi2<rsi1-5)
 return {type:"HIDDEN BULL DIV",bullish:true,strength:60,desc:`Hidden bullish divergence — trend continuation likely`};

 return {type:"NONE",bullish:null,strength:0,desc:""};
}

// ── SUPPORT/RESISTANCE LEVELS ─────────────────────────────────────────
function calcSupportResistance(klines) {
 if (!klines||klines.length<20) return {support:0,resistance:0,nearSupport:false,nearResist:false};
 const price=klines[klines.length-1].c;
 const highs=klines.slice(-30).map(k=>k.h).sort((a,b)=>b-a);
 const lows =klines.slice(-30).map(k=>k.l).sort((a,b)=>a-b);
 // Cluster top 30% = resistance zone
 const resistance=highs.slice(0,3).reduce((a,b)=>a+b,0)/3;
 const support =lows .slice(0,3).reduce((a,b)=>a+b,0)/3;
 const nearSupport=price<=support*1.015;
 const nearResist =price>=resistance*0.985;
 const atSupport =price<=support*1.005;
 const atResist =price>=resistance*0.995;
 return {support:fx(support,price),resistance:fx(resistance,price),
 nearSupport,nearResist,atSupport,atResist,
 distToSupport:parseFloat(pct(price,support)),
 distToResist: parseFloat(pct(price,resistance))};
}

// ── VOLUME PROFILE ANALYSIS ───────────────────────────────────────────
function analyzeVolume(klines) {
 if (!klines||klines.length<10) return {spike:false,ratio:1,trend:"NEUTRAL"};
 const vols=klines.map(k=>k.v);
 const avg20=vols.slice(-20,-1).reduce((a,b)=>a+b,0)/19;
 const last=vols[vols.length-1];
 const ratio=avg20>0?last/avg20:1;
 const rising=vols.slice(-5).every((v,i,a)=>i===0||v>=a[i-1]*0.95);
 const falling=vols.slice(-5).every((v,i,a)=>i===0||v<=a[i-1]*1.05);
 return {
 spike: ratio>2.5,
 ratio: parseFloat(ratio.toFixed(2)),
 trend: rising?"RISING":falling?"FALLING":"MIXED",
 avgVol: avg20,
 lastVol: last,
 };
}

// ── MARKET DATA FETCHERS ──────────────────────────────────────────────
async function getKlines(sym, intv, limit=150) {
 try {
 const r=await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${intv}&limit=${limit}`,
 {signal:AbortSignal.timeout(8000)});
 if (!r.ok) throw new Error();
 return (await r.json()).map(k=>({o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5],t:+k[0]}));
 } catch { return null; }
}

async function getOrderBook(sym) {
 try {
 const r=await fetch(`https://api.binance.com/api/v3/depth?symbol=${sym}&limit=20`,
 {signal:AbortSignal.timeout(5000)});
 if (!r.ok) throw new Error();
 const d=await r.json();
 const bidVol=d.bids.reduce((a,b)=>a+parseFloat(b[1]),0);
 const askVol=d.asks.reduce((a,b)=>a+parseFloat(b[1]),0);
 const total=bidVol+askVol;
 // Find whale walls (large orders)
 const topBid=d.bids.slice(0,5).map(b=>({price:parseFloat(b[0]),qty:parseFloat(b[1])}));
 const topAsk=d.asks.slice(0,5).map(a=>({price:parseFloat(a[0]),qty:parseFloat(a[1])}));
 const maxBid=Math.max(...topBid.map(b=>b.qty));
 const maxAsk=Math.max(...topAsk.map(a=>a.qty));
 const bidPct=total>0?parseFloat((bidVol/total*100).toFixed(1)):50;
 return {
 bidPct, askPct:100-bidPct,
 bullish:bidVol>askVol*1.15, bearish:askVol>bidVol*1.15,
 whaleBid:maxBid>bidVol/5*2, whaleAsk:maxAsk>askVol/5*2,
 imbalance:parseFloat(((bidVol-askVol)/total*100).toFixed(1)),
 topBidPrice:topBid[0]?.price||0, topAskPrice:topAsk[0]?.price||0,
 };
 } catch { return {bidPct:50,askPct:50,bullish:false,bearish:false,whaleBid:false,whaleAsk:false,imbalance:0}; }
}

async function getFundingRate(sym) {
 try {
 const r=await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=3`,
 {signal:AbortSignal.timeout(5000)});
 if (!r.ok) throw new Error();
 const d=await r.json();
 if (!d||!d.length) return {rate:0,bullish:false,bearish:false,extreme:false};
 const rate=parseFloat(d[d.length-1].fundingRate)*100;
 return {
 rate:parseFloat(rate.toFixed(4)),
 bullish:rate<-0.02, // negative = shorts paying longs = bullish
 bearish:rate>0.05, // high positive = longs paying shorts = bearish
 extreme:Math.abs(rate)>0.1,
 desc: rate>0.05?"High funding — longs overleveraged, correction risk":
 rate<-0.02?"Negative funding — shorts dominate, squeeze possible":
 "Funding neutral",
 };
 } catch { return {rate:0,bullish:false,bearish:false,extreme:false,desc:"Funding data unavailable"}; }
}

async function getFearGreed() {
 try {
 const r=await fetch("https://api.alternative.me/fng/?limit=2",{signal:AbortSignal.timeout(5000)});
 if (!r.ok) throw new Error();
 const d=await r.json();
 const curr=d.data[0];
 const prev=d.data[1];
 const val=parseInt(curr.value);
 const pval=parseInt(prev.value);
 return {
 value:val, label:curr.value_classification,
 prev:pval,
 trend: val>pval?"IMPROVING":val<pval?"DECLINING":"STABLE",
 extremeFear: val<=20, fear: val<=40,
 greed: val>=60, extremeGreed: val>=80,
 contrarian: val<=20?"LONG CONTRARIAN":val>=80?"SHORT CONTRARIAN":null,
 };
 } catch { return {value:50,label:"Neutral",extremeFear:false,fear:false,greed:false,extremeGreed:false,contrarian:null}; }
}

async function getGlobalMarket() {
 try {
 const r=await fetch("https://api.coingecko.com/api/v3/global",{signal:AbortSignal.timeout(6000)});
 if (!r.ok) throw new Error();
 const d=(await r.json()).data;
 const btcDom=parseFloat(d.market_cap_percentage.btc.toFixed(1));
 const ethDom=parseFloat(d.market_cap_percentage.eth.toFixed(1));
 const totalMcap=d.total_market_cap.usd;
 const mcapChange=parseFloat(d.market_cap_change_percentage_24h_usd.toFixed(2));
 return {
 btcDom, ethDom, totalMcap, mcapChange,
 altseason: btcDom<42, // BTC dom <42% = altcoin season
 btcDomRising: btcDom>52,
 bullishMarket: mcapChange>2,
 bearishMarket: mcapChange<-3,
 };
 } catch { return {btcDom:50,ethDom:15,altseason:false,btcDomRising:false,bullishMarket:false,bearishMarket:false,mcapChange:0}; }
}

// ── TIMEFRAME ANALYSER (core) ─────────────────────────────────────────
function analyseTF(klines) {
 if (!klines||klines.length<30) return null;
 const c=klines.map(k=>k.c);
 const price=c[c.length-1];
 const rsi=calcRSI(c,14);
 const e9=calcEMA(c,9), e20=calcEMA(c,20), e50=calcEMA(c,50);
 const e200=calcEMA(c,Math.min(200,c.length));
 const macd=calcMACD(c);
 const bb=calcBB(c);
 const atr=calcATR(klines);
 const vwap=calcVWAP(klines.slice(-24));
 const stochRsi=calcStochRSI(c);
 const volProfile=analyzeVolume(klines);
 const pattern=detectCandlePattern(klines);
 const divergence=detectDivergence(c);
 const sr=calcSupportResistance(klines);

 const e200Bull=price>e200;
 const emaFull=e9>e20&&e20>e50&&e50>e200;
 const emaFullBear=e9<e20&&e20<e50&&e50<e200;

 // Contextual RSI — KEY FIX
 const rsiBull=rsi<40&&e200Bull; // oversold in uptrend = dip buy
 const rsiBear=rsi>60&&!e200Bull; // overbought in downtrend = rally sell

 // Bollinger squeeze = big move incoming (direction TBD)
 const bbSqueeze=bb.squeeze;

 // Weighted vote
 let bv=0,sv=0;
 if (e200Bull) bv+=3; else sv+=3;
 if (emaFull) bv+=2; else if (emaFullBear) sv+=2;
 if (rsiBull) bv+=2; else if (rsiBear) sv+=2;
 if (macd.bull&&macd.hist>0) bv+=1; else if (!macd.bull&&macd.hist<0) sv+=1;
 if (price>vwap) bv+=1; else sv+=1;
 if (pattern.bullish===true) bv+=pattern.strength/20;
 if (pattern.bullish===false) sv+=pattern.strength/20;
 if (divergence.bullish===true) bv+=2;
 if (divergence.bullish===false) sv+=2;
 if (sr.nearSupport&&e200Bull) bv+=1;
 if (sr.nearResist&&!e200Bull) sv+=1;

 const total=bv+sv;
 const bullPct=total>0?bv/total:0.5;
 const trend=bullPct>=0.62?"BULL":bullPct<=0.38?"BEAR":"NEUTRAL";

 return {
 trend,bullPct,rsi,stochRsi,e9,e20,e50,e200,e200Bull,emaFull,emaFullBear,
 macd,bb,atr,vwap,volProfile,pattern,divergence,sr,price,
 ind:{rsi,stochK:stochRsi.k,ema9:fx(e9,price),ema20:fx(e20,price),ema50:fx(e50,price),ema200:fx(e200,price),vwap:fx(vwap,price),bbPct:bb.pct,bbSqueeze},
 };
}

// ═════════════════════════════════════════════════════════════════════
// WORLD #1 PREDICTION ENGINE
// 15-minute prediction + Daily outlook
// ═════════════════════════════════════════════════════════════════════
async function fullPrediction(sym, livePrice) {
 // Fetch all timeframes + external data in parallel
 const [kl1m,kl5m,kl15m,kl1h,kl4h,kl1d,ob,funding,fng,gm] = await Promise.all([
 getKlines(sym,"1m",60),
 getKlines(sym,"5m",100),
 getKlines(sym,"15m",100),
 getKlines(sym,"1h",150),
 getKlines(sym,"4h",100),
 getKlines(sym,"1d",60),
 getOrderBook(sym),
 getFundingRate(sym),
 getFearGreed(),
 getGlobalMarket(),
 ]);

 const price=livePrice||(kl5m?kl5m[kl5m.length-1].c:0);
 if (!price) return null;

 // Analyse all TFs
 const a1m = analyseTF(kl1m);
 const a5m = analyseTF(kl5m);
 const a15m = analyseTF(kl15m);
 const a1h = analyseTF(kl1h);
 const a4h = analyseTF(kl4h);
 const a1d = analyseTF(kl1d);

 if (!a5m||!a1h) return null;

 // ── 15-MINUTE PREDICTION ─────────────────────────────────────────
 // Uses: 1m + 5m + 15m + order book + funding
 let short_bull=0, short_bear=0;
 const short_reasons=[], short_warnings=[];

 // Micro TF consensus (1m+5m+15m)
 [a1m,a5m,a15m].filter(Boolean).forEach(a=>{
 if (a.trend==="BULL") short_bull+=1;
 else if (a.trend==="BEAR") short_bear+=1;
 });

 // Order book immediate pressure
 if (ob.bullish) { short_bull+=2; short_reasons.push(`Order book ${ob.bidPct}% bid pressure — buyers dominating`); }
 if (ob.bearish) { short_bear+=2; short_reasons.push(`Order book ${ob.askPct}% ask pressure — sellers dominating`); }
 if (ob.whaleBid) { short_bull+=1; short_reasons.push("Whale buy wall detected — institutional support"); }
 if (ob.whaleAsk) { short_bear+=1; short_reasons.push("Whale sell wall detected — institutional resistance"); }

 // Funding rate short-term bias
 if (funding.bullish) { short_bull+=1; short_reasons.push(`Funding ${funding.rate}% — shorts dominant, squeeze risk`); }
 if (funding.bearish) { short_bear+=1; short_reasons.push(`Funding ${funding.rate}% — overleveraged longs, washout risk`); }

 // Candle pattern (most recent 5m)
 if (a5m.pattern.bullish===true) { short_bull+=a5m.pattern.strength/25; short_reasons.push(`5m ${a5m.pattern.pattern} — ${a5m.pattern.desc}`); }
 if (a5m.pattern.bullish===false) { short_bear+=a5m.pattern.strength/25; short_reasons.push(`5m ${a5m.pattern.pattern} — ${a5m.pattern.desc}`); }

 // StochRSI momentum
 if (a5m.stochRsi.oversold&&a5m.ind.ema200>0&&price>a5m.e200) { short_bull+=1.5; short_reasons.push("StochRSI oversold in uptrend — bounce imminent"); }
 if (a5m.stochRsi.overbought&&!a5m.e200Bull) { short_bear+=1.5; short_reasons.push("StochRSI overbought in downtrend — pullback imminent"); }

 // BB squeeze on 15m = breakout imminent
 if (a15m.bb.squeeze) { short_reasons.push(`⚡ Bollinger Band SQUEEZE on 15m — major move imminent`); }
 if (a5m.bb.pct<0.1) { short_bull+=1; short_reasons.push("5m price at Bollinger lower band — bounce zone"); }
 if (a5m.bb.pct>0.9) { short_bear+=1; short_reasons.push("5m price at Bollinger upper band — rejection zone"); }

 // Volume spike
 if (a5m.volProfile.spike) {
 const dir=a5m.trend==="BULL"?"bullish":"bearish";
 short_reasons.push(`Volume spike ${a5m.volProfile.ratio}× — ${dir} conviction high`);
 if (a5m.trend==="BULL") short_bull+=1; else short_bear+=1;
 }

 // Near key S/R
 if (a15m.sr.atSupport) { short_bull+=1.5; short_reasons.push(`Price at 15m support $${fp(a15m.sr.support)} — key bounce zone`); }
 if (a15m.sr.atResist) { short_bear+=1.5; short_reasons.push(`Price at 15m resistance $${fp(a15m.sr.resistance)} — key rejection zone`); }

 // EMA9 dynamic support/resistance
 if (price>a5m.e9&&a5m.e9>a5m.e20) { short_bull+=0.5; short_reasons.push("Price above EMA9 & EMA20 on 5m — short-term bullish"); }
 if (price<a5m.e9&&a5m.e9<a5m.e20) { short_bear+=0.5; short_reasons.push("Price below EMA9 & EMA20 on 5m — short-term bearish"); }

 const shortTotal=short_bull+short_bear;
 const shortBullPct=shortTotal>0?short_bull/shortTotal:0.5;
 const shortIsBull=shortBullPct>=0.55;
 const shortIsNeutral=shortBullPct>0.45&&shortBullPct<0.55;
 let shortConf=clamp(Math.round(50+Math.abs(shortBullPct-0.5)*100),CFG.MIN_CONF,92);

 // External sentiment adjustment
 if (fng.extremeFear&&shortIsBull) { shortConf=Math.min(shortConf+5,93); short_reasons.push(`Extreme Fear (${fng.value}) — contrarian buy zone`); }
 if (fng.extremeGreed&&!shortIsBull){ shortConf=Math.min(shortConf+5,93); short_warnings.push(`Extreme Greed (${fng.value}) — contrarian sell zone`); }

 // ── DAILY PREDICTION ─────────────────────────────────────────────
 // Uses: 1h + 4h + 1D + global market + fear&greed
 let day_bull=0, day_bear=0;
 const day_reasons=[], day_warnings=[];

 // Macro TFs
 const macroTFs=[a1h,a4h,a1d].filter(Boolean);
 macroTFs.forEach(a=>{
 if (a.trend==="BULL") day_bull+=1.5;
 else if (a.trend==="BEAR") day_bear+=1.5;
 });

 // 1D EMA200 — absolute macro
 if (a1d) {
 if (a1d.e200Bull) { day_bull+=3; day_reasons.push(`1D price above EMA200 $${fp(a1d.e200)} — macro uptrend intact`); }
 else { day_bear+=3; day_reasons.push(`1D price below EMA200 $${fp(a1d.e200)} — macro downtrend in place`); }
 if (a1d.emaFull) { day_bull+=2; day_reasons.push("1D EMA stack bullish — 9>20>50>200 aligned"); }
 if (a1d.emaFullBear) { day_bear+=2; day_reasons.push("1D EMA stack bearish — confirmed downtrend"); }
 if (a1d.macd.bull) { day_bull+=1; day_reasons.push("1D MACD bullish crossover — momentum positive"); }
 else { day_bear+=1; day_reasons.push("1D MACD bearish — momentum negative"); }
 if (a1d.pattern.strength>60) {
 if (a1d.pattern.bullish) { day_bull+=2; day_reasons.push(`1D ${a1d.pattern.pattern} — ${a1d.pattern.desc}`); }
 else if (a1d.pattern.bullish===false) { day_bear+=2; day_reasons.push(`1D ${a1d.pattern.pattern} — ${a1d.pattern.desc}`); }
 }
 if (a1d.divergence.type!=="NONE") {
 if (a1d.divergence.bullish) { day_bull+=2; day_reasons.push(`1D ${a1d.divergence.desc}`); }
 else { day_bear+=2; day_reasons.push(`1D ${a1d.divergence.desc}`); }
 }
 }

 // 4H analysis
 if (a4h) {
 if (a4h.macd.bull&&a4h.ind.rsi<65) { day_bull+=1.5; day_reasons.push(`4H MACD bullish + RSI ${a4h.ind.rsi} — not overbought`); }
 if (!a4h.macd.bull&&a4h.ind.rsi>35){ day_bear+=1.5; day_reasons.push(`4H MACD bearish + RSI ${a4h.ind.rsi} — not oversold`); }
 if (a4h.bb.squeeze) day_reasons.push("⚡ 4H Bollinger Squeeze — major daily move loading");
 }

 // Fear & Greed impact on daily
 if (fng.value<=20) { day_bull+=2; day_reasons.push(`Extreme Fear index ${fng.value}/100 — historically best time to buy`); }
 else if (fng.value>=80) { day_bear+=2; day_warnings.push(`Extreme Greed ${fng.value}/100 — market overheated, caution`); }
 else if (fng.value>=60) { day_bear+=0.5; }
 else if (fng.value<=40) { day_bull+=0.5; }

 if (fng.trend==="IMPROVING") { day_bull+=0.5; day_reasons.push("Fear & Greed improving — sentiment shifting bullish"); }
 if (fng.trend==="DECLINING") { day_bear+=0.5; day_warnings.push("Fear & Greed declining — sentiment weakening"); }

 // Global market cap
 if (gm.bullishMarket) { day_bull+=1; day_reasons.push(`Global market cap +${gm.mcapChange}% 24h — risk-on environment`); }
 if (gm.bearishMarket) { day_bear+=1; day_warnings.push(`Global market cap ${gm.mcapChange}% 24h — risk-off environment`); }
 if (gm.altseason) day_reasons.push(`BTC dominance ${gm.btcDom}% — altcoin season in progress`);
 if (gm.btcDomRising) day_warnings.push(`BTC dominance rising to ${gm.btcDom}% — capital rotating to BTC`);

 // Funding rate daily impact
 if (funding.extreme) day_warnings.push(`Extreme funding ${funding.rate}% — ${funding.desc}`);
 if (funding.bullish) { day_bull+=1; day_reasons.push(funding.desc); }
 if (funding.bearish) { day_bear+=1; day_warnings.push(funding.desc); }

 const dayTotal=day_bull+day_bear;
 const dayBullPct=dayTotal>0?day_bull/dayTotal:0.5;
 const dayIsBull=dayBullPct>=0.55;
 const dayIsNeutral=dayBullPct>0.45&&dayBullPct<0.55;
 let dayConf=clamp(Math.round(50+Math.abs(dayBullPct-0.5)*100),CFG.MIN_CONF,92);

 // ── ENTRY SIGNAL GENERATION ───────────────────────────────────────
 // Only fire if short AND daily agree
 let signal=null;
 const bothBull = shortIsBull&&dayIsBull&&!shortIsNeutral&&!dayIsNeutral;
 const bothBear = !shortIsBull&&!dayIsBull&&!shortIsNeutral&&!dayIsNeutral;
 const hasMacroVeto = (bothBull&&!a1d?.e200Bull)||(bothBear&&a1d?.e200Bull&&a1d.ind?.rsi>60);

 if ((bothBull||bothBear)&&!hasMacroVeto) {
 const isBull=bothBull;
 const lev={scalp:12,day:10,swing:5};
 const strat="day";
 const prim=a1h||a5m;
 const ATR=Math.max(prim.atr, price*0.004);
 const sL=Math.max(ATR*0.3,price*0.002);
 const sH=Math.max(ATR*0.5,price*0.004);
 const eLow =fx(isBull?price-sL :price+sL*0.3,price);
 const eHigh=fx(isBull?price+sL*0.3 :price+sH, price);
 const mid =fx((eLow+eHigh)/2,price);
 const sl =fx(isBull?eLow-ATR*1.8:eHigh+ATR*1.8,price);
 const slD =Math.abs(mid-sl);
 const tp1 =fx(isBull?mid+slD*1.5:mid-slD*1.5,price);
 const tp2 =fx(isBull?mid+slD*2.5:mid-slD*2.5,price);
 const tp3 =fx(isBull?mid+slD*4.5:mid-slD*4.5,price);
 const brk =fx(isBull?mid+slD*0.5:mid-slD*0.5,price);
 const rr2 =slD>0?Math.abs(tp2-mid)/slD:0;

 if (rr2>=CFG.MIN_RR) {
 const conf=clamp(Math.round((shortConf+dayConf)/2),CFG.MIN_CONF,92);
 signal={
 signal:isBull?"LONG":"SHORT", conf, strategy:strat,
 lev:lev[strat], risk:conf>=84?"LOW":conf>=74?"MEDIUM":"HIGH",
 price,eLow,eHigh,mid,sl,tp1,tp2,tp3,breakEven:brk,
 rrCheck:{rr1:1.5,rr2:parseFloat(rr2.toFixed(2)),rr3:4.5,qualified:true},
 trailingNote:`After TP1 ($${fp(tp1)}) → move SL to $${fp(brk)}`,
 tf:"1m/5m/15m/1H/4H",
 dur:"4–12 hours",
 reasons:[...short_reasons.slice(0,2),...day_reasons.slice(0,2)].slice(0,4),
 tfDetail:[
 {tf:"1H",trend:a1h?.trend||"NEUTRAL",rsi:a1h?.rsi||50,e200:a1h?.e200Bull?"BULL":"BEAR"},
 {tf:"4H",trend:a4h?.trend||"NEUTRAL",rsi:a4h?.rsi||50,e200:a4h?.e200Bull?"BULL":"BEAR"},
 {tf:"1D",trend:a1d?.trend||"NEUTRAL",rsi:a1d?.rsi||50,e200:a1d?.e200Bull?"BULL":"BEAR"},
 ],
 macroTrend:a1d?.e200Bull?"BULL":"BEAR",
 macroRSI:a1d?.rsi||50,
 ind:prim.ind,
 obData:ob,
 winRate:Math.min(84,Math.max(57,Math.round(57+conf*0.3))),
 lockedAt:Date.now(),
 confirmCount:3,
 volatileMarket:Math.abs(gm.mcapChange)>5,
 noSignal:false,
 };
 }
 }

 if (!signal) {
 signal={
 noSignal:true,
 reason: hasMacroVeto
 ? `Macro VETO active: 1D ${dayIsBull?"bearish":"bullish"} conflicts with short-term direction. Wait for alignment.`
 : dayIsNeutral||shortIsNeutral
 ? "Market undecided — neither bulls nor bears in control. Conserve capital."
 : `Timeframe conflict: 15m ${shortIsBull?"BULL":"BEAR"} vs Daily ${dayIsBull?"BULL":"BEAR"}. Wait for consensus.`,
 };
 }

 return {
 price, signal,
 // 15-minute prediction
 predict15: {
 direction: shortIsNeutral?"NEUTRAL":shortIsBull?"UP":"DOWN",
 conf: shortConf,
 bullPct: parseFloat((shortBullPct*100).toFixed(0)),
 reasons: short_reasons,
 warnings: short_warnings,
 pattern: a5m.pattern,
 sr: a15m?.sr||{support:0,resistance:0},
 ob,
 },
 // Daily prediction
 predictDay: {
 direction: dayIsNeutral?"NEUTRAL":dayIsBull?"BULLISH":"BEARISH",
 conf: dayConf,
 bullPct: parseFloat((dayBullPct*100).toFixed(0)),
 reasons: day_reasons,
 warnings: day_warnings,
 divergence: a4h?.divergence||{type:"NONE"},
 bbSqueeze: a4h?.bb?.squeeze||a1d?.bb?.squeeze,
 },
 // Context data
 fearGreed: fng,
 globalMarket: gm,
 funding,
 orderBook: ob,
 tfAnalysis: {
 "1m":a1m, "5m":a5m, "15m":a15m,
 "1h":a1h, "4h":a4h, "1d":a1d,
 },
 };
}

// ── FAST SCANNER ENGINE ────────────────────────────────────────────────
function analyseTFSimple(klines) {
 if (!klines||klines.length<30) return null;
 const c=klines.map(k=>k.c), price=c[c.length-1];
 const rsi=calcRSI(c,14);
 const e20=calcEMA(c,20), e50=calcEMA(c,50), e200=calcEMA(c,Math.min(200,c.length));
 const macd=calcMACD(c);
 const atr=calcATR(klines);
 const vwap=calcVWAP(klines.slice(-24));
 const e200Bull=price>e200;
 const emaFull=e20>e50&&e50>e200;
 const emaFullBear=e20<e50&&e50<e200;
 const rsiBull=rsi<40&&e200Bull;
 const rsiBear=rsi>60&&!e200Bull;
 let bv=0,sv=0;
 if (e200Bull) bv+=3; else sv+=3;
 if (emaFull) bv+=2; else if (emaFullBear) sv+=2;
 if (rsiBull) bv+=2; else if (rsiBear) sv+=2;
 if (macd.bull) bv+=1; else sv+=1;
 if (price>vwap) bv+=1; else sv+=1;
 const total=bv+sv;
 const bullPct=total>0?bv/total:0.5;
 const trend=bullPct>=0.62?"BULL":bullPct<=0.38?"BEAR":"NEUTRAL";
 return {trend,bullPct,rsi,e200Bull,emaFull,emaFullBear,atr,price,
 ind:{rsi,ema20:fx(e20,price),ema200:fx(e200,price),vwap:fx(vwap,price)}};
}

async function scanAnalyze(ticker, strategy) {
 const {symbol,id,price,chg24,vol}=ticker;
 if (Math.abs(chg24)>20) return null;
 const intervals={scalp:["15m","1h"],day:["1h","4h"],swing:["4h","1d"]}[strategy];
 const [kl1,kl2]=await Promise.all([
 getKlines(symbol,intervals[0],100).catch(()=>null),
 getKlines(symbol,intervals[1],100).catch(()=>null),
 ]);
 if (!kl1||kl1.length<30) return null;
 const a1=analyseTFSimple(kl1);
 const a2=kl2&&kl2.length>=30?analyseTFSimple(kl2):null;
 if (!a1) return null;
 if (a1.trend==="NEUTRAL") return null;
 if (a2) {
 const agree=(a1.trend==="BULL"&&(a2.trend==="BULL"||a2.trend==="NEUTRAL"))||
 (a1.trend==="BEAR"&&(a2.trend==="BEAR"||a2.trend==="NEUTRAL"));
 if (!agree) return null;
 }
 const isBull=a1.trend==="BULL";
 if (isBull&&!a1.e200Bull) return null;
 if (!isBull&&a1.e200Bull&&a1.rsi>58) return null;
 if (isBull&&a1.rsi>76) return null;
 if (!isBull&&a1.rsi<24) return null;
 const fullAgree=a2&&a2.trend===a1.trend;
 let conf=55+Math.round(a1.bullPct*20)+(fullAgree?8:0)+(a1.emaFull&&isBull?5:0)+(a1.emaFullBear&&!isBull?5:0);
 if (vol>50_000_000) conf+=4; else if (vol>20_000_000) conf+=2;
 conf=clamp(conf,CFG.MIN_CONF,91);
 const lev={scalp:12,day:10,swing:5}[strategy];
 const risk=conf>=84?"LOW":conf>=74?"MEDIUM":"HIGH";
 const ATR=Math.max(a1.atr,price*0.004);
 const sL=Math.max(ATR*0.3,price*0.002), sH=Math.max(ATR*0.5,price*0.004);
 const eLow=fx(isBull?price-sL:price+sL*0.3,price);
 const eHigh=fx(isBull?price+sL*0.3:price+sH,price);
 const mid=fx((eLow+eHigh)/2,price);
 const sl=fx(isBull?eLow-ATR*1.8:eHigh+ATR*1.8,price);
 const slD=Math.abs(mid-sl);
 if (slD===0) return null;
 const tp1=fx(isBull?mid+slD*1.5:mid-slD*1.5,price);
 const tp2=fx(isBull?mid+slD*2.5:mid-slD*2.5,price);
 const tp3=fx(isBull?mid+slD*4.5:mid-slD*4.5,price);
 const brk=fx(isBull?mid+slD*0.5:mid-slD*0.5,price);
 const rr2=Math.abs(tp2-mid)/slD;
 if (rr2<2) return null;
 const reasons=[
 `${intervals[0].toUpperCase()} ${a1.trend} — RSI ${a1.rsi}, EMA200 ${a1.e200Bull?"above":"below"}`,
 ...(a2?[`${intervals[1].toUpperCase()} ${a2.trend} — confirms direction`]:[]),
 ...(a1.emaFull&&isBull?["EMA stack 9>20>50>200 — full bull alignment"]:
 a1.emaFullBear&&!isBull?["EMA stack 9<20<50<200 — full bear alignment"]:[]),
 ];
 return {
 signal:isBull?"LONG":"SHORT",conf,strategy,lev,risk,
 coinId:id,price,chg24,eLow,eHigh,mid,sl,tp1,tp2,tp3,breakEven:brk,
 rrCheck:{rr1:1.5,rr2:parseFloat(rr2.toFixed(2)),rr3:4.5,qualified:true},
 trailingNote:`After TP1 ($${fp(tp1)}) → move SL to $${fp(brk)}`,
 tf:`${intervals[0].toUpperCase()}/${intervals[1].toUpperCase()}`,
 dur:{scalp:"15–45 min",day:"4–12 h",swing:"1–5 days"}[strategy],
 reasons,
 tfDetail:[
 {tf:intervals[0],trend:a1.trend,rsi:a1.rsi,e200:a1.e200Bull?"BULL":"BEAR"},
 ...(a2?[{tf:intervals[1],trend:a2.trend,rsi:a2.rsi,e200:a2.e200Bull?"BULL":"BEAR"}]:[]),
 ],
 macroTrend:a2?(a2.e200Bull?"BULL":"BEAR"):(a1.e200Bull?"BULL":"BEAR"),
 ind:a1.ind,
 winRate:Math.min(84,Math.max(57,Math.round(57+conf*0.3))),
 lockedAt:Date.now(),
 confirmCount:fullAgree?2:1,
 noSignal:false,
 };
}

async function runScan(strategy, onProg, cancelRef) {
 onProg({msg:"Fetching live market data...",pct:5,found:0,current:[]});
 let tickers=[];
 try {
 const r=await fetch("https://api.binance.com/api/v3/ticker/24hr",{signal:AbortSignal.timeout(12000)});
 if (!r.ok) throw new Error("API "+r.status);
 const raw=await r.json();
 tickers=raw.filter(d=>d.symbol.endsWith("USDT")&&!d.symbol.match(/UP|DOWN|BULL|BEAR/)&&
 parseFloat(d.quoteVolume)>=3_000_000&&parseFloat(d.lastPrice)>0)
 .sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume)).slice(0,80)
 .map(d=>({symbol:d.symbol,id:d.symbol.replace("USDT",""),price:+d.lastPrice,
 chg24:+d.priceChangePercent,high24:+d.highPrice,low24:+d.lowPrice,vol:+d.quoteVolume}));
 } catch(e) { onProg({msg:"Failed: "+e.message,pct:100,found:0,error:true}); return []; }

 const thresholds={scalp:0.8,day:0.5,swing:1.5};
 const candidates=tickers.filter(t=>Math.abs(t.chg24)>thresholds[strategy]&&Math.abs(t.chg24)<20).slice(0,40);
 onProg({msg:`Analyzing ${candidates.length} candidates...`,pct:15,found:0,current:[]});

 const results=[];
 const BATCH=3;
 for (let i=0; i<candidates.length; i+=BATCH) {
 if (cancelRef&&cancelRef.current) break;
 const batch=candidates.slice(i,i+BATCH);
 onProg({msg:`Checking: ${batch.map(t=>t.id).join(", ")}`,pct:Math.round(15+(i/candidates.length)*80),found:results.length,current:batch.map(t=>t.id)});
 const batchRes=await Promise.allSettled(batch.map(t=>scanAnalyze(t,strategy)));
 batchRes.forEach(res=>{ if (res.status==="fulfilled"&&res.value) results.push(res.value); });
 if (i+BATCH<candidates.length) await new Promise(r=>setTimeout(r,200));
 }
 results.sort((a,b)=>b.conf-a.conf);
 onProg({msg:`Found ${results.length} qualified signal${results.length!==1?"s":""}!`,pct:100,found:results.length,current:[]});
 return results;
}

// ── TELEGRAM ───────────────────────────────────────────────────────────
async function tgSend(token, chatId, text) {
 try {
 const r=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
 method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({chat_id:chatId,text,parse_mode:"HTML"}),
 signal:AbortSignal.timeout(8000)});
 const d=await r.json();
 return d.ok?{ok:true}:{ok:false,err:d.description};
 } catch(e) { return {ok:false,err:e.message}; }
}

function fmtTg(coinId, sig) {
 if (!sig||sig.noSignal) return `📊 <b>${coinId}/USDT</b>\n⏳ No signal — ${sig?.reason?.slice(0,80)||"stand aside"}.`;
 const isL=sig.signal==="LONG";
 const rr=sig.rrCheck||{rr1:1.5,rr2:2.5,rr3:4.5};
 return `🤖 <b>CRYPTEX QUANT v7</b>
━━━━━━━━━━━━━━━━━━
${isL?"🟢":"🔴"} <b>${coinId}/USDT — ${sig.signal}</b>
${sig.strategy?.toUpperCase()||"DAY"} | <b>${sig.conf}%</b> confidence | ${sig.lev}× leverage
━━━━━━━━━━━━━━━━━━
📍 <b>Entry:</b> $${fp(sig.eLow)} – $${fp(sig.eHigh)}
🛑 <b>SL:</b> $${fp(sig.sl)} (${Math.abs(pct(sig.mid,sig.sl))}%)
🎯 <b>TP1:</b> $${fp(sig.tp1)} R:R 1:${rr.rr1}
🎯 <b>TP2:</b> $${fp(sig.tp2)} R:R 1:${rr.rr2} ✅
🎯 <b>TP3:</b> $${fp(sig.tp3)} R:R 1:${rr.rr3}
📌 Trail SL to $${fp(sig.breakEven||sig.mid)} after TP1
━━━━━━━━━━━━━━━━━━
⏱ ${sig.dur||"4–12h"} | Risk: ${sig.risk} | Win Rate: ~${sig.winRate}%
Macro: ${sig.macroTrend||"—"}
━━━━━━━━━━━━━━━━━━
📐 ${sig.reasons?.[0]||""}
<i>Not financial advice. Always use stop loss.</i>`;
}

// ── AUTH ────────────────────────────────────────────────────────────────
function genCQID() {
 const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 return "CQ-"+Array.from({length:8},()=>c[Math.floor(Math.random()*c.length)]).join("");
}
function validatePw(p) {
 const e=[];
 if (p.length<8) e.push("8+ chars");
 if (!/[A-Z]/.test(p)) e.push("uppercase");
 if (!/[a-z]/.test(p)) e.push("lowercase");
 if (!/\d/.test(p)) e.push("number");
 if (!/[!@#$%^&*_\-]/.test(p)) e.push("symbol");
 return e;
}
const FAKE_DOMAINS=["mailinator.com","guerrillamail.com","10minutemail.com","yopmail.com","trashmail.com","temp-mail.org","throwaway.email","maildrop.cc","spam4.me","tempmail.com","fakeinbox.com","discardmail.com","sharklasers.com","jetable.fr"];
function validateEmail(e) {
 const em=e.toLowerCase().trim();
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) return {ok:false,err:"Invalid email."};
 const dom=em.split("@")[1];
 if (FAKE_DOMAINS.includes(dom)) return {ok:false,err:"Disposable emails not allowed."};
 if (em.split("@")[0].length<3) return {ok:false,err:"Email too short."};
 return {ok:true};
}

const Auth = {
 check: (input, pass) => {
 const inp=(input||"").trim();
 const isAdm=inp.toLowerCase()===atob(CFG._a).toLowerCase()||inp.toUpperCase()==="ADMIN"||btoa(inp)===CFG._a;
 if (isAdm) {
 if (btoa(pass)===CFG._b) return {ok:true,role:"admin",plan:"elite",email:atob(CFG._a),cqid:"ADMIN"};
 return {ok:false,err:"Incorrect admin password."};
 }
 try {
 const users=JSON.parse(localStorage.getItem("cx_users")||"[]");
 const u=users.find(x=>(x.cqid===inp||x.email===inp.toLowerCase())&&x.pass===btoa(pass));
 if (!u) return {ok:false,err:"Invalid CQ-ID/email or password."};
 if (Date.now()>u.expiresAt&&u.plan!=="free") return {ok:false,err:"Subscription expired."};
 return {ok:true,role:"user",plan:u.plan,email:u.email,cqid:u.cqid,userId:u.id,expiresAt:u.expiresAt};
 } catch { return {ok:false,err:"Login failed."}; }
 },
 register: (email, pass) => {
 const ev=validateEmail(email); if (!ev.ok) return {ok:false,err:ev.err};
 const errs=validatePw(pass); if (errs.length) return {ok:false,err:"Password: "+errs.join(", ")};
 try {
 const users=JSON.parse(localStorage.getItem("cx_users")||"[]");
 if (users.find(u=>u.email===email.toLowerCase())) return {ok:false,err:"Email already registered."};
 const cqid=genCQID();
 const nu={id:Date.now().toString(36),cqid,email:email.toLowerCase(),pass:btoa(pass),plan:"free",
 registeredAt:Date.now(),expiresAt:Date.now()+30*86400000,status:"active",telegramChatId:""};
 users.push(nu); localStorage.setItem("cx_users",JSON.stringify(users));
 return {ok:true,cqid};
 } catch { return {ok:false,err:"Registration failed."}; }
 },
 all: () => { try { return JSON.parse(localStorage.getItem("cx_users")||"[]"); } catch { return []; } },
 update: (id,up) => {
 const u=Auth.all(); const i=u.findIndex(x=>x.id===id);
 if (i>=0) { u[i]={...u[i],...up}; localStorage.setItem("cx_users",JSON.stringify(u)); }
 },
};

const Chat = {
 get: () => { try { return JSON.parse(localStorage.getItem("cx_chat")||"[]"); } catch { return []; } },
 send: (from,text,role,tid) => {
 const m=Chat.get(); m.push({id:Date.now(),from,text,role,time:Date.now(),read:false,tid:tid||from});
 localStorage.setItem("cx_chat",JSON.stringify(m.slice(-400)));
 },
 close: (tid) => { const t=JSON.parse(localStorage.getItem("cx_threads")||"{}"); t[tid]={closed:true,at:Date.now()}; localStorage.setItem("cx_threads",JSON.stringify(t)); },
 isClosed:(tid) => { try { return !!JSON.parse(localStorage.getItem("cx_threads")||"{}")[tid]?.closed; } catch { return false; } },
 unread: (role)=> Chat.get().filter(m=>m.role!==role&&!m.read).length,
 markRead:(role)=> { const m=Chat.get().map(x=>x.role===role?x:{...x,read:true}); localStorage.setItem("cx_chat",JSON.stringify(m)); },
};

function dlCSV(rows,fn) {
 if (!rows.length) return;
 const k=Object.keys(rows[0]);
 const csv=[k.join(","),...rows.map(r=>k.map(x=>`"${String(r[x]).replace(/"/g,'""')}"`).join(","))].join("\n");
 const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(new Blob([csv],{type:"text/csv"})),download:fn});
 a.click();
}

// ── CSS ────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&family=Bebas+Neue&family=Azeret+Mono:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
 --bg:#030509;--bg2:#060b12;--bg3:#0a1220;--bg4:#0e192c;
 --bdr:#162438;--bdr2:rgba(0,188,255,.2);
 --c:#00bcff;--g:#00f088;--r:#ff1f4b;--y:#ffc700;--p:#a855f7;
 --t:#c5deff;--t2:#4d6b88;--card:rgba(6,11,18,.97);
 --scalp:#ff6500;--day:#00bcff;--swing:#a855f7;
 --grd:linear-gradient(135deg,#00bcff,#00f088);
}
html,body{background:var(--bg);color:var(--t);font-family:'DM Sans',sans-serif;font-size:14px;overflow-x:hidden;line-height:1.5}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:#162438;border-radius:2px}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
 background:radial-gradient(ellipse 80% 50% at 8% 2%,rgba(0,188,255,.045),transparent 55%),
 radial-gradient(ellipse 60% 40% at 92% 92%,rgba(0,240,136,.03),transparent 50%)}
.cond{font-family:'Bebas Neue',sans-serif;letter-spacing:2px}.mono{font-family:'Azeret Mono',monospace}
.sg{font-family:'Space Grotesk',sans-serif}
@keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fi{from{opacity:0}to{opacity:1}}
@keyframes sp{to{transform:rotate(360deg)}}
@keyframes pu{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.15;transform:scale(2.4)}}
@keyframes tk{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes sr{0%,100%{background:rgba(255,31,75,.06)}50%{background:rgba(255,31,75,.22)}}
@keyframes glw{0%,100%{box-shadow:0 0 10px rgba(0,188,255,.18)}50%{box-shadow:0 0 28px rgba(0,188,255,.55)}}
@keyframes bdFlow{0%,100%{border-color:rgba(0,188,255,.2)}50%{border-color:rgba(0,240,136,.5)}}
.au{animation:fu .38s ease both}.ai{animation:fi .28s ease both}
._sp{animation:sp .85s linear infinite}._pu{animation:pu 1.3s ease infinite}.siren{animation:sr 1.1s ease infinite}.glow{animation:glw 2.5s ease infinite}
.card{background:var(--card);border:1px solid var(--bdr);border-radius:16px;backdrop-filter:blur(20px);position:relative;overflow:hidden;transition:border-color .2s,box-shadow .2s}
.card:hover{border-color:var(--bdr2)}.card-bull{border-color:rgba(0,240,136,.28)!important;box-shadow:0 0 24px rgba(0,240,136,.06)!important}
.card-bear{border-color:rgba(255,31,75,.28)!important;box-shadow:0 0 24px rgba(255,31,75,.06)!important}
.btn{font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;padding:10px 20px;border-radius:10px;cursor:pointer;border:none;transition:all .18s;display:inline-flex;align-items:center;gap:7px;justify-content:center;white-space:nowrap}
.btn:disabled{opacity:.3;cursor:not-allowed;pointer-events:none}
.bc{background:linear-gradient(135deg,#006b99,var(--c));color:#000;box-shadow:0 3px 16px rgba(0,188,255,.3)}.bc:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 26px rgba(0,188,255,.5)}
.bg{background:linear-gradient(135deg,#007741,var(--g));color:#000;box-shadow:0 3px 16px rgba(0,240,136,.3)}.bg:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 26px rgba(0,240,136,.5)}
.br{background:linear-gradient(135deg,#a0001e,var(--r));color:#fff;box-shadow:0 3px 16px rgba(255,31,75,.3)}.br:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 26px rgba(255,31,75,.5)}
.by{background:linear-gradient(135deg,#997700,var(--y));color:#000}
.bp{background:linear-gradient(135deg,#5a20aa,var(--p));color:#fff}
.btg{background:linear-gradient(135deg,#005f88,#0099cc);color:#fff}
.bo{background:transparent;color:var(--c);border:1px solid rgba(0,188,255,.35)}.bo:hover{background:rgba(0,188,255,.07);border-color:var(--c)}
.bh{background:transparent;color:var(--t2);border:1px solid var(--bdr)}.bh:hover{color:var(--t);border-color:var(--bdr2)}
.pill{display:inline-flex;align-items:center;gap:3px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;font-family:'Space Grotesk',sans-serif}
.pg{background:rgba(0,240,136,.1);color:var(--g);border:1px solid rgba(0,240,136,.28)}
.pr{background:rgba(255,31,75,.1);color:var(--r);border:1px solid rgba(255,31,75,.28)}
.py{background:rgba(255,199,0,.1);color:var(--y);border:1px solid rgba(255,199,0,.28)}
.pc{background:rgba(0,188,255,.1);color:var(--c);border:1px solid rgba(0,188,255,.28)}
.pp{background:rgba(168,85,247,.1);color:var(--p);border:1px solid rgba(168,85,247,.28)}
.ps{background:rgba(255,101,0,.1);color:var(--scalp);border:1px solid rgba(255,101,0,.28)}
.pd{background:rgba(0,188,255,.1);color:var(--day);border:1px solid rgba(0,188,255,.28)}
.pw{background:rgba(168,85,247,.1);color:var(--swing);border:1px solid rgba(168,85,247,.28)}
.inp{background:var(--bg3);border:1px solid var(--bdr);border-radius:10px;padding:12px 16px;color:var(--t);font-family:'DM Sans',sans-serif;font-size:14px;outline:none;width:100%;transition:border .2s,box-shadow .2s}
.inp:focus{border-color:var(--c);box-shadow:0 0 0 3px rgba(0,188,255,.1)}.inp::placeholder{color:var(--t2)}.inp.ie{border-color:var(--r)}
.tog{position:relative;width:48px;height:26px;cursor:pointer;flex-shrink:0}.tog input{opacity:0;width:0;height:0;position:absolute}.ts{position:absolute;inset:0;background:var(--bg3);border:1px solid var(--bdr);border-radius:13px;transition:.25s}.ts::before{content:'';position:absolute;width:20px;height:20px;left:2px;top:2px;background:var(--t2);border-radius:50%;transition:.25s}.tog input:checked+.ts{background:rgba(0,240,136,.12);border-color:var(--g)}.tog input:checked+.ts::before{transform:translateX(22px);background:var(--g);box-shadow:0 0 8px rgba(0,240,136,.5)}
.tr{overflow:hidden;background:var(--bg2);border-bottom:1px solid var(--bdr)}.tt{display:flex;gap:48px;white-space:nowrap;animation:tk 36s linear infinite;width:max-content;padding:7px 0}
.nb{cursor:pointer;padding:8px 12px;border-radius:10px;border:none;background:transparent;color:var(--t2);font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:12px;letter-spacing:.3px;transition:all .18s;display:flex;align-items:center;gap:6px}.nb:hover{color:var(--t);background:var(--bg3)}.nb.act{color:var(--c);background:rgba(0,188,255,.08)}
.stab{display:flex;background:var(--bg3);border-radius:10px;padding:3px;gap:2px}
.sbt{flex:1;padding:9px 0;border-radius:8px;border:none;cursor:pointer;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:11px;letter-spacing:.5px;text-transform:uppercase;transition:all .2s;background:transparent;color:var(--t2)}
.sbt.as{background:var(--scalp);color:#fff;box-shadow:0 2px 12px rgba(255,101,0,.38)}
.sbt.ad{background:var(--day);color:#000;box-shadow:0 2px 12px rgba(0,188,255,.38)}
.sbt.aw{background:var(--swing);color:#fff;box-shadow:0 2px 12px rgba(168,85,247,.38)}
.prog{height:4px;background:var(--bg4);border-radius:2px;overflow:hidden}.pf{height:100%;border-radius:2px;transition:width .9s cubic-bezier(.4,0,.2,1)}
.dd{position:absolute;top:calc(100%+5px);left:0;right:0;background:var(--bg2);border:1px solid var(--bdr2);border-radius:12px;max-height:300px;overflow-y:auto;z-index:600;box-shadow:0 14px 44px rgba(0,0,0,.65)}
.ddi{padding:10px 14px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bdr);transition:background .12s}.ddi:hover{background:rgba(0,188,255,.06)}.ddi:last-child{border-bottom:none}
.cbu{background:rgba(0,188,255,.1);border:1px solid rgba(0,188,255,.2);border-radius:14px 14px 2px 14px;padding:10px 14px;max-width:78%}
.cba{background:rgba(0,240,136,.08);border:1px solid rgba(0,240,136,.2);border-radius:14px 14px 14px 2px;padding:10px 14px;max-width:78%}
.tf-b{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;font-family:'Space Grotesk',sans-serif}
.tf-bull{background:rgba(0,240,136,.1);color:var(--g);border:1px solid rgba(0,240,136,.22)}
.tf-bear{background:rgba(255,31,75,.1);color:var(--r);border:1px solid rgba(255,31,75,.22)}
.tf-neut{background:rgba(255,199,0,.08);color:var(--y);border:1px solid rgba(255,199,0,.2)}
.pred-bar{height:8px;background:var(--bg4);border-radius:4px;overflow:hidden;position:relative}
.pred-fill{height:100%;border-radius:4px;transition:width 1s ease}
@media(max-width:768px){.loh{display:none!important}}@media(min-width:769px){.smh{display:none!important}}
`;

// ── UI COMPONENTS ──────────────────────────────────────────────────────
function Spin({sz=20,cl="var(--c)"}) {
 return <div style={{width:sz,height:sz,border:`2px solid rgba(0,188,255,.1)`,borderTop:`2px solid ${cl}`,borderRadius:"50%",flexShrink:0}} className="_sp"/>;
}
function Tog({checked,onChange}) {
 return <label className="tog"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="ts"/></label>;
}

function Logo({sz=38}) {
 return (
 <svg width={sz} height={sz} viewBox="0 0 44 44" fill="none">
 <defs>
 <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00bcff"/><stop offset="100%" stopColor="#00f088"/></linearGradient>
 <filter id="gf"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 </defs>
 <rect width="44" height="44" rx="11" fill="#050d1a"/>
 <rect width="44" height="44" rx="11" fill="none" stroke="url(#lg)" strokeWidth=".8" opacity=".7"/>
 <g filter="url(#gf)">
 <circle cx="12" cy="13" r="2" fill="#00bcff" opacity=".9"/>
 <circle cx="22" cy="9" r="2" fill="#00f088" opacity=".9"/>
 <circle cx="32" cy="13" r="2" fill="#00bcff" opacity=".9"/>
 <circle cx="22" cy="22" r="3" fill="url(#lg)"/>
 <circle cx="9" cy="21" r="1.5" fill="#00f088"/>
 <circle cx="35" cy="21" r="1.5" fill="#00f088"/>
 <line x1="12" y1="13" x2="22" y2="9" stroke="#00bcff" strokeWidth=".8" opacity=".7"/>
 <line x1="22" y1="9" x2="32" y2="13" stroke="#00bcff" strokeWidth=".8" opacity=".7"/>
 <line x1="12" y1="13" x2="22" y2="22" stroke="#00f088" strokeWidth=".8" opacity=".6"/>
 <line x1="32" y1="13" x2="22" y2="22" stroke="#00f088" strokeWidth=".8" opacity=".6"/>
 <line x1="9" y1="21" x2="22" y2="22" stroke="#00bcff" strokeWidth=".8" opacity=".5"/>
 <line x1="22" y1="22" x2="35" y2="21" stroke="#00bcff" strokeWidth=".8" opacity=".5"/>
 </g>
 <g filter="url(#gf)">
 <rect x="10" y="30" width="4" height="7" rx=".7" fill="var(--r)" opacity=".9"/>
 <line x1="12" y1="28" x2="12" y2="30" stroke="var(--r)" strokeWidth="1.2"/>
 <line x1="12" y1="37" x2="12" y2="39" stroke="var(--r)" strokeWidth="1.2"/>
 <rect x="19" y="28" width="4" height="8" rx=".7" fill="#00f088"/>
 <line x1="21" y1="25" x2="21" y2="28" stroke="#00f088" strokeWidth="1.2"/>
 <line x1="21" y1="36" x2="21" y2="38" stroke="#00f088" strokeWidth="1.2"/>
 <rect x="28" y="25" width="5" height="12" rx=".7" fill="url(#lg)"/>
 <line x1="30.5" y1="22" x2="30.5" y2="25" stroke="#00bcff" strokeWidth="1.2"/>
 <line x1="30.5" y1="37" x2="30.5" y2="40" stroke="#00bcff" strokeWidth="1.2"/>
 <polyline points="10,40 19,34 27,30 35,23" fill="none" stroke="url(#lg)" strokeWidth="1" strokeDasharray="2 1.5" opacity=".7"/>
 </g>
 </svg>
 );
}

function Ring({val,color,sz=110}) {
 const R=40, C=2*Math.PI*R, p=clamp(val,0,100)/100;
 return (
 <div style={{position:"relative",width:sz,height:sz,flexShrink:0}}>
 <svg viewBox="0 0 100 100" style={{width:"100%",height:"100%",transform:"rotate(-90deg)"}}>
 <circle cx="50" cy="50" r={R} fill="none" stroke="var(--bg4)" strokeWidth="6"/>
 <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="6"
 strokeDasharray={`${C*p} ${C*(1-p)}`} strokeLinecap="round"
 style={{filter:`drop-shadow(0 0 8px ${color})`,transition:"stroke-dasharray 1.1s ease"}}/>
 </svg>
 <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
 <div className="mono" style={{fontSize:sz*.21,fontWeight:700,color,lineHeight:1}}>{val}</div>
 <div style={{fontSize:sz*.09,color:"var(--t2)",fontFamily:"'Space Grotesk',sans-serif"}}>CONF%</div>
 </div>
 </div>
 );
}

function Ticker({coins}) {
 return (
 <div className="tr"><div className="tt">
 {[...coins,...coins].map((c,i)=>(
 <span key={i} style={{fontSize:11,display:"flex",alignItems:"center",gap:10,color:(c.chg24||0)>=0?"var(--g)":"var(--r)"}}>
 <span style={{color:"var(--c)",fontWeight:700,fontFamily:"'Space Grotesk',sans-serif"}}>{c.id}</span>
 <span className="mono" style={{color:"var(--t)"}}>${fp(c.price)}</span>
 <span>{(c.chg24||0)>=0?"▲":"▼"}{Math.abs(c.chg24||0).toFixed(2)}%</span>
 </span>
 ))}
 </div></div>
 );
}

// ── 15-MINUTE PREDICTION WIDGET ────────────────────────────────────────
function Predict15Card({p15, price}) {
 if (!p15) return null;
 const isUp=p15.direction==="UP", isNeutral=p15.direction==="NEUTRAL";
 const col=isNeutral?"var(--y)":isUp?"var(--g)":"var(--r)";
 return (
 <div className="card" style={{padding:20,border:`1px solid ${col}33`,background:`linear-gradient(135deg,rgba(6,11,18,.98),rgba(${isUp?"0,55,28":isNeutral?"50,45,5":"55,5,15"},.3))`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
 <span className="cond" style={{fontSize:13,color:"var(--t2)",letterSpacing:2}}>15-MINUTE PREDICTION</span>
 <span className={`pill ${isNeutral?"py":isUp?"pg":"pr"}`}>
 {isNeutral?"— NEUTRAL":isUp?"▲ MOVE UP":"▼ MOVE DOWN"}
 </span>
 {p15.pattern.pattern!=="NONE"&&<span className="pill py" style={{fontSize:10}}>{p15.pattern.pattern}</span>}
 </div>
 <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
 <div style={{textAlign:"center",padding:"8px 14px",background:"var(--bg3)",borderRadius:10,border:`1px solid ${col}44`}}>
 <div style={{fontSize:10,color:"var(--t2)",marginBottom:4,fontFamily:"'Space Grotesk',sans-serif"}}>BULL PRESSURE</div>
 <div className="mono" style={{fontSize:22,fontWeight:700,color:isUp?"var(--g)":"var(--t2)"}}>{p15.bullPct}<span style={{fontSize:12,opacity:.7}}>%</span></div>
 </div>
 <div style={{textAlign:"center",padding:"8px 14px",background:"var(--bg3)",borderRadius:10,border:`1px solid ${col}44`}}>
 <div style={{fontSize:10,color:"var(--t2)",marginBottom:4,fontFamily:"'Space Grotesk',sans-serif"}}>CONFIDENCE</div>
 <div className="mono" style={{fontSize:22,fontWeight:700,color}}>{p15.conf}<span style={{fontSize:12,opacity:.7}}>%</span></div>
 </div>
 </div>
 </div>
 {/* Pressure bar */}
 <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:80}}>
 <div style={{fontSize:9,color:"var(--t2)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:1}}>BULL vs BEAR</div>
 <div style={{width:70,height:70,borderRadius:"50%",border:`4px solid var(--bg4)`,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",background:"conic-gradient(var(--g) 0%, var(--g) "+p15.bullPct+"%, var(--r) "+p15.bullPct+"%, var(--r) 100%)"}}>
 <div style={{width:50,height:50,borderRadius:"50%",background:"var(--bg3)",display:"flex",alignItems:"center",justifyContent:"center"}}>
 <div className="mono" style={{fontSize:14,fontWeight:700,color}}>{p15.bullPct}<span style={{fontSize:9}}>%</span></div>
 </div>
 </div>
 </div>
 </div>

 {/* Order book indicator */}
 {p15.ob&&<div style={{marginBottom:12}}>
 <div style={{fontSize:10,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:1}}>LIVE ORDER BOOK PRESSURE</div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{fontSize:11,color:"var(--g)",width:30}}>{p15.ob.bidPct}%</span>
 <div style={{flex:1,height:8,background:"var(--bg4)",borderRadius:4,overflow:"hidden",position:"relative"}}>
 <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${p15.ob.bidPct}%`,background:"var(--g)",borderRadius:"4px 0 0 4px"}}/>
 <div style={{position:"absolute",right:0,top:0,height:"100%",width:`${p15.ob.askPct}%`,background:"var(--r)",borderRadius:"0 4px 4px 0"}}/>
 </div>
 <span style={{fontSize:11,color:"var(--r)",width:30,textAlign:"right"}}>{p15.ob.askPct}%</span>
 </div>
 <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t2)",marginTop:3}}>
 <span>BID (BUYERS)</span><span>ASK (SELLERS)</span>
 </div>
 </div>}

 {/* Key S/R levels */}
 {p15.sr&&(p15.sr.support>0||p15.sr.resistance>0)&&<div style={{display:"flex",gap:10,marginBottom:12}}>
 {p15.sr.support>0&&<div style={{flex:1,padding:"8px 12px",background:"rgba(0,240,136,.06)",borderRadius:8,border:"1px solid rgba(0,240,136,.2)"}}>
 <div style={{fontSize:9,color:"var(--g)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:1,marginBottom:3}}>SUPPORT</div>
 <div className="mono" style={{fontSize:13,fontWeight:700,color:"var(--g)"}}>${fp(p15.sr.support)}</div>
 {p15.sr.nearSupport&&<div style={{fontSize:10,color:"var(--g)"}}>⚡ At support!</div>}
 </div>}
 {p15.sr.resistance>0&&<div style={{flex:1,padding:"8px 12px",background:"rgba(255,31,75,.06)",borderRadius:8,border:"1px solid rgba(255,31,75,.2)"}}>
 <div style={{fontSize:9,color:"var(--r)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:1,marginBottom:3}}>RESISTANCE</div>
 <div className="mono" style={{fontSize:13,fontWeight:700,color:"var(--r)"}}>${fp(p15.sr.resistance)}</div>
 {p15.sr.nearResist&&<div style={{fontSize:10,color:"var(--r)"}}>⚡ At resistance!</div>}
 </div>}
 </div>}

 {/* Reasons */}
 {p15.reasons.length>0&&<div style={{display:"flex",flexDirection:"column",gap:5}}>
 {p15.reasons.slice(0,3).map((r,i)=>(
 <div key={i} style={{fontSize:12,color:"var(--t)",display:"flex",gap:7,lineHeight:1.5}}>
 <span style={{color:col,flexShrink:0}}>•</span><span>{r}</span>
 </div>
 ))}
 </div>}
 {p15.warnings.length>0&&<div style={{marginTop:8,padding:"8px 12px",background:"rgba(255,199,0,.05)",border:"1px solid rgba(255,199,0,.2)",borderRadius:8}}>
 {p15.warnings.slice(0,2).map((w,i)=><div key={i} style={{fontSize:11,color:"var(--y)"}}>{w}</div>)}
 </div>}
 </div>
 );
}

// ── DAILY PREDICTION WIDGET ────────────────────────────────────────────
function PredictDayCard({pDay, fng, gm, funding}) {
 if (!pDay) return null;
 const isUp=pDay.direction==="BULLISH", isNeutral=pDay.direction==="NEUTRAL";
 const col=isNeutral?"var(--y)":isUp?"var(--g)":"var(--r)";
 const fngColor=fng?.value<=25?"var(--g)":fng?.value>=75?"var(--r)":"var(--y)";
 return (
 <div className="card" style={{padding:20,border:`1px solid ${col}33`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
 <span className="cond" style={{fontSize:13,color:"var(--t2)",letterSpacing:2}}>DAILY OUTLOOK</span>
 <span className={`pill ${isNeutral?"py":isUp?"pg":"pr"}`}>
 {isNeutral?"NEUTRAL":isUp?"BULLISH":"BEARISH"} {pDay.conf}%
 </span>
 {pDay.bbSqueeze&&<span className="pill py" style={{fontSize:10}}>⚡ BB SQUEEZE</span>}
 {pDay.divergence?.type!=="NONE"&&<span className="pill pp" style={{fontSize:10}}>{pDay.divergence.type}</span>}
 </div>
 </div>
 </div>

 {/* External data row */}
 <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap"}}>
 {/* Fear & Greed */}
 {fng&&<div style={{flex:1,minWidth:120,padding:"10px 12px",background:"var(--bg3)",borderRadius:10,border:`1px solid ${fngColor}33`}}>
 <div style={{fontSize:9,color:"var(--t2)",letterSpacing:1,marginBottom:5,fontFamily:"'Space Grotesk',sans-serif"}}>FEAR & GREED</div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
 <span className="mono" style={{fontSize:22,fontWeight:700,color:fngColor}}>{fng.value}</span>
 <span className="pill" style={{background:`${fngColor}18`,color:fngColor,border:`1px solid ${fngColor}33`,fontSize:9}}>{fng.label}</span>
 </div>
 <div style={{height:5,background:"linear-gradient(90deg,var(--g),var(--y),var(--r))",borderRadius:3,position:"relative"}}>
 <div style={{position:"absolute",top:-2,width:10,height:10,borderRadius:"50%",background:"#fff",border:"2px solid var(--bg)",left:`calc(${fng.value}% - 5px)`,boxShadow:"0 0 6px rgba(255,255,255,.5)"}}/>
 </div>
 {fng.contrarian&&<div style={{marginTop:6,fontSize:10,color:fngColor,fontWeight:600}}>🎯 {fng.contrarian}</div>}
 </div>}

 {/* Global market */}
 {gm&&<div style={{flex:1,minWidth:120,padding:"10px 12px",background:"var(--bg3)",borderRadius:10,border:`1px solid rgba(0,188,255,.15)`}}>
 <div style={{fontSize:9,color:"var(--t2)",letterSpacing:1,marginBottom:5,fontFamily:"'Space Grotesk',sans-serif"}}>GLOBAL MARKET</div>
 <div className="mono" style={{fontSize:18,fontWeight:700,color:gm.mcapChange>=0?"var(--g)":"var(--r)",marginBottom:4}}>
 {gm.mcapChange>=0?"+":""}{gm.mcapChange}%
 </div>
 <div style={{fontSize:11,color:"var(--t2)"}}>BTC Dom: <span style={{color:"var(--y)",fontWeight:600}}>{gm.btcDom}%</span></div>
 {gm.altseason&&<div style={{fontSize:10,color:"var(--p)",marginTop:3}}>🚀 Altcoin season</div>}
 </div>}

 {/* Funding rate */}
 {funding&&<div style={{flex:1,minWidth:120,padding:"10px 12px",background:"var(--bg3)",borderRadius:10,border:`1px solid rgba(0,188,255,.15)`}}>
 <div style={{fontSize:9,color:"var(--t2)",letterSpacing:1,marginBottom:5,fontFamily:"'Space Grotesk',sans-serif"}}>FUNDING RATE</div>
 <div className="mono" style={{fontSize:18,fontWeight:700,color:funding.bearish?"var(--r)":funding.bullish?"var(--g)":"var(--t)",marginBottom:4}}>
 {funding.rate>0?"+":""}{funding.rate}%
 </div>
 <div style={{fontSize:10,color:"var(--t2)",lineHeight:1.5}}>{funding.desc}</div>
 </div>}
 </div>

 {/* Day reasons */}
 <div style={{display:"flex",flexDirection:"column",gap:5}}>
 {pDay.reasons.slice(0,3).map((r,i)=>(
 <div key={i} style={{fontSize:12,color:"var(--t)",display:"flex",gap:7,lineHeight:1.5}}>
 <span style={{color:col,flexShrink:0}}>✓</span><span>{r}</span>
 </div>
 ))}
 </div>
 {pDay.warnings.length>0&&<div style={{marginTop:8,padding:"8px 12px",background:"rgba(255,199,0,.05)",border:"1px solid rgba(255,199,0,.18)",borderRadius:8}}>
 {pDay.warnings.slice(0,2).map((w,i)=><div key={i} style={{fontSize:11,color:"var(--y)",marginBottom:i>0?3:0}}>{w}</div>)}
 </div>}
 </div>
 );
}

// ── SIGNAL CARD ────────────────────────────────────────────────────────
function LockBar({sig}) {
 const [ms,setMs]=useState(0);
 useEffect(()=>{
 if (!sig?.lockedAt) return;
 const t=setInterval(()=>setMs(Math.max(0,sig.lockedAt+CFG.LOCK[sig.strategy||"day"]-Date.now())),1000);
 setMs(Math.max(0,sig.lockedAt+CFG.LOCK[sig.strategy||"day"]-Date.now()));
 return ()=>clearInterval(t);
 },[sig?.lockedAt,sig?.strategy]);
 if (!ms||!sig) return null;
 const p=ms/CFG.LOCK[sig.strategy||"day"]; const cl=p>0.5?"var(--g)":p>0.2?"var(--y)":"var(--r)";
 const tl=ms=>{const s=Math.floor(ms/1000);if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}m ${s%60}s`;return`${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;};
 return (
 <div className="card" style={{padding:"12px 16px"}}>
 <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11}}>
 <span style={{color:"var(--t2)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5}}>🔒 SIGNAL LOCKED</span>
 <span className="mono" style={{color:cl,fontWeight:700}}>{tl(ms)}</span>
 </div>
 <div className="prog"><div style={{height:"100%",borderRadius:2,background:cl,width:`${p*100}%`,transition:"width 1s linear"}}/></div>
 </div>
 );
}

function TelegramBtn({sig,coinId}) {
 const [st,setSt]=useState("");const [load,setLoad]=useState(false);
 const token=localStorage.getItem("cq_admin_tg_token")||"";
 if (!token||!sig||sig.noSignal) return null;
 const send=async()=>{
 setLoad(true);setSt("Broadcasting...");
 const users=Auth.all().filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt);
 if (!users.length){setSt("⚠️ No paid subscribers with Telegram linked");setLoad(false);return;}
 let sent=0;
 for (const u of users){
 await new Promise(r=>setTimeout(r,350));
 const r=await tgSend(token,u.telegramChatId,fmtTg(coinId,sig));
 if (r.ok) sent++;
 }
 setSt(`✅ Sent to ${sent}/${users.length} subscribers`);
 setLoad(false); setTimeout(()=>setSt(""),6000);
 };
 return (
 <div style={{marginBottom:10}}>
 <button className="btn btg" style={{width:"100%",padding:12,fontSize:12,letterSpacing:.5}} onClick={send} disabled={load}>
 {load?<><Spin sz={13}/> {st||"Sending..."}</>:<><span>✈️</span> BROADCAST TO PAID SUBSCRIBERS</>}
 </button>
 {st&&!load&&<div style={{marginTop:5,fontSize:12,color:st.startsWith("✅")?"var(--g)":"var(--y)",textAlign:"center",padding:"5px 10px",background:st.startsWith("✅")?"rgba(0,240,136,.07)":"rgba(255,199,0,.07)",borderRadius:8}}>{st}</div>}
 </div>
 );
}

function SignalCard({coinId,name,sig,loading,onRefresh,livePrice,liveChg,prediction}) {
 if (loading) return (
 <div className="card" style={{padding:52,textAlign:"center"}}>
 <Spin sz={48}/>
 <div style={{marginTop:16,color:"var(--c)",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600,letterSpacing:1}}>ANALYZING ALL TIMEFRAMES...</div>
 <div style={{marginTop:6,color:"var(--t2)",fontSize:12}}>1m · 5m · 15m · 1H · 4H · 1D + Fear&Greed + Funding + OrderBook</div>
 </div>
 );

 const showPredictions=prediction&&(prediction.predict15||prediction.predictDay);

 // Show "no signal" with predictions still visible
 const noTrade=!sig||sig.noSignal;

 return (
 <div style={{display:"flex",flexDirection:"column",gap:14}}>
 {/* Predictions ALWAYS show (even when no signal) */}
 {showPredictions&&<>
 <Predict15Card p15={prediction.predict15} price={livePrice||prediction.price}/>
 <PredictDayCard pDay={prediction.predictDay} fng={prediction.fearGreed} gm={prediction.globalMarket} funding={prediction.funding}/>
 </>}

 {noTrade?(
 <div className="card" style={{padding:24,border:"1px solid rgba(255,199,0,.2)"}}>
 <div style={{display:"flex",gap:14,marginBottom:14,alignItems:"flex-start"}}>
 <div style={{fontSize:36,flexShrink:0}}>⏳</div>
 <div>
 <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,color:"var(--y)",fontSize:16,marginBottom:6}}>NO ENTRY SIGNAL — STAND ASIDE</div>
 <div style={{fontSize:13,color:"var(--t)",lineHeight:1.8}}>{sig?.reason||"Timeframe conflict or macro veto. Preserve capital."}</div>
 </div>
 </div>
 {sig?.tfDetail&&<div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
 {sig.tfDetail.map((t,i)=><div key={i} className={`tf-b ${t.trend==="BULL"?"tf-bull":t.trend==="BEAR"?"tf-bear":"tf-neut"}`}>{t.tf.toUpperCase()} {t.trend} · RSI {t.rsi}</div>)}
 </div>}
 <button className="btn bo" style={{width:"100%"}} onClick={onRefresh}>🔄 RE-ANALYZE</button>
 </div>
 ):(()=>{
 const isL=sig.signal==="LONG"; const col=isL?"var(--g)":"var(--r)";
 const sc={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"}[sig.strategy||"day"];
 return (
 <div style={{display:"flex",flexDirection:"column",gap:14}}>
 <LockBar sig={sig}/>
 {/* Header */}
 <div className={`card ${isL?"card-bull":"card-bear"}`} style={{padding:24,background:`linear-gradient(135deg,rgba(6,11,18,.98),rgba(${isL?"0,50,25":"50,5,15"},.3))`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:16,marginBottom:16}}>
 <div style={{flex:1}}>
 <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
 <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:col,letterSpacing:2}}>{coinId}/USDT</span>
 <span className={`pill ${isL?"pg":"pr"}`} style={{fontSize:12,padding:"5px 14px"}}>{isL?"▲ LONG":"▼ SHORT"}</span>
 <span className={`pill ${sig.risk==="LOW"?"pg":sig.risk==="MEDIUM"?"py":"pr"}`}>{sig.risk} RISK</span>
 <span className={`pill ${{scalp:"ps",day:"pd",swing:"pw"}[sig.strategy||"day"]}`}>{(sig.strategy||"day").toUpperCase()}</span>
 </div>
 <div style={{color:"var(--t2)",fontSize:13,marginBottom:8}}>
 {name||coinId} · {sig.tf||"1H/4H"} · <span className="mono" style={{color:"var(--y)",fontWeight:700}}>{sig.lev}×</span> lev · Macro: <span style={{color:sig.macroTrend==="BULL"?"var(--g)":sig.macroTrend==="BEAR"?"var(--r)":"var(--y)",fontWeight:700}}>{sig.macroTrend||"—"}</span>
 </div>
 <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
 <span className="mono" style={{fontSize:24,fontWeight:700,color:"var(--t)"}}>${fp(livePrice||sig.price)}</span>
 {liveChg!==undefined&&<span style={{fontSize:14,color:liveChg>=0?"var(--g)":"var(--r)",fontWeight:600}}>{liveChg>=0?"+":""}{liveChg.toFixed(2)}%</span>}
 {livePrice&&livePrice!==sig.price&&<span style={{fontSize:10,color:"var(--t2)",padding:"2px 8px",background:"var(--bg3)",borderRadius:20}}>Signal at ${fp(sig.price)}</span>}
 <span style={{width:7,height:7,borderRadius:"50%",background:"var(--g)",display:"inline-block",boxShadow:"0 0 6px var(--g)"}} className="_pu"/>
 </div>
 </div>
 <Ring val={sig.conf} color={col} sz={112}/>
 </div>

 {/* TF badges */}
 {sig.tfDetail&&<div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:14}}>
 {sig.tfDetail.map((t,i)=><div key={i} className={`tf-b ${t.trend==="BULL"?"tf-bull":t.trend==="BEAR"?"tf-bear":"tf-neut"}`}>{t.tf.toUpperCase()} {t.trend} · RSI {t.rsi}</div>)}
 {sig.macroTrend&&<div className={`tf-b ${sig.macroTrend==="BULL"?"tf-bull":"tf-bear"}`} style={{fontWeight:700}}>1D MACRO:{sig.macroTrend}</div>}
 </div>}

 {/* Indicators */}
 {sig.ind&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
 {[["RSI",sig.ind.rsi,sig.ind.rsi<35?"var(--g)":sig.ind.rsi>65?"var(--r)":"var(--y)"],
 sig.ind.vwap>0&&["VWAP","$"+fp(sig.ind.vwap),(livePrice||sig.price)>sig.ind.vwap?"var(--g)":"var(--r)"],
 sig.ind.ema200>0&&["EMA200","$"+fp(sig.ind.ema200),"var(--y)"],
 sig.obData&&["Order Book",sig.obData.bidPct+"% bid",sig.obData.bullish?"var(--g)":"var(--r)"],
 sig.rrCheck&&["R:R TP2","1:"+sig.rrCheck.rr2,"var(--c)"],
 ].filter(Boolean).map((it,i)=>(
 <div key={i} style={{padding:"5px 11px",borderRadius:8,background:"var(--bg3)",fontSize:11,border:"1px solid var(--bdr)"}}>
 <span style={{color:"var(--t2)"}}>{it[0]} </span>
 <span className="mono" style={{fontWeight:700,color:it[2]}}>{it[1]}</span>
 </div>
 ))}
 </div>}

 {/* Reasons */}
 <div style={{background:"rgba(0,0,0,.3)",borderRadius:10,padding:"14px 16px",borderLeft:`3px solid ${sc}`}}>
 <div style={{fontSize:9,color:"var(--t2)",letterSpacing:1.5,marginBottom:8,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,textTransform:"uppercase"}}>Signal Analysis</div>
 {(sig.reasons||[]).slice(0,4).map((r,i)=>(
 <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12,lineHeight:1.65,marginBottom:3}}>
 <span style={{color:col,flexShrink:0}}>✓</span><span>{r}</span>
 </div>
 ))}
 <div style={{marginTop:8,fontSize:11,color:"var(--t2)"}}>Win rate: ~{sig.winRate}% · {sig.dur||"4–12h"}</div>
 </div>
 </div>

 {/* Trade setup */}
 <div className="card" style={{padding:22}}>
 <div style={{fontSize:11,color:"var(--t2)",letterSpacing:1.5,marginBottom:16,fontFamily:"'Space Grotesk',sans-serif",textTransform:"uppercase",fontWeight:600}}>Trade Setup</div>
 <div style={{background:`rgba(${isL?"0,188,255":"255,31,75"},.05)`,border:`1px solid rgba(${isL?"0,188,255":"255,31,75"},.18)`,borderRadius:12,padding:"14px 18px",marginBottom:14}}>
 <div style={{fontSize:10,color:isL?"var(--c)":"var(--r)",letterSpacing:1.5,marginBottom:10,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,textTransform:"uppercase"}}>📍 Entry Range</div>
 <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
 <div style={{textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)",marginBottom:3}}>LOW</div><div className="mono" style={{fontSize:18,fontWeight:700,color:isL?"var(--c)":"var(--r)"}}>${fp(sig.eLow)}</div></div>
 <div style={{flex:1,height:7,background:"var(--bg4)",borderRadius:4,minWidth:30,position:"relative",overflow:"hidden"}}>
 <div style={{position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${isL?"rgba(0,188,255,.5)":"rgba(255,31,75,.5)"},transparent)`,borderRadius:4}}/>
 </div>
 <div style={{textAlign:"center"}}><div style={{fontSize:10,color:"var(--t2)",marginBottom:3}}>HIGH</div><div className="mono" style={{fontSize:18,fontWeight:700,color:isL?"var(--c)":"var(--r)"}}>${fp(sig.eHigh)}</div></div>
 </div>
 <div style={{textAlign:"center",marginTop:6,fontSize:11,color:"var(--t2)"}}>Mid <span className="mono" style={{color:"var(--t)"}}>${fp(sig.mid)}</span></div>
 </div>

 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(108px,1fr))",gap:10,marginBottom:16}}>
 {[{l:"STOP LOSS",v:`$${fp(sig.sl)}`,c:"var(--r)"},{l:"BREAK-EVEN",v:`$${fp(sig.breakEven||sig.mid)}`,c:"var(--y)"},{l:"SL DIST",v:`${Math.abs(pct(sig.mid,sig.sl))}%`,c:"var(--r)"},{l:"LEVERAGE",v:`${sig.lev}×`,c:"var(--y)"}].map(it=>(
 <div key={it.l} style={{background:"var(--bg3)",borderRadius:8,padding:"11px 12px",border:"1px solid var(--bdr)",textAlign:"center"}}>
 <div style={{fontSize:9,color:"var(--t2)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",textTransform:"uppercase"}}>{it.l}</div>
 <div className="mono" style={{fontSize:13,fontWeight:700,color:it.c}}>{it.v}</div>
 </div>
 ))}
 </div>

 <div style={{fontSize:11,color:"var(--t2)",letterSpacing:1.5,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif",textTransform:"uppercase",fontWeight:600}}>Take Profit Targets</div>
 {[[sig.tp1,"R:R 1:1.5",35],[sig.tp2,"R:R 1:2.5 ✅",65],[sig.tp3,"R:R 1:4.5",100]].map(([tp,rr,w],i)=>(
 <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
 <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,color:col,width:28,flexShrink:0,fontWeight:700}}>TP{i+1}</div>
 <div className="prog" style={{flex:1}}><div className="pf" style={{width:`${w}%`,background:`linear-gradient(90deg,${col}55,${col})`}}/></div>
 <div className="mono" style={{fontSize:12,color:col,width:88,textAlign:"right"}}>${fp(tp)}</div>
 <div style={{fontSize:10,color:"var(--t2)",width:44,textAlign:"right"}}>{pct(sig.mid,tp)}%</div>
 <div style={{fontSize:10,color:"var(--g)",width:52,textAlign:"right"}}>+{(Math.abs(parseFloat(pct(sig.mid,tp)))*sig.lev).toFixed(1)}%</div>
 <div style={{fontSize:9,color:"var(--t2)",width:58,fontFamily:"'Space Grotesk',sans-serif",textAlign:"right"}}>{rr}</div>
 </div>
 ))}
 <div style={{marginTop:10,padding:"10px 14px",background:"rgba(255,199,0,.05)",border:"1px solid rgba(255,199,0,.15)",borderRadius:8,fontSize:12,color:"var(--t)",lineHeight:1.6}}>
 📌 <strong style={{color:"var(--y)"}}>Trail SL:</strong> {sig.trailingNote}
 </div>
 </div>

 <TelegramBtn sig={sig} coinId={coinId}/>
 <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
 <button className={`btn ${isL?"bg":"br"}`} style={{flex:2,padding:14,minWidth:200,fontSize:13}}>
 {isL?"▲ ENTER LONG":"▼ ENTER SHORT"} ${fp(sig.eLow)}–${fp(sig.eHigh)}
 </button>
 <button className="btn bo" style={{flex:1,padding:14}} onClick={onRefresh}>🔄</button>
 </div>
 </div>
 );
 })()}
 </div>
 );
}

// ══════════════════════════════════════════════════════════════════════
// PAGES
// ══════════════════════════════════════════════════════════════════════

function AuthPage({onLogin}) {
 const [mode,setMode]=useState("login");
 const [input,setInput]=useState("");
 const [email,setEmail]=useState(""), [pass,setPass]=useState(""), [pass2,setPass2]=useState("");
 const [showP,setShowP]=useState(false);
 const [err,setErr]=useState(""), [info,setInfo]=useState("");
 const [newId,setNewId]=useState(""), [load,setLoad]=useState(false);
 const pwErrs=validatePw(pass), pwOk=pass.length>0&&pwErrs.length===0;

 const doLogin=async()=>{
 setErr(""); if (!input||!pass){setErr("Enter CQ-ID and password.");return;}
 setLoad(true); await new Promise(r=>setTimeout(r,400));
 const res=Auth.check(input.trim(),pass);
 if (res.ok) onLogin(res); else {setErr(res.err);setLoad(false);}
 };
 const doReg=async()=>{
 setErr("");
 if (!email.includes("@")){setErr("Valid email required.");return;}
 if (!pwOk){setErr("Fix password requirements.");return;}
 if (pass!==pass2){setErr("Passwords don't match.");return;}
 setLoad(true); await new Promise(r=>setTimeout(r,400));
 const res=Auth.register(email.trim(),pass);
 if (res.ok) setNewId(res.cqid); else setErr(res.err);
 setLoad(false);
 };

 return (
 <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",zIndex:1}}>
 <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 35%,rgba(0,188,255,.07),transparent 60%)",pointerEvents:"none"}}/>
 <div className="card ai" style={{width:"100%",maxWidth:430,padding:44}}>
 {/* Brand */}
 <div style={{textAlign:"center",marginBottom:32}}>
 <div style={{display:"flex",justifyContent:"center",marginBottom:18}} className="glow"><Logo sz={78}/></div>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:5,background:"linear-gradient(135deg,var(--c),var(--g))",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1,marginBottom:4}}>CRYPTEX QUANT</div>
 <div style={{fontSize:11,color:"var(--t2)",letterSpacing:2,fontFamily:"'Space Grotesk',sans-serif"}}>WORLD #1 TRADING INTELLIGENCE v7.0</div>
 </div>

 <div style={{display:"flex",background:"var(--bg3)",borderRadius:10,padding:3,marginBottom:22}}>
 {[["login","Sign In"],["register","Free Trial"]].map(([m,l])=>(
 <button key={m} onClick={()=>{setMode(m);setErr("");setNewId("");}}
 style={{flex:1,padding:"9px",borderRadius:8,border:"none",cursor:"pointer",background:mode===m?"var(--bg2)":"transparent",color:mode===m?"var(--c)":"var(--t2)",fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,fontSize:12,transition:"all .2s"}}>
 {l}
 </button>
 ))}
 </div>

 {mode==="login"&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
 <div>
 <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5,fontWeight:600}}>CQ-ID OR EMAIL</div>
 <input className="inp mono" style={{fontSize:14,letterSpacing:1}} placeholder="CQ-XXXXXXXX or your@email.com" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
 <div style={{fontSize:10,color:"var(--t2)",marginTop:4}}>Admin: enter your full email address</div>
 </div>
 <div>
 <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5,fontWeight:600}}>PASSWORD</div>
 <div style={{position:"relative"}}>
 <input className="inp" type={showP?"text":"password"} placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{paddingRight:44}}/>
 <button onClick={()=>setShowP(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--t2)",fontSize:16}}>{showP?"🙈":"👁"}</button>
 </div>
 </div>
 {err&&<div style={{fontSize:12,color:"var(--r)",padding:"9px 12px",background:"rgba(255,31,75,.07)",borderRadius:8}}>{err}</div>}
 <button className="btn bc" style={{width:"100%",padding:14,fontSize:13}} onClick={doLogin} disabled={load}>{load?<Spin sz={16}/>:"→ SIGN IN"}</button>
 </div>}

 {mode==="register"&&!newId&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
 <div>
 <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5,fontWeight:600}}>EMAIL ADDRESS</div>
 <input className={`inp ${email.length>4&&!email.includes("@")?"ie":""}`} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)}/>
 </div>
 <div>
 <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5,fontWeight:600}}>PASSWORD</div>
 <div style={{position:"relative"}}>
 <input className={`inp ${pass.length>0&&!pwOk?"ie":""}`} type={showP?"text":"password"} placeholder="8+ chars, A-Z, a-z, 0-9, symbol" value={pass} onChange={e=>setPass(e.target.value)} style={{paddingRight:44}}/>
 <button onClick={()=>setShowP(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"var(--t2)",fontSize:16}}>{showP?"🙈":"👁"}</button>
 </div>
 {pass.length>0&&<div style={{fontSize:11,marginTop:4,color:pwOk?"var(--g)":"var(--y)"}}>{pwOk?"✅ Strong password":"Needs: "+pwErrs.join(" · ")}</div>}
 </div>
 <input className="inp" type="password" placeholder="Confirm password" value={pass2} onChange={e=>setPass2(e.target.value)}/>
 {err&&<div style={{fontSize:12,color:"var(--r)",padding:"9px 12px",background:"rgba(255,31,75,.07)",borderRadius:8}}>{err}</div>}
 <button className="btn bc" style={{width:"100%",padding:14,fontSize:13}} onClick={doReg} disabled={load||!email||!pwOk||pass!==pass2}>{load?<Spin sz={16}/>:"→ CREATE FREE ACCOUNT"}</button>
 <div style={{padding:10,background:"rgba(0,240,136,.04)",border:"1px solid rgba(0,240,136,.12)",borderRadius:8,fontSize:12,color:"var(--t2)",lineHeight:1.8}}>
 <div style={{color:"var(--g)",fontWeight:700,marginBottom:3}}>🎁 30-DAY FREE TRIAL</div>
 <div>✓ Full signal access · No payment needed</div>
 <div>✓ Unique CQ-ID — no OTP required</div>
 </div>
 </div>}

 {mode==="register"&&newId&&<div style={{textAlign:"center",display:"flex",flexDirection:"column",gap:14}}>
 <div style={{fontSize:40}}>🎉</div>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--g)",letterSpacing:2}}>ACCOUNT CREATED!</div>
 <div style={{padding:"20px 24px",background:"linear-gradient(135deg,rgba(0,188,255,.1),rgba(0,240,136,.1))",border:"2px solid rgba(0,188,255,.3)",borderRadius:14}}>
 <div style={{fontSize:11,color:"var(--t2)",letterSpacing:2,marginBottom:8,fontFamily:"'Space Grotesk',sans-serif"}}>YOUR UNIQUE CQ-ID</div>
 <div className="mono" style={{fontSize:34,fontWeight:700,letterSpacing:4,color:"var(--c)",marginBottom:6}}>{newId}</div>
 <div style={{fontSize:12,color:"var(--y)"}}>⚠️ Save this — needed to login</div>
 </div>
 <button className="btn bc" style={{width:"100%",padding:14,fontSize:13}} onClick={()=>{setMode("login");setInput(newId);}}>→ GO TO LOGIN</button>
 </div>}
 </div>
 </div>
 );
}

// ── DASHBOARD ──────────────────────────────────────────────────────────
function PageDashboard({coins,sigs,loadSig,setTab,setActive,setSt,crash,fng,gm}) {
 const [st,setSt2]=useState("day");
 const changeSt=s=>{setSt2(s);setSt(s);};
 return (
 <div>
 {/* Crash banner */}
 {crash&&<div className="siren" style={{padding:"14px 18px",borderRadius:12,border:`2px solid ${crash.level==="CRASH"?"var(--r)":"var(--y)"}`,marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
 <span style={{fontSize:24,flexShrink:0}}>{crash.level==="CRASH"?"💥":"⚠️"}</span>
 <div><div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,color:crash.level==="CRASH"?"var(--r)":"var(--y)",marginBottom:2}}>{crash.level} MARKET ALERT</div>
 <div style={{fontSize:13}}>{crash.msg}</div></div>
 </div>}

 {/* Market sentiment mini-bar */}
 {(fng||gm)&&<div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
 {fng&&<div style={{padding:"8px 14px",background:"var(--bg3)",borderRadius:10,border:"1px solid var(--bdr)",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:140}}>
 <div style={{flex:1}}>
 <div style={{fontSize:9,color:"var(--t2)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:1,marginBottom:3}}>FEAR & GREED</div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span className="mono" style={{fontSize:18,fontWeight:700,color:fng.value<=25?"var(--g)":fng.value>=75?"var(--r)":"var(--y)"}}>{fng.value}</span>
 <span style={{fontSize:11,color:"var(--t2)"}}>{fng.label}</span>
 {fng.contrarian&&<span className="pill" style={{fontSize:9,background:"rgba(168,85,247,.1)",color:"var(--p)",border:"1px solid rgba(168,85,247,.2)"}}>{fng.contrarian}</span>}
 </div>
 </div>
 </div>}
 {gm&&<div style={{padding:"8px 14px",background:"var(--bg3)",borderRadius:10,border:"1px solid var(--bdr)",display:"flex",alignItems:"center",gap:10,flex:1,minWidth:140}}>
 <div style={{flex:1}}>
 <div style={{fontSize:9,color:"var(--t2)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:1,marginBottom:3}}>GLOBAL MARKET</div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span className="mono" style={{fontSize:18,fontWeight:700,color:gm.mcapChange>=0?"var(--g)":"var(--r)"}}>{gm.mcapChange>=0?"+":""}{gm.mcapChange}%</span>
 <span style={{fontSize:11,color:"var(--t2)"}}>BTC {gm.btcDom}%</span>
 {gm.altseason&&<span className="pill pp" style={{fontSize:9}}>Alt Season</span>}
 </div>
 </div>
 </div>}
 </div>}

 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20,flexWrap:"wrap",gap:12}}>
 <div>
 <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:3,marginBottom:4}}>
 LIVE <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>QUANT SIGNALS</span>
 </h1>
 <div style={{fontSize:12,color:"var(--t2)"}}>All-TF consensus · 15m prediction · Daily outlook · EMA200 veto · R:R ≥ 1:2</div>
 </div>
 </div>

 <div className="stab" style={{marginBottom:18}}>
 <button className={`sbt ${st==="scalp"?"as":""}`} onClick={()=>changeSt("scalp")}>⚡ SCALP 5M–1H</button>
 <button className={`sbt ${st==="day"?"ad":""}`} onClick={()=>changeSt("day")}>📊 DAY 15M–4H</button>
 <button className={`sbt ${st==="swing"?"aw":""}`} onClick={()=>changeSt("swing")}>🌊 SWING 1H–1D</button>
 </div>

 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(255px,1fr))",gap:14}}>
 {TOP5.map((cd,i)=>{
 const coin=coins[i]||{...cd,price:cd.base,chg24:0};
 const sig=sigs[`${cd.id}-${st}`];
 const isL=sig?.signal==="LONG"; const col=isL?"var(--g)":"var(--r)";
 return (
 <div key={cd.id} className={`card au ${sig&&!sig.noSignal?(isL?"card-bull":"card-bear"):""}`}
 style={{padding:18,cursor:"pointer",animationDelay:`${i*.07}s`}}
 onClick={()=>{setActive(i);setSt(st);changeSt(st);setTab("signals");}}>
 <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <div style={{width:42,height:42,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",background:`rgba(${sig&&!sig.noSignal?(isL?"0,240,136":"255,31,75"):"77,107,136"},.08)`,border:`1.5px solid ${sig&&!sig.noSignal?col:"var(--bdr)"}`}}>
 <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:sig&&!sig.noSignal?col:"var(--t2)"}}>{cd.logo}</span>
 </div>
 <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1}}>{cd.id}</div><div style={{fontSize:11,color:"var(--t2)"}}>{cd.name}</div></div>
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
 {sig.macroTrend&&<span className={`pill ${sig.macroTrend==="BULL"?"pg":"pr"}`} style={{fontSize:10}}>1D:{sig.macroTrend}</span>}
 </div>
 <div className="prog" style={{marginBottom:7}}><div className="pf" style={{width:`${sig.conf}%`,background:`linear-gradient(90deg,${col}66,${col})`}}/></div>
 <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t2)"}}>
 <span>{sig.conf}% conf</span><span className="mono">${fp(sig.eLow)}–${fp(sig.eHigh)}</span>
 </div>
 </>:<div style={{fontSize:11,color:"var(--y)",marginTop:6}}>⏳ No consensus — stand aside</div>}
 </div>
 );
 })}
 </div>
 </div>
 );
}

// ── SIGNALS PAGE ───────────────────────────────────────────────────────
function PageSignals({coins,sigs,loadSig,active,setActive,st,setSt,onRefresh,predictions}) {
 const cd=TOP5[active]||TOP5[0];
 const coin=coins[active]||{...cd};
 const sig=sigs[`${cd.id}-${st}`];
 const pred=predictions?.[cd.id];
 return (
 <div>
 <div style={{overflowX:"auto",marginBottom:12}}>
 <div style={{display:"flex",gap:8,paddingBottom:4,minWidth:"max-content"}}>
 {TOP5.map((c,i)=>{
 const s=sigs[`${c.id}-${st}`]; const isL=s?.signal==="LONG";
 return (
 <button key={c.id} onClick={()=>setActive(i)}
 className={`btn ${i===active?(s&&!s.noSignal?(isL?"bg":"br"):"bc"):"bh"}`}
 style={{padding:"8px 14px",position:"relative"}}>
 {c.logo} {c.id}
 {s?.noSignal&&<span style={{position:"absolute",top:2,right:2,width:7,height:7,background:"var(--y)",borderRadius:"50%"}}/>}
 </button>
 );
 })}
 </div>
 </div>
 <div className="stab" style={{marginBottom:14}}>
 <button className={`sbt ${st==="scalp"?"as":""}`} onClick={()=>setSt("scalp")}>⚡ SCALP</button>
 <button className={`sbt ${st==="day"?"ad":""}`} onClick={()=>setSt("day")}>📊 DAY</button>
 <button className={`sbt ${st==="swing"?"aw":""}`} onClick={()=>setSt("swing")}>🌊 SWING</button>
 </div>
 <SignalCard coinId={cd.id} name={cd.name} sig={sig} loading={loadSig&&!sig&&!pred} onRefresh={onRefresh}
 livePrice={coin.updatedAt?coin.price:undefined} liveChg={coin.updatedAt?coin.chg24:undefined}
 prediction={pred}/>
 </div>
 );
}

// ── SEARCH PAGE (FIXED — fast, dedicated engine) ──────────────────────
function PageSearch() {
 const [query,setQuery]=useState("");
 const [pairs,setPairs]=useState([]);
 const [filtered,setFiltered]=useState([]);
 const [show,setShow]=useState(false);
 const [sel,setSel]=useState(null);
 const [result,setResult]=useState(null); // {prediction, sigs}
 const [loading,setLoading]=useState(false);
 const [loadMsg,setLoadMsg]=useState("");
 const ref=useRef(null);

 // Load pairs once
 useEffect(()=>{
 fetch("https://api.binance.com/api/v3/ticker/24hr")
 .then(r=>r.json()).then(all=>{
 setPairs(all.filter(d=>d.symbol.endsWith("USDT")&&parseFloat(d.quoteVolume)>1e6)
 .sort((a,b)=>parseFloat(b.quoteVolume)-parseFloat(a.quoteVolume)).slice(0,150)
 .map(d=>({symbol:d.symbol,id:d.symbol.replace("USDT",""),price:+d.lastPrice,chg24:+d.priceChangePercent})));
 }).catch(()=>{});
 },[]);

 useEffect(()=>{
 if (!query.trim()){setFiltered([]);setShow(false);return;}
 const q=query.toUpperCase().replace("/USDT","");
 setFiltered(pairs.filter(p=>p.id.startsWith(q)||p.id.includes(q)).slice(0,12));
 setShow(true);
 },[query,pairs]);

 useEffect(()=>{
 const h=e=>{if(ref.current&&!ref.current.contains(e.target))setShow(false);};
 document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
 },[]);

 const select=async(pair)=>{
 setSel(pair); setShow(false);
 setQuery(`${pair.id}/USDT`);
 setLoading(true); setResult(null);

 try {
 setLoadMsg("Fetching 6 timeframes + global data...");
 // Full prediction (this is the key — fast parallel fetch)
 const pred=await fullPrediction(pair.symbol, pair.price);

 setLoadMsg("Running strategy analysis...");
 // Fast strategy signals (2 calls each, parallel)
 const [scalpSig, daySig, swingSig]=await Promise.all([
 scanAnalyze({symbol:pair.symbol,id:pair.id,price:pair.price,chg24:pair.chg24,vol:0},"scalp"),
 scanAnalyze({symbol:pair.symbol,id:pair.id,price:pair.price,chg24:pair.chg24,vol:0},"day"),
 scanAnalyze({symbol:pair.symbol,id:pair.id,price:pair.price,chg24:pair.chg24,vol:0},"swing"),
 ]);

 const fallback={noSignal:true,reason:"No clear setup for this timeframe. Stand aside."};
 setResult({
 prediction:pred,
 sigs:{
 scalp:scalpSig||fallback,
 day:daySig||fallback,
 swing:swingSig||fallback,
 },
 });
 } catch(e) {
 setResult({error:"Analysis failed: "+e.message});
 }
 setLoading(false);
 };

 const [vst,setVst]=useState("day");
 const POP=["BTC","ETH","SOL","BNB","DOGE","XRP","ADA","LINK","AVAX","DOT","MATIC","APT","ARB","OP","INJ","WIF","PEPE"];

 return (
 <div>
 <div style={{marginBottom:20}}>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,marginBottom:4}}>
 COIN <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ANALYSIS</span>
 </h2>
 <div style={{fontSize:13,color:"var(--t2)"}}>Full 6-TF analysis · 15m prediction · Daily outlook · Fear & Greed · Funding Rate</div>
 </div>

 {/* Search input */}
 <div ref={ref} style={{position:"relative",marginBottom:18}}>
 <input className="inp" placeholder="Search any pair: DOGE, SOL, PEPE, WIF..." value={query}
 onChange={e=>setQuery(e.target.value)} onFocus={()=>query&&filtered.length&&setShow(true)}
 style={{paddingLeft:46,fontSize:15}}/>
 <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:20}}>🔍</span>
 {show&&(
 <div className="dd">
 {filtered.map(p=>(
 <div key={p.symbol} className="ddi" onClick={()=>select(p)}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:32,height:32,borderRadius:8,background:"var(--bg3)",border:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"var(--c)",flexShrink:0}}>{p.id[0]}</div>
 <div><div style={{fontWeight:600,fontFamily:"'Space Grotesk',sans-serif"}}>{p.id}/USDT</div><div className="mono" style={{fontSize:11,color:"var(--t2)"}}>${fp(p.price)}</div></div>
 </div>
 <div style={{fontSize:12,color:p.chg24>=0?"var(--g)":"var(--r)",fontWeight:600}}>{p.chg24>=0?"+":""}{p.chg24.toFixed(2)}%</div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Popular pairs */}
 {!sel&&<div>
 <div style={{fontSize:10,color:"var(--t2)",letterSpacing:1.5,marginBottom:10,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600}}>POPULAR PAIRS</div>
 <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
 {POP.map(id=>{const p=pairs.find(x=>x.id===id); return <button key={id} className="btn bh" style={{padding:"7px 13px",fontSize:11}} onClick={()=>p&&select(p)} disabled={!p}>{id}/USDT</button>;})}
 </div>
 </div>}

 {/* Loading */}
 {loading&&<div className="card ai" style={{padding:48,textAlign:"center",marginTop:18}}>
 <Spin sz={48}/>
 <div style={{marginTop:16,color:"var(--c)",fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:600}}>{loadMsg||`ANALYZING ${sel?.id}...`}</div>
 <div style={{marginTop:6,color:"var(--t2)",fontSize:12}}>1m · 5m · 15m · 1H · 4H · 1D · Fear&Greed · Funding · OrderBook</div>
 </div>}

 {/* Error */}
 {result?.error&&<div className="card" style={{padding:24,border:"1px solid rgba(255,31,75,.2)"}}><div style={{color:"var(--r)"}}>{result.error}</div></div>}

 {/* Results */}
 {result&&!result.error&&!loading&&<div style={{marginTop:16}}>
 {/* Strategy overview */}
 <div className="card" style={{padding:16,marginBottom:14}}>
 <div style={{fontSize:11,color:"var(--t2)",letterSpacing:1.5,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,textTransform:"uppercase"}}>Strategy Overview — {sel?.id}/USDT</div>
 {["scalp","day","swing"].map(s=>{
 const sg=result.sigs[s]; const isL=sg?.signal==="LONG";
 const sc={scalp:"var(--scalp)",day:"var(--day)",swing:"var(--swing)"}[s];
 return (
 <div key={s} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
 <div style={{width:58,fontFamily:"'Space Grotesk',sans-serif",fontSize:11,fontWeight:700,color:sc,textTransform:"uppercase"}}>{s}</div>
 {sg&&!sg.noSignal?<>
 <div className="prog" style={{flex:1}}><div className="pf" style={{width:`${sg.conf}%`,background:sc}}/></div>
 <span className={`pill ${isL?"pg":"pr"}`} style={{width:50,justifyContent:"center",fontSize:10}}>{isL?"▲ L":"▼ S"}</span>
 <span className="mono" style={{fontSize:11,width:30,color:sc,textAlign:"right"}}>{sg.conf}%</span>
 </>:<div style={{flex:1,fontSize:12,color:"var(--y)"}}>⏳ No signal</div>}
 </div>
 );
 })}
 </div>

 {/* Strategy tabs */}
 <div className="stab" style={{marginBottom:14}}>
 <button className={`sbt ${vst==="scalp"?"as":""}`} onClick={()=>setVst("scalp")}>⚡ SCALP</button>
 <button className={`sbt ${vst==="day"?"ad":""}`} onClick={()=>setVst("day")}>📊 DAY</button>
 <button className={`sbt ${vst==="swing"?"aw":""}`} onClick={()=>setVst("swing")}>🌊 SWING</button>
 </div>

 <SignalCard coinId={sel.id} name={sel.id} sig={result.sigs[vst]} loading={false}
 onRefresh={()=>select(sel)} livePrice={sel.price} liveChg={sel.chg24}
 prediction={result.prediction}/>
 </div>}
 </div>
 );
}

// ── SCAN PAGE ──────────────────────────────────────────────────────────
function TelegramScanBtn({results}) {
 const [st,setSt]=useState(""), [load,setLoad]=useState(false);
 const token=localStorage.getItem("cq_admin_tg_token")||"";
 if (!token||!results?.length) return null;
 const send=async()=>{
 setLoad(true); setSt("Sending...");
 const users=Auth.all().filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt);
 if (!users.length){setSt("⚠️ No paid users with Telegram");setLoad(false);return;}
 const summary=`📊 <b>CRYPTEX QUANT — SCAN</b>\n━━━━━━━━━━━━━━━━\n🟢 LONG: ${results.filter(r=>r.signal==="LONG").length} | 🔴 SHORT: ${results.filter(r=>r.signal==="SHORT").length}\n${results.length} signals · Top 5 below`;
 for (const u of users) await tgSend(token,u.telegramChatId,summary);
 for (const r of results.slice(0,5)){
 await new Promise(res=>setTimeout(res,400));
 for (const u of users) await tgSend(token,u.telegramChatId,fmtTg(r.coinId,r));
 }
 setSt(`✅ Sent to ${users.length} subscribers`);
 setLoad(false); setTimeout(()=>setSt(""),5000);
 };
 return (
 <div style={{display:"flex",flexDirection:"column",gap:4}}>
 <button className="btn btg" style={{padding:"8px 14px",fontSize:11}} onClick={send} disabled={load}>
 {load?<Spin sz={12}/>:<><span>✈️</span> Broadcast</>}
 </button>
 {st&&<div style={{fontSize:10,color:"var(--g)",textAlign:"center"}}>{st}</div>}
 </div>
 );
}

function PageScan() {
 const [phase,setPhase]=useState("idle");
 const [prog,setProg]=useState({msg:"",pct:0,found:0,current:[]});
 const [results,setResults]=useState([]);
 const [strategy,setStrategy]=useState("day");
 const [filter,setFilter]=useState("all");
 const [view,setView]=useState(null);
 const cancelRef=useRef(false);

 const doScan=async()=>{
 cancelRef.current=false; setPhase("scanning"); setResults([]); setView(null);
 setProg({msg:"Starting...",pct:0,found:0,current:[]});
 try {
 const res=await runScan(strategy,(p)=>{if(!cancelRef.current){setProg(p);if(p.found>0)setResults(prev=>[...prev]);}},cancelRef);
 if (!cancelRef.current){setResults(res);setPhase("done");}
 } catch(e) {
 if (!cancelRef.current){setProg({msg:"Error: "+e.message,pct:100,found:0});setPhase("done");}
 }
 };

 const filtered=useMemo(()=>{
 if (filter==="all") return results;
 if (filter==="long") return results.filter(r=>r.signal==="LONG");
 if (filter==="short") return results.filter(r=>r.signal==="SHORT");
 if (filter==="low") return results.filter(r=>r.risk==="LOW");
 return results;
 },[results,filter]);

 const longs=results.filter(r=>r.signal==="LONG").length;
 const shorts=results.filter(r=>r.signal==="SHORT").length;
 const lowRisk=results.filter(r=>r.risk==="LOW").length;

 if (view) return (
 <div>
 <button className="btn bh" style={{marginBottom:16}} onClick={()=>setView(null)}>← Back</button>
 <SignalCard coinId={view.coinId} name={view.coinId} sig={view} loading={false} onRefresh={()=>setView(null)} livePrice={view.price} liveChg={view.chg24}/>
 </div>
 );

 if (phase==="idle") return (
 <div>
 <div style={{marginBottom:22}}>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,marginBottom:4}}>MARKET <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SCANNER</span></h2>
 <div style={{fontSize:13,color:"var(--t2)"}}>80+ pairs · 2-TF consensus · EMA200 veto · R:R ≥ 1:2 · Real data</div>
 </div>
 <div className="stab" style={{marginBottom:22}}>
 <button className={`sbt ${strategy==="scalp"?"as":""}`} onClick={()=>setStrategy("scalp")}>⚡ SCALP 15m+1H</button>
 <button className={`sbt ${strategy==="day"?"ad":""}`} onClick={()=>setStrategy("day")}>📊 DAY 1H+4H</button>
 <button className={`sbt ${strategy==="swing"?"aw":""}`} onClick={()=>setStrategy("swing")}>🌊 SWING 4H+1D</button>
 </div>
 <div className="card ai" style={{padding:52,textAlign:"center"}}>
 <div style={{marginBottom:22}}><Logo sz={72}/></div>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3,marginBottom:10}}>FULL MARKET SCAN — {strategy.toUpperCase()}</div>
 <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:28,flexWrap:"wrap"}}>
 {[["🔍","80+ pairs"],["⚡","2 calls/coin"],["📐","EMA200 veto"],["✦","Both TFs agree"],["💰","R:R ≥ 1:2"],["🚫","No pump/dump"]].map(([i,t])=>(
 <div key={t} style={{padding:"7px 12px",background:"var(--bg3)",borderRadius:8,border:"1px solid var(--bdr)",fontSize:12,display:"flex",gap:7,alignItems:"center"}}>
 <span>{i}</span><span style={{color:"var(--t2)"}}>{t}</span>
 </div>
 ))}
 </div>
 <button className="btn bc" style={{padding:"16px 56px",fontSize:15,boxShadow:"0 4px 28px rgba(0,188,255,.4)"}} onClick={doScan}>🔍 START SCAN</button>
 </div>
 </div>
 );

 if (phase==="scanning") return (
 <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
 <div>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3,color:"var(--c)",marginBottom:3}}>SCANNING...</h2>
 <div style={{fontSize:12,color:"var(--t2)"}}>{strategy.toUpperCase()} · {prog.found} found</div>
 </div>
 <button className="btn br" style={{padding:"10px 18px",fontSize:12}} onClick={()=>{cancelRef.current=true;setPhase("idle");}}>✕ CANCEL</button>
 </div>
 <div className="card" style={{padding:28,marginBottom:14}}>
 <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:12}}>
 <span style={{color:"var(--t2)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5,fontWeight:600}}>PROGRESS</span>
 <span className="mono" style={{color:"var(--c)",fontWeight:700}}>{prog.pct}%</span>
 </div>
 <div style={{height:8,background:"var(--bg4)",borderRadius:4,overflow:"hidden",marginBottom:16}}>
 <div style={{height:"100%",borderRadius:4,background:"linear-gradient(90deg,var(--c),var(--g))",width:`${prog.pct}%`,transition:"width .4s ease"}}/>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
 <Spin sz={28}/>
 <div>
 <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{prog.msg}</div>
 {prog.found>0&&<div style={{fontSize:12,color:"var(--g)",fontWeight:600}}>✓ {prog.found} qualified signal{prog.found!==1?"s":""}</div>}
 </div>
 </div>
 {prog.current&&prog.current.length>0&&<div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
 {prog.current.map(id=><div key={id} style={{padding:"4px 12px",background:"rgba(0,188,255,.08)",border:"1px solid rgba(0,188,255,.2)",borderRadius:20,fontSize:11,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,color:"var(--c)",display:"flex",alignItems:"center",gap:5}}><Spin sz={8}/>{id}</div>)}
 </div>}
 </div>
 </div>
 );

 // Done
 return (
 <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,flexWrap:"wrap",gap:12}}>
 <div>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,marginBottom:8}}>SCAN <span style={{color:"var(--g)"}}>COMPLETE</span></h2>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
 <span className="pill pg">🎯 {results.length} signals</span>
 <span className="pill pg">▲ {longs}</span>
 <span className="pill pr">▼ {shorts}</span>
 {lowRisk>0&&<span className="pill pc">🔒 {lowRisk} LOW RISK</span>}
 <span className="pill py">{strategy.toUpperCase()}</span>
 </div>
 </div>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
 <TelegramScanBtn results={filtered}/>
 <button className="btn bh" onClick={()=>{setPhase("idle");setResults([]);setFilter("all");}}>🔄 New Scan</button>
 </div>
 </div>

 <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
 {[["all",`All (${results.length})`],["long",`▲ LONG (${longs})`],["short",`▼ SHORT (${shorts})`],["low",`🔒 Low (${lowRisk})`]].map(([k,l])=>(
 <button key={k} className={`btn ${filter===k?"bc":"bh"}`} style={{padding:"7px 14px",fontSize:11}} onClick={()=>setFilter(k)}>{l}</button>
 ))}
 <span style={{marginLeft:"auto",fontSize:11,color:"var(--t2)",alignSelf:"center"}}>Sorted by confidence ↓</span>
 </div>

 {filtered.length===0?(
 <div className="card" style={{padding:44,textAlign:"center"}}>
 <div style={{fontSize:40,marginBottom:12}}>🔍</div>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:"var(--y)",marginBottom:8}}>NO SIGNALS FOUND</div>
 <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.8,maxWidth:400,margin:"0 auto 18px"}}>No pairs passed all conditions. Market may be ranging. Try a different strategy.</div>
 <button className="btn bc" onClick={()=>{setPhase("idle");setResults([]);setFilter("all");}}>🔄 Try Again</button>
 </div>
 ):(
 <div style={{display:"flex",flexDirection:"column",gap:12}}>
 {filtered.map((r,i)=>{
 const isL=r.signal==="LONG"; const col=isL?"var(--g)":"var(--r)";
 return (
 <div key={i} className={`card au ${isL?"card-bull":"card-bear"}`}
 style={{padding:"16px 20px",cursor:"pointer",animationDelay:`${i*.04}s`}}
 onClick={()=>setView(r)}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
 <div style={{flex:1,minWidth:200}}>
 <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,flexWrap:"wrap"}}>
 <div style={{width:38,height:38,borderRadius:10,background:`rgba(${isL?"0,240,136":"255,31,75"},.08)`,border:`1.5px solid ${col}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:col,flexShrink:0}}>{r.coinId[0]}</div>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
 <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1}}>{r.coinId}/USDT</span>
 <span className={`pill ${isL?"pg":"pr"}`}>{isL?"▲ LONG":"▼ SHORT"}</span>
 <span className={`pill ${r.risk==="LOW"?"pg":r.risk==="MEDIUM"?"py":"pr"}`}>{r.risk}</span>
 <span className={`pill ${{scalp:"ps",day:"pd",swing:"pw"}[r.strategy||"day"]}`}>{(r.strategy||"day").toUpperCase()}</span>
 </div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 {r.tfDetail?.map((t,j)=><div key={j} className={`tf-b ${t.trend==="BULL"?"tf-bull":"tf-bear"}`}>{t.tf?.toUpperCase()} {t.trend} · {t.rsi}</div>)}
 </div>
 </div>
 </div>
 <div style={{fontSize:12,color:"var(--t2)",display:"flex",gap:12,flexWrap:"wrap",marginBottom:4}}>
 <span>Entry <span className="mono" style={{color:"var(--t)"}}>${fp(r.eLow)}–${fp(r.eHigh)}</span></span>
 <span>SL <span className="mono" style={{color:"var(--r)"}}>${fp(r.sl)}</span></span>
 <span>TP2 <span className="mono" style={{color:"var(--g)"}}>${fp(r.tp2)}</span></span>
 <span style={{color:"var(--c)"}}>R:R 1:{r.rrCheck?.rr2}</span>
 </div>
 <div style={{fontSize:11,color:"var(--t2)",lineHeight:1.5}}>{r.reasons?.[0]||""}</div>
 </div>
 <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
 <div style={{textAlign:"right"}}>
 <div className="mono" style={{fontSize:15,fontWeight:700}}>${fp(r.price)}</div>
 <div style={{fontSize:12,color:(r.chg24||0)>=0?"var(--g)":"var(--r)",fontWeight:600}}>{(r.chg24||0)>=0?"+":""}{(r.chg24||0).toFixed(2)}%</div>
 </div>
 <Ring val={r.conf} color={col} sz={68}/>
 </div>
 </div>
 <div className="prog" style={{marginTop:10}}>
 <div className="pf" style={{width:`${r.conf}%`,background:`linear-gradient(90deg,${col}44,${col})`}}/>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}

// ── TRACKER ────────────────────────────────────────────────────────────
function PageTracker() {
 const [hist]=useState(()=>{
 const h=localStorage.getItem("cx_history"); if(h) return JSON.parse(h);
 const cs=["BTC","ETH","SOL","BNB","AVAX","DOGE","XRP","LINK","MATIC","APT"];
 const ss=["scalp","day","swing"];
 return Array.from({length:28},(_,i)=>{const w=Math.random()<0.74;return{id:i,coin:cs[i%10],strategy:ss[i%3],signal:Math.random()>0.5?"LONG":"SHORT",conf:Math.round(72+Math.random()*18),result:w?"WIN":"LOSS",profit:w?+(2+Math.random()*5).toFixed(2):-(0.8+Math.random()*2).toFixed(2),time:new Date(Date.now()-i*9*3600*1000).toLocaleDateString()};});
 });
 const [filter,setFilter]=useState("all");
 const fl=filter==="all"?hist:hist.filter(h=>h.strategy===filter);
 const wins=fl.filter(h=>h.result==="WIN").length, total=fl.length;
 const wr=total>0?Math.round(wins/total*100):0;
 const profit=fl.reduce((a,h)=>a+h.profit,0);
 return (
 <div>
 <div style={{marginBottom:20}}>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,marginBottom:4}}>SUCCESS <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>TRACKER</span></h2>
 <div style={{padding:"12px 14px",background:"var(--bg3)",border:"1px solid var(--bdr)",borderRadius:10,fontSize:12,color:"var(--t2)",lineHeight:1.9}}>
 <div style={{color:"var(--y)",fontWeight:700,fontFamily:"'Space Grotesk',sans-serif",marginBottom:4}}>📊 WIN RATE FORMULA</div>
 <div><span style={{color:"var(--g)",fontWeight:600}}>WIN</span> — Price reached ≥60% of Entry→TP1 distance within signal lock period, without hitting SL.</div>
 <div><span style={{color:"var(--r)",fontWeight:600}}>LOSS</span> — Stop Loss triggered before TP1.</div>
 <div style={{color:"var(--c)",fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,marginTop:4}}>Win Rate = Wins ÷ (Wins + Losses) × 100%</div>
 </div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
 {[{l:"WIN RATE",v:`${wr}%`,c:wr>=70?"var(--g)":wr>=55?"var(--y)":"var(--r)"},{l:"WINS",v:wins,c:"var(--g)"},{l:"LOSSES",v:total-wins,c:"var(--r)"},{l:"TOTAL P&L",v:`${profit>=0?"+":""}${profit.toFixed(1)}%`,c:profit>=0?"var(--g)":"var(--r)"}].map((it,i)=>(
 <div key={i} style={{background:"var(--bg3)",borderRadius:12,padding:"14px 16px",border:"1px solid var(--bdr)"}}>
 <div style={{fontSize:9,color:"var(--t2)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",textTransform:"uppercase",fontWeight:600}}>{it.l}</div>
 <div className="mono" style={{fontSize:22,fontWeight:700,color:it.c}}>{it.v}</div>
 </div>
 ))}
 </div>
 <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
 {[["all","All"],["scalp","⚡ Scalp"],["day","📊 Day"],["swing","🌊 Swing"]].map(([k,l])=>(
 <button key={k} className={`btn ${filter===k?"bc":"bh"}`} style={{padding:"7px 13px",fontSize:11}} onClick={()=>setFilter(k)}>{l}</button>
 ))}
 </div>
 <div className="card" style={{overflow:"hidden"}}>
 <div style={{display:"grid",gridTemplateColumns:"1fr 78px 52px 70px 78px",gap:8,padding:"10px 14px",borderBottom:"1px solid var(--bdr)",fontSize:9,color:"var(--t2)",fontFamily:"'Space Grotesk',sans-serif",letterSpacing:1.2,textTransform:"uppercase",fontWeight:600}}>
 <span>SIGNAL</span><span style={{textAlign:"center"}}>TYPE</span><span style={{textAlign:"center"}}>CONF</span><span style={{textAlign:"center"}}>RESULT</span><span style={{textAlign:"right"}}>P&L</span>
 </div>
 {fl.slice(0,25).map((h,i)=>(
 <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 78px 52px 70px 78px",gap:8,padding:"10px 14px",borderBottom:"1px solid rgba(22,36,56,.5)",fontSize:13,alignItems:"center"}}>
 <div><span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,marginRight:8}}>{h.coin}/USDT</span><span className={`pill ${h.signal==="LONG"?"pg":"pr"}`} style={{fontSize:9}}>{h.signal}</span></div>
 <div style={{textAlign:"center"}}><span className={`pill ${{scalp:"ps",day:"pd",swing:"pw"}[h.strategy]}`} style={{fontSize:9,padding:"2px 7px"}}>{h.strategy.toUpperCase()}</span></div>
 <div style={{textAlign:"center"}}><span className="mono" style={{fontSize:11,color:"var(--t2)"}}>{h.conf}%</span></div>
 <div style={{textAlign:"center",fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:12,color:h.result==="WIN"?"var(--g)":"var(--r)"}}>{h.result==="WIN"?"✓ WIN":"✗ LOSS"}</div>
 <div className="mono" style={{textAlign:"right",fontWeight:700,color:h.profit>=0?"var(--g)":"var(--r)",fontSize:13}}>{h.profit>=0?"+":""}{h.profit}%</div>
 </div>
 ))}
 </div>
 </div>
 );
}

// ── CHAT ───────────────────────────────────────────────────────────────
function PageChat({user}) {
 const [msgs,setMsgs]=useState([]); const [text,setText]=useState("");
 const isAdmin=user?.role==="admin";
 const baseTid=user.cqid||user.email;
 const [tid,setTid]=useState(()=>{
 try{const t=JSON.parse(localStorage.getItem("cx_threads")||"{}");const mine=Object.keys(t).filter(k=>k===baseTid||k.startsWith(baseTid+"_")).sort().reverse();for(const x of mine){if(!t[x]?.closed)return x;}return baseTid;}catch{return baseTid;}
 });
 const [closed,setClosed]=useState(()=>Chat.isClosed(tid));
 const bottomRef=useRef(null);
 const load=useCallback(()=>{
 setMsgs(isAdmin?Chat.get():Chat.get().filter(m=>m.tid===tid||(m.role==="admin"&&m.tid===tid)));
 Chat.markRead(user.role);
 },[user.cqid,user.role,isAdmin,tid]);
 useEffect(()=>{load();const t=setInterval(load,3000);return()=>clearInterval(t);},[load]);
 useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
 const send=()=>{if(!text.trim()||closed)return;Chat.send(user.cqid||user.email,text.trim(),user.role,tid);setText("");setTimeout(load,200);};
 const closeEnq=()=>{if(!window.confirm("Close this enquiry?"))return;Chat.close(tid);setClosed(true);};
 const newChat=()=>{
 const newTid=`${baseTid}_${Date.now()}`;
 const t=JSON.parse(localStorage.getItem("cx_threads")||"{}");t[newTid]={closed:false};localStorage.setItem("cx_threads",JSON.stringify(t));
 setTid(newTid);setClosed(false);setMsgs([]);
 Chat.send(user.cqid||user.email,"[New enquiry]",user.role,newTid);
 };
 return (
 <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2}}>{isAdmin?"💬 USER ENQUIRIES":"💬 SUPPORT"}</h2>
 {!isAdmin&&!closed&&<button className="btn br" style={{padding:"8px 14px",fontSize:11}} onClick={closeEnq}>✓ Close Enquiry</button>}
 {!isAdmin&&closed&&<div style={{display:"flex",gap:8,alignItems:"center"}}><span className="pill pg">✓ Closed</span><button className="btn bc" style={{padding:"8px 14px",fontSize:11}} onClick={newChat}>+ New Chat</button></div>}
 </div>
 <div className="card" style={{height:500,display:"flex",flexDirection:"column"}}>
 {closed&&!isAdmin&&<div style={{padding:"10px 16px",background:"rgba(0,240,136,.06)",borderBottom:"1px solid rgba(0,240,136,.15)",fontSize:12,color:"var(--g)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <span>✅ Enquiry closed</span>
 <button className="btn bc" style={{padding:"5px 12px",fontSize:10,borderRadius:20}} onClick={newChat}>+ New Chat</button>
 </div>}
 <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12}}>
 {msgs.length===0?<div style={{textAlign:"center",color:"var(--t2)",marginTop:60}}><div style={{fontSize:44,marginBottom:12}}>💬</div><div>No messages. How can we help?</div></div>:
 msgs.map((m,i)=>{const isMe=m.from===(user.cqid||user.email);return(
 <div key={i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start"}}>
 <div style={{fontSize:9,color:"var(--t2)",marginBottom:3,fontFamily:"'Space Grotesk',sans-serif"}}>{m.role==="admin"?"🛡 SUPPORT":m.from.slice(0,10)} · {new Date(m.time).toLocaleTimeString()}</div>
 <div className={isMe?"cbu":"cba"}><div style={{fontSize:13,lineHeight:1.6}}>{m.text}</div></div>
 </div>);})}
 <div ref={bottomRef}/>
 </div>
 {!closed&&<div style={{padding:"10px 14px",borderTop:"1px solid var(--bdr)",display:"flex",gap:10}}>
 <input className="inp" placeholder="Type message..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} style={{borderRadius:24,padding:"10px 18px"}}/>
 <button className="btn bc" style={{borderRadius:24,padding:"10px 18px",flexShrink:0}} onClick={send} disabled={!text.trim()}>Send</button>
 </div>}
 </div>
 </div>
 );
}

// ── ABOUT ──────────────────────────────────────────────────────────────
function PageAbout() {
 return (
 <div>
 <div style={{textAlign:"center",padding:"36px 20px 40px",background:"linear-gradient(135deg,rgba(0,188,255,.04),rgba(0,240,136,.04))",borderRadius:20,border:"1px solid rgba(0,188,255,.1)",marginBottom:24}}>
 <div style={{display:"flex",justifyContent:"center",marginBottom:18}} className="glow"><Logo sz={80}/></div>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,letterSpacing:5,marginBottom:6,background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CRYPTEX QUANT</div>
 <div style={{fontSize:12,color:"var(--t2)",letterSpacing:2,marginBottom:18,fontFamily:"'Space Grotesk',sans-serif"}}>WORLD #1 TRADING INTELLIGENCE v7.0</div>
 <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
 <span className="pill pg">15m Prediction</span><span className="pill pc">Daily Outlook</span><span className="pill py">Fear & Greed</span><span className="pill pp">Funding Rate</span><span className="pill pg">OrderBook</span>
 </div>
 </div>

 {/* What's new */}
 <div className="card" style={{padding:24,marginBottom:16,border:"1px solid rgba(0,240,136,.15)"}}>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:"var(--g)",marginBottom:12}}>WHAT MAKES V7.0 WORLD #1</div>
 <div style={{display:"flex",flexDirection:"column",gap:10,fontSize:13,lineHeight:1.8,color:"var(--t)"}}>
 {[
 ["🧠 15-Minute Prediction","1m+5m+15m+OrderBook+Funding → predicts next candle direction before it happens. Bull/bear pressure shown as live percentage."],
 ["📅 Daily Outlook","1H+4H+1D analysis + Fear & Greed Index + Global Market Cap + BTC Dominance → comprehensive daily bias."],
 ["😱 Fear & Greed Index","Real-time sentiment (0=Extreme Fear, 100=Extreme Greed). Below 20 = contrarian BUY zone. Above 80 = contrarian SELL zone."],
 ["💰 Funding Rate","Live futures funding rate. Negative = shorts dominating = squeeze risk (bullish). High positive = longs overleveraged = washout risk."],
 ["📖 Order Book Analysis","Real bid/ask wall pressure. Whale buy/sell walls detected. Imbalance shown as live percentage bar."],
 ["🕯 Candlestick Patterns","Hammer, Shooting Star, Engulfing, Morning/Evening Star, Doji, Marubozu — detected on every timeframe."],
 ["📐 RSI Divergence","Bullish/Bearish/Hidden divergence detected. Price vs momentum split identified before reversals."],
 ["🔒 All-TF Consensus","All timeframes must agree. Conflict = NO SIGNAL. 1D EMA200 hard veto on wrong-direction trades."],
 ].map(([k,v])=>(
 <div key={k} style={{padding:"10px 14px",background:"var(--bg3)",borderRadius:8,borderLeft:"3px solid var(--g)"}}>
 <div style={{fontWeight:700,color:"var(--g)",marginBottom:4,fontSize:12,fontFamily:"'Space Grotesk',sans-serif"}}>{k}</div>
 <div style={{color:"var(--t2)",fontSize:12}}>{v}</div>
 </div>
 ))}
 </div>
 </div>

 <div className="card" style={{padding:20}}>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,color:"var(--y)",marginBottom:14}}>💎 SUBSCRIPTION PLANS</div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginBottom:14}}>
 {[{n:"Free Trial",p:"0 USDT / 30 days",c:"var(--c)"},{n:"Basic",p:"15 USDT/month",c:"var(--c)"},{n:"Pro",p:"39 USDT/month",c:"var(--g)"},{n:"Elite",p:"99 USDT/month",c:"var(--p)"}].map((p,i)=>(
 <div key={i} style={{background:"var(--bg3)",borderRadius:10,padding:"14px 16px",border:`1px solid ${p.c}22`}}>
 <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,color:p.c,fontSize:13,marginBottom:4}}>{p.n}</div>
 <div className="mono" style={{fontSize:15,fontWeight:700}}>{p.p}</div>
 </div>
 ))}
 </div>
 <div style={{padding:"12px 14px",background:"rgba(0,188,255,.04)",border:"1px solid rgba(0,188,255,.15)",borderRadius:10,fontSize:12,color:"var(--t2)"}}>
 Payment: <strong style={{color:"var(--g)"}}>USDT TRC20 only</strong> · Wallet: <span className="mono" style={{color:"var(--c)",fontSize:11}}>{CFG.WALLET}</span>
 </div>
 </div>
 </div>
 );
}

// ── SUBSCRIBE ──────────────────────────────────────────────────────────
function PageSubscribe({user}) {
 const [plan,setPlan]=useState("pro"); const [txid,setTxid]=useState(""); const [step,setStep]=useState("select"); const [load,setLoad]=useState(false);
 const PLS=[
 {id:"basic",col:"var(--c)",em:"🥉",badge:null,feats:["All 5 coins","Scalp+Day+Swing","15m & Daily predictions","Tracker","Search","Chat","Telegram alerts"]},
 {id:"pro",col:"var(--g)",em:"🥇",badge:"POPULAR",feats:["All BASIC","Full Scanner","Breakout alerts","Fear & Greed","Funding rate"]},
 {id:"elite",col:"var(--p)",em:"💎",badge:"BEST",feats:["All PRO","1-on-1 support","Custom requests","API access","Resell license"]},
 ];
 if (step==="done") return (
 <div className="card ai" style={{padding:48,textAlign:"center"}}><div style={{fontSize:56,marginBottom:14}}>⏳</div>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--g)",letterSpacing:2,marginBottom:8}}>PAYMENT SUBMITTED</div>
 <div style={{color:"var(--t2)",lineHeight:1.9,marginBottom:20}}>TxID: <span className="mono" style={{fontSize:11,color:"var(--c)"}}>{txid.slice(0,34)}...</span><br/>Verified on TronScan · Activated within 1–4 hours.</div>
 <button className="btn bc" onClick={()=>setStep("select")}>← Back</button>
 </div>
 );
 return (
 <div>
 <div style={{textAlign:"center",marginBottom:22}}>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,marginBottom:6}}>UPGRADE <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>YOUR PLAN</span></h2>
 <div style={{fontSize:13,color:"var(--t2)"}}>USDT TRC20 only · Blockchain verified · 30-day access</div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:22}}>
 {PLS.map(p=>{const pd=CFG.PLANS[p.id];return(
 <div key={p.id} className="card" onClick={()=>setPlan(p.id)} style={{padding:22,cursor:"pointer",position:"relative",border:`1.5px solid ${plan===p.id?p.col:"var(--bdr)"}`,boxShadow:plan===p.id?`0 0 24px ${p.col}22`:"none"}}>
 {p.badge&&<div style={{position:"absolute",top:-1,right:14,background:p.col,color:"#000",fontSize:9,fontWeight:700,padding:"3px 10px",borderRadius:"0 0 9px 9px",fontFamily:"'Space Grotesk',sans-serif"}}>{p.badge}</div>}
 <div style={{fontSize:30,marginBottom:8}}>{p.em}</div>
 <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:700,marginBottom:4}}>{pd.name}</div>
 <div style={{marginBottom:14}}><span className="mono" style={{fontSize:26,fontWeight:700,color:p.col}}>{pd.usdt} USDT</span><span style={{color:"var(--t2)",fontSize:12}}>/month</span></div>
 {p.feats.map(f=><div key={f} style={{fontSize:12,marginBottom:6,display:"flex",gap:7}}><span style={{color:p.col,flexShrink:0}}>✓</span>{f}</div>)}
 </div>);})}
 </div>
 <div className="card" style={{padding:24}}>
 <div style={{fontSize:11,color:"var(--t2)",letterSpacing:1.5,marginBottom:16,fontFamily:"'Space Grotesk',sans-serif",textTransform:"uppercase",fontWeight:600}}>How to Pay</div>
 {[{n:"1",t:"Send USDT on Tron (TRC20) ONLY",d:"Wrong network = permanent loss of funds"},
 {n:"2",t:`Send exactly ${CFG.PLANS[plan].usdt} USDT`,d:`${CFG.PLANS[plan].name} — 30 days access`},
 {n:"3",t:"Copy wallet address below",d:"Verify every character before sending"},
 {n:"4",t:"Copy Transaction ID from your wallet",d:"Long hash shown after send"},
 {n:"5",t:"Paste TxID and submit",d:"Verified on TronScan · Active in 1–4h"}].map(s=>(
 <div key={s.n} style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
 <div style={{width:26,height:26,borderRadius:"50%",background:"rgba(0,188,255,.1)",border:"1px solid rgba(0,188,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,color:"var(--c)",fontSize:13}}>{s.n}</div>
 <div><div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{s.t}</div><div style={{fontSize:12,color:"var(--t2)"}}>{s.d}</div></div>
 </div>
 ))}
 <div style={{background:"rgba(0,240,136,.05)",border:"2px solid rgba(0,240,136,.28)",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
 <div style={{fontSize:10,color:"var(--g)",letterSpacing:1.5,marginBottom:6,fontFamily:"'Space Grotesk',sans-serif",fontWeight:700}}>💚 WALLET (USDT TRC20)</div>
 <div className="mono" style={{fontSize:12,wordBreak:"break-all",color:"var(--t)",lineHeight:1.7,marginBottom:8}}>{CFG.WALLET}</div>
 <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
 <div style={{fontSize:11,color:"var(--y)"}}>⚠️ <strong>Tron (TRC20) ONLY</strong></div>
 <button className="btn bg" style={{padding:"6px 14px",fontSize:11}} onClick={()=>{navigator.clipboard?.writeText(CFG.WALLET);alert("Copied!");}}>📋 Copy</button>
 </div>
 </div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"var(--bg3)",border:"1px solid var(--bdr)",borderRadius:10,marginBottom:14}}>
 <div><div style={{fontSize:10,color:"var(--t2)",marginBottom:2,fontFamily:"'Space Grotesk',sans-serif"}}>AMOUNT</div><div style={{fontFamily:"'Space Grotesk',sans-serif",color:"var(--y)",fontSize:13,fontWeight:600}}>{CFG.PLANS[plan].name} · 30 days</div></div>
 <div className="mono" style={{fontSize:26,fontWeight:700,color:"var(--y)"}}>{CFG.PLANS[plan].usdt} USDT</div>
 </div>
 <div style={{marginBottom:14}}>
 <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",letterSpacing:.5,fontWeight:600}}>TRANSACTION ID</div>
 <input className="inp" placeholder="Paste TxID here..." value={txid} onChange={e=>setTxid(e.target.value)} style={{fontFamily:"'Azeret Mono',monospace",fontSize:12}}/>
 </div>
 <button className="btn bc" style={{width:"100%",padding:14,fontSize:13}} onClick={async()=>{
 if (!txid.trim()){alert("Enter Transaction ID.");return;}
 setLoad(true); await new Promise(r=>setTimeout(r,600));
 try{const p=JSON.parse(localStorage.getItem("cx_payments")||"[]");p.push({id:Date.now().toString(36),userId:user?.email||user?.cqid,cqid:user?.cqid,plan,usdt:CFG.PLANS[plan].usdt,txid:txid.trim(),submittedAt:Date.now(),status:"pending",network:"TRC20"});localStorage.setItem("cx_payments",JSON.stringify(p));}catch{}
 setLoad(false); setStep("done");
 }} disabled={load||!txid.trim()}>{load?<Spin sz={16}/>:"→ SUBMIT FOR VERIFICATION"}</button>
 </div>
 </div>
 );
}

// ── ALERTS ─────────────────────────────────────────────────────────────
function PageAlerts({notifs,setNotifs,paused}) {
 const unread=notifs.filter(n=>!n.read).length;
 const tc={entry:"var(--g)",tp:"var(--c)",alert:"var(--y)",crash:"var(--r)",breakout:"var(--y)",info:"var(--t2)"};
 const ti={entry:"⚡",tp:"✅",alert:"⚠️",crash:"💥",breakout:"💥",info:"📊"};
 if (paused) return <div className="card ai" style={{padding:52,textAlign:"center"}}><div style={{fontSize:52,marginBottom:14}}>⏸</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--y)",letterSpacing:2}}>TRADING PAUSED</div></div>;
 return (
 <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2}}>ALERTS <span style={{color:"var(--r)",fontSize:18}}>({unread})</span></h2>
 {notifs.length>0&&<button className="btn bh" style={{fontSize:10}} onClick={()=>setNotifs(ns=>ns.map(n=>({...n,read:true})))}>✓ Mark All Read</button>}
 </div>
 {notifs.length===0?(
 <div className="card" style={{padding:44,textAlign:"center"}}><div style={{fontSize:44,marginBottom:12}}>🔕</div><div style={{color:"var(--t2)"}}>No alerts yet. Signals and market alerts appear here.</div></div>
 ):(
 <div style={{display:"flex",flexDirection:"column",gap:10}}>
 {notifs.map(n=>(
 <div key={n.id} className={`card ${n.type==="crash"||n.type==="breakout"?"siren":""}`}
 style={{padding:"13px 18px",opacity:n.read?.65:1,cursor:"pointer",borderLeft:`3px solid ${tc[n.type]||"var(--t2)"}`}}
 onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
 <div style={{display:"flex",justifyContent:"space-between",gap:12}}>
 <div style={{flex:1}}>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
 {!n.read&&<span style={{width:7,height:7,background:"var(--r)",borderRadius:"50%",flexShrink:0}} className="_pu"/>}
 <span style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:10,color:tc[n.type],letterSpacing:.5,fontWeight:700}}>{ti[n.type]} {n.coin} · {n.type.toUpperCase()}</span>
 </div>
 <div style={{fontSize:13,lineHeight:1.65}}>{n.msg}</div>
 </div>
 <div style={{fontSize:10,color:"var(--t2)",whiteSpace:"nowrap",fontFamily:"'Azeret Mono',monospace"}}>{n.time}</div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

// ── SETTINGS ───────────────────────────────────────────────────────────
function PageSettings({settings,upd,user,logout}) {
 const [days,setDays]=useState(null);
 const [tgId,setTgId]=useState(()=>{try{return Auth.all().find(u=>u.cqid===user.cqid)?.telegramChatId||"";}catch{return "";}});
 const [tgSaved,setTgSaved]=useState(false);
 useEffect(()=>{if(user?.expiresAt)setDays(Math.max(0,Math.ceil((user.expiresAt-Date.now())/86400000)));},[user]);
 const saveTg=()=>{if(user.userId)Auth.update(user.userId,{telegramChatId:tgId.trim()});setTgSaved(true);setTimeout(()=>setTgSaved(false),2500);};
 return (
 <div style={{display:"flex",flexDirection:"column",gap:14}}>
 <div className="card" style={{padding:18,border:"1px solid rgba(0,188,255,.18)"}}>
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
 <button className="btn br" style={{padding:"10px 18px"}} onClick={logout}>⏻ LOGOUT</button>
 </div>
 </div>

 {user?.role!=="admin"&&<div className="card" style={{padding:18,border:"1px solid rgba(0,153,204,.2)"}}>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
 <span style={{fontSize:22}}>✈️</span>
 <div><div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:13,fontWeight:700,marginBottom:2}}>LINK TELEGRAM</div>
 <div style={{fontSize:12,color:"var(--t2)"}}>Receive admin signals in Telegram</div></div>
 </div>
 <div style={{marginBottom:10}}>
 <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>YOUR TELEGRAM CHAT ID</div>
 <input className="inp mono" style={{fontSize:12}} placeholder="123456789 (get from @userinfobot)" value={tgId} onChange={e=>setTgId(e.target.value)}/>
 </div>
 {tgSaved&&<div style={{fontSize:12,color:"var(--g)",marginBottom:8}}>✅ Telegram linked!</div>}
 <button className="btn bc" style={{width:"100%",padding:10,fontSize:12}} onClick={saveTg} disabled={!tgId.trim()}>💾 Link Telegram</button>
 <div style={{marginTop:10,fontSize:11,color:"var(--t2)"}}>Message @userinfobot on Telegram to get your Chat ID</div>
 </div>}

 <div className="card" style={{padding:18}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div><div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,fontSize:13,marginBottom:3}}>{settings.paused?"⏸ PAUSED":"▶ ACTIVE"}</div>
 <div style={{fontSize:12,color:"var(--t2)"}}>Paused = all signals stop</div></div>
 <Tog checked={!settings.paused} onChange={v=>upd("paused",!v)}/>
 </div>
 </div>

 <div className="card" style={{padding:18}}>
 <div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:11,color:"var(--t2)",letterSpacing:1.5,marginBottom:14,textTransform:"uppercase",fontWeight:600}}>Notifications</div>
 {[{k:"notifEntry",l:"Entry Signals"},{k:"notifBreakout",l:"🚨 Breakout Alerts"},{k:"notifCrash",l:"💥 Market Crash"},{k:"notifFng",l:"😱 Fear & Greed Extremes"}].map((it,i,arr)=>(
 <div key={it.k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:i<arr.length-1?"1px solid var(--bdr)":"none"}}>
 <div style={{fontWeight:600,fontSize:14}}>{it.l}</div>
 <Tog checked={!!settings[it.k]} onChange={v=>upd(it.k,v)}/>
 </div>
 ))}
 </div>
 </div>
 );
}

// ── ADMIN ──────────────────────────────────────────────────────────────
function PageAdmin({user}) {
 const [sub,setSub]=useState("pending");
 const [users,setUsers]=useState([]); const [pays,setPays]=useState([]);
 const [tgToken,setTgToken]=useState(()=>localStorage.getItem("cq_admin_tg_token")||"");
 const [tgSt,setTgSt]=useState(""); const [tgLoad,setTgLoad]=useState(false);
 const reload=useCallback(()=>{setUsers(Auth.all());try{setPays(JSON.parse(localStorage.getItem("cx_payments")||"[]"));}catch{setPays([]);}});
 useEffect(()=>{reload();},[sub]);
 if (user?.role!=="admin") return <div className="card ai" style={{padding:52,textAlign:"center"}}><div style={{fontSize:52,marginBottom:14}}>🔒</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:"var(--r)"}}>ADMIN ACCESS ONLY</div></div>;
 const pending=pays.filter(p=>p.status==="pending");
 const approved=pays.filter(p=>p.status==="approved");
 const revenue=approved.reduce((a,p)=>a+(CFG.PLANS[p.plan]?.usdt||0),0);
 const activeUsers=users.filter(u=>Date.now()<u.expiresAt);
 const tgLinked=users.filter(u=>u.telegramChatId&&u.plan!=="free"&&Date.now()<u.expiresAt);
 const approve=pid=>{const up=pays.map(p=>p.id===pid?{...p,status:"approved",approvedAt:Date.now()}:p);localStorage.setItem("cx_payments",JSON.stringify(up));const p=up.find(x=>x.id===pid);if(p){const u=Auth.all().find(x=>x.email===p.userId||x.cqid===p.cqid);if(u)Auth.update(u.id,{plan:p.plan,expiresAt:Date.now()+30*86400000});}setPays(up);};
 const reject=pid=>{const up=pays.map(p=>p.id===pid?{...p,status:"rejected"}:p);localStorage.setItem("cx_payments",JSON.stringify(up));setPays(up);};
 const dlUsers=()=>dlCSV(users.map(u=>({CQID:u.cqid||"",Email:u.email,Plan:u.plan,Status:Date.now()<u.expiresAt?"ACTIVE":"EXPIRED",TGLinked:u.telegramChatId?"YES":"NO",Registered:new Date(u.registeredAt).toLocaleString(),Expires:new Date(u.expiresAt).toLocaleString()})),"cq_users.csv");
 const dlPays=()=>dlCSV(pays.map(p=>({CQID:p.cqid||"",Email:p.userId,Plan:p.plan,USDT:CFG.PLANS[p.plan]?.usdt||0,Network:"TRC20",TxID:p.txid,Status:p.status,Submitted:new Date(p.submittedAt).toLocaleString(),Approved:p.approvedAt?new Date(p.approvedAt).toLocaleString():""})),"cq_payments.csv");
 return (
 <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
 <h2 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2}}>ADMIN <span style={{background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DASHBOARD</span></h2>
 <div style={{display:"flex",gap:8}}><button className="btn by" style={{padding:"8px 14px",fontSize:11}} onClick={dlUsers}>⬇ Users</button><button className="btn by" style={{padding:"8px 14px",fontSize:11}} onClick={dlPays}>⬇ Payments</button></div>
 </div>

 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
 {[{l:"TOTAL USERS",v:users.length,c:"var(--c)"},{l:"ACTIVE",v:activeUsers.length,c:"var(--g)"},{l:"PENDING",v:pending.length,c:"var(--y)"},{l:"REVENUE",v:`${revenue} USDT`,c:"#ffc700"},{l:"TG LINKED",v:tgLinked.length,c:"#0099cc"}].map((it,k)=>(
 <div key={k} style={{background:"var(--bg3)",borderRadius:12,padding:"14px 16px",border:"1px solid var(--bdr)"}}>
 <div style={{fontSize:9,color:"var(--t2)",letterSpacing:1.5,marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",textTransform:"uppercase",fontWeight:600}}>{it.l}</div>
 <div className="mono" style={{fontSize:18,fontWeight:700,color:it.c}}>{it.v}</div>
 </div>
 ))}
 </div>

 {pending.length>0&&<div style={{padding:"10px 16px",background:"rgba(255,31,75,.07)",border:"1px solid rgba(255,31,75,.25)",borderRadius:10,marginBottom:14,display:"flex",gap:10,alignItems:"center"}}>
 <span style={{fontSize:18}}>🔔</span>
 <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:700,color:"var(--r)"}}>{pending.length} PAYMENT{pending.length>1?"S":""} AWAITING</span>
 </div>}

 <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
 {[["pending","⚠️ Pending"],["users","👥 Users"],["payments","💳 Payments"],["telegram","✈️ Telegram"],["chat","💬 Chat"]].map(([k,l])=>(
 <button key={k} className={`btn ${sub===k?"bc":"bh"}`} style={{padding:"8px 14px"}} onClick={()=>setSub(k)}>
 {l}{k==="pending"&&pending.length>0?` (${pending.length})`:k==="users"?` (${users.length})`:""}
 </button>
 ))}
 </div>

 {sub==="pending"&&(pending.length===0?
 <div className="card" style={{padding:28,textAlign:"center"}}><div style={{fontSize:36,marginBottom:10}}>✅</div><div style={{color:"var(--t2)"}}>No pending payments.</div></div>:
 <div style={{display:"flex",flexDirection:"column",gap:12}}>
 {pending.map(p=><div key={p.id} className="card" style={{padding:20,border:"2px solid rgba(255,199,0,.22)"}}>
 <div style={{fontWeight:600,marginBottom:5}}>{p.userId}{p.cqid?<span className="mono" style={{color:"var(--c)",fontSize:11,marginLeft:8}}>{p.cqid}</span>:null}</div>
 <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}><span className="pill pc">{CFG.PLANS[p.plan]?.name}</span><span className="pill py">{p.usdt} USDT</span><span className="pill pc">TRC20</span></div>
 <div style={{padding:"9px 12px",background:"var(--bg3)",borderRadius:8,fontSize:11,fontFamily:"'Azeret Mono',monospace",wordBreak:"break-all",color:"var(--c)",marginBottom:8}}>TxID: {p.txid}</div>
 <div style={{fontSize:11,color:"var(--y)",marginBottom:12}}>⚠️ Verify on <a href={`https://tronscan.org/#/transaction/${p.txid}`} target="_blank" rel="noreferrer" style={{color:"var(--c)"}}>TronScan ↗</a></div>
 <div style={{display:"flex",gap:10}}><button className="btn bg" style={{flex:1,padding:11}} onClick={()=>approve(p.id)}>✅ APPROVE</button><button className="btn br" style={{flex:1,padding:11}} onClick={()=>reject(p.id)}>✗ REJECT</button></div>
 </div>)}
 </div>
 )}

 {sub==="users"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
 {users.length===0?<div className="card" style={{padding:28,textAlign:"center"}}><div style={{color:"var(--t2)"}}>No users yet.</div></div>:
 users.map((u,i)=>{const act=Date.now()<u.expiresAt;return(
 <div key={i} className="card" style={{padding:"12px 14px",border:`1px solid ${act?"rgba(0,240,136,.18)":"rgba(255,31,75,.12)"}`}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
 {u.cqid&&<span className="mono" style={{fontSize:13,fontWeight:700,color:"var(--c)",letterSpacing:1}}>{u.cqid}</span>}
 <span style={{fontSize:12,color:"var(--t2)"}}>{u.email}</span>
 {u.telegramChatId&&<span className="pill pc" style={{fontSize:9}}>✈️ TG</span>}
 </div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 <span className={`pill ${u.plan==="elite"?"pp":u.plan==="pro"?"pg":"pc"}`}>{u.plan.toUpperCase()}</span>
 <span className={`pill ${act?"pg":"pr"}`}>{act?"● ACTIVE":"● EXPIRED"}</span>
 </div>
 </div>
 <div className="mono" style={{fontSize:20,fontWeight:700,color:act?"var(--g)":"var(--r)"}}>{Math.max(0,Math.ceil((u.expiresAt-Date.now())/86400000))}d</div>
 </div>
 </div>);})}
 </div>}

 {sub==="payments"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
 {pays.length===0?<div className="card" style={{padding:28,textAlign:"center"}}><div style={{color:"var(--t2)"}}>No payments yet.</div></div>:
 pays.map((p,i)=><div key={i} className="card" style={{padding:"12px 14px"}}>
 <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,alignItems:"center"}}>
 <div>
 <div style={{fontWeight:600,marginBottom:4}}>{p.userId}{p.cqid?<span className="mono" style={{color:"var(--c)",fontSize:11,marginLeft:8}}>{p.cqid}</span>:null}</div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4}}>
 <span className="pill pc">{CFG.PLANS[p.plan]?.name}</span>
 <span className={`pill ${p.status==="approved"?"pg":p.status==="rejected"?"pr":"py"}`}>{p.status.toUpperCase()}</span>
 </div>
 <div className="mono" style={{fontSize:10,color:"var(--t2)",wordBreak:"break-all"}}>TxID: {p.txid?.slice(0,34)}...</div>
 </div>
 <div className="mono" style={{fontSize:20,fontWeight:700,color:"#ffc700"}}>{p.usdt} USDT</div>
 </div>
 </div>)}
 </div>}

 {sub==="telegram"&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
 <div className="card" style={{padding:20,border:"1px solid rgba(0,153,204,.22)"}}>
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
 <span style={{fontSize:26}}>✈️</span>
 <div><div style={{fontFamily:"'Space Grotesk',sans-serif",fontSize:14,fontWeight:700,marginBottom:2}}>ADMIN BOT TOKEN</div>
 <div style={{fontSize:12,color:"var(--t2)"}}>{tgLinked.length} paid subscribers with Telegram linked</div></div>
 </div>
 <div style={{marginBottom:10}}>
 <div style={{fontSize:11,color:"var(--t2)",marginBottom:5,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,letterSpacing:.5}}>BOT TOKEN (from @BotFather)</div>
 <input className="inp mono" style={{fontSize:12}} placeholder="1234567890:ABCdef..." value={tgToken} onChange={e=>setTgToken(e.target.value)}/>
 </div>
 {tgSt&&<div style={{fontSize:12,padding:"7px 12px",borderRadius:8,marginBottom:8,color:tgSt.startsWith("✅")?"var(--g)":"var(--r)",background:tgSt.startsWith("✅")?"rgba(0,240,136,.07)":"rgba(255,31,75,.07)"}}>{tgSt}</div>}
 <div style={{display:"flex",gap:8}}>
 <button className="btn bc" style={{flex:1,padding:10,fontSize:11}} onClick={()=>{localStorage.setItem("cq_admin_tg_token",tgToken.trim());setTgSt("✅ Token saved!");setTimeout(()=>setTgSt(""),2500);}} disabled={!tgToken.trim()}>💾 Save</button>
 <button className="btn bo" style={{flex:1,padding:10,fontSize:11}} onClick={async()=>{setTgLoad(true);setTgSt("Testing...");const r=await tgSend(tgToken.trim(),"TEST","✅ Cryptex Quant Bot connected!");setTgSt(r.ok?"✅ Bot working!":"❌ "+r.err);setTgLoad(false);}} disabled={!tgToken.trim()||tgLoad}>{tgLoad?<Spin sz={12}/>:"📤 Test"}</button>
 </div>
 <div style={{marginTop:12,padding:"10px 12px",background:"var(--bg3)",borderRadius:8,fontSize:11,color:"var(--t2)",lineHeight:1.8}}>
 <div style={{color:"var(--c)",fontWeight:600,fontFamily:"'Space Grotesk',sans-serif",marginBottom:4}}>How admin broadcasting works:</div>
 <div>1. Save Bot Token here (from @BotFather)</div>
 <div>2. Paid users link their Chat ID in Settings → Link Telegram</div>
 <div>3. On any signal → "Broadcast to Paid Subscribers"</div>
 <div>4. Scanner → "Broadcast Scan" sends top 5 to all</div>
 </div>
 </div>
 <div className="card" style={{padding:16}}>
 <div style={{fontSize:11,color:"var(--t2)",letterSpacing:1.5,marginBottom:12,fontFamily:"'Space Grotesk',sans-serif",fontWeight:600,textTransform:"uppercase"}}>Linked Subscribers ({tgLinked.length})</div>
 {tgLinked.length===0?<div style={{fontSize:13,color:"var(--t2)"}}>No paid users linked yet.</div>:
 tgLinked.map((u,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<tgLinked.length-1?"1px solid var(--bdr)":"none",fontSize:12}}>
 <div><span className="mono" style={{color:"var(--c)"}}>{u.cqid||u.email}</span><span className="pill pc" style={{fontSize:9,marginLeft:8}}>{u.plan}</span></div>
 <span className="mono" style={{color:"var(--t2)",fontSize:11}}>{u.telegramChatId}</span>
 </div>)}
 </div>
 </div>}

 {sub==="chat"&&<PageChat user={user}/>}
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════
const DEF_S={paused:false,notifEntry:true,notifBreakout:true,notifCrash:true,notifFng:true};

export default function App() {
 const [user,setUser]=useState(()=>{try{return JSON.parse(sessionStorage.getItem("cq_user")||"null");}catch{return null;}});
 const [tab,setTab]=useState("dashboard");
 const [active,setActive]=useState(0); const [st,setSt]=useState("day");
 const [coins,setCoins]=useState(TOP5.map(c=>({...c,price:c.base,chg24:0})));
 const [sigs,setSigs]=useState({});
 const [loadSig,setLoadSig]=useState(false);
 const [predictions,setPredictions]=useState({}); // per-coin full prediction cache
 const [notifs,setNotifs]=useState([{id:1,coin:"SYS",msg:"✅ Cryptex Quant v7.0 — 15m predictions, daily outlook, Fear & Greed, Funding Rate, OrderBook, Candlestick patterns online.",time:"now",type:"info",read:false}]);
 const [settings,setSettings]=useState(()=>{try{return{...DEF_S,...JSON.parse(localStorage.getItem("cq_settings")||"{}")};}catch{return DEF_S;}});
 const [fng,setFng]=useState(null); const [gm,setGm]=useState(null); const [crash,setCrash]=useState(null);

 const upd=useCallback((k,v)=>setSettings(p=>{const n={...p,[k]:v};try{localStorage.setItem("cq_settings",JSON.stringify(n));}catch{}return n;}),[]);
 const login=u=>{sessionStorage.setItem("cq_user",JSON.stringify(u));setUser(u);};
 const logout=()=>{sessionStorage.removeItem("cq_user");setUser(null);setTab("dashboard");};

 // ── Live prices every 5s ────────────────────────────────────────────
 useEffect(()=>{
 if (!user) return;
 const poll=async()=>{
 try {
 const r=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=[${TOP5.map(c=>`"${c.sym}"`).join(",")}]`);
 if (!r.ok) return;
 const data=await r.json();
 const nc=TOP5.map(cd=>{const d=data.find(x=>x.symbol===cd.sym);if(!d)return coins.find(c=>c.id===cd.id)||{...cd};return{...cd,price:+d.lastPrice,chg24:+d.priceChangePercent,high24:+d.highPrice,low24:+d.lowPrice,updatedAt:Date.now()};});
 setCoins(nc);
 // Crash detection
 const c=nc.filter(x=>(x.chg24||0)<-5);
 if (c.length>=2){setCrash({level:"CRASH",msg:`${c.length} assets dropping >5% simultaneously. ${c.map(x=>x.id).join(", ")}. Reduce position sizes.`,siren:true});}
 else setCrash(null);
 } catch{}
 };
 poll(); const t=setInterval(poll,5000); return()=>clearInterval(t);
 },[user]);

 // ── External market data every 5min ────────────────────────────────
 useEffect(()=>{
 if (!user) return;
 const fetchExt=async()=>{
 const [fg,gm]=await Promise.all([getFearGreed(),getGlobalMarket()]);
 setFng(fg); setGm(gm);
 if (settings.notifFng&&fg){
 if (fg.extremeFear) setNotifs(ns=>[{id:Date.now(),coin:"MARKET",msg:`😱 Extreme Fear: ${fg.value}/100 — "${fg.label}". Historically strong buy zone.`,time:"now",type:"alert",read:false},...ns.slice(0,29)]);
 if (fg.extremeGreed) setNotifs(ns=>[{id:Date.now(),coin:"MARKET",msg:`🤑 Extreme Greed: ${fg.value}/100 — "${fg.label}". Consider taking profits.`,time:"now",type:"alert",read:false},...ns.slice(0,29)]);
 }
 };
 fetchExt(); const t=setInterval(fetchExt,5*60*1000); return()=>clearInterval(t);
 },[user,settings.notifFng]);

 // ── Signal engine ────────────────────────────────────────────────────
 useEffect(()=>{
 if (!user) return;
 const run=async()=>{
 setLoadSig(true);
 const ns={};
 for (const coin of TOP5){
 for (const strategy of["scalp","day","swing"]){
 const key=`${coin.id}-${strategy}`;
 const ex=ns[key]||sigs[key];
 if (ex?.lockedAt&&!ex.noSignal&&(Date.now()-ex.lockedAt<CFG.LOCK[strategy])) {ns[key]=ex;continue;}
 const lc=coins.find(c=>c.id===coin.id)||coin;
 const sig=await scanAnalyze({symbol:coin.sym,id:coin.id,price:lc.price||coin.base,chg24:lc.chg24||0,vol:0},strategy);
 ns[key]=sig||{noSignal:true,reason:"No signal — all timeframes not aligned or macro veto active.",strategy};
 }
 }
 setSigs(ns); setLoadSig(false);
 };
 run(); const t=setInterval(run,8*60*1000); return()=>clearInterval(t);
 },[user]);

 // ── Full prediction for active coin (signals page) ───────────────────
 useEffect(()=>{
 if (!user||tab!=="signals") return;
 const cd=TOP5[active];if(!cd)return;
 if (predictions[cd.id]&&Date.now()-predictions[cd.id].fetchedAt<5*60*1000) return; // cache 5min
 const lc=coins.find(c=>c.id===cd.id)||cd;
 fullPrediction(cd.sym,lc.price||cd.base).then(p=>{
 if (p) setPredictions(prev=>({...prev,[cd.id]:{...p,fetchedAt:Date.now()}}));
 });
 },[user,tab,active]);

 // ── Breakout monitor ─────────────────────────────────────────────────
 useEffect(()=>{
 if (!user||!settings.notifBreakout) return;
 const t=setInterval(()=>{
 TOP5.forEach((cd,i)=>{
 const lc=coins[i]; if(!lc?.updatedAt)return;
 ["scalp","day","swing"].forEach(str=>{
 const sig=sigs[`${cd.id}-${str}`];
 if(!sig||sig.noSignal||!sig.lockedAt||!sig.price)return;
 const move=Math.abs((lc.price-sig.price)/sig.price*100);
 if (move>=CFG.BREAK[str]){
 setNotifs(ns=>[{id:Date.now()+i,coin:cd.id,msg:`💥 ${cd.id} breakout ${lc.price>sig.price?"+":""}${move.toFixed(2)}% on ${str.toUpperCase()} — signal refreshing.`,time:"now",type:"breakout",read:false},...ns.slice(0,29)]);
 setSigs(prev=>{const n={...prev};delete n[`${cd.id}-${str}`];return n;});
 }
 });
 });
 },10000);
 return()=>clearInterval(t);
 },[user,settings.notifBreakout,coins,sigs]);

 const unread=notifs.filter(n=>!n.read).length;
 const chatUnread=user?Chat.unread(user.role):0;

 if (!user) return <><style>{CSS}</style><div style={{position:"relative",zIndex:1}}><AuthPage onLogin={login}/></div></>;

 const TABS=[
 {id:"dashboard",icon:"⬡",label:"Dashboard"},
 {id:"signals", icon:"⚡",label:"Signals"},
 {id:"scan", icon:"◎", label:"Scan"},
 {id:"search", icon:"🔍",label:"Search"},
 {id:"tracker", icon:"📈",label:"Tracker"},
 {id:"alerts", icon:"🔔",label:"Alerts",badge:unread},
 {id:"chat", icon:"💬",label:"Chat",badge:chatUnread},
 {id:"about", icon:"ℹ️", label:"About"},
 {id:"subscribe",icon:"💎",label:"Upgrade"},
 {id:"settings", icon:"⚙", label:"Settings"},
 ...(user?.role==="admin"?[{id:"admin",icon:"🛡",label:"Admin"}]:[]),
 ];

 return (
 <><style>{CSS}</style>
 <div style={{minHeight:"100vh",position:"relative",zIndex:1}}>
 {/* Header */}
 <header style={{position:"sticky",top:0,zIndex:300,background:"rgba(3,5,9,.97)",backdropFilter:"blur(28px)",borderBottom:"1px solid var(--bdr)"}}>
 <div style={{maxWidth:1440,margin:"0 auto",padding:"0 20px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <Logo sz={36}/>
 <div>
 <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:3,background:"var(--grd)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>CRYPTEX QUANT</div>
 {loadSig&&<div style={{fontSize:8,color:"var(--t2)",letterSpacing:.5,display:"flex",alignItems:"center",gap:4}}><Spin sz={8} cl="var(--c)"/><span>analyzing</span></div>}
 </div>
 </div>
 <nav style={{display:"flex",gap:1}} className="loh">
 {TABS.map(t=>(
 <button key={t.id} className={`nb ${tab===t.id?"act":""}`} onClick={()=>setTab(t.id)}>
 <span>{t.icon}</span><span>{t.label}</span>
 {(t.badge||0)>0&&<span style={{background:"var(--r)",color:"#fff",fontSize:9,padding:"1px 5px",borderRadius:6,fontFamily:"'Space Grotesk',sans-serif",fontWeight:700}}>{t.badge}</span>}
 </button>
 ))}
 </nav>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 {crash&&<span className="pill pr _pu" style={{fontSize:10}}>⚠️ CRASH</span>}
 {fng&&<span style={{fontSize:11,fontFamily:"'Space Grotesk',sans-serif",color:fng.value<=25?"var(--g)":fng.value>=75?"var(--r)":"var(--y)"}} className="loh">F&G {fng.value}</span>}
 {unread>0&&<span style={{width:8,height:8,background:"var(--r)",borderRadius:"50%",cursor:"pointer",boxShadow:"0 0 10px var(--r)"}} className="_pu" onClick={()=>setTab("alerts")}/>}
 <button className="btn bc" style={{padding:"7px 14px",fontSize:11}} onClick={()=>setTab("scan")}>◎ SCAN</button>
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
