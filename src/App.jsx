import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api.js';
import { io } from 'socket.io-client';
import { AppContext } from './context.js';
import Dashboard from './components/Dashboard.jsx';
import MediaLibrary from './components/MediaLibrary.jsx';
import SlideshowConfig from './components/SlideshowConfig.jsx';
import NetworkStatus from './components/NetworkStatus.jsx';

// Read version from package.json at build time
const APP_VERSION = '1.0.6';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/';
const TRANSPORTS = import.meta.env.DEV ? ['polling'] : ['websocket', 'polling'];
const socket = io(SOCKET_URL, { transports: TRANSPORTS });

let toastTimer;

export default function App() {
  const [page, setPage]         = useState('dashboard');
  const [status, setStatus]     = useState({ status:'playing', mode:'slideshow', currentSlide:0, totalSlides:0 });
  const [config, setConfig]     = useState(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast]       = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    socket.on('connect',       () => setConnected(true));
    socket.on('disconnect',    () => setConnected(false));
    socket.on('status',        setStatus);
    socket.on('config',        setConfig);
    socket.on('config-update', setConfig);
    return () => ['connect','disconnect','status','config','config-update'].forEach(e => socket.off(e));
  }, []);

  useEffect(() => {
    apiFetch('/api/config').then(r => r.json()).then(setConfig).catch(() => {});
    apiFetch('/api/status').then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  function toast_(msg) {
    setToast(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(null), 3000);
  }

  const sendCommand = useCallback((action, data = {}) => {
    socket.emit('command', { action, ...data });
    toast_(`▶ ${action.replace(/-/g, ' ')}`);
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
      toast_('Saved ✓');
      return updated;
    } catch { toast_('Failed to save'); }
  }, []);

  async function handleReboot() {
    if (!confirm('Reboot the Raspberry Pi?\nAll clients disconnect for ~60 seconds.')) return;
    try {
      await apiFetch('/api/system/reboot', { method: 'POST' });
      toast_('Rebooting…');
    } catch { toast_('Reboot command sent'); }
  }

  async function handleNetworkRestart() {
    if (!confirm('Restart network service?')) return;
    try {
      await apiFetch('/api/system/restart-network', { method: 'POST' });
      toast_('Restarting network…');
    } catch { toast_('Network restart failed'); }
  }

  async function handleUpdate() {
    if (!confirm('Pull latest version from GitHub and rebuild?\nThe app will restart automatically.')) return;
    setUpdating(true);
    toast_('⬆ Update started…');
    try {
      await apiFetch('/api/system/update', { method: 'POST' });
      // Start polling immediately — server will be down briefly during restart
      let attempts = 0;
      function poll() {
        fetch('/api/config')
          .then(r => r.json())
          .then(() => { setUpdating(false); window.location.reload(); })
          .catch(() => {
            attempts++;
            if (attempts < 60) setTimeout(poll, 3000); // try for 3 minutes
            else { setUpdating(false); toast_('Update timed out — check Pi logs'); }
          });
      }
      setTimeout(poll, 5000); // first check after 5s
    } catch {
      toast_('Update failed — check Pi has git and internet access');
      setUpdating(false);
    }
  }

  const navItems = [
    { id:'dashboard', label:'Dashboard', icon:'⊞' },
    { id:'media',     label:'Media',     icon:'📁' },
    { id:'slideshow', label:'Slideshow', icon:'▶'  },
    { id:'network',   label:'Network',   icon:'📡' },
  ];

  function handleNav(id) { setPage(id); setMenuOpen(false); }

  const ctx = { socket, status, config, connected, sendCommand, saveConfig };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
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
            <button
              className={`btn btn-sm header-sys-btn ${updating ? 'btn-slate' : 'btn-ghost'}`}
              title="Update from GitHub"
              onClick={handleUpdate}
              disabled={updating}
            >
              {updating ? '⏳' : '⬆'} <span className="btn-label">{updating ? 'Updating…' : `Update`}</span>
              <span style={{ fontSize:10, opacity:.6, marginLeft:4 }}>v{APP_VERSION}</span>
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
