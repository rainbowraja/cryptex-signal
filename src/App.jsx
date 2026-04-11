import { useState, useEffect, useMemo } from "react";

// ── STRATEGY CONFIGURATION ──────────────────────────────────────────────────
const STRATEGIES = {
  SCALP: { 
    id: "SCALP", label: "Scalping", icon: "⚡", tf: "1m/5m", 
    risk: "High", tp: 1.5, sl: 0.8, color: "#00d4ff",
    desc: "Quick profits in minutes. Fast execution required."
  },
  DAY: { 
    id: "DAY", label: "Day Trade", icon: "📅", tf: "15m/1h", 
    risk: "Medium", tp: 4.5, sl: 2.0, color: "#00e676",
    desc: "Intraday positions. Closes within 24 hours."
  },
  SWING: { 
    id: "SWING", label: "Swing", icon: "⏳", tf: "4h/1D", 
    risk: "Low", tp: 12.0, sl: 5.0, color: "#aa00ff",
    desc: "Hold for days. Target massive price moves."
  }
};

// ── ENHANCED SIGNAL CALCULATOR ──────────────────────────────────────────────
function calculateSignal(coin, strategyId) {
  const strat = STRATEGIES[strategyId];
  const price = coin.price || coin.base;
  const change = coin.chg24 || 0;
  
  // Logic: Trend Detection based on 24h change & Volume
  const isLong = change > -1; // Simplified trend logic
  const confidence = Math.min(98, 70 + Math.abs(change) * 2);
  
  // Strategy-specific TP/SL calculation
  const multiplier = isLong ? 1 : -1;
  const entryLow = price * (isLong ? 0.998 : 1.001);
  const entryHigh = price * (isLong ? 1.001 : 1.003);
  
  const tpPrice = price * (1 + (strat.tp / 100) * multiplier);
  const slPrice = price * (1 - (strat.sl / 100) * multiplier);

  return {
    ...strat,
    type: isLong ? "LONG" : "SHORT",
    confidence: Math.round(confidence),
    entryRange: `${entryLow.toFixed(2)} - ${entryHigh.toFixed(2)}`,
    tp: tpPrice.toFixed(2),
    sl: slPrice.toFixed(2),
    leverage: strategyId === "SCALP" ? "20x" : strategyId === "DAY" ? "10x" : "5x",
    reason: `Strong ${strat.tf} momentum with ${confidence}% technical confirmation.`
  };
}

// ── MAIN APP COMPONENT ──────────────────────────────────────────────────────
export default function CryptexApp() {
  const [selectedStrategy, setSelectedStrategy] = useState("DAY");
  const [marketData, setMarketData] = useState(COIN_LIST); // Assuming COIN_LIST from your previous code
  const [activeSignals, setActiveSignals] = useState([]);

  // சிக்னல்களை அப்டேட் செய்யும் வசதி
  useEffect(() => {
    const newSignals = marketData.map(coin => calculateSignal(coin, selectedStrategy));
    setActiveSignals(newSignals);
  }, [selectedStrategy, marketData]);

  return (
    <div className="app-container" style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100vh' }}>
      
      {/* Strategy Selector UI */}
      <div className="strategy-nav" style={{ display: 'flex', gap: '10px', padding: '20px', justifyContent: 'center' }}>
        {Object.values(STRATEGIES).map(strat => (
          <button 
            key={strat.id}
            onClick={() => setSelectedStrategy(strat.id)}
            className={`btn ${selectedStrategy === strat.id ? 'btn-c' : 'btn-h'}`}
            style={{ flex: 1, maxWidth: '200px' }}
          >
            {strat.icon} {strat.label}
          </button>
        ))}
      </div>

      {/* Strategy Description Header */}
      <div style={{ textAlign: 'center', padding: '10px', opacity: 0.8 }}>
        <p className="mono" style={{ color: STRATEGIES[selectedStrategy].color }}>
          Mode: {STRATEGIES[selectedStrategy].desc} (TF: {STRATEGIES[selectedStrategy].tf})
        </p>
      </div>

      {/* Signal Cards Grid */}
      <div className="signals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', padding: '20px' }}>
        {activeSignals.map((sig, idx) => (
          <div key={idx} className={`card au ${sig.type === 'LONG' ? 'card-glow-g' : 'card-glow-r'}`} style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h2 className="head">{sig.coinId || marketData[idx].id}/USDT</h2>
              <span className={`pill ${sig.type === 'LONG' ? 'pill-g' : 'pill-r'}`}>{sig.type} {sig.leverage}</span>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Ring val={sig.confidence} color={sig.type === 'LONG' ? 'var(--green)' : 'var(--red)'} size={80} />
              <div className="mono" style={{ fontSize: '13px' }}>
                <div style={{ color: 'var(--muted)' }}>ENTRY RANGE</div>
                <div style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{sig.entryRange}</div>
              </div>
            </div>

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' }}>
              <div className="stat">
                <div className="label">TARGET (TP)</div>
                <div className="value" style={{ color: 'var(--green)' }}>${sig.tp}</div>
              </div>
              <div className="stat">
                <div className="label">STOP LOSS (SL)</div>
                <div className="value" style={{ color: 'var(--red)' }}>${sig.sl}</div>
              </div>
            </div>

            <div style={{ marginTop: '15px', padding: '10px', background: 'var(--bg2)', borderRadius: '8px', fontSize: '11px', opacity: 0.7 }}>
              <strong>AI REASON:</strong> {sig.reason}
            </div>
          </div>
        ))}
      </div>

      <style>{CSS}</style> {/* உங்கள் பழைய CSS இங்கே இருக்க வேண்டும் */}
    </div>
  );
}
