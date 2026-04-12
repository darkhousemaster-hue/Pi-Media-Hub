import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api.js';
import { io } from 'socket.io-client';
import { AppContext } from './context.js';
import Dashboard from './components/Dashboard.jsx';
import MediaLibrary from './components/MediaLibrary.jsx';
import SlideshowConfig from './components/SlideshowConfig.jsx';
import NetworkStatus from './components/NetworkStatus.jsx';

// In dev, Vite is on :5173 but socket.io must connect directly to Express on :3000.
// Use polling-only in dev — the browser blocks cross-origin WebSocket upgrades.
// In production everything is on the same port so WebSocket works fine.
const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/';
const TRANSPORTS = import.meta.env.DEV ? ['polling'] : ['websocket', 'polling'];
const socket = io(SOCKET_URL, { transports: TRANSPORTS });

let toastTimer;

export default function App() {
  const [page, setPage]       = useState('dashboard');
  const [status, setStatus]   = useState({ status:'playing', mode:'slideshow', currentSlide:0, totalSlides:0 });
  const [config, setConfig]   = useState(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast]     = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    socket.on('connect',       () => setConnected(true));
    socket.on('disconnect',    () => setConnected(false));
    socket.on('status',        setStatus);
    socket.on('config',        setConfig);
    socket.on('config-update', setConfig);
    return () => {
      ['connect','disconnect','status','config','config-update'].forEach(e => socket.off(e));
    };
  }, []);

  // Always fetch config via REST on mount — don't wait for socket
  useEffect(() => {
    apiFetch('/api/config').then(r => r.json()).then(setConfig).catch(() => {});
    apiFetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  function toast_(msg) {
    setToast(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(null), 2800);
  }

  const sendCommand = useCallback((action, data = {}) => {
    socket.emit('command', { action, ...data });
    toast_(`▶ ${action.replace(/-/g,' ')}`);
  }, []);

  const saveConfig = useCallback(async (updates) => {
    try {
      const res = await apiFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const updated = await res.json();
      setConfig(updated);
      toast_('Configuration saved ✓');
      return updated;
    } catch {
      toast_('Failed to save config');
    }
  }, []);

  const navItems = [
    { id:'dashboard', label:'Dashboard', icon:'⊞' },
    { id:'media',     label:'Media',     icon:'📁' },
    { id:'slideshow', label:'Slideshow', icon:'▶'  },
    { id:'network',   label:'Network',   icon:'📡' },
  ];

  function handleNav(id) { setPage(id); setMenuOpen(false); }

  function handleReboot() {
    if (confirm('Reboot the Raspberry Pi?\nAll clients will disconnect for ~60 seconds.'))
      sendCommand('reboot');
  }

  async function handleUpdate() {
    if (!confirm('Pull latest version from GitHub and rebuild?\n\nThe app will restart automatically. This takes ~1-2 minutes.')) return;
    try {
      const res = await apiFetch('/api/system/update', { method: 'POST' });
      const data = await res.json();
      toast_('⬆ Updating… app will restart in ~2 minutes');
    } catch {
      toast_('Update failed — is this a Pi with git installed?');
    }
  }
  function handleNetworkRestart() {
    if (confirm('Restart network service?\nClients may briefly disconnect.'))
      sendCommand('restart-network');
  }

  const ctx = { socket, status, config, connected, sendCommand, saveConfig };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        {/* ── Header ── */}
        <header className="header">
          <div className="header-logo">
            <div className="logo-icon">🖥️</div>
            <span className="logo-text">Pi Media Hub</span>
          </div>

          <nav className="header-nav">
            {navItems.map(item => (
              <button key={item.id}
                className={`nav-btn ${page === item.id ? 'active' : ''}`}
                onClick={() => handleNav(item.id)}>
                <span>{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button className="btn btn-ghost btn-sm header-sys-btn"
              title="Update from GitHub" onClick={handleUpdate}>
              ⬆ <span className="btn-label">Update</span>
            </button>
            <button className="btn btn-ghost btn-sm header-sys-btn"
              title="Restart network" onClick={handleNetworkRestart}>
              📡 <span className="btn-label">Network</span>
            </button>
            <button className="btn btn-danger btn-sm header-sys-btn"
              title="Reboot Pi" onClick={handleReboot}>
              ⏻ <span className="btn-label">Reboot</span>
            </button>
            <button className="mobile-menu-btn" onClick={() => setMenuOpen(m => !m)} aria-label="Menu">
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </header>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="mobile-nav">
            {navItems.map(item => (
              <button key={item.id}
                className={`mobile-nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => handleNav(item.id)}>
                <span>{item.icon}</span> {item.label}
              </button>
            ))}
          </div>
        )}

        <main className="main-content">
          {page === 'dashboard' && <Dashboard />}
          {page === 'media'     && <MediaLibrary />}
          {page === 'slideshow' && <SlideshowConfig />}
          {page === 'network'   && <NetworkStatus />}
        </main>

        {toast && <div className="toast">{toast}</div>}
      </div>
    </AppContext.Provider>
  );
}
