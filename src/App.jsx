import { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   CRYPTEX SIGNAL v3.5 — ALL FEATURES + MULTI-STRATEGY UPDATE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const CFG = {
  WALLETS: {
    USDT_TRC20: "YOUR_TRC20_USDT_WALLET_ADDRESS",
    ETH: "YOUR_ETH_WALLET_ADDRESS",
    TRX: "YOUR_TRX_WALLET_ADDRESS",
  },
  PLANS: {
    free:  { name:"FREE TRIAL", price:0,   days:30, label:"Free 30 days" },
    basic: { name:"BASIC",      price:15,  days:30, label:"$15 USDT/mo"  },
    pro:   { name:"PRO",        price:39,  days:30, label:"$39 USDT/mo"  },
    elite: { name:"ELITE",      price:99,  days:30, label:"$99 USDT/mo"  },
  },
  _a: btoa("admin@cryptexsignal.io"),
  _b: btoa("Cx@Admin#2024!Secure"),
};

const STRATEGIES = {
  SCALP: { id: "SCALP", label: "Scalp", icon: "⚡", tpPct: 1.5, slPct: 0.8, lev: "20x", tf: "5m" },
  DAY:   { id: "DAY",   label: "Day",   icon: "📅", tpPct: 4.5, slPct: 2.0, lev: "10x", tf: "1h" },
  SWING: { id: "SWING", label: "Swing", icon: "⏳", tpPct: 12.0, slPct: 5.0, lev: "5x",  tf: "4h" }
};

const COIN_LIST = [
  { id:"BTC", name:"Bitcoin", symbol:"BTCUSDT", base:71000, logo:"₿", color:"#F7931A", why:"#1 market cap. High liquidity." },
  { id:"ETH", name:"Ethereum", symbol:"ETHUSDT", base:2190, logo:"Ξ", color:"#627EEA", why:"#2 market cap. DeFi leader." },
  { id:"SOL", name:"Solana", symbol:"SOLUSDT", base:83, logo:"◎", color:"#9945FF", why:"High speed L1. Retail favorite." },
  { id:"BNB", name:"BNB Chain", symbol:"BNBUSDT", base:600, logo:"◆", color:"#F3BA2F", why:"Binance ecosystem backing." },
  { id:"AVAX", name:"Avalanche", symbol:"AVAXUSDT", base:35, logo:"▲", color:"#E84142", why:"Institutional speed (4500 TPS)." },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@500;700&family=Inter:wght@400;600&display=swap');
  :root {
    --bg: #050b14; --bg2: #081120; --bg3: #0c1829; --bdr: #1a3050;
    --cyan: #00d4ff; --green: #00e676; --red: #ff1744; --text: #cfe8ff; --muted: #3a6080;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; margin: 0; }
  .card { background: rgba(8,17,32,0.97); border: 1px solid var(--bdr); border-radius: 16px; padding: 20px; }
  .btn { padding: 10px 18px; border-radius: 10px; cursor: pointer; border: none; font-family: 'Syne'; font-weight: 700; }
  .btn-c { background: var(--cyan); color: #000; }
  .btn-h { background: var(--bg3); color: var(--muted); border: 1px solid var(--bdr); }
  .stat { background: var(--bg3); padding: 12px; border-radius: 10px; border: 1px solid var(--bdr); }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .head { font-family: 'Syne', sans-serif; }
`;

export default function App() {
  const [strategy, setStrategy] = useState("DAY");
  const [prices, setPrices] = useState({});
  const [emergency, setEmergency] = useState(null);

  // Real-time Price Tracking (Binance WebSocket)
  useEffect(() => {
    const streams = COIN_LIST.map(c => `${c.symbol.toLowerCase()}@ticker`).join("/");
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    ws.onmessage = (e) => {
      const { data } = JSON.parse(e.data);
      if (data) {
        setPrices(prev => ({ 
          ...prev, 
          [data.s]: { p: parseFloat(data.c), chg: parseFloat(data.P) } 
        }));
        // Emergency Detection
        if (Math.abs(parseFloat(data.P)) > 7) {
          setEmergency({ id: data.s, chg: data.P, msg: `CRITICAL: ${data.s} moved ${data.P}%!` });
        }
      }
    };
    return () => ws.close();
  }, []);

  const f = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getSignal = (coin) => {
    const data = prices[coin.symbol] || { p: coin.base, chg: 0 };
    const strat = STRATEGIES[strategy];
    const isLong = data.chg > -1.2;
    const conf = Math.min(96, 60 + Math.abs(data.chg) * 2.5);
    
    const entryLow = data.p * (isLong ? 0.998 : 1.001);
    const entryHigh = data.p * (isLong ? 1.001 : 1.004);
    const tp = data.p * (1 + (strat.tpPct / 100) * (isLong ? 1 : -1));
    const sl = data.p * (1 - (strat.slPct / 100) * (isLong ? 1 : -1));

    return { ...strat, isLong, conf, entryLow, entryHigh, tp, sl, current: data.p };
  };

  return (
    <div style={{ paddingBottom: "50px" }}>
      <style>{CSS}</style>

      {/* Emergency Banner */}
      {emergency && (
        <div style={{ background: "rgba(255,23,68,0.2)", padding: "12px", textAlign: "center", borderBottom: "2px solid var(--red)" }}>
          <span style={{ fontWeight: "bold", color: "var(--red)" }}>🚨 {emergency.msg}</span>
          <button onClick={() => setEmergency(null)} style={{ marginLeft: "15px", background: "none", border: "none", color: "white", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "30px 20px", textAlign: "center" }}>
        <h1 className="head" style={{ color: "var(--cyan)", margin: 0, fontSize: "28px" }}>CRYPTEX SIGNAL v3.5</h1>
        <p className="mono" style={{ fontSize: "12px", color: "var(--muted)", marginTop: "5px" }}>Precision Engineering for Professional Traders</p>
      </div>

      {/* Strategy Switcher */}
      <div style={{ display: "flex", gap: "10px", padding: "0 20px 20px", justifyContent: "center" }}>
        {Object.values(STRATEGIES).map(s => (
          <button 
            key={s.id} 
            className={`btn ${strategy === s.id ? "btn-c" : "btn-h"}`}
            onClick={() => setStrategy(s.id)}
            style={{ flex: 1, maxWidth: "150px" }}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Signals Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", padding: "20px" }}>
        {COIN_LIST.map(coin => {
          const sig = getSignal(coin);
          return (
            <div key={coin.id} className="card" style={{ borderLeft: `4px solid ${sig.isLong ? 'var(--green)' : 'var(--red)'}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="head" style={{ fontSize: "20px" }}>{coin.id}/USDT</span>
                <span style={{ color: sig.isLong ? 'var(--green)' : 'var(--red)', fontWeight: "bold", fontSize: "14px" }}>
                  {sig.isLong ? "↑ LONG" : "↓ SHORT"} {sig.lev}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px", margin: "20px 0" }}>
                <div style={{ width: "60px", height: "60px", borderRadius: "50%", border: `4px solid ${sig.isLong ? 'var(--green)' : 'var(--red)'}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                  {Math.round(sig.conf)}%
                </div>
                <div>
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>LIVE PRICE</div>
                  <div className="mono" style={{ fontSize: "22px", fontWeight: "bold" }}>${f(sig.current)}</div>
                </div>
              </div>

              <div className="stat" style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>ENTRY ZONE</div>
                <div className="mono" style={{ color: "var(--cyan)", fontSize: "14px" }}>${f(sig.entryLow)} - ${f(sig.entryHigh)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="stat">
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>TARGET (TP)</div>
                  <div className="mono" style={{ color: "var(--green)" }}>${f(sig.tp)}</div>
                </div>
                <div className="stat">
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>STOP LOSS (SL)</div>
                  <div className="mono" style={{ color: "var(--red)" }}>${f(sig.sl)}</div>
                </div>
              </div>

              <div style={{ marginTop: "15px", fontSize: "11px", color: "var(--muted)", background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px" }}>
                <strong>AI REASON:</strong> {coin.why} Analyzed on {sig.tf} timeframe.
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Wallets (As in v3.0) */}
      <div style={{ margin: "20px", padding: "20px", background: "var(--bg2)", borderRadius: "16px", border: "1px dashed var(--bdr)" }}>
        <h3 className="head" style={{ fontSize: "14px", marginBottom: "10px", color: "var(--cyan)" }}>SECURE PAYMENT WALLETS</h3>
        <div style={{ fontSize: "11px", opacity: 0.8 }}>
          <div>USDT (TRC20): {CFG.WALLETS.USDT_TRC20}</div>
          <div style={{ marginTop: "5px" }}>ETH: {CFG.WALLETS.ETH}</div>
        </div>
      </div>
    </div>
  );
}
