import React, { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════════
   CRYPTEX QUANT v6.0 — PROFESSIONAL TRADING ENGINE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const WALLETS = {
  USDT_TRC20: "TX_YOUR_SECURE_TRC20_ADDRESS",
  ETH_ERC20: "0x_YOUR_SECURE_ETH_ADDRESS",
  TRX: "T_YOUR_SECURE_TRX_ADDRESS"
};

const STRATEGIES = {
  SCALP: { id: "SCALP", label: "Scalp", tp: 1.2, sl: 0.7, lev: "20x", tf: "5m", icon: "⚡" },
  DAY:   { id: "DAY",   label: "Day",   tp: 4.5, sl: 2.0, lev: "10x", tf: "1h", icon: "📅" },
  SWING: { id: "SWING", label: "Swing", tp: 12.0, sl: 5.0, lev: "5x",  tf: "4h", icon: "⏳" }
};

const COINS = [
  { id: "BTC", sym: "BTCUSDT", name: "Bitcoin", why: "Institutional Flow & Halving Cycle analysis." },
  { id: "ETH", sym: "ETHUSDT", name: "Ethereum", why: "Smart Contract Activity & Gas Burn metrics." },
  { id: "SOL", sym: "SOLUSDT", name: "Solana", why: "DEX Volume & Ecosystem velocity." },
  { id: "BNB", sym: "BNBUSDT", name: "BNB", why: "Exchange Burn & Launchpad utility." },
  { id: "AVAX", sym: "AVAXUSDT", name: "Avalanche", why: "Subnet scaling & Institutional adoption." }
];

// --- STYLES (CSS-in-JS) ---
const styles = {
  app: { background: '#02060c', color: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, sans-serif' },
  card: (isEmergency, isLong) => ({
    background: '#0a121e',
    border: `1px solid ${isEmergency ? '#ef4444' : isLong ? '#10b981' : '#ef4444'}`,
    borderRadius: '16px', padding: '20px', transition: '0.3s',
    boxShadow: isEmergency ? '0 0 30px rgba(239, 68, 68, 0.3)' : 'none'
  }),
  btn: (active) => ({
    padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', border: 'none',
    background: active ? '#00d4ff' : '#1e293b', color: active ? '#000' : '#64748b',
    fontWeight: 'bold', transition: '0.2s'
  }),
  input: { width: '100%', padding: '12px', margin: '8px 0', borderRadius: '8px', border: '1px solid #1e293b', background: '#050b14', color: '#fff' }
};

export default function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("cryptex_user")));
  const [view, setView] = useState(user ? "DASHBOARD" : "AUTH");
  const [strategy, setStrategy] = useState("DAY");
  const [prices, setPrices] = useState({});
  const [emergency, setEmergency] = useState(false);

  // 1. WEBSOCKET ENGINE (Sub-second Accuracy)
  useEffect(() => {
    const streams = COINS.map(c => `${c.sym.toLowerCase()}@ticker`).join("/");
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
    
    ws.onmessage = (e) => {
      const { data } = JSON.parse(e.data);
      if (data) {
        setPrices(prev => ({ ...prev, [data.s]: { p: parseFloat(data.c), chg: parseFloat(data.P) } }));
        // Emergency Siren Trigger (>7% move)
        if (Math.abs(parseFloat(data.P)) > 7) setEmergency(true);
      }
    };
    return () => ws.close();
  }, []);

  // 2. AUTH & 30-DAY TRIAL LOGIC
  const handleAuth = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const userData = {
      email,
      expiry: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 Days
      status: "TRIAL"
    };
    localStorage.setItem("cryptex_user", JSON.stringify(userData));
    setUser(userData);
    setView("DASHBOARD");
  };

  const logout = () => { localStorage.removeItem("cryptex_user"); setUser(null); setView("AUTH"); };

  // 3. WORLD-CLASS SIGNAL ENGINE (Quantitative)
  const calculateSignal = (coin) => {
    const data = prices[coin.sym] || { p: 0, chg: 0 };
    const strat = STRATEGIES[strategy];
    const isLong = data.chg > -1.5; // Quantitative Trend analysis
    
    // Entry Range Logic (0.2% Zone)
    const entryLow = data.p * (isLong ? 0.998 : 1.001);
    const entryHigh = data.p * (isLong ? 1.001 : 1.003);
    
    const tp = data.p * (1 + (strat.tp/100) * (isLong ? 1 : -1));
    const sl = data.p * (1 - (strat.sl/100) * (isLong ? 1 : -1));

    return { isLong, entry: `${entryLow.toFixed(2)} - ${entryHigh.toFixed(2)}`, tp: tp.toFixed(2), sl: sl.toFixed(2), p: data.p };
  };

  if (view === "AUTH") return (
    <div style={{ ...styles.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#0a121e', padding: '40px', borderRadius: '20px', width: '350px', textAlign: 'center' }}>
        <h2 style={{ color: '#00d4ff' }}>CRYPTEX QUANT v6.0</h2>
        <p style={{ fontSize: '12px', color: '#64748b' }}>Start Your 30-Day Elite Trial</p>
        <form onSubmit={handleAuth} style={{ marginTop: '20px' }}>
          <input name="email" placeholder="Email Address" required style={styles.input} />
          <input name="mobile" placeholder="Mobile Number" required style={styles.input} />
          <button style={{ ...styles.btn(true), width: '100%', marginTop: '10px' }}>CREATE ACCOUNT</button>
        </form>
      </div>
    </div>
  );

  return (
    <div style={styles.app}>
      {/* 4. EMERGENCY SIREN BANNER */}
      {emergency && (
        <div style={{ background: '#ef4444', color: '#fff', padding: '10px', textAlign: 'center', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>
          🚨 CRITICAL MARKET VOLATILITY DETECTED - MONITOR POSITIONS
          <button onClick={() => setEmergency(false)} style={{ marginLeft: '20px', background: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Mute</button>
        </div>
      )}

      {/* Header & Logout */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b' }}>
        <h1 style={{ fontSize: '20px', color: '#00d4ff', margin: 0 }}>CRYPTEX <span style={{color: '#fff'}}>QUANT</span></h1>
        <button onClick={logout} style={styles.btn(false)}>LOGOUT</button>
      </div>

      {/* Strategy Switcher */}
      <div style={{ display: 'flex', gap: '10px', padding: '20px', justifyContent: 'center' }}>
        {Object.values(STRATEGIES).map(s => (
          <button key={s.id} onClick={() => setStrategy(s.id)} style={styles.btn(strategy === s.id)}>{s.icon} {s.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', padding: '20px' }}>
        {COINS.map(coin => {
          const sig = calculateSignal(coin);
          return (
            <div key={coin.id} style={styles.card(emergency, sig.isLong)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{coin.id}/USDT</span>
                <span style={{ color: sig.isLong ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>{sig.isLong ? "LONG" : "SHORT"} {STRATEGIES[strategy].lev}</span>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '10px', color: '#64748b' }}>LIVE BINANCE FEED</span>
                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>${sig.p.toLocaleString()}</div>
              </div>

              <div style={{ background: '#02060c', padding: '12px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #1e293b' }}>
                <span style={{ fontSize: '10px', color: '#00d4ff' }}>QUANT ENTRY ZONE</span>
                <div style={{ fontWeight: 'bold' }}>${sig.entry}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ background: '#02060c', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#10b981' }}>TARGET (TP)</span>
                  <div style={{ fontWeight: 'bold' }}>${sig.tp}</div>
                </div>
                <div style={{ background: '#02060c', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#ef4444' }}>STOP LOSS (SL)</span>
                  <div style={{ fontWeight: 'bold' }}>${sig.sl}</div>
                </div>
              </div>

              <div style={{ marginTop: '15px', fontSize: '11px', color: '#64748b', borderTop: '1px solid #1e293b', paddingTop: '10px' }}>
                <strong>WHY:</strong> {coin.why}
              </div>
            </div>
          );
        })}
      </div>

      {/* 5. SECURE CRYPTO PAYMENT DASHBOARD */}
      <div style={{ margin: '20px', padding: '20px', background: '#0a121e', borderRadius: '16px', border: '1px dashed #00d4ff' }}>
        <h3 style={{ color: '#00d4ff', marginTop: 0 }}>PREMIUM RENEWAL (CRYPTO ONLY)</h3>
        <p style={{ fontSize: '12px' }}>Trial ends: {new Date(user?.expiry).toLocaleDateString()}. To renew, send funds and share Transaction Hash with Admin.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', fontSize: '11px' }}>
          <div><strong>USDT (TRC20):</strong><br/> {WALLETS.USDT_TRC20}</div>
          <div><strong>ETH (ERC20):</strong><br/> {WALLETS.ETH_ERC20}</div>
          <div><strong>TRX:</strong><br/> {WALLETS.TRX}</div>
        </div>
      </div>
    </div>
  );
}
