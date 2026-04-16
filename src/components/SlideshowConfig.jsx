import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import SlidePreview from './SlidePreview.jsx';
import Slider from './Slider.jsx';
import { useApp } from '../context.js';

// ── Constants ──────────────────────────────────────────────────────────────

const EFFECTS = [
  { id:'fade',     label:'Fade',     desc:'Smooth opacity',     g:'linear-gradient(135deg,#a78bfa,#6366f1)' },
  { id:'slide',    label:'Slide',    desc:'Horizontal slide',   g:'linear-gradient(135deg,#60a5fa,#818cf8)' },
  { id:'zoom',     label:'Zoom',     desc:'Scale in/out',       g:'linear-gradient(135deg,#34d399,#60a5fa)' },
  { id:'flip',     label:'Flip',     desc:'3D flip',            g:'linear-gradient(135deg,#f472b6,#818cf8)' },
  { id:'cube',     label:'Cube',     desc:'3D cube',            g:'linear-gradient(135deg,#fb923c,#f472b6)' },
  { id:'dissolve', label:'Dissolve', desc:'Blur dissolve',      g:'linear-gradient(135deg,#a3e635,#34d399)' },
  { id:'wipe',     label:'Wipe',     desc:'Directional reveal', g:'linear-gradient(135deg,#fbbf24,#f472b6)' },
  { id:'push',     label:'Push',     desc:'Push out',           g:'linear-gradient(135deg,#38bdf8,#818cf8)' },
];

const LAYOUT_COUNTS = {
  'single':1,'grid-2h':2,'grid-2v':2,'triptych':3,'grid-3':3,
  'grid-4':4,'focus':4,'grid-5':5,'grid-6':6,'grid-8':8,'grid-9':9,
};

