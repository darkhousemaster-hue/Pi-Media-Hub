# 🖥️ Pi Media Hub

A full-stack Raspberry Pi media presentation system. Shows a photo slideshow with background music on your TV, plays videos on a schedule, and is fully controlled via a web interface over WiFi.

## Features

- 📸 **Photo Slideshow** — Display pictures with 8 transition effects (Fade, Slide, Zoom, Flip, Cube, Dissolve, Wipe, Push)
- 🎵 **Background Music** — Plays your music library continuously while the slideshow runs
- 🎬 **Scheduled Videos** — Automatically pauses the slideshow/music and plays a video every N minutes, then resumes
- 📱 **Web Control Interface** — Full remote control dashboard over WiFi (any phone, tablet or computer)
- 📁 **Media Management** — Upload, browse and delete files via drag-and-drop
- ⚡ **Real-time Control** — Socket.io for instant command delivery to the player
- 💾 **Persistent Config** — All settings saved and restored on restart

---

## Quick Start

### 1. Install

```bash
git clone <your-repo-url> pi-media-hub
cd pi-media-hub
npm install
```

### 2. Development (on your computer)

```bash
npm run dev
```

This starts:
- Express backend at `http://localhost:3000`
- Vite dev server at `http://localhost:5173` (the control interface)
- TV Player at `http://localhost:3000/player.html`

Open `http://localhost:5173` to use the control interface.
Open `http://localhost:3000/player.html` in another window to see the TV player.

### 3. Production (on the Pi)

```bash
npm run build   # Build the React app once
npm start       # Start the server (serves everything on port 3000)
```

Or run the automated setup script:

```bash
chmod +x setup.sh
./setup.sh
```

---

## Project Structure

```
pi-media-hub/
├── server.js              # Express + Socket.io backend
├── vite.config.js         # Vite bundler config
├── index.html             # React app entry point
├── public/
│   └── player.html        # TV display page (kiosk mode)
├── src/
│   ├── main.jsx           # React entry
│   ├── App.jsx            # Root component + socket connection
│   ├── App.css            # Global styles
│   └── components/
│       ├── Dashboard.jsx      # Quick actions, system overview
│       ├── MediaLibrary.jsx   # File browser + upload
│       ├── SlideshowConfig.jsx # Timing, transitions, scheduling
│       └── NetworkStatus.jsx  # Network info + storage
├── uploads/               # Auto-created, stores your media
│   ├── pictures/
│   ├── videos/
│   └── music/
├── config.json            # Auto-created, stores your settings
└── setup.sh               # Automated Pi setup script
```

---

## TV Setup

The `player.html` page runs on the Pi's local display (connected to your TV via HDMI).

**Option A - Chromium kiosk mode (recommended):**

```bash
chromium-browser --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --check-for-update-interval=604800 \
  http://localhost:3000/player.html
```

**Option B - Auto-start on boot** (added by `setup.sh`):

Create `~/.config/autostart/pi-media-hub-player.desktop` with the above command.

---

## WiFi Hotspot Setup

To make the Pi create its own WiFi network (no router needed):

```bash
sudo apt install -y hostapd dnsmasq
```

**`/etc/hostapd/hostapd.conf`:**
```
interface=wlan0
driver=nl80211
ssid=PiMediaHub
hw_mode=g
channel=7
wpa=2
wpa_passphrase=mediahub123
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
```

**`/etc/dnsmasq.conf`:**
```
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
address=/#/192.168.4.1
```

**`/etc/dhcpcd.conf`** (add at end):
```
interface wlan0
static ip_address=192.168.4.1/24
nohook wpa_supplicant
```

Then:
```bash
sudo systemctl unmask hostapd
sudo systemctl enable hostapd dnsmasq
sudo reboot
```

After reboot, connect to **PiMediaHub** WiFi, then open `http://192.168.4.1:3000`.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files/:type` | List files (type: pictures/videos/music) |
| POST | `/api/files/:type` | Upload files (multipart/form-data) |
| DELETE | `/api/files/:type/:filename` | Delete a file |
| GET | `/api/config` | Get slideshow config |
| PUT | `/api/config` | Save slideshow config |
| GET | `/api/status` | Get current playback status |
| GET | `/api/storage` | Get storage usage stats |
| GET | `/api/network` | Get network info |
| POST | `/api/system/reboot` | Reboot the Pi |
| POST | `/api/system/restart-network` | Restart networking |

## Socket.io Events

**Client → Server:**
- `command` — `{ action: 'play' | 'pause' | 'stop' | 'next' | 'restart-slideshow' | 'emergency' | 'restart-network' | 'reboot' }`
- `state-update` — Player reports its current state

**Server → Client:**
- `status` — Current playback state
- `config` — Current configuration
- `config-update` — Configuration was changed
- `command` — Forwarded command (for player.html)
- `media-updated` — Media library changed

---

## Keyboard Shortcuts (on the player display)

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| → | Next slide |
| E | Emergency video |
| R | Restart slideshow |

---

## Requirements

- Node.js 18+
- Raspberry Pi (any model with WiFi, tested on Pi 4)
- Raspberry Pi OS Bookworm (64-bit recommended)
- Chromium browser (pre-installed on Raspberry Pi OS)

---

## Service Management

```bash
sudo systemctl start pi-media-hub
sudo systemctl stop pi-media-hub
sudo systemctl restart pi-media-hub
sudo systemctl status pi-media-hub
sudo journalctl -u pi-media-hub -f  # Live logs
```
