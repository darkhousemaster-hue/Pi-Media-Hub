import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { useApp } from '../context.js';
import SlidePreview from './SlidePreview.jsx';
import Icon from './Icon.jsx';

const baseName = fn => fn.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

const SHORTCUTS = [['Play / Pause', 'Space'], ['Next slide', '→'], ['Restart', 'R']];

function InstructionSheet({ onClose, sendCommand, toast_ }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/files/instructionvideos')
      .then(r => r.json()).then(v => { setVideos(v); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <>
      <button className="scrim" onClick={onClose} aria-label="Close" />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Play Instructions">
        <div className="grab" />
        <div className="sheet-hd">
          <span className="sheet-t">Play Instructions</span>
          <button className="sheet-x" onClick={onClose} aria-label="Close">
            <Icon name="close" size="sm" />
          </button>
        </div>
        <p className="hint">Plays on the TV now. The slideshow resumes when it ends.</p>

        {loading ? (
          <div className="empty"><p>Loading…</p></div>
        ) : videos.length === 0 ? (
          <div className="empty">
            <Icon name="cue" size="lg" />
            <h4>No instruction videos yet</h4>
            <p>Add them under Media, Clips. The filename becomes the button label.</p>
          </div>
        ) : videos.map(v => (
          <button key={v.name} className="cue-row"
            onClick={() => { sendCommand('play-instruction', { url: v.url }); toast_(`Playing ${baseName(v.name)}`); onClose(); }}>
            <span className="cue-ico"><Icon name="cue" /></span>
            <span style={{ minWidth: 0 }}>
              <span className="cue-nm">{baseName(v.name)}</span>
              <span className="cue-du">{v.name}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export default function Now() {
  const { sendCommand, status, connected, config, toast_ } = useApp();
  const [counts, setCounts] = useState({ pictures: 0, videos: 0, music: 0, instructionvideos: 0 });
  const [showCues, setShowCues] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    const load = () => Promise.all(
      ['pictures', 'videos', 'music', 'instructionvideos'].map(k =>
        apiFetch(`/api/files/${k}`).then(r => r.json()).then(a => [k, a.length]).catch(() => [k, 0]))
    ).then(pairs => setCounts(Object.fromEntries(pairs)));
    load();
  }, []);

  const isPlaying = status.status === 'playing';
  const isPaused  = status.status === 'paused';
  const mode      = status.mode || 'slideshow';
  const previewUrl = status.currentSlideUrl || null;

  const state = !connected ? { cls: 'pill-off',  label: 'Offline' }
    : mode === 'video'     ? { cls: 'pill-live', label: 'Video' }
    : isPaused             ? { cls: 'pill-hold', label: 'Paused' }
    : status.status === 'stopped' ? { cls: 'pill-off', label: 'Stopped' }
    : { cls: 'pill-live', label: 'On air' };

  const total = status.totalSlides || counts.pictures || 0;
  const pad = n => String(n).padStart(2, '0');

  const playerUrl = `${window.location.protocol}//${window.location.hostname}:3000/player.html`;

  return (
    <>
      <div className="cols cols-2">
        <div>
          <div className="tally">
            <div className="tally-top">
              <span className={`pill ${state.cls}`}><span className="tally-dot" />{state.label}</span>
              <span className="tally-meta">
                Slide {pad((status.currentSlide ?? 0) + 1)} / {pad(total)}
              </span>
            </div>

            <div className="preview">
              <SlidePreview
                urls={status.currentSlideUrls || (previewUrl ? [previewUrl] : [])}
                layout={config?.slideshow?.layout || 'single'}
                style={{ width: '100%', height: '100%' }}
              />
              {!previewUrl && (
                <div className="preview-empty" style={{ background: '#000' }}>
                  <Icon name="tv" size="lg" />
                  <span>{connected ? 'Open the TV player to begin' : 'Connecting to the player…'}</span>
                </div>
              )}
              {previewUrl && (
                <div className="pv-foot">
                  <Icon name={mode === 'video' ? 'film' : 'image'} size="sm" />
                  <span className="nm">{mode === 'video' ? 'Video playing' : 'Slideshow'} · {status.status}</span>
                </div>
              )}
            </div>

            <div className="transport">
              <button className="tbtn tbtn-key"
                onClick={() => sendCommand(isPlaying ? 'pause' : 'play')}>
                <Icon name={isPlaying ? 'pause' : 'play'} size="lg" />
                {isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}
              </button>
              <button className="tbtn" onClick={() => sendCommand('next')}>
                <Icon name="next" />Next
              </button>
              <button className="tbtn" onClick={() => sendCommand('restart-slideshow')}>
                <Icon name="restart" />Restart
              </button>
              <button className="tbtn" onClick={() => sendCommand('stop')}>
                <Icon name="stop" />Stop
              </button>
            </div>

            <button className="cue-btn" onClick={() => setShowCues(true)}>
              <Icon name="cue" />Play Instructions
              <span className="n">{counts.instructionvideos}</span>
            </button>
          </div>

          <div className="slab">Library</div>
          <div className="libline">
            {[
              ['pictures', 'Pictures'],
              ['videos', 'Video'],
              ['music', 'Music'],
              ['instructionvideos', 'Clips'],
            ].map(([k, label]) => (
              <div key={k} className="lib">
                <div className="lib-n">{counts[k]}</div>
                <div className="lib-l">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="slab slab-first">The TV</div>
          <div className="group">
            <a className="srow" href={playerUrl} target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="srow-l">
                <div className="srow-t">Open TV player</div>
                <div className="srow-d">The page that runs on the lobby screen</div>
              </div>
              <Icon name="tv" size="sm" />
            </a>
            <div className="srow">
              <div className="srow-l"><div className="srow-t">Layout</div></div>
              <div className="srow-v">{config?.slideshow?.layout || 'single'}</div>
            </div>
            <div className="srow">
              <div className="srow-l"><div className="srow-t">Per slide</div></div>
              <div className="srow-v">{config?.slideshow?.defaultDuration ?? 5}s</div>
            </div>
            <div className="srow">
              <div className="srow-l"><div className="srow-t">Interval video</div></div>
              <div className="srow-v">
                {config?.video?.enabled === false ? 'Off' : `${config?.video?.intervalMinutes ?? 5} min`}
              </div>
            </div>
          </div>

          <div className="slab">Keyboard</div>
          <div className="group">
            <button className="srow" onClick={() => setShowKeys(k => !k)}
              style={{ width: '100%', background: 'none', border: 0, borderBottom: showKeys ? '1px solid var(--line)' : 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
              <Icon name="keyboard" size="sm" />
              <div className="srow-l"><div className="srow-t">Keyboard shortcuts</div></div>
              <Icon name="chevron" size="sm"
                className={showKeys ? 'rot-down' : ''}
                />
            </button>
            {showKeys && (
              <div className="kbds">
                {SHORTCUTS.map(([a, k]) => (
                  <div key={a} className="kbd-row"><span>{a}</span><span className="kbd">{k}</span></div>
                ))}
              </div>
            )}
          </div>
          <p className="hint">Shortcuts work on the TV player window, not here.</p>
        </div>
      </div>

      {showCues && (
        <InstructionSheet onClose={() => setShowCues(false)} sendCommand={sendCommand} toast_={toast_} />
      )}
    </>
  );
}
