import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { useApp } from '../context.js';
import SlidePreview from './SlidePreview.jsx';
import Slider from './Slider.jsx';
import Icon from './Icon.jsx';

const EFFECTS = [
  { id:'fade',     label:'Fade',     desc:'Smooth opacity' },
  { id:'slide',    label:'Slide',    desc:'Horizontal slide' },
  { id:'zoom',     label:'Zoom',     desc:'Scale in/out' },
  { id:'flip',     label:'Flip',     desc:'3D flip' },
  { id:'cube',     label:'Cube',     desc:'3D cube' },
  { id:'dissolve', label:'Dissolve', desc:'Blur dissolve' },
  { id:'wipe',     label:'Wipe',     desc:'Directional reveal' },
  { id:'push',     label:'Push',     desc:'Push out' },
];

const LAYOUTS = [
  { id:'single',   label:'Single',       desc:'1 full screen',  count:1, cols:'1fr',           rows:'1fr',           spans:[] },
  { id:'grid-2h',  label:'Side by Side', desc:'2 across',       count:2, cols:'1fr 1fr',       rows:'1fr',           spans:[] },
  { id:'grid-2v',  label:'Stacked',      desc:'2 down',         count:2, cols:'1fr',           rows:'1fr 1fr',       spans:[] },
  { id:'triptych', label:'Triptych',     desc:'3, wider centre',count:3, cols:'1fr 1.4fr 1fr', rows:'1fr',           spans:[] },
  { id:'grid-3',   label:'1+2',          desc:'1 large + 2',    count:3, cols:'2fr 1fr',       rows:'1fr 1fr',       spans:[{i:0,row:'span 2'}] },
  { id:'grid-4',   label:'2×2 Grid',     desc:'4 images',       count:4, cols:'1fr 1fr',       rows:'1fr 1fr',       spans:[] },
  { id:'focus',    label:'Focus',        desc:'1 large + 3',    count:4, cols:'1fr 1fr 1fr',   rows:'3fr 1fr',       spans:[{i:0,col:'span 3'}] },
  { id:'grid-5',   label:'1+4',          desc:'1 + 4 sidebar',  count:5, cols:'2fr 1fr',       rows:'repeat(4,1fr)', spans:[{i:0,row:'span 4'}] },
  { id:'grid-6',   label:'3×2 Grid',     desc:'6 images',       count:6, cols:'1fr 1fr 1fr',   rows:'1fr 1fr',       spans:[] },
  { id:'grid-8',   label:'4×2 Grid',     desc:'8 images',       count:8, cols:'repeat(4,1fr)', rows:'1fr 1fr',       spans:[] },
  { id:'grid-9',   label:'3×3 Grid',     desc:'9 images',       count:9, cols:'1fr 1fr 1fr',   rows:'1fr 1fr 1fr',   spans:[] },
];

const SPEED_PRESETS = [
  { value:'fast',   label:'Fast (2s)',   dur:2 },
  { value:'normal', label:'Normal (5s)', dur:5 },
  { value:'slow',   label:'Slow (10s)',  dur:10 },
  { value:'custom', label:'Custom',      dur:null },
];

const EASINGS = [
  { value:'ease-in-out', label:'Ease in out' },
  { value:'ease-in',     label:'Ease in' },
  { value:'ease-out',    label:'Ease out' },
  { value:'linear',      label:'Linear' },
];

function LayThumb({ l }) {
  return (
    <div className="lay-thumb" style={{ gridTemplateColumns: l.cols, gridTemplateRows: l.rows }}>
      {Array.from({ length: l.count }, (_, i) => {
        const s = l.spans.find(x => x.i === i);
        return <span key={i} style={{ gridRow: s?.row, gridColumn: s?.col }} />;
      })}
    </div>
  );
}

// Defined outside the component: an inline definition remounts on every
// keystroke, which breaks slider drags.
function VolumeRow({ label, hint, value, master, onChange }) {
  return (
    <div className="vrow">
      <div className="vrow-l">
        <div className="srow-t">{label}</div>
        {hint && <div className="srow-d">{hint}</div>}
      </div>
      <div className="vrow-c">
        <Slider min={0} max={100} value={value} onChange={onChange} width={120} />
        <span className="srow-v" style={{ minWidth: 42, textAlign: 'right' }}>{value}%</span>
      </div>
      {master !== undefined && (
        <div className="srow-d" style={{ width: '100%', marginTop: -2 }}>
          Plays at {Math.round(master * value / 100)}%
        </div>
      )}
    </div>
  );
}

