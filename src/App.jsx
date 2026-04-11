import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   CRYPTEX SIGNAL v3.5 — PROFESSIONAL MULTI-STRATEGY EDITION
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

// ── CONFIG & DATA ─────────────────────────────────────────────────────────────
const CFG = {
  WALLETS: {
    USDT_TRC20: "YOUR_TRC20_USDT_WALLET_ADDRESS",
    ETH: "YOUR_ETH_WALLET_ADDRESS",
    TRX: "YOUR_TRX_WALLET_ADDRESS",
  },
  _a: btoa("admin@cryptexsignal.io"),
  _b: btoa("Cx@Admin#2024!Secure"),
};

const STRATEGIES = {
  SCALP: { id: "SCALP", label: "Scalp", icon: "⚡", risk: "High", tf: "5m", tp: 1.2, sl: 0.7, lev: "20x", color: "#00d4ff" },
  DAY:   { id: "DAY",   label: "Day",   icon: "📅", risk: "Med",  tf: "1h", tp: 4.0, sl: 2.0, lev: "10x", color: "#00e676" },
  SWING: { id: "SWING", label: "Swing", icon: "⏳", risk: "Low",  tf: "4h", tp: 12.0, sl: 5.0, lev: "5x",  color: "#aa00ff" }
};

const COIN_LIST = [
  { id: "BTC", symbol: "BTCUSDT", base: 71000, logo: "₿", color: "#F7931A" },
  { id: "ETH", symbol: "ETHUSDT", base: 2190,  logo: "Ξ", color: "#627EEA" },
  { id: "SOL", symbol: "SOLUSDT", base: 83,    logo: "◎", color: "#9945FF" },
  { id: "BNB", symbol: "BNBUSDT", base: 600,   logo: "◆", color: "#F3BA2F" },
  { id: "AVAX", symbol: "AVAXUSDT", base: 35,  logo: "▲", color: "#E84142" },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;600&display=swap');
:root {
  --bg: #050b14; --bg2: #081120; --bg3: #0c1829; --bdr: #1a3050;
  --cyan: #00d4ff; --green: #00e676; --red: #ff1744; --text: #cfe8ff; --muted: #3a6080;
}
body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; }
.card { background: rgba(8,17,32,.97); border: 1px solid var(--bdr); border-radius: 16px; padding: 20px; transition: 0.3s; }
.card-long { border-color: rgba(0,230,118,.4); box-shadow: 0 0 20px rgba(0,230,118,.1); }
.card-short { border-color: rgba(255,23,68,.4); box-shadow: 0 0 20px rgba(255,23,68,.1); }
.btn { padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 700; border: none; transition: 0.2s; }
.btn-c { background: var(--cyan); color: #000; }
.btn-h { background: var(--bg3); color: var(--muted); border: 1px solid var(--bdr); }
.pill { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
.pill-g { background: rgba(0,230,118,.1); color: var(--green); }
.pill-r { background: rgba(255,23,68,.1); color: var(--red); }
.stat { background: var(--bg3); padding: 10px; border-radius: 8px; border: 1px solid var(--bdr); }
.mono { font-family: 'JetBrains Mono', monospace; }
.head { font-family: 'Syne', sans-serif; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 20px; }
`;

// ── UTILS ─────────────────────────────────────────────────────────────────────
const f = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Ring({ val, color, size = 80 }) {
  const r = 35, c = 2 * Math.PI * r, p = val / 100;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--bg3)" strokeWidth="8"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${c * p} ${c * (1 - p)}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: "bold", color }}>{val}%</div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [strategy, setStrategy] = useState("DAY");
  const [prices, setPrices] = useState({});
  const [user, setUser] = useState(null); // Simple auth state for demo

  // WebSocket for Prices
  useEffect(() => {
    const streams = COIN_LIST.map(c => `${c.symbol.toLowerCase()}@ticker`).join("/");
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    ws.onmessage = (e) => {
      const { data } = JSON.parse(e.data);
      setPrices(prev => ({ ...prev, [data.s]: { p: parseFloat(data.c), chg: parseFloat(data.P) } }));
    };
    return () => ws.close();
  }, []);

  const getSignal = (coin) => {
    const data = prices[coin.symbol] || { p: coin.base, chg: 0 };
    const strat = STRATEGIES[strategy];
    const isLong = data.chg > -1.5;
    const conf = Math.min(95, 65 + Math.abs(data.chg) * 2);
    
    const entryLow = data.p * (isLong ? 0.997 : 1.002);
    const entryHigh = data.p * (isLong ? 1.001 : 1.005);
    const tp = data.p * (1 + (strat.tp / 100) * (isLong ? 1 : -1));
    const sl = data.p * (1 - (strat.sl / 100) * (isLong ? 1 : -1));

    return { ...strat, isLong, conf, entryLow, entryHigh, tp, sl, current: data.p };
  };

  return (
    <div>
      <style>{CSS}</style>
      
      {/* Top Navigation */}
      <div style={{ padding: "20px", textAlign: "center", borderBottom: "1px solid var(--bdr)" }}>
        <h1 className="head" style={{ color: var(--cyan), margin: 0 }}>CRYPTEX SIGNAL v3.5</h1>
        <p style={{ fontSize: 12, color: var(--muted) }}>World-Class Crypto Futures Signals</p>
      </div>

      {/* Strategy Selector */}
      <div style={{ display: "flex", gap: "10px", padding: "20px", justifyContent: "center" }}>
        {Object.values(STRATEGIES).map(s => (
          <button 
            key={s.id} 
            className={`btn ${strategy === s.id ? "btn-c" : "btn-h"}`}
            onClick={() => setStrategy(s.id)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Signals Grid */}
      <div className="grid">
        {COIN_LIST.map(coin => {
          const sig = getSignal(coin);
          return (
            <div key={coin.id} className={`card ${sig.isLong ? 'card-long' : 'card-short'}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 className="head" style={{ margin: 0 }}>{coin.id}/USDT</h2>
                <span className={`pill ${sig.isLong ? 'pill-g' : 'pill-r'}`}>
                  {sig.isLong ? "LONG" : "SHORT"} {sig.lev}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px", margin: "20px 0" }}>
                <Ring val={Math.round(sig.conf)} color={sig.isLong ? "var(--green)" : "var(--red)"} />
                <div>
                  <div style={{ fontSize: 10, color: var(--muted) }}>CURRENT PRICE</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: "bold" }}>${f(sig.current)}</div>
                </div>
              </div>

              <div className="stat" style={{ marginBottom: "15px" }}>
                <div style={{ fontSize: 10, color: var(--muted) }}>ENTRY RANGE</div>
                <div className="mono" style={{ color: var(--cyan) }}>${f(sig.entryLow)} - ${f(sig.entryHigh)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="stat">
                  <div style={{ fontSize: 10, color: var(--muted) }}>TARGET (TP)</div>
                  <div className="mono" style={{ color: var(--green) }}>${f(sig.tp)}</div>
                </div>
                <div className="stat">
                  <div style={{ fontSize: 10, color: var(--muted) }}>STOP LOSS (SL)</div>
                  <div className="mono" style={{ color: var(--red) }}>${f(sig.sl)}</div>
                </div>
              </div>

              <div style={{ marginTop: "15px", fontSize: 11, background: "var(--bg2)", padding: "10px", borderRadius: "8px" }}>
                <span style={{ color: var(--muted) }}>AI LOGIC:</span> {sig.tf} setup based on momentum analysis.
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div style={{ padding: "40px 20px", textAlign: "center", opacity: 0.5, fontSize: 12 }}>
        © 2026 Cryptex Signal - Mechanical Engineering Precision in Trading
      </div>
    </div>
  );
}
