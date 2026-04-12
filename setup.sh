#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Pi Media Hub - Raspberry Pi Setup Script
#  Run this on your Raspberry Pi after cloning the repo
# ═══════════════════════════════════════════════════════════

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Pi Media Hub - Setup Script      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Check Node.js ──────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  NODE_VER=$(node -v)
  echo "✅ Node.js already installed: $NODE_VER"
fi

# ── 2. Install dependencies ───────────────────────────────
echo ""
echo "📦 Installing npm dependencies..."
npm install

# ── 3. Build the React frontend ───────────────────────────
echo ""
echo "🔨 Building React frontend..."
npm run build

# ── 4. Create upload directories ──────────────────────────
echo ""
echo "📁 Creating upload directories..."
mkdir -p uploads/pictures uploads/videos uploads/music

# ── 5. Create systemd service ─────────────────────────────
echo ""
echo "🔧 Creating systemd service..."

INSTALL_DIR=$(pwd)
USERNAME=$(whoami)

sudo tee /etc/systemd/system/pi-media-hub.service > /dev/null << EOF
[Unit]
Description=Pi Media Hub
After=network.target

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable pi-media-hub
sudo systemctl start pi-media-hub

echo "✅ Service created and started"

# ── 6. Set up WiFi Hotspot ────────────────────────────────
echo ""
echo "📡 Setting up WiFi Hotspot..."
echo "   (You can skip this if you'll connect Pi to existing WiFi)"
read -p "   Set up WiFi hotspot? [y/N]: " SETUP_HOTSPOT

if [[ "$SETUP_HOTSPOT" == "y" || "$SETUP_HOTSPOT" == "Y" ]]; then
  sudo apt-get install -y hostapd dnsmasq

  # hostapd config
  sudo tee /etc/hostapd/hostapd.conf > /dev/null << 'HOSTAPD_EOF'
interface=wlan0
driver=nl80211
ssid=PiMediaHub
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=mediahub123
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
HOSTAPD_EOF

  sudo tee -a /etc/default/hostapd > /dev/null << 'HOSTAPD_DEFAULT'
DAEMON_CONF="/etc/hostapd/hostapd.conf"
HOSTAPD_DEFAULT

  # dnsmasq config
  sudo tee /etc/dnsmasq.conf > /dev/null << 'DNSMASQ_EOF'
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
address=/#/192.168.4.1
DNSMASQ_EOF

  # Static IP for wlan0
  sudo tee -a /etc/dhcpcd.conf > /dev/null << 'DHCPCD_EOF'
interface wlan0
static ip_address=192.168.4.1/24
nohook wpa_supplicant
DHCPCD_EOF

  # Enable IP forwarding
  sudo sed -i 's/#net.ipv4.ip_forward=1/net.ipv4.ip_forward=1/' /etc/sysctl.conf

  sudo systemctl unmask hostapd
  sudo systemctl enable hostapd dnsmasq
  sudo systemctl restart dhcpcd hostapd dnsmasq

  echo ""
  echo "✅ WiFi Hotspot configured!"
  echo "   SSID:     PiMediaHub"
  echo "   Password: mediahub123"
  echo "   IP:       192.168.4.1"
fi

# ── 7. Auto-start Player in Kiosk Mode ───────────────────
echo ""
read -p "Auto-start Chromium player on boot? [y/N]: " SETUP_KIOSK

if [[ "$SETUP_KIOSK" == "y" || "$SETUP_KIOSK" == "Y" ]]; then
  mkdir -p ~/.config/autostart

  cat > ~/.config/autostart/pi-media-hub-player.desktop << EOF
[Desktop Entry]
Type=Application
Name=Pi Media Hub Player
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=604800 http://localhost:3000/player.html
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

  echo "✅ Kiosk mode configured - will start on next boot"
fi

# ── Done ──────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                   Setup Complete! 🎉                 ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Service:    sudo systemctl status pi-media-hub      ║"
echo "║  Logs:       sudo journalctl -u pi-media-hub -f      ║"
echo "║  Web UI:     http://localhost:3000                   ║"
echo "║  TV Player:  http://localhost:3000/player.html       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
