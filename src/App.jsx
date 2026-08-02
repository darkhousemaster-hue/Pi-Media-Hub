import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api.js';
import { io } from 'socket.io-client';
import { AppContext } from './context.js';
import Icon from './components/Icon.jsx';
import Now from './components/Now.jsx';
import MediaLibrary from './components/MediaLibrary.jsx';
import SlideshowConfig from './components/SlideshowConfig.jsx';
import SystemPanel from './components/SystemPanel.jsx';

// Read version from package.json at build time
const APP_VERSION = '2.0.0';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : '/';
const TRANSPORTS = import.meta.env.DEV ? ['polling'] : ['websocket', 'polling'];
const socket = io(SOCKET_URL, { transports: TRANSPORTS });

let toastTimer;

const NAV = [
  { id: 'now',    label: 'Now',    icon: 'tv' },
  { id: 'media',  label: 'Media',  icon: 'image' },
  { id: 'show',   label: 'Show',   icon: 'sliders' },
  { id: 'system', label: 'System', icon: 'wifi' },
];

const TITLES = {
  now:    { t: 'Lobby screen', s: 'Pi Media Hub' },
  media:  { t: 'Media',        s: 'Pictures, video, music, clips' },
  show:   { t: 'Show',         s: 'Layout, timing, volume' },
  system: { t: 'System',       s: `v${APP_VERSION}` },
};

export default function App() {
  const [page, setPage]           = useState('now');
  const [status, setStatus]       = useState({ status:'playing', mode:'slideshow', currentSlide:0, totalSlides:0 });
  const [config, setConfig]       = useState(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast]         = useState(null);

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

  const toast_ = useCallback((msg, err = false) => {
    setToast({ msg, err });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => setToast(null), 3200);
  }, []);

  const sendCommand = useCallback((action, data = {}) => {
    socket.emit('command', { action, ...data });
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
      toast_('Saved');
      return updated;
    } catch { toast_('Could not save', true); return null; }
  }, [toast_]);

  const ctx = { socket, status, config, connected, sendCommand, saveConfig, toast_, version: APP_VERSION };
  const head = TITLES[page];

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">

        <nav className="rail-nav">
          <div className="rail-brand">
            <div className="mark">AR</div>
            <div>
              <div className="abar-t" style={{ fontSize: 13.5 }}>Lobby screen</div>
              <div className="abar-s">Pi Media Hub</div>
            </div>
          </div>
          {NAV.map(item => (
            <button key={item.id} className={`rnav ${page === item.id ? 'on' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => setPage(item.id)}>
              <Icon name={item.icon} />{item.label}
            </button>
          ))}
          <div className="rail-foot">
            <span className={`conn ${connected ? '' : 'off'}`} />
            {connected ? 'ONLINE' : 'OFFLINE'} · v{APP_VERSION}
          </div>
        </nav>

        <div className="col-wrap">
          <header className="abar">
            <div className="mark">AR</div>
            <div style={{ minWidth: 0 }}>
              <div className="abar-t">{head.t}</div>
              <div className="abar-s">{head.s}</div>
            </div>
            <div className="abar-r">
              <span className="conn-pill">
                <span className={`conn ${connected ? '' : 'off'}`} />
                {connected ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </header>

          <main className="main">
            {page === 'now'    && <Now />}
            {page === 'media'  && <MediaLibrary />}
            {page === 'show'   && <SlideshowConfig />}
            {page === 'system' && <SystemPanel />}
          </main>
        </div>

        <nav className="tabs">
          {NAV.map(item => (
            <button key={item.id} className={`tab ${page === item.id ? 'on' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => setPage(item.id)}>
              <Icon name={item.icon} />{item.label}
            </button>
          ))}
        </nav>

        {toast && <div className={`toast ${toast.err ? 'err' : ''}`}>{toast.msg}</div>}
      </div>
    </AppContext.Provider>
  );
}
