#!/bin/bash
# Pi Media Hub — Install script
# Run from inside the pi-media-hub folder: bash install.sh

set -e
USER_NAME=$(whoami)
INSTALL_DIR=$(pwd)

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Pi Media Hub — Install v1.0.1      ║"
echo "║   User: $USER_NAME"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Restore uploads backup if it exists ────────────────────────────────
if [ -d "$HOME/pi-media-hub-uploads-backup" ] && [ ! -d "$INSTALL_DIR/uploads/pictures" ]; then
  echo "📦 Restoring uploads backup..."
  cp -r "$HOME/pi-media-hub-uploads-backup/." "$INSTALL_DIR/uploads/"
  echo "✓ Uploads restored"
fi

# ── 2. Create upload dirs ──────────────────────────────────────────────────
mkdir -p uploads/pictures uploads/videos uploads/music uploads/instructionvideos

# ── 3. Build ───────────────────────────────────────────────────────────────
echo "📦 Installing dependencies..."
npm install --silent
echo "🔨 Building..."
npm run build
echo "✓ Build complete"

# ── 4. Systemd service ────────────────────────────────────────────────────
echo "🔧 Installing service..."
sudo tee /etc/systemd/system/pi-media-hub.service > /dev/null << SVCEOF
[Unit]
Description=Pi Media Hub
After=network.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVCEOF

sudo systemctl daemon-reload
sudo systemctl enable pi-media-hub
sudo systemctl restart pi-media-hub
sleep 2

STATUS=$(sudo systemctl is-active pi-media-hub)
if [ "$STATUS" = "active" ]; then
  echo "✓ Service running"
else
  echo "✗ Service failed — check with: sudo journalctl -u pi-media-hub -n 20"
fi

# ── 5. Kiosk autostart ────────────────────────────────────────────────────
echo "🖥️  Setting up kiosk..."
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/player.desktop << DESKEOF
[Desktop Entry]
Type=Application
Name=Pi Media Hub Player
Exec=chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:3000/player.html
DESKEOF
echo "✓ Kiosk autostart configured"

# ── 6. WiFi hotspot (optional) ────────────────────────────────────────────
echo ""
read -p "Set up WiFi hotspot fallback? (y/N): " DO_HOTSPOT
if [[ "$DO_HOTSPOT" =~ ^[Yy]$ ]]; then
  sudo apt-get install -y hostapd dnsmasq -q
  sudo systemctl unmask hostapd

  sudo tee /etc/hostapd/hostapd.conf > /dev/null << HAEOF
interface=wlan0
ssid=PiMediaHub
wpa_passphrase=mafia2016
hw_mode=g
channel=6
wpa=2
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
HAEOF

  sudo tee /etc/dnsmasq.d/pimediahub.conf > /dev/null << DNSEOF
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
DNSEOF

  sudo tee /usr/local/bin/wifi-check.sh > /dev/null << 'WIFIEOF'
#!/bin/bash
sleep 20
CONNECTED=$(iwgetid -r 2>/dev/null)
if [ -z "$CONNECTED" ]; then
  echo "No WiFi — starting hotspot"
  sudo ip addr add 192.168.4.1/24 dev wlan0 2>/dev/null || true
  sudo systemctl start hostapd dnsmasq
else
  echo "WiFi: $CONNECTED — hotspot off"
  sudo systemctl stop hostapd dnsmasq 2>/dev/null || true
fi
WIFIEOF
  sudo chmod +x /usr/local/bin/wifi-check.sh
  (sudo crontab -l 2>/dev/null; echo "@reboot /usr/local/bin/wifi-check.sh >> /var/log/wifi-check.log 2>&1") | sort -u | sudo crontab -
  echo "✓ Hotspot configured (SSID: PiMediaHub, password: mafia2016)"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║           Installation complete! ✓               ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Web UI:  http://$(hostname -I | awk '{print $1}'):3000  ║"
echo "║  Logs:    sudo journalctl -u pi-media-hub -f     ║"
echo "║  Reboot to start the TV kiosk display            ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
