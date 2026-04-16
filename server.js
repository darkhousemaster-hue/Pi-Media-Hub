import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { execSync, spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', '*'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CONFIG_FILE = path.join(__dirname, 'config.json');

['pictures', 'videos', 'music', 'instructionvideos'].forEach(dir => {
  fs.mkdirSync(path.join(UPLOAD_DIR, dir), { recursive: true });
});

// ─── Default Config ──────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  slideshow: {
    defaultDuration: 5,
    transitionDuration: 1,
    transitionEffect: 'fade',
    easing: 'ease-in-out',
    autoAdvance: true,
    loop: true,
    randomOrder: false,
    pauseBetweenCycles: 0,
    speedPreset: 'normal',
    layout: 'single'
  },
  video: {
    intervalMinutes: 5,
    enabled: true
  },
  audio: {
    masterVolume: 75,
    musicVolume: 100,
    intervalVideoVolume: 100,
    instructionVideoVolume: 100,
    enabled: true
  },
  display: {
    output: 'auto',
    resolution: 'auto'
  },
  individualTiming: {}
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const saved = JSON.parse(raw);
    // Deep merge to ensure new default keys are present
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      slideshow: { ...DEFAULT_CONFIG.slideshow, ...(saved.slideshow || {}) },
      video:     { ...DEFAULT_CONFIG.video,     ...(saved.video     || {}) },
      audio:     { ...DEFAULT_CONFIG.audio,     ...(saved.audio     || {}) },
      display:   { ...DEFAULT_CONFIG.display,   ...(saved.display   || {}) },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// ─── Playback State ───────────────────────────────────────────────────────────
let state = {
  status: 'playing',
  mode: 'slideshow',
  currentSlide: 0,
  currentSlideUrl: null,
  totalSlides: 0,
  startTime: Date.now()
};

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true), // allow all origins in dev
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));

