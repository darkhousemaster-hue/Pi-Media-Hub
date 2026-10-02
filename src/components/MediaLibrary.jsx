import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, uploadFiles } from '../api.js';
import { useApp } from '../context.js';
import Icon from './Icon.jsx';

// `types` mirrors the server's fileFilter in server.js. Checking here means a
// wrong file is refused instantly, instead of after minutes of uploading it.
const VIDEO_TYPES = /\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/i;
const FOLDERS = {
  pictures:          { icon: 'image', label: 'Pictures', short: 'Pictures', accept: 'image/*',
                       types: /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i, typeList: 'JPG, PNG, GIF, WebP, BMP or SVG' },
  videos:            { icon: 'film',  label: 'Videos',   short: 'Videos',   accept: 'video/*',
                       types: VIDEO_TYPES, typeList: 'MP4, MOV, WebM, M4V, MKV, AVI or OGG' },
  music:             { icon: 'music', label: 'Music',    short: 'Music',    accept: 'audio/*',
                       types: /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i, typeList: 'MP3, WAV, M4A, AAC, FLAC, OGG or Opus' },
  instructionvideos: { icon: 'cue',   label: 'Instruction Videos', short: 'Clips', accept: 'video/*',
                       types: VIDEO_TYPES, typeList: 'MP4, MOV, WebM, M4V, MKV, AVI or OGG' },
};
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;   // multer's limit in server.js

const fmtSize = b => !b ? '0 B' : b < 1e6 ? (b/1024).toFixed(1)+' KB' : b < 1e9 ? (b/1e6).toFixed(1)+' MB' : (b/1e9).toFixed(2)+' GB';
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
const baseName = fn => fn.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
const stripExt = fn => fn.replace(/\.[^/.]+$/, '');
const extOf    = fn => (fn.match(/\.[^/.]+$/) || [''])[0];
const isImg = n => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(n);
const isVid = n => /\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/i.test(n);
const isAud = n => /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i.test(n);
const iconFor = n => isImg(n) ? 'image' : isVid(n) ? 'film' : isAud(n) ? 'music' : 'image';

