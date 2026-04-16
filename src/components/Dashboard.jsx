import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import SlidePreview from './SlidePreview.jsx';
import { useApp } from '../context.js';

function InstructionModal({ onClose, sendCommand }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/files/instructionvideos')
      .then(r => r.json())
      .then(f => { setVideos(f); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function displayName(filename) {
    return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'#fff',borderRadius:16,padding:28,width:440,maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,.25)',maxHeight:'75vh',display:'flex',flexDirection:'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:20,fontWeight:800,marginBottom:3 }}>▶ Play Instructions</h2>
            <p style={{ fontSize:13,color:'var(--gray-500)' }}>Slideshow & music will pause while playing</p>
          </div>
          <button onClick={onClose} style={{ background:'var(--gray-100)',border:'none',borderRadius:8,width:32,height:32,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',marginLeft:12 }}>✕</button>
        </div>
        <div style={{ flex:1,overflowY:'auto' }}>
          {loading ? (
            <div style={{ padding:32,textAlign:'center',color:'var(--gray-400)' }}>Loading...</div>
          ) : videos.length === 0 ? (
            <div style={{ padding:32,textAlign:'center' }}>
              <div style={{ fontSize:40,marginBottom:12 }}>🎬</div>
              <div style={{ fontWeight:600,color:'var(--gray-700)',marginBottom:6 }}>No instruction videos yet</div>
              <div style={{ fontSize:13,color:'var(--gray-400)',lineHeight:1.6 }}>
                Upload videos in Media Library → Instruction Videos.<br/>
                The filename becomes the button label.
              </div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {videos.map(v => (
                <button key={v.name}
                  onClick={() => { sendCommand('play-instruction', { url: v.url }); onClose(); }}
                  style={{ display:'flex',alignItems:'center',gap:14,padding:'13px 16px',background:'var(--gray-50)',border:'2px solid var(--gray-200)',borderRadius:10,cursor:'pointer',textAlign:'left',fontFamily:'var(--font)',width:'100%',transition:'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.background='var(--primary-light)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='var(--gray-200)'; e.currentTarget.style.background='var(--gray-50)'; }}>
                  <div style={{ width:40,height:40,background:'#7c3aed',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,color:'#fff' }}>▶</div>
                  <div>
                    <div style={{ fontSize:15,fontWeight:700,color:'var(--gray-900)',textTransform:'capitalize' }}>{displayName(v.name)}</div>
                    <div style={{ fontSize:11,color:'var(--gray-400)',marginTop:2 }}>{v.name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { sendCommand, status, connected, config } = useApp();
  const [systemInfo, setSystemInfo] = useState({ slides:0,videos:0,tracks:0,instructions:0 });
  const [showInstructions, setShowInstructions] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);


  useEffect(() => {
    async function loadCounts() {
      try {
        const [pics, vids, mus, ins] = await Promise.all([
          apiFetch('/api/files/pictures').then(r=>r.json()),
          apiFetch('/api/files/videos').then(r=>r.json()),
          apiFetch('/api/files/music').then(r=>r.json()),
          apiFetch('/api/files/instructionvideos').then(r=>r.json()),
        ]);
        setSystemInfo({ slides:pics.length,videos:vids.length,tracks:mus.length,instructions:ins.length });
      } catch {}
    }
    loadCounts();
  }, []);

  const isPlaying = status.status === 'playing';
  const mode = status.mode || 'slideshow';

  // Live preview: use the URL the player broadcasts, no local file list needed
  const previewUrl = status.currentSlideUrl || null;

  const statusLabel = () => {
    if (!connected) return { text:'Disconnected', dot:'gray' };
    if (mode==='video') return { text:'Playing Video', dot:'orange' };
    if (status.status==='paused') return { text:'Paused', dot:'orange' };
    if (status.status==='stopped') return { text:'Stopped', dot:'red' };
    return { text:'Normal Operation', dot:'green' };
  };
  const { text:statusText, dot:statusDot } = statusLabel();

  return (
    <>
      <div className="page-header">
        <h1>System Dashboard</h1>
        <p>Control and monitor your Pi Media Hub</p>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <div className="card-title"><span>⚡</span> Quick Actions</div>
          <div style={{ display:'flex',alignItems:'center',gap:6 }}>
            <span className={`status-dot ${statusDot}`}></span>
            <span className="text-sm text-muted">{statusText}</span>
          </div>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
          <button className="action-btn primary" onClick={() => sendCommand(
              status.status === 'playing' ? 'pause' : 'play'
            )}>
            <span className="action-icon">
              {status.status === 'playing' ? '⏸' : '▶'}
            </span>
            {status.status === 'playing' ? 'Pause' : status.status === 'paused' ? 'Resume' : 'Play'}
          </button>
          <button className="action-btn secondary" onClick={() => sendCommand('next')}>
            <span className="action-icon">⏭</span>Next Slide
          </button>
          <button className="action-btn" style={{ background:'#7c3aed',color:'#fff' }} onClick={() => setShowInstructions(true)}>
            <span className="action-icon">🎬</span>Play Instructions
          </button>
          <button className="action-btn secondary" onClick={() => sendCommand('restart-slideshow')}>
            <span className="action-icon">↺</span>Restart
          </button>

        </div>
        <div style={{ marginTop:14,borderTop:'1px solid var(--gray-100)',paddingTop:12 }}>
          <button onClick={() => setShowShortcuts(s => !s)}
            style={{ background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--gray-400)',display:'flex',alignItems:'center',gap:5,fontFamily:'var(--font)' }}>
            ⌨️ Keyboard Shortcuts {showShortcuts ? '▲' : '▼'}
          </button>
          {showShortcuts && (
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'6px 24px',marginTop:10,padding:'12px 14px',background:'var(--gray-50)',borderRadius:8 }}>
              {[['Play/Pause','Space'],['Next','→'],['Restart','R']].map(([a,k]) => (
                <div key={a} className="shortcut-row"><span>{a}</span><span className="kbd">{k}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Preview — driven by status.currentSlideUrl from socket */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className={`status-dot ${isPlaying && mode==='slideshow' ? 'green' : 'gray'}`}></span>
            &nbsp;Current Slideshow
            {isPlaying && mode==='slideshow' && previewUrl && (
              <span style={{ fontSize:11,color:'var(--success)',marginLeft:8,fontWeight:500,background:'rgba(22,163,74,.1)',padding:'2px 7px',borderRadius:10 }}>● LIVE</span>
            )}
          </div>
          <div style={{ display:'flex',gap:8,alignItems:'center' }}>
            <span style={{ fontSize:12,color:'var(--gray-400)' }}>
              Slide {status.currentSlide + 1} / {status.totalSlides || systemInfo.slides || '—'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => sendCommand(
                status.status === 'playing' ? 'pause' : 'play'
              )}>
              {status.status === 'playing' ? '⏸ Pause' : status.status === 'paused' ? '▶ Resume' : '▶ Play'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => sendCommand('stop')}>⏹ Stop</button>
          </div>
        </div>

        <div className="preview-container">
          <SlidePreview
            urls={status.currentSlideUrls || (previewUrl ? [previewUrl] : [])}
            layout={config?.slideshow?.layout || 'single'}
            style={{ width:'100%', height:'100%' }}
          />
          {!previewUrl && (
            <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,background:'var(--gray-100)' }}>
              <span style={{ fontSize:48,opacity:.2 }}>🖼️</span>
              <span style={{ color:'var(--gray-400)',fontSize:14 }}>
                {connected ? 'Open the TV Player to begin' : 'Connecting to player…'}
              </span>
            </div>
          )}
          {previewUrl && (
            <div className="preview-badge" style={{ fontSize:11 }}>
              {mode.toUpperCase()} • {status.status}
            </div>
          )}
        </div>

        <div style={{ marginTop:14 }}>
          <a href={`${window.location.protocol}//${window.location.hostname}:3000/player.html`}
            target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
            🖥️ Open TV Player Display
          </a>
          <span className="text-xs text-muted" style={{ marginLeft:10 }}>Opens the display that runs on your TV</span>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { label:'Pictures',     value:systemInfo.slides,       sub:'in slideshow',       icon:'🖼️' },
          { label:'Videos',       value:systemInfo.videos,       sub:'scheduled videos',   icon:'🎬' },
          { label:'Music',        value:systemInfo.tracks,       sub:'audio tracks',       icon:'🎵' },
          { label:'Instructions', value:systemInfo.instructions, sub:'instruction videos', icon:'▶'  },
        ].map(({ label,value,sub,icon }) => (
          <div key={label} className="stat-card">
            <div style={{ fontSize:22,marginBottom:6 }}>{icon}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {showInstructions && <InstructionModal onClose={() => setShowInstructions(false)} sendCommand={sendCommand} />}
    </>
  );
}