// Only serve built frontend in production; in dev, Vite handles it on :5173
const distPath = path.join(__dirname, 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type;
    const validTypes = ['pictures', 'videos', 'music', 'instructionvideos'];
    if (!validTypes.includes(type)) return cb(new Error('Invalid folder type: ' + type));
    const dir = path.join(UPLOAD_DIR, type);
    fs.mkdirSync(dir, { recursive: true }); // ensure exists
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Preserve spaces as underscores but keep extension intact
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._\- ]/g, '').trim().replace(/\s+/g, '_');
    cb(null, base + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB max
  fileFilter: (req, file, cb) => {
    const type = req.params.type;
    const allowed = {
      pictures:          /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i,
      videos:            /\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/i,
      music:             /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i,
      instructionvideos: /\.(mp4|webm|ogg|mov|avi|mkv|m4v)$/i,
    };
    const re = allowed[type];
    if (!re) return cb(new Error('Unknown upload type: ' + type));
    if (re.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed for ${type}: ${file.originalname}`));
    }
  }
});

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/files/:type', (req, res) => {
  const dir = path.join(UPLOAD_DIR, req.params.type);
  try {
    const files = fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(filename => {
        const filePath = path.join(dir, filename);
        const stat = fs.statSync(filePath);
        return { name: filename, size: stat.size, modified: stat.mtime, url: `/uploads/${req.params.type}/${encodeURIComponent(filename)}` };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(files);
  } catch { res.json([]); }
});

app.post('/api/files/:type', (req, res) => {
  upload.array('files', 100)(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    if (!req.files?.length) return res.status(400).json({ error: 'No files received' });
    const uploaded = req.files.map(f => ({ name: f.originalname, savedAs: f.filename, size: f.size }));
    io.emit('media-updated', { type: req.params.type });
    res.json({ success: true, files: uploaded });
  });
});

app.delete('/api/files/:type/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.type, decodeURIComponent(req.params.filename));
  try { fs.unlinkSync(filePath); io.emit('media-updated', { type: req.params.type }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/config', (req, res) => res.json(loadConfig()));

app.put('/api/config', (req, res) => {
  const existing = loadConfig();
  const updated = {
    ...existing,
    ...req.body,
    slideshow: { ...existing.slideshow, ...(req.body.slideshow || {}) },
    video:     { ...existing.video,     ...(req.body.video     || {}) },
    audio:     { ...existing.audio,     ...(req.body.audio     || {}) },
    display:   { ...existing.display,   ...(req.body.display   || {}) },
  };
  saveConfig(updated);
  io.emit('config-update', updated);
  res.json(updated);
});

app.get('/api/status', (req, res) => res.json(state));

app.get('/api/storage', (req, res) => {
  const types = ['pictures', 'videos', 'music', 'instructionvideos'];
  const result = { total: 0, folders: {} };
  types.forEach(type => {
    const dir = path.join(UPLOAD_DIR, type);
    let size = 0, count = 0;
    try { fs.readdirSync(dir).filter(f => !f.startsWith('.')).forEach(file => { try { size += fs.statSync(path.join(dir, file)).size; count++; } catch {} }); } catch {}
    result.folders[type] = { size, count };
    result.total += size;
  });
  res.json(result);
});

app.get('/api/network', (req, res) => {
  let ip = '192.168.4.1', ssid = 'PiMediaHub', connected = false;
  try { ip = execSync('hostname -I 2>/dev/null').toString().trim().split(' ')[0] || ip; connected = true; } catch {}
  try { const w = execSync('iwgetid -r 2>/dev/null').toString().trim(); if (w) ssid = w; } catch {}
  res.json({ ip, ssid, connected, port: PORT });
});

app.post('/api/system/reboot', (req, res) => {
  res.json({ success: true });
  setTimeout(() => {
    const child = spawn('sudo', ['reboot'], { detached: true, stdio: 'ignore' });
    child.unref();
  }, 1000);
});

app.post('/api/system/restart-network', (req, res) => {
  res.json({ success: true });
  setTimeout(() => { try { execSync('sudo systemctl restart networking'); } catch {} }, 500);
});

// ─── Update endpoint ─────────────────────────────────────────────────────────
app.post('/api/system/update', (req, res) => {
  res.json({ success: true, message: 'Update started' });

  // Write an update script and run it detached so it survives service restart
  const script = `#!/bin/bash
set -e
LOG=/tmp/pi-media-hub-update.log
exec >> $LOG 2>&1
echo "=== UPDATE STARTED $(date) ==="
cd ${__dirname}
git pull origin main
npm install --silent
npm run build
echo "=== BUILD DONE - restarting ==="
sudo systemctl restart pi-media-hub
echo "=== UPDATE COMPLETE $(date) ==="
`;
  const scriptPath = path.join(__dirname, '_update.sh');
  fs.writeFileSync(scriptPath, script, { mode: 0o755 });

  // Spawn detached so it keeps running after service restarts
  const child = spawn('bash', [scriptPath], {
    detached: true,
    stdio: 'ignore',
    cwd: __dirname,
  });
  child.unref();
  console.log('Update process launched (PID:', child.pid, ')');
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current state immediately so player can resume from correct position
  socket.emit('status', state);
  socket.emit('config', loadConfig());

  socket.on('command', (cmd) => {
    switch (cmd.action) {
      case 'play':           state.status = 'playing'; state.mode = 'slideshow'; break;
      case 'pause':          state.status = state.status === 'paused' ? 'playing' : 'paused'; break;
      case 'stop':           state.status = 'stopped'; break;
      case 'next':           state.currentSlide = (state.currentSlide + 1) % Math.max(state.totalSlides, 1); break;
      case 'restart-slideshow': state.currentSlide = 0; state.status = 'playing'; state.mode = 'slideshow'; break;
      case 'play-instruction':  state.mode = 'video'; state.status = 'playing'; break;
      case 'reboot':
        setTimeout(() => {
          try {
            spawn('sudo', ['reboot'], { detached: true, stdio: 'ignore' }).unref();
          } catch(e) { console.error('reboot:', e.message); }
        }, 1000);
        break;
      case 'restart-network':
        setTimeout(() => {
          try {
            spawn('sudo', ['systemctl', 'restart', 'networking'], { detached: true, stdio: 'ignore' }).unref();
          } catch(e) { console.error('network restart:', e.message); }
        }, 300);
        break;
    }
    io.emit('command', cmd);
    io.emit('status', state);
  });

  // Player reports its live state — broadcast to all other clients (control UIs)
  socket.on('state-update', (update) => {
    state = { ...state, ...update };
    socket.broadcast.emit('status', state);
  });

  socket.on('disconnect', () => console.log(`Disconnected: ${socket.id}`));
});

// ─── Serve ────────────────────────────────────────────────────────────────────
app.get('/player.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'player.html')));

app.get('*', (req, res) => {
  const idx = path.join(__dirname, 'dist', 'index.html');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(idx)) {
    res.sendFile(idx);
  } else {
    res.send(`<html><body style="font-family:sans-serif;padding:40px;max-width:500px;margin:auto">
      <h1>🖥️ Pi Media Hub — Server Running</h1>
      <p style="color:#16a34a;font-weight:bold">✓ Server is running on port ${PORT}</p>
      <hr style="margin:20px 0">
      <p><strong>Open the web interface at:</strong></p>
      <p style="font-size:20px"><a href="http://localhost:5173">http://localhost:5173</a></p>
      <p style="color:#6b7280;margin-top:8px">(This is port 3000 — the API server. The UI is on port 5173.)</p>
      <hr style="margin:20px 0">
      <p>TV Player: <a href="/player.html">http://localhost:${PORT}/player.html</a></p>
    </body></html>`);
  }
});

// Keep the process alive — log errors instead of crashing
process.on('uncaughtException', err => {
  console.error('[UNCAUGHT EXCEPTION]', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════╗`);
  console.log(`║   Pi Media Hub — port ${PORT}       ║`);
  console.log(`║   Player: /player.html           ║`);
  console.log(`╚══════════════════════════════════╝\n`);
});