export default function MediaLibrary() {
  const { toast_, socket } = useApp();
  const [folder, setFolder]     = useState('pictures');
  const [files, setFiles]       = useState([]);
  const [counts, setCounts]     = useState({});
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch]     = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);   // { sent, total, files, filesDone, startedAt }
  const [dragOver, setDragOver] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [openFile, setOpenFile] = useState(null);   // filename shown in the sheet
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const renameInputRef = useRef(null);

  const loadFiles = useCallback(async f => {
    try { setFiles(await apiFetch(`/api/files/${f}`).then(r => r.json())); }
    catch { setFiles([]); }
  }, []);

  const loadCounts = useCallback(async () => {
    const c = {};
    await Promise.all(Object.keys(FOLDERS).map(async k => {
      try { c[k] = (await apiFetch(`/api/files/${k}`).then(r => r.json())).length; }
      catch { c[k] = 0; }
    }));
    setCounts(c);
  }, []);

  useEffect(() => {
    loadFiles(folder); loadCounts();
    setSelected(new Set()); setOpenFile(null); setRenaming(false);
  }, [folder, loadFiles, loadCounts]);

  // The folder on screen right now. Async work must read this, not `folder`:
  // a quick upload switches folders, and its closure still held the old one,
  // so a successful upload never showed up in the list.
  const folderRef = useRef(folder);
  useEffect(() => { folderRef.current = folder; }, [folder]);

  // Uploads, renames and deletes from any device broadcast this. Without it
  // the list only changed when this very screen made the change.
  useEffect(() => {
    if (!socket) return;
    const onUpdate = ({ type } = {}) => {
      loadCounts();
      if (!type || type === folderRef.current) loadFiles(folderRef.current);
    };
    socket.on('media-updated', onUpdate);
    return () => socket.off('media-updated', onUpdate);
  }, [socket, loadFiles, loadCounts]);

  // Leaving or reloading the page kills an upload mid-file.
  useEffect(() => {
    if (!uploading) return;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  async function doUpload(fileList, targetFolder) {
    if (!fileList?.length) return;
    const f = targetFolder || folder;
    const rule = FOLDERS[f];
    const all = Array.from(fileList);
    // Upload what fits and say what was skipped: one stray .HEIC should not
    // throw away a whole batch of photos.
    const wrongType = all.filter(x => !rule.types.test(x.name));
    const tooBig = all.filter(x => rule.types.test(x.name) && x.size > MAX_UPLOAD_BYTES);
    const list = all.filter(x => !wrongType.includes(x) && !tooBig.includes(x));
    const names = arr => arr.slice(0, 3).map(x => x.name).join(', ') + (arr.length > 3 ? ` and ${arr.length - 3} more` : '');
    const skipped = [
      wrongType.length && `${names(wrongType)} can't go in ${rule.short}. Use ${rule.typeList}.`,
      tooBig.length && `${names(tooBig)} ${tooBig.length > 1 ? 'are' : 'is'} over the 2 GB limit.`,
    ].filter(Boolean).join(' ');
    if (!list.length) { toast_(skipped, true); setInputKey(k => k + 1); return; }
    setUploading(true);
    setProgress({ sent: 0, total: list.reduce((s, x) => s + x.size, 0), files: list.length, filesDone: 0, startedAt: Date.now() });
    try {
      const data = await uploadFiles(f, list, p => setProgress(prev => ({ ...prev, ...p })));
      const done = `Uploaded ${data.files.length} file${data.files.length !== 1 ? 's' : ''}.`;
      toast_(skipped ? `${done} Skipped: ${skipped}` : done, !!skipped);
      if (f === folderRef.current) await loadFiles(f);
      await loadCounts();
    } catch (err) { toast_(err.message, true); }
    finally { setUploading(false); setProgress(null); setInputKey(k => k + 1); }
  }

  async function deleteNames(names) {
    if (!names.length) return;
    if (!confirm(`Delete ${names.length} file${names.length > 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    let failed = 0;
    await Promise.all(names.map(async name => {
      try {
        const r = await apiFetch(`/api/files/${folder}/${encodeURIComponent(name)}`, { method: 'DELETE' });
        if (!r.ok) failed++;
      } catch { failed++; }
    }));
    setSelected(new Set()); setOpenFile(null); setRenaming(false);
    await loadFiles(folder); await loadCounts();
    setDeleting(false);
    toast_(failed ? `${failed} could not be deleted` : `Deleted ${names.length} file${names.length > 1 ? 's' : ''}`, !!failed);
  }

  function toggleSelect(name) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  function openSheet(name) {
    setOpenFile(name);
    setRenameValue(stripExt(name));
    setRenaming(false);
  }

  async function doRename(oldName) {
    const next = renameValue.trim();
    if (!next || next === stripExt(oldName)) { setRenaming(false); return; }
    setRenameBusy(true);
    try {
      const res = await apiFetch(`/api/files/${folder}/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Rename failed (${res.status})`);
      setRenaming(false);
      await loadFiles(folder);
      setOpenFile(data.name);
      setRenameValue(stripExt(data.name));
      toast_(`Renamed to ${data.name}`);
    } catch (err) {
      toast_(err.message, true);
      setTimeout(() => renameInputRef.current?.focus(), 0);
    }
    setRenameBusy(false);
  }

  const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  const pct = progress?.total ? Math.min(100, Math.floor((progress.sent / progress.total) * 100)) : 0;
  const upEta = (() => {
    if (!progress || !progress.total) return '';
    if (progress.sent >= progress.total) return 'saving on the Pi…';
    const secs = (Date.now() - progress.startedAt) / 1000;
    if (secs < 3 || progress.sent <= 0) return '';
    const left = (progress.total - progress.sent) / (progress.sent / secs);
    return left > 90 ? `about ${Math.round(left / 60)} min left` : `about ${Math.max(5, Math.round(left / 5) * 5)} s left`;
  })();
  const current = openFile ? files.find(f => f.name === openFile) : null;
  const meta = FOLDERS[folder];

  return (
    <>
      <div className="chips">
        {Object.entries(FOLDERS).map(([k, { icon, short }]) => (
          <button key={k} className={`chip ${folder === k ? 'on' : ''}`}
            aria-pressed={folder === k} onClick={() => { setFolder(k); setSearch(''); }}>
            <Icon name={icon} size="sm" />{short}
            <span className="c">{counts[k] ?? '—'}</span>
          </button>
        ))}
      </div>

      <div className={dragOver ? 'drop' : ''}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files); }}>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="search">
            <Icon name="search" size="sm" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${meta.short.toLowerCase()}`} aria-label={`Search ${meta.label}`} />
          </div>
          <div className="vtoggle">
            <button className={`vbtn ${viewMode === 'list' ? 'on' : ''}`} aria-label="List view"
              aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><Icon name="list" size="sm" /></button>
            <button className={`vbtn ${viewMode === 'grid' ? 'on' : ''}`} aria-label="Grid view"
              aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')}><Icon name="grid" size="sm" /></button>
          </div>
        </div>

        <div className="selbar">
          {selected.size === 0 ? (
            <>
              <span>{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
              {filtered.length > 0 && (
                <button className="link" onClick={() => setSelected(new Set(filtered.map(f => f.name)))}>Select all</button>
              )}
              <button className="link link-mute" onClick={() => { loadFiles(folder); loadCounts(); }}>Refresh</button>
              {dragOver && <span style={{ color: 'var(--brand-hi)', fontWeight: 600 }}>Drop to upload</span>}
              <label className="b b-key b-sm" style={{ marginLeft: 'auto', cursor: 'pointer' }}>
                <Icon name="upload" size="sm" />{uploading ? `Uploading ${pct}%` : 'Upload'}
                <input key={`u-${folder}-${inputKey}`} type="file" multiple accept={meta.accept}
                  style={{ display: 'none' }} disabled={uploading}
                  onChange={e => doUpload(e.target.files)} />
              </label>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{selected.size} selected</span>
              <button className="link" onClick={() => setSelected(new Set(filtered.map(f => f.name)))}>Select all</button>
              <button className="link link-mute" onClick={() => setSelected(new Set())}>Clear</button>
              <button className="b b-danger b-sm" style={{ marginLeft: 'auto' }} disabled={deleting}
                onClick={() => deleteNames([...selected])}>
                <Icon name="trash" size="sm" />{deleting ? 'Deleting…' : `Delete ${selected.size}`}
              </button>
            </>
          )}
        </div>

        {uploading && progress && (
          <div className="upbar">
            <div className="bar" role="progressbar" aria-label="Upload progress"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="bar-f" style={{ width: `${pct}%`, background: 'var(--brand)' }} />
            </div>
            <div className="upbar-t">
              <span>
                {progress.files > 1 && `${progress.filesDone} of ${progress.files} files · `}
                {fmtSize(progress.sent)} of {fmtSize(progress.total)}
                {progress.note ? ` · ${progress.note}` : upEta && ` · ${upEta}`}
              </span>
              <span>Keep this page open</span>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name={meta.icon} size="lg" />
            <h4>No {meta.label.toLowerCase()} yet</h4>
            <p>{folder === 'instructionvideos'
              ? 'The filename becomes the button label under Play Instructions.'
              : 'Drag files here, or use Upload above.'}</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="fgrid">
            {filtered.map(file => (
              <button key={file.name} className={`fcard ${selected.has(file.name) ? 'on' : ''}`}
                onClick={() => selected.size > 0 ? toggleSelect(file.name) : openSheet(file.name)}>
                <div className="fcard-t">
                  {isImg(file.name)
                    ? <img src={file.url} alt="" loading="lazy" />
                    : <Icon name={iconFor(file.name)} size="lg" />}
                </div>
                <div className="fcard-b">
                  <div className="fcard-n">{folder === 'instructionvideos' ? baseName(file.name) : file.name}</div>
                  <div className="fcard-s">{fmtSize(file.size)}</div>
                </div>
                {selected.has(file.name) && <span className="fcard-tick"><Icon name="check" size="sm" /></span>}
              </button>
            ))}
          </div>
        ) : (
          <div>
            {filtered.map(file => (
              <button key={file.name} className={`frow ${selected.has(file.name) ? 'on' : ''}`}
                onClick={() => selected.size > 0 ? toggleSelect(file.name) : openSheet(file.name)}>
                <span className="thumb">
                  {isImg(file.name)
                    ? <img src={file.url} alt="" loading="lazy" />
                    : <Icon name={iconFor(file.name)} size="sm" />}
                </span>
                <span className="fmeta">
                  <span className="fnm">{folder === 'instructionvideos' ? baseName(file.name) : file.name}</span>
                  <span className="fsub">{fmtSize(file.size)} · {fmtDate(file.modified)}</span>
                </span>
                <span className={`fcheck ${selected.has(file.name) ? 'on' : ''}`}
                  onClick={e => { e.stopPropagation(); toggleSelect(file.name); }}>
                  <Icon name="check" size="sm" />
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="slab">Quick upload</div>
        <div className="group">
          {Object.entries(FOLDERS).map(([k, { icon, label, accept }]) => (
            <label key={k} className="srow" style={{ cursor: 'pointer' }}>
              <Icon name={icon} size="sm" />
              <div className="srow-l"><div className="srow-t">Add {label.toLowerCase()}</div></div>
              <Icon name="upload" size="sm" />
              <input key={`q-${k}-${inputKey}`} type="file" multiple accept={accept}
                style={{ display: 'none' }} disabled={uploading}
                onChange={e => { setFolder(k); doUpload(e.target.files, k); }} />
            </label>
          ))}
        </div>
        {folder === 'instructionvideos' && (
          <p className="hint">The filename becomes the button label under Play Instructions.</p>
        )}
      </div>

      {current && (
        <>
          <button className="scrim" onClick={() => { setOpenFile(null); setRenaming(false); }} aria-label="Close" />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={current.name}>
            <div className="grab" />
            <div className="sheet-hd">
              <span className="thumb" style={{ width: 52, height: 40 }}>
                {isImg(current.name)
                  ? <img src={current.url} alt="" />
                  : <Icon name={iconFor(current.name)} size="sm" />}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="sheet-nm">{current.name}</span>
                <span className="sheet-sub">
                  {fmtSize(current.size)} · {extOf(current.name).replace('.', '').toUpperCase()} · {fmtDate(current.modified)}
                </span>
              </span>
              <button className="sheet-x" onClick={() => { setOpenFile(null); setRenaming(false); }} aria-label="Close">
                <Icon name="close" size="sm" />
              </button>
            </div>

            {isImg(current.name) && (
              <img src={current.url} alt="" style={{ width:'100%', aspectRatio:'16/10', objectFit:'contain', background:'#000', borderRadius:'var(--r-sm)', marginBottom:12 }} />
            )}
            {(isVid(current.name) || folder === 'instructionvideos') && (
              <video src={current.url} controls style={{ width:'100%', aspectRatio:'16/9', background:'#000', borderRadius:'var(--r-sm)', marginBottom:12 }} />
            )}
            {isAud(current.name) && (
              <audio src={current.url} controls style={{ width:'100%', marginBottom:12 }} />
            )}
            {folder === 'instructionvideos' && (
              <div className="note"><b>Button label:</b> {baseName(current.name)}</div>
            )}

            {renaming ? (
              <div style={{ marginBottom: 12 }}
                onKeyDown={e => { if (e.key === 'Escape' && !renameBusy) setRenaming(false); }}>
                <span className="flabel">Rename file</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input className="input" autoFocus ref={renameInputRef} value={renameValue}
                    disabled={renameBusy} aria-label={`New name for ${current.name}`}
                    onChange={e => setRenameValue(e.target.value)}
                    onFocus={e => e.target.select()}
                    onKeyDown={e => { if (e.key === 'Enter') doRename(current.name); }} />
                  <span className="srow-v">{extOf(current.name)}</span>
                </div>
                <p className="hint">Spaces become underscores. The extension stays the same.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="b b-key" style={{ flex: 1 }} disabled={renameBusy}
                    onClick={() => doRename(current.name)}>{renameBusy ? 'Saving…' : 'Save name'}</button>
                  <button className="b b-ghost" style={{ flex: 1 }} disabled={renameBusy}
                    onClick={() => setRenaming(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="acts">
                <button className="act" onClick={() => setRenaming(true)}>
                  <Icon name="pencil" size="sm" />Rename
                </button>
                <a className="act" href={current.url} download>
                  <Icon name="down" size="sm" />Download
                </a>
                <button className="act act-danger" disabled={deleting}
                  onClick={() => deleteNames([current.name])}>
                  <Icon name="trash" size="sm" />Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
