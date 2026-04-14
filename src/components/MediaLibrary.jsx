import { useState, useEffect, useCallback } from 'react';
import { apiFetch, uploadFiles } from '../api.js';

const FOLDERS = {
  pictures:          { icon:'🖼️', label:'Pictures',          accept:'image/*',  color:'#3b82f6' },
  videos:            { icon:'🎬', label:'Videos',             accept:'video/*',  color:'#ef4444' },
  music:             { icon:'🎵', label:'Music',              accept:'audio/*',  color:'#22c55e' },
  instructionvideos: { icon:'▶',  label:'Instruction Videos', accept:'video/*',  color:'#7c3aed' },
};

const fmtSize = b => !b ? '0 B' : b < 1e6 ? (b/1024).toFixed(1)+' KB' : b < 1e9 ? (b/1e6).toFixed(1)+' MB' : (b/1e9).toFixed(2)+' GB';
const fmtDate = d => new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const baseName = fn => fn.replace(/\.[^/.]+$/,'').replace(/[-_]/g,' ');
const isImg = n => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(n);
const isVid = n => /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(n);
const isAud = n => /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(n);
const fileIcon = n => isImg(n)?'🖼️':isVid(n)?'🎬':isAud(n)?'🎵':'📄';

export default function MediaLibrary() {
  const [folder, setFolder]       = useState('pictures');
  const [files, setFiles]         = useState([]);
  const [counts, setCounts]       = useState({});
  const [selected, setSelected]   = useState(new Set()); // multi-select
  const [search, setSearch]       = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [viewMode, setViewMode]   = useState('grid');
  const [inputKey, setInputKey]   = useState(0);
  const [toast, setToast]         = useState(null);
  const [deleting, setDeleting]   = useState(false);

  const showToast = useCallback((msg, err=false) => {
    setToast({msg,err}); setTimeout(()=>setToast(null), 3500);
  }, []);

  async function loadFiles(f) {
    try { setFiles(await apiFetch(`/api/files/${f}`).then(r=>r.json())); }
    catch { setFiles([]); }
  }

  async function loadCounts() {
    const c = {};
    await Promise.all(Object.keys(FOLDERS).map(async k => {
      try { c[k] = (await apiFetch(`/api/files/${k}`).then(r=>r.json())).length; }
      catch { c[k] = 0; }
    }));
    setCounts(c);
  }

  useEffect(() => { loadFiles(folder); loadCounts(); setSelected(new Set()); }, [folder]);

  async function doUpload(fileList, targetFolder) {
    if (!fileList?.length) return;
    const f = targetFolder || folder;
    const total = fileList.length;
    setUploading(true);
    setUploadMsg(total > 1 ? `Uploading 0 / ${total}…` : 'Uploading…');
    try {
      const data = await uploadFiles(f, fileList, (done, all) => {
        setUploadMsg(`Uploading ${done} / ${all}…`);
      });
      showToast(`✓ Uploaded ${data.files.length} file${data.files.length !== 1 ? 's' : ''}`);
      if (f === folder) await loadFiles(folder);
      await loadCounts();
    } catch(err) { showToast(`✗ ${err.message}`, true); }
    finally { setUploading(false); setUploadMsg(''); setInputKey(k=>k+1); }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const names = [...selected];
    if (!confirm(`Delete ${names.length} file${names.length>1?'s':''}?`)) return;
    setDeleting(true);
    let failed = 0;
    await Promise.all(names.map(async name => {
      try { await apiFetch(`/api/files/${folder}/${encodeURIComponent(name)}`, {method:'DELETE'}); }
      catch { failed++; }
    }));
    setSelected(new Set());
    await loadFiles(folder);
    await loadCounts();
    setDeleting(false);
    showToast(failed > 0 ? `✗ ${failed} failed to delete` : `✓ Deleted ${names.length} file${names.length>1?'s':''}`);
  }

  function toggleSelect(name, e) {
    // Shift-click or ctrl/cmd-click adds to selection; plain click sets single
    const next = new Set(selected);
    if (e.shiftKey || e.ctrlKey || e.metaKey || selected.size > 0) {
      if (next.has(name)) next.delete(name); else next.add(name);
    } else {
      if (next.has(name) && next.size === 1) next.clear(); else { next.clear(); next.add(name); }
    }
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(filtered.map(f=>f.name)));
  }

  function clearSelection() { setSelected(new Set()); }

  const meta = FOLDERS[folder];
  const filtered = files.filter(f=>f.name.toLowerCase().includes(search.toLowerCase()));
  const singleSelected = selected.size === 1 ? files.find(f=>f.name===[...selected][0]) : null;

  // Direct upload handler - not a component to avoid remount issues
  function uploadLabel(label, targetFolder, btnClass) {
    return (
      <label className={btnClass || 'btn btn-primary'} style={{cursor:'pointer'}}>
        {uploading ? (uploadMsg || 'Uploading…') : label}
        <input
          key={`ul-${targetFolder||folder}-${inputKey}`}
          type="file" multiple
          accept={FOLDERS[targetFolder||folder]?.accept || meta.accept}
          style={{display:'none'}}
          disabled={uploading}
          onChange={e => { if (targetFolder) setFolder(targetFolder); doUpload(e.target.files, targetFolder || folder); }}
        />
      </label>
    );
  }

  return (
    <>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,marginBottom:4}}>Media Library</h1>
          <p style={{color:'var(--gray-500)'}}>Manage pictures, music, videos and instruction videos</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn btn-ghost" onClick={()=>{loadFiles(folder);loadCounts();}}>↺ Refresh</button>
          {uploadLabel("⬆ Upload Files")}
        </div>
      </div>

      <div className="media-layout">
        {/* Sidebar */}
        <div className="media-sidebar">
          <div style={{fontWeight:700,fontSize:12,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Library</div>
          {Object.entries(FOLDERS).map(([k,{icon,label}])=>(
            <div key={k} className={`folder-item ${folder===k?'active':''}`}
              onClick={()=>{setFolder(k);setSearch('');}}>
              <span style={{fontSize:16}}>{icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div className="folder-name">{label}</div>
                <div className="folder-count">{counts[k]??'—'} files</div>
              </div>
              {k==='instructionvideos'&&<span style={{fontSize:9,background:'#7c3aed',color:'#fff',borderRadius:4,padding:'1px 4px',fontWeight:700}}>NEW</span>}
            </div>
          ))}

          <div style={{marginTop:16,paddingTop:14,borderTop:'1px solid var(--gray-200)'}}>
            <div style={{fontWeight:700,fontSize:12,color:'var(--gray-500)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Quick Upload</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {Object.entries(FOLDERS).map(([k,{icon,label,accept}])=>(
                <label key={k} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:8,background:'var(--gray-50)',border:'1px solid var(--gray-200)',cursor:'pointer',transition:'all .15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.background='var(--primary-light)';e.currentTarget.style.borderColor='var(--primary)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--gray-50)';e.currentTarget.style.borderColor='var(--gray-200)';}}>
                  <input key={`q-${k}-${inputKey}`} type="file" multiple accept={accept} style={{display:'none'}}
                    disabled={uploading} onChange={e=>{setFolder(k);doUpload(e.target.files,k);}}/><span style={{fontSize:16}}>{icon}</span>
                  <span style={{fontSize:12,fontWeight:500,color:'var(--gray-700)',flex:1}}>Add {label}</span>
                  <span style={{fontSize:11,color:'var(--gray-400)'}}>⬆</span>
                </label>
              ))}
            </div>
          </div>
          {folder==='instructionvideos'&&(
            <div style={{marginTop:12,padding:'9px 11px',background:'rgba(124,58,237,.07)',border:'1px solid rgba(124,58,237,.2)',borderRadius:8,fontSize:11,color:'#6d28d9',lineHeight:1.5}}>
              💡 Filename = button label in Play Instructions
            </div>
          )}
        </div>

        {/* File grid */}
        <div className="media-main"
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);doUpload(e.dataTransfer.files);}}
          style={{outline:dragOver?'3px dashed var(--primary)':'none',outlineOffset:-3}}>

          <div className="media-toolbar">
            <input className="search-input" placeholder="Search files…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
              <button className={`filter-btn ${viewMode==='grid'?'active':''}`} onClick={()=>setViewMode('grid')}>⊞</button>
              <button className={`filter-btn ${viewMode==='list'?'active':''}`} onClick={()=>setViewMode('list')}>☰</button>
            </div>
          </div>

          {/* Selection toolbar */}
          <div style={{padding:'6px 14px',fontSize:12,borderBottom:'1px solid var(--gray-100)',display:'flex',alignItems:'center',gap:10,minHeight:36,flexWrap:'wrap'}}>
            {selected.size === 0 ? (
              <>
                <span style={{color:'var(--gray-400)'}}>{meta.icon} {filtered.length} file{filtered.length!==1?'s':''}</span>
                {filtered.length > 0 && <button onClick={selectAll} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--primary)',fontFamily:'var(--font)',padding:0}}>Select all</button>}
                {dragOver && <span style={{color:'var(--primary)',fontWeight:600}}>Drop to upload →</span>}
              </>
            ) : (
              <>
                <span style={{fontWeight:600,color:'var(--gray-800)'}}>{selected.size} selected</span>
                <button onClick={selectAll} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--primary)',fontFamily:'var(--font)',padding:0}}>Select all</button>
                <button onClick={clearSelection} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--gray-400)',fontFamily:'var(--font)',padding:0}}>Clear</button>
                <div style={{marginLeft:'auto'}}>
                  <button className="btn btn-danger btn-sm" onClick={deleteSelected} disabled={deleting}>
                    {deleting ? '⏳ Deleting…' : `🗑 Delete ${selected.size} file${selected.size>1?'s':''}`}
                  </button>
                </div>
              </>
            )}
          </div>

          {filtered.length===0 ? (
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,color:'var(--gray-400)',padding:32}}>
              <span style={{fontSize:40}}>{meta.icon}</span>
              <div style={{fontSize:15,fontWeight:600}}>No {meta.label.toLowerCase()} yet</div>
              {uploadLabel(`Upload ${meta.label}`, undefined, "btn btn-outline")}
            </div>
          ) : viewMode==='grid' ? (
            <div className="files-grid">
              {filtered.map(file=>(
                <div key={file.name}
                  className={`file-card ${selected.has(file.name)?'selected':''}`}
                  onClick={e=>toggleSelect(file.name,e)}
                  title="Click to select · Ctrl+click to multi-select">
                  <div className="file-thumb">
                    {isImg(file.name)?<img src={file.url} alt={file.name} loading="lazy"/>:<span style={{fontSize:28}}>{fileIcon(file.name)}</span>}
                  </div>
                  <div className="file-info">
                    <div className="file-name" title={file.name} style={folder==='instructionvideos'?{fontWeight:700,color:'#7c3aed',textTransform:'capitalize'}:{}}>{folder==='instructionvideos'?baseName(file.name):file.name}</div>
                    <div className="file-meta">{fmtSize(file.size)}</div>
                  </div>
                  {selected.has(file.name)&&<div className="file-check">✓</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{flex:1,overflowY:'auto'}}>
              {filtered.map(file=>(
                <div key={file.name} onClick={e=>toggleSelect(file.name,e)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderBottom:'1px solid var(--gray-100)',cursor:'pointer',background:selected.has(file.name)?'var(--primary-light)':'transparent'}}>
                  <div style={{width:18,height:18,border:`2px solid ${selected.has(file.name)?'var(--primary)':'var(--gray-300)'}`,borderRadius:4,background:selected.has(file.name)?'var(--primary)':'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {selected.has(file.name)&&<span style={{color:'#fff',fontSize:10}}>✓</span>}
                  </div>
                  <span style={{fontSize:20,flexShrink:0}}>{fileIcon(file.name)}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:folder==='instructionvideos'?'#7c3aed':'inherit'}}>{folder==='instructionvideos'?baseName(file.name):file.name}</div>
                    <div style={{fontSize:10,color:'var(--gray-400)'}}>{fmtSize(file.size)}</div>
                  </div>
                  <div style={{fontSize:11,color:'var(--gray-400)',whiteSpace:'nowrap'}}>{fmtDate(file.modified)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="media-detail">
          {selected.size > 1 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,textAlign:'center',minHeight:200}}>
              <span style={{fontSize:40}}>📂</span>
              <div style={{fontWeight:700,fontSize:16}}>{selected.size} files selected</div>
              <div style={{fontSize:13,color:'var(--gray-500)'}}>{[...selected].map(n=>folder==='instructionvideos'?baseName(n):n).join(', ')}</div>
              <button className="btn btn-danger" onClick={deleteSelected} disabled={deleting} style={{marginTop:8}}>
                {deleting?'⏳ Deleting…':`🗑 Delete all ${selected.size} files`}
              </button>
              <button className="btn btn-ghost" onClick={clearSelection}>Clear selection</button>
            </div>
          ) : singleSelected ? (
            <>
              {isImg(singleSelected.name)&&<img src={singleSelected.url} alt={singleSelected.name} style={{width:'100%',aspectRatio:'16/10',objectFit:'cover',borderRadius:8,marginBottom:12}}/>}
              {(isVid(singleSelected.name)||folder==='instructionvideos')&&<video src={singleSelected.url} controls style={{width:'100%',aspectRatio:'16/9',objectFit:'contain',borderRadius:8,marginBottom:12,background:'#000'}}/>}
              {isAud(singleSelected.name)&&<div style={{padding:16,background:'var(--gray-100)',borderRadius:8,textAlign:'center',marginBottom:12}}><div style={{fontSize:36,marginBottom:10}}>🎵</div><audio src={singleSelected.url} controls style={{width:'100%'}}/></div>}
              {folder==='instructionvideos'&&<div style={{background:'rgba(124,58,237,.07)',border:'1px solid rgba(124,58,237,.2)',borderRadius:8,padding:'9px 12px',marginBottom:12,fontSize:12}}><div style={{fontWeight:700,color:'#6d28d9',marginBottom:3}}>▶ Button label</div><div style={{color:'#7c3aed',fontWeight:700,fontSize:15,textTransform:'capitalize'}}>{baseName(singleSelected.name)}</div></div>}
              <div style={{fontWeight:700,fontSize:13,marginBottom:8,wordBreak:'break-all'}}>{singleSelected.name}</div>
              <div style={{background:'var(--gray-50)',border:'1px solid var(--gray-200)',borderRadius:8,padding:10,fontSize:12,marginBottom:12}}>
                {[['Size',fmtSize(singleSelected.size)],['Modified',fmtDate(singleSelected.modified)],['Type',singleSelected.name.split('.').pop().toUpperCase()]].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--gray-100)'}}>
                    <span style={{color:'var(--gray-500)'}}>{l}</span><span style={{fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                <a href={singleSelected.url} download className="btn btn-outline w-full">⬇ Download</a>
                <button className="btn btn-danger w-full" onClick={()=>{ setSelected(new Set([singleSelected.name])); deleteSelected(); }}>🗑 Delete</button>
              </div>
            </>
          ) : (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:10,color:'var(--gray-400)',textAlign:'center',minHeight:200}}>
              <span style={{fontSize:36}}>←</span>
              <div style={{fontWeight:600}}>Select files</div>
              <div style={{fontSize:12}}>Click to select one · Ctrl+click for multiple</div>
            </div>
          )}
        </div>
      </div>

      {toast&&<div className="toast" style={{background:toast.err?'var(--danger)':'var(--gray-900)'}}>{toast.msg}</div>}
    </>
  );
}