const LAYOUTS = [
  { id:'single',   label:'Single',       desc:'1 image, full screen',    count:1,
    thumb: () => <div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#6366f1,#818cf8)',borderRadius:4}}/> },
  { id:'grid-2h',  label:'Side by Side', desc:'2 horizontal',            count:2,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{['#6366f1','#818cf8'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'grid-2v',  label:'Stacked',      desc:'2 vertical',              count:2,
    thumb: () => <div style={{display:'grid',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{['#6366f1','#818cf8'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'triptych', label:'Triptych',     desc:'3 columns, wider centre', count:3,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'1fr 1.4fr 1fr',gap:2,width:'100%',height:'100%'}}>{['#818cf8','#6366f1','#a78bfa'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'grid-3',   label:'1+2',          desc:'1 large + 2 stacked',     count:3,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}><div style={{background:'#6366f1',borderRadius:2,gridRow:'span 2'}}/>{['#818cf8','#a78bfa'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'grid-4',   label:'2×2 Grid',     desc:'4 images',                count:4,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{['#6366f1','#818cf8','#a78bfa','#c4b5fd'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'focus',    label:'Focus',        desc:'1 large + 3 strip',       count:4,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'3fr 1fr',gap:2,width:'100%',height:'100%'}}><div style={{background:'#6366f1',borderRadius:2,gridColumn:'span 3'}}/>{['#818cf8','#a78bfa','#c4b5fd'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'grid-5',   label:'1+4',          desc:'1 featured + 4 sidebar',  count:5,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gridTemplateRows:'repeat(4,1fr)',gap:2,width:'100%',height:'100%'}}><div style={{background:'#6366f1',borderRadius:2,gridRow:'span 4'}}/>{['#818cf8','#a78bfa','#c4b5fd','#7c3aed'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'grid-6',   label:'3×2 Grid',     desc:'6 images',                count:6,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{['#6366f1','#818cf8','#a78bfa','#c4b5fd','#7c3aed','#4f46e5'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'grid-8',   label:'4×2 Grid',     desc:'8 images',                count:8,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gridTemplateRows:'1fr 1fr',gap:2,width:'100%',height:'100%'}}>{['#6366f1','#818cf8','#a78bfa','#c4b5fd','#7c3aed','#4f46e5','#60a5fa','#34d399'].map((c,i)=><div key={i} style={{background:c,borderRadius:2}}/>)}</div> },
  { id:'grid-9',   label:'3×3 Grid',     desc:'9 images',                count:9,
    thumb: () => <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gridTemplateRows:'1fr 1fr 1fr',gap:2,width:'100%',height:'100%'}}>{Array.from({length:9},(_,i)=><div key={i} style={{background:`hsl(${230+i*12},70%,${60+i*3}%)`,borderRadius:2}}/>)}</div> },
];

const SPEED_PRESETS = [
  { value:'fast',   label:'Fast (2s)',   dur:2 },
  { value:'normal', label:'Normal (5s)', dur:5 },
  { value:'slow',   label:'Slow (10s)',  dur:10 },
  { value:'custom', label:'Custom',      dur:null },
];

// ── Sub-components defined OUTSIDE the main component ─────────────────────
// CRITICAL: Defining components inside a render function causes React to
// unmount/remount them on every state change, breaking slider drags and
// scrolling the page to top on every interaction.

function VolumeRow({ label, hint, value, onChange }) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--gray-100)'}}>
      <div>
        <div style={{fontSize:14,fontWeight:500,color:'var(--gray-700)'}}>{label}</div>
        {hint && <div style={{fontSize:11,color:'var(--gray-400)',marginTop:2}}>{hint}</div>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <Slider min={0} max={100} value={value} onChange={onChange} width={130} />
        <span style={{fontSize:14,fontWeight:600,minWidth:38,textAlign:'right'}}>{value}%</span>
      </div>
    </div>
  );
}

function Section({ id, title, subtitle, open, onToggle, children }) {
  return (
    <div className="card" style={{padding:0,marginBottom:16}}>
      <div className="section-header" onClick={() => onToggle(id)}>
        <div className="section-title">
          <div>
            <h3 style={{fontSize:15}}>{title}</h3>
            {subtitle && <p style={{fontSize:12,color:'var(--gray-400)',marginTop:2}}>{subtitle}</p>}
          </div>
        </div>
        <span style={{fontSize:16,color:'var(--gray-400)'}}>{open ? '∧' : '∨'}</span>
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SlideshowConfig() {
  const { config, saveConfig, status, socket } = useApp();
  const [local, setLocal] = useState(null);
  const [openSections, setOpenSections] = useState({ quick:true, layout:true, transitions:true, timing:false, volume:true, schedule:false });
  const [previewFiles, setPreviewFiles] = useState([]);
  const [liveIndex, setLiveIndex] = useState(0);
  const [liveUrl, setLiveUrl] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config && !local) setLocal(JSON.parse(JSON.stringify(config)));
  }, [config]);

  useEffect(() => {
    apiFetch('/api/config').then(r => r.json()).then(cfg => {
      setLocal(prev => prev || JSON.parse(JSON.stringify(cfg)));
    }).catch(() => {});
    apiFetch('/api/files/pictures').then(r => r.json()).then(setPreviewFiles).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = s => {
      if (s.currentSlide !== undefined) setLiveIndex(s.currentSlide);
      if (s.currentSlideUrl) setLiveUrl(s.currentSlideUrl);
    };
    socket.on('status', handler);
    return () => socket.off('status', handler);
  }, [socket]);

  const tog = id => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

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

  if (!local) return (
    <div style={{padding:60,textAlign:'center',color:'var(--gray-400)'}}>
      <div style={{fontSize:32,marginBottom:12}}>⚙️</div>Loading configuration...
    </div>
  );

  const sl = local.slideshow || {};
  const vi = local.video || {};
  const au = local.audio || {};

  const layout = LAYOUTS.find(l => l.id === sl.layout) || LAYOUTS[0];
  const effect = EFFECTS.find(e => e.id === sl.transitionEffect) || EFFECTS[0];

  const previewUrl = liveUrl || (previewFiles.length > 0 ? previewFiles[liveIndex % previewFiles.length]?.url : null);

  const getVal = keyPath => {
    const parts = keyPath.split('.');
    let v = local;
    for (const p of parts) v = v?.[p];
    return v;
  };

  return (
    <>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:28,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,marginBottom:4}}>Slideshow Configuration</h1>
          <p style={{color:'var(--gray-500)'}}>Layouts, transitions, timing and volume</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-ghost" onClick={() => config && setLocal(JSON.parse(JSON.stringify(config)))}>↺ Reset</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save'}</button>
        </div>
      </div>

      <div className="slideshow-two-col" style={{display:'grid',gridTemplateColumns:'1fr 310px',gap:20}}>
        <div>

          {/* Quick Settings */}
          <Section id="quick" title="⚡ Quick Settings" open={openSections.quick} onToggle={tog}>
            <div className="slider-row">
              <span className="slider-label">Slide Duration</span>
              <div className="slider-control">
                <Slider min={1} max={60} value={sl.defaultDuration || 5} onChange={v => update('slideshow.defaultDuration', v)} width={110} />
                <span className="slider-value">{sl.defaultDuration || 5}s</span>
              </div>
            </div>
            <div className="slider-row">
              <span className="slider-label">Video Interval</span>
              <div className="slider-control">
                <Slider min={1} max={60} value={vi.intervalMinutes || 5} onChange={v => update('video.intervalMinutes', v)} width={110} />
                <span className="slider-value">{vi.intervalMinutes || 5}m</span>
              </div>
            </div>
            <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
              <div className="checkbox-row">
                <input type="checkbox" id="videoEnabled"
                  checked={vi.enabled !== false}
                  onChange={e => update('video.enabled', e.target.checked)} />
                <label htmlFor="videoEnabled">Enable automatic video interruptions</label>
              </div>
              <div className="checkbox-row">
                <input type="checkbox" id="randomOrder"
                  checked={sl.randomOrder === true}
                  onChange={e => update('slideshow.randomOrder', e.target.checked)} />
                <label htmlFor="randomOrder">🔀 Random slide order</label>
              </div>
            </div>
          </Section>

          {/* Volume */}
          <Section id="volume" title="🔊 Volume" subtitle="Master controls all; sliders set per-category levels" open={openSections.volume} onToggle={tog}>
            <div style={{background:'var(--primary-light)',border:'1px solid rgba(37,99,235,.15)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:13,color:'var(--primary)'}}>
              💡 Actual volume = Master × Category. E.g. Master 80% × Music 50% = 40%.
            </div>
            <VolumeRow label="Master Volume" hint="Scales all other volumes" value={au.masterVolume ?? 75} onChange={v => update('audio.masterVolume', v)} />
            <VolumeRow label="Music" hint="Background music" value={au.musicVolume ?? 100} onChange={v => update('audio.musicVolume', v)} />
            <VolumeRow label="Interval Videos" hint="Automatic scheduled videos" value={au.intervalVideoVolume ?? 100} onChange={v => update('audio.intervalVideoVolume', v)} />
            <VolumeRow label="Instruction Videos" hint="Play Instructions button" value={au.instructionVideoVolume ?? 100} onChange={v => update('audio.instructionVideoVolume', v)} />
          </Section>

          {/* Layout */}
          <Section id="layout" title="⊞ Slideshow Layout" subtitle="How many images to show at once" open={openSections.layout} onToggle={tog}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12}}>
              {LAYOUTS.map(l => (
                <div key={l.id}
                  onClick={() => update('slideshow.layout', l.id)}
                  style={{border:`2px solid ${sl.layout === l.id ? 'var(--primary)' : 'var(--gray-200)'}`,background:sl.layout === l.id ? 'var(--primary-light)' : '#fff',borderRadius:10,padding:10,cursor:'pointer',transition:'all .15s',textAlign:'center'}}>
                  <div style={{width:'100%',aspectRatio:'16/9',marginBottom:8,borderRadius:4,overflow:'hidden'}}>{l.thumb()}</div>
                  <div style={{fontWeight:700,fontSize:12,color:sl.layout === l.id ? 'var(--primary)' : 'var(--gray-800)'}}>{l.label}</div>
                  <div style={{fontSize:10,color:'var(--gray-400)',marginTop:2}}>{l.desc}</div>
                </div>
              ))}
            </div>
            {sl.layout !== 'single' && (
              <div style={{padding:'9px 14px',background:'rgba(37,99,235,.06)',borderRadius:8,fontSize:13,color:'var(--primary)'}}>
                💡 Advances {layout.count} image{layout.count > 1 ? 's' : ''} per step.
              </div>
            )}
          </Section>

          {/* Transitions */}
          <Section id="transitions" title="✨ Transition Effect" subtitle="Animation between slides" open={openSections.transitions} onToggle={tog}>
            <div className="effects-grid" style={{marginBottom:16}}>
              {EFFECTS.map(({ id, label, desc, g }) => (
                <div key={id}
                  className={`effect-card ${sl.transitionEffect === id ? 'selected' : ''}`}
                  onClick={() => update('slideshow.transitionEffect', id)}>
                  <div className="effect-preview" style={{background:g}} />
                  <div className="effect-name">{label}</div>
                  <div className="effect-desc">{desc}</div>
                </div>
              ))}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Transition Duration (s)</label>
                <input type="number" min="0.1" max="5" step="0.1" className="form-input"
                  value={sl.transitionDuration || 1} onChange={e => update('slideshow.transitionDuration', +e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Easing</label>
                <select className="form-select" value={sl.easing || 'ease-in-out'} onChange={e => update('slideshow.easing', e.target.value)}>
                  <option value="ease-in-out">Ease In Out</option>
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="linear">Linear</option>
                </select>
              </div>
            </div>
          </Section>

          {/* Timing */}
          <Section id="timing" title="⏱ Timing" subtitle="Duration, order and looping" open={openSections.timing} onToggle={tog}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Speed Preset</label>
                <select className="form-select" value={sl.speedPreset || 'normal'}
                  onChange={e => {
                    const p = SPEED_PRESETS.find(x => x.value === e.target.value);
                    update('slideshow.speedPreset', e.target.value);
                    if (p?.dur) update('slideshow.defaultDuration', p.dur);
                  }}>
                  {SPEED_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Default Duration (s)</label>
                <input type="number" min="1" max="300" className="form-input"
                  value={sl.defaultDuration || 5} onChange={e => update('slideshow.defaultDuration', +e.target.value)} />
                <p className="form-hint">Per slide or per grid block</p>
              </div>
              <div className="form-group">
                <label className="form-label">Pause Between Cycles (min)</label>
                <input type="number" min="0" max="60" className="form-input"
                  value={sl.pauseBetweenCycles || 0} onChange={e => update('slideshow.pauseBetweenCycles', +e.target.value)} />
              </div>
              <div className="form-group" style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:8}}>
                {[
                  ['slideshow.autoAdvance', 'Auto-advance slides'],
                  ['slideshow.loop',        'Loop slideshow'],
                  ['slideshow.randomOrder', 'Random order'],
                ].map(([k, label]) => (
                  <div key={k} className="checkbox-row">
                    <input type="checkbox" id={k}
                      checked={getVal(k) !== false && getVal(k) !== undefined ? !!getVal(k) : false}
                      onChange={e => update(k, e.target.checked)} />
                    <label htmlFor={k}>{label}</label>
                  </div>
                ))}
              </div>
            </div>
          </Section>

        </div>

        {/* Live Preview */}
        <div>
          <div className="card" style={{position:'sticky',top:80}}>
            <div className="card-header" style={{marginBottom:12}}>
              <div className="card-title" style={{fontSize:14}}>
                <span style={{width:8,height:8,background:previewUrl ? 'var(--success)' : 'var(--gray-300)',borderRadius:'50%',display:'inline-block'}}></span>
                &nbsp;Live Preview
                {previewUrl && status.status === 'playing' && (
                  <span style={{fontSize:10,color:'var(--success)',fontWeight:500,marginLeft:6,background:'rgba(22,163,74,.1)',padding:'2px 6px',borderRadius:8}}>● LIVE</span>
                )}
              </div>
              <span style={{fontSize:12,color:'var(--gray-400)'}}>{liveIndex + 1} / {previewFiles.length || '?'}</span>
            </div>

            <div style={{borderRadius:8,overflow:'hidden',background:'#000',aspectRatio:'16/9',marginBottom:14,position:'relative'}}>
              <SlidePreview
                urls={(() => {
                  const count = LAYOUT_COUNTS[sl.layout || 'single'] || 1;
                  if (previewFiles.length === 0) return [];
                  return Array.from({length:count}, (_, i) => previewFiles[(liveIndex + i) % previewFiles.length]?.url).filter(Boolean);
                })()}
                layout={sl.layout || 'single'}
                style={{width:'100%',height:'100%'}}
              />
              {previewFiles.length === 0 && (
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,color:'var(--gray-400)'}}>
                  <span style={{fontSize:32}}>🖼️</span>
                  <span style={{fontSize:12}}>Upload pictures to preview</span>
                </div>
              )}
            </div>

            <div style={{fontSize:12,display:'flex',flexDirection:'column'}}>
              {[
                ['Layout',   layout.label],
                ['Effect',   effect.label],
                ['Duration', `${sl.defaultDuration || 5}s`],
                ['Master',   `${au.masterVolume ?? 75}%`],
                ['Music',    `${au.musicVolume ?? 100}% → ${Math.round((au.masterVolume ?? 75) * (au.musicVolume ?? 100) / 100)}%`],
                ['Video',    `${au.intervalVideoVolume ?? 100}% → ${Math.round((au.masterVolume ?? 75) * (au.intervalVideoVolume ?? 100) / 100)}%`],
                ['Instr.',   `${au.instructionVideoVolume ?? 100}% → ${Math.round((au.masterVolume ?? 75) * (au.instructionVideoVolume ?? 100) / 100)}%`],
              ].map(([k, v]) => (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--gray-100)'}}>
                  <span style={{color:'var(--gray-500)'}}>{k}</span>
                  <span style={{fontWeight:600,color:'var(--gray-800)'}}>{v}</span>
                </div>
              ))}
            </div>

            <button className="btn btn-primary w-full" style={{marginTop:16}} onClick={handleSave} disabled={saving}>
              {saving ? '⏳ Saving...' : '💾 Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
