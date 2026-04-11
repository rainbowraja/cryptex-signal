import React, { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   CRYPTEX SIGNAL v3.5 — FIXED PRODUCTION BUILD
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const STRATEGIES = {
  SCALP: { id: "SCALP", label: "Scalp", icon: "⚡", tp: 1.2, sl: 0.7, lev: "20x", color: "#00d4ff" },
  DAY:   { id: "DAY",   label: "Day",   icon: "📅", tp: 4.0, sl: 2.0, lev: "10x", color: "#00e676" },
  SWING: { id: "SWING", label: "Swing", icon: "⏳", tp: 12.0, sl: 5.0, lev: "5x",  color: "#aa00ff" }
};

const COIN_LIST = [
  { id: "BTC", symbol: "BTCUSDT", base: 71000 },
  { id: "ETH", symbol: "ETHUSDT", base: 2190 },
  { id: "SOL", symbol: "SOLUSDT", base: 83 },
  { id: "BNB", symbol: "BNBUSDT", base: 600 },
  { id: "AVAX", symbol: "AVAXUSDT", base: 35 },
];

const CSS = `
  :root {
    --bg: #050b14; --bg2: #081120; --bg3: #0c1829; --bdr: #1a3050;
    --cyan: #00d4ff; --green: #00e676; --red: #ff1744; --text: #cfe8ff; --muted: #3a6080;
  }
  body { background: var(--bg); color: var(--text); font-family: sans-serif; margin: 0; }
  .card { background: rgba(8,17,32,0.95); border: 1px solid var(--bdr); border-radius: 16px; padding: 20px; transition: 0.3s; }
  .btn { padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; border: none; }
  .btn-c { background: var(--cyan); color: #000; }
  .btn-h { background: var(--bg3); color: var(--muted); border: 1px solid var(--bdr); }
  .stat { background: var(--bg3); padding: 10px; border-radius: 8px; border: 1px solid var(--bdr); margin-top: 10px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 20px; }
`;

export default function App() {
  const [strategy, setStrategy] = useState("DAY");
  const [prices, setPrices] = useState({});

  useEffect(() => {
    const streams = COIN_LIST.map(c => `${c.symbol.toLowerCase()}@ticker`).join("/");
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    ws.onmessage = (e) => {
      const { data } = JSON.parse(e.data);
      setPrices(prev => ({ ...prev, [data.s]: { p: parseFloat(data.c), chg: parseFloat(data.P) } }));
    };
    return () => ws.close();
  }, []);

  const f = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      <style>{CSS}</style>
      
      <div style={{ padding: "20px", textAlign: "center", borderBottom: "1px solid var(--bdr)" }}>
        <h1 style={{ color: "var(--cyan)", margin: 0 }}>CRYPTEX SIGNAL v3.5</h1>
        <p style={{ fontSize: "12px", color: "var(--muted)" }}>Professional Crypto Analytics</p>
      </div>

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

      <div className="grid">
        {COIN_LIST.map(coin => {
          const data = prices[coin.symbol] || { p: coin.base, chg: 0 };
          const strat = STRATEGIES[strategy];
          const isLong = data.chg > -1.5;
          
          const entryLow = data.p * (isLong ? 0.997 : 1.002);
          const entryHigh = data.p * (isLong ? 1.001 : 1.005);
          const tp = data.p * (1 + (strat.tp / 100) * (isLong ? 1 : -1));
          const sl = data.p * (1 - (strat.sl / 100) * (isLong ? 1 : -1));

          return (
            <div key={coin.id} className="card" style={{ borderColor: isLong ? "var(--green)" : "var(--red)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <h2 style={{ margin: 0 }}>{coin.id}/USDT</h2>
                <span style={{ color: isLong ? "var(--green)" : "var(--red)", fontWeight: "bold" }}>
                  {isLong ? "LONG" : "SHORT"} {strat.lev}
                </span>
              </div>

              <div style={{ margin: "20px 0" }}>
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>LIVE PRICE</div>
                <div style={{ fontSize: "24px", fontWeight: "bold", color: "white" }}>${f(data.p)}</div>
              </div>

              <div className="stat">
                <div style={{ fontSize: "10px", color: "var(--muted)" }}>ENTRY RANGE</div>
                <div style={{ color: "var(--cyan)" }}>${f(entryLow)} - ${f(entryHigh)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="stat">
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>TARGET (TP)</div>
                  <div style={{ color: "var(--green)" }}>${f(tp)}</div>
                </div>
                <div className="stat">
                  <div style={{ fontSize: "10px", color: "var(--muted)" }}>STOP LOSS (SL)</div>
                  <div style={{ color: "var(--red)" }}>${f(sl)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
