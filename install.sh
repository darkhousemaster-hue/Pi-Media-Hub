#!/bin/bash
# Pi Media Hub — Install/Fix script
# Run this on the Pi: bash install.sh

set -e
USER_NAME=$(whoami)
INSTALL_DIR=$(pwd)

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Pi Media Hub — Install           ║"
echo "║     User: $USER_NAME"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Build the app ───────────────────────────────────────────────────────
echo "📦 Installing dependencies and building..."
npm install --silent
npm run build

echo "✓ Build complete"

# ── 2. Create systemd service with correct user ────────────────────────────
echo "🔧 Installing systemd service..."

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
sudo systemctl status pi-media-hub --no-pager | head -5

echo "✓ Service installed and started"

# ── 3. Create autostart for kiosk player ──────────────────────────────────
echo "🖥️  Setting up kiosk autostart..."
mkdir -p ~/.config/autostart

cat > ~/.config/autostart/player.desktop << DESKEOF
[Desktop Entry]
Type=Application
Name=Pi Media Hub Player
Exec=chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:3000/player.html
DESKEOF

echo "✓ Kiosk autostart configured"

# ── 4. WiFi hotspot setup ──────────────────────────────────────────────────
echo ""
read -p "Set up WiFi hotspot fallback? (y/N): " DO_HOTSPOT
if [[ "$DO_HOTSPOT" =~ ^[Yy]$ ]]; then
  echo "📡 Installing hostapd and dnsmasq..."
  sudo apt-get install -y hostapd dnsmasq -q

  # Unmask hostapd (it's masked by default on Pi OS)
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

  # Add static IP for hotspot mode
  grep -q "interface wlan0" /etc/dhcpcd.conf || sudo tee -a /etc/dhcpcd.conf > /dev/null << DHCPEOF

# Pi Media Hub hotspot static IP (only active when hotspot runs)
#interface wlan0
#static ip_address=192.168.4.1/24
#nohook wpa_supplicant
DHCPEOF

  sudo tee /etc/dnsmasq.d/pimediahub.conf > /dev/null << DNSEOF
interface=wlan0
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
DNSEOF

  # Auto-switching script
  sudo tee /usr/local/bin/wifi-check.sh > /dev/null << 'WIFIEOF'
#!/bin/bash
# Wait for wifi to settle
sleep 15
CONNECTED=$(iwgetid -r 2>/dev/null)
if [ -z "$CONNECTED" ]; then
    echo "No WiFi — starting hotspot"
    # Enable static IP for wlan0
    sudo sed -i 's/^#interface wlan0/interface wlan0/; s/^#static ip_address/static ip_address/; s/^#nohook wpa_supplicant/nohook wpa_supplicant/' /etc/dhcpcd.conf
    sudo systemctl restart dhcpcd
    sudo systemctl start hostapd dnsmasq
else
    echo "Connected to: $CONNECTED — hotspot off"
    sudo systemctl stop hostapd dnsmasq 2>/dev/null || true
fi
WIFIEOF
  sudo chmod +x /usr/local/bin/wifi-check.sh

  # Run wifi-check on every boot
  (sudo crontab -l 2>/dev/null; echo "@reboot /usr/local/bin/wifi-check.sh >> /var/log/wifi-check.log 2>&1") | sudo crontab -

  echo "✓ Hotspot configured (SSID: PiMediaHub, password: mafia2016)"
  echo "  When no WiFi found, connect to PiMediaHub → http://192.168.4.1:3000"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║           Installation complete! ✓               ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Service:    sudo systemctl status pi-media-hub  ║"
echo "║  Logs:       sudo journalctl -u pi-media-hub -f  ║"
echo "║  Web UI:     http://localhost:3000               ║"
echo "║  Reboot to start the kiosk display               ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