export default function SlideshowConfig() {
  const { config, saveConfig, status, socket } = useApp();
  const [local, setLocal] = useState(null);
  const [previewFiles, setPreviewFiles] = useState([]);
  const [liveIndex, setLiveIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (config && !local) setLocal(JSON.parse(JSON.stringify(config))); }, [config, local]);

  useEffect(() => {
    apiFetch('/api/config').then(r => r.json())
      .then(cfg => setLocal(prev => prev || JSON.parse(JSON.stringify(cfg)))).catch(() => {});
    apiFetch('/api/files/pictures').then(r => r.json()).then(setPreviewFiles).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = s => { if (s.currentSlide !== undefined) setLiveIndex(s.currentSlide); };
    socket.on('status', handler);
    return () => socket.off('status', handler);
  }, [socket]);

  function update(keyPath, value) {
    setLocal(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const parts = keyPath.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    await saveConfig(local);
    setSaving(false);
  }

  if (!local) return <div className="empty"><p>Loading configuration…</p></div>;

  const sl = local.slideshow || {};
  const vi = local.video || {};
  const au = local.audio || {};

  const layout = LAYOUTS.find(l => l.id === sl.layout) || LAYOUTS[0];
  const effect = EFFECTS.find(e => e.id === sl.transitionEffect) || EFFECTS[0];
  const master = au.masterVolume ?? 75;
  const dirty = config && JSON.stringify(config) !== JSON.stringify(local);

  return (
    <div className="cols cols-2">
      <div>
        <div className="slab slab-first">Quick settings</div>
        <div className="group">
          <div className="vrow">
            <div className="vrow-l"><div className="srow-t">Seconds per slide</div></div>
            <div className="vrow-c">
              <Slider min={1} max={60} value={sl.defaultDuration || 5}
                onChange={v => update('slideshow.defaultDuration', v)} width={120} />
              <span className="srow-v" style={{ minWidth: 42, textAlign: 'right' }}>{sl.defaultDuration || 5}s</span>
            </div>
          </div>
          <div className="vrow">
            <div className="vrow-l"><div className="srow-t">Video interval</div></div>
            <div className="vrow-c">
              <Slider min={1} max={60} value={vi.intervalMinutes || 5}
                onChange={v => update('video.intervalMinutes', v)} width={120} />
              <span className="srow-v" style={{ minWidth: 42, textAlign: 'right' }}>{vi.intervalMinutes || 5}m</span>
            </div>
          </div>
          <div className="srow">
            <div className="srow-l">
              <div className="srow-t">Interrupt with videos</div>
              <div className="srow-d">Plays a video from the Videos folder on the interval above</div>
            </div>
            <button className={`sw ${vi.enabled !== false ? 'on' : ''}`} role="switch"
              aria-checked={vi.enabled !== false} aria-label="Interrupt with videos"
              onClick={() => update('video.enabled', vi.enabled === false)} />
          </div>
          <div className="srow">
            <div className="srow-l">
              <div className="srow-t">Random slide order</div>
              <div className="srow-d">Reshuffles each time the list reloads</div>
            </div>
            <button className={`sw ${sl.randomOrder === true ? 'on' : ''}`} role="switch"
              aria-checked={sl.randomOrder === true} aria-label="Random slide order"
              onClick={() => update('slideshow.randomOrder', sl.randomOrder !== true)} />
          </div>
        </div>

        <div className="slab">Volume</div>
        <div className="note">
          Actual volume is <b>master × category</b>. Master 80% with music at 50% plays music at 40%.
        </div>
        <div className="group">
          <VolumeRow label="Master" hint="Scales everything below" value={master}
            onChange={v => update('audio.masterVolume', v)} />
          <VolumeRow label="Music" hint="Background music" value={au.musicVolume ?? 100} master={master}
            onChange={v => update('audio.musicVolume', v)} />
          <VolumeRow label="Interval videos" hint="Automatic scheduled videos" value={au.intervalVideoVolume ?? 100} master={master}
            onChange={v => update('audio.intervalVideoVolume', v)} />
          <VolumeRow label="Instruction videos" hint="Played from Play Instructions" value={au.instructionVideoVolume ?? 100} master={master}
            onChange={v => update('audio.instructionVideoVolume', v)} />
        </div>

        <div className="slab">Layout <span className="n">{LAYOUTS.length}</span></div>
        <div className="group">
          <div className="lay-grid">
            {LAYOUTS.map(l => (
              <button key={l.id} className={`lay ${sl.layout === l.id ? 'on' : ''}`}
                aria-pressed={sl.layout === l.id} onClick={() => update('slideshow.layout', l.id)}>
                <LayThumb l={l} />
                <div className="lay-n">{l.label}</div>
                <div className="lay-d">{l.desc}</div>
              </button>
            ))}
          </div>
          {sl.layout !== 'single' && (
            <p className="hint" style={{ padding: '0 14px 12px', margin: 0 }}>
              Advances {layout.count} image{layout.count > 1 ? 's' : ''} per step.
            </p>
          )}
        </div>

        <div className="slab">Transition <span className="n">{EFFECTS.length}</span></div>
        <div className="group">
          <div className="fx-grid">
            {EFFECTS.map(e => (
              <button key={e.id} className={`fxcard ${sl.transitionEffect === e.id ? 'on' : ''}`}
                aria-pressed={sl.transitionEffect === e.id}
                onClick={() => update('slideshow.transitionEffect', e.id)}>
                <div className="fx-swatch" />
                <div className="fx-n">{e.label}</div>
                <div className="fx-d">{e.desc}</div>
              </button>
            ))}
          </div>
          <div className="group-pad" style={{ borderTop: '1px solid var(--line)' }}>
            <label className="field">
              <span className="flabel">Transition duration (seconds)</span>
              <input className="input" type="number" min="0.1" max="5" step="0.1"
                value={sl.transitionDuration ?? 1}
                onChange={e => update('slideshow.transitionDuration', +e.target.value)} />
            </label>
            <label className="field">
              <span className="flabel">Easing</span>
              <select className="select" value={sl.easing || 'ease-in-out'}
                onChange={e => update('slideshow.easing', e.target.value)}>
                {EASINGS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="slab">Timing</div>
        <div className="group">
          <div className="group-pad">
            <label className="field">
              <span className="flabel">Speed preset</span>
              <select className="select" value={sl.speedPreset || 'normal'}
                onChange={e => {
                  const p = SPEED_PRESETS.find(x => x.value === e.target.value);
                  update('slideshow.speedPreset', e.target.value);
                  if (p?.dur) update('slideshow.defaultDuration', p.dur);
                }}>
                {SPEED_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="flabel">Default duration (seconds)</span>
              <input className="input" type="number" min="1" max="300"
                value={sl.defaultDuration || 5}
                onChange={e => update('slideshow.defaultDuration', +e.target.value)} />
              <span className="fhint">Per slide, or per grid block when a multi-image layout is used.</span>
            </label>
            <label className="field">
              <span className="flabel">Pause between cycles (minutes)</span>
              <input className="input" type="number" min="0" max="60"
                value={sl.pauseBetweenCycles || 0}
                onChange={e => update('slideshow.pauseBetweenCycles', +e.target.value)} />
            </label>
          </div>
          <div className="srow">
            <div className="srow-l"><div className="srow-t">Auto-advance slides</div></div>
            <button className={`sw ${sl.autoAdvance !== false ? 'on' : ''}`} role="switch"
              aria-checked={sl.autoAdvance !== false} aria-label="Auto-advance slides"
              onClick={() => update('slideshow.autoAdvance', sl.autoAdvance === false)} />
          </div>
          <div className="srow">
            <div className="srow-l"><div className="srow-t">Loop slideshow</div></div>
            <button className={`sw ${sl.loop !== false ? 'on' : ''}`} role="switch"
              aria-checked={sl.loop !== false} aria-label="Loop slideshow"
              onClick={() => update('slideshow.loop', sl.loop === false)} />
          </div>
          <div className="srow">
            <div className="srow-l"><div className="srow-t">Random order</div></div>
            <button className={`sw ${sl.randomOrder === true ? 'on' : ''}`} role="switch"
              aria-checked={sl.randomOrder === true} aria-label="Random order"
              onClick={() => update('slideshow.randomOrder', sl.randomOrder !== true)} />
          </div>
        </div>
      </div>

      {/* Live preview + save */}
      <div>
        <div className="sticky-side">
          <div className="slab slab-first">
            Preview
            <span className="n">{previewFiles.length ? `${(liveIndex % previewFiles.length) + 1} / ${previewFiles.length}` : '0'}</span>
          </div>
          <div className="tally">
            <div className="preview">
              <SlidePreview
                urls={previewFiles.length
                  ? Array.from({ length: layout.count }, (_, i) => previewFiles[(liveIndex + i) % previewFiles.length]?.url).filter(Boolean)
                  : []}
                layout={sl.layout || 'single'}
                style={{ width: '100%', height: '100%' }}
              />
              {previewFiles.length === 0 && (
                <div className="preview-empty">
                  <Icon name="image" size="lg" />
                  <span>Upload pictures to preview</span>
                </div>
              )}
            </div>
            <div className="tally-top" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}>
              <span className={`pill ${status.status === 'playing' ? 'pill-live' : 'pill-off'}`}>
                <span className="tally-dot" />{status.status === 'playing' ? 'On air' : status.status}
              </span>
            </div>
          </div>

          <div className="group" style={{ marginTop: 14 }}>
            {[
              ['Layout',   layout.label],
              ['Effect',   effect.label],
              ['Duration', `${sl.defaultDuration || 5}s`],
              ['Master',   `${master}%`],
              ['Music',    `${au.musicVolume ?? 100}% → ${Math.round(master * (au.musicVolume ?? 100) / 100)}%`],
              ['Videos',   `${au.intervalVideoVolume ?? 100}% → ${Math.round(master * (au.intervalVideoVolume ?? 100) / 100)}%`],
              ['Instr.',   `${au.instructionVideoVolume ?? 100}% → ${Math.round(master * (au.instructionVideoVolume ?? 100) / 100)}%`],
            ].map(([k, v]) => (
              <div key={k} className="srow">
                <div className="srow-l"><div className="srow-t">{k}</div></div>
                <div className="srow-v">{v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="b b-key" style={{ flex: 2 }} onClick={handleSave} disabled={saving || !dirty}>
              <Icon name="save" size="sm" />{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
            <button className="b b-ghost" style={{ flex: 1 }} disabled={!dirty}
              onClick={() => config && setLocal(JSON.parse(JSON.stringify(config)))}>
              <Icon name="restart" size="sm" />Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
