#!/bin/bash
# Pi Media Hub — Complete uninstall
# Backs up your uploads first, then wipes everything cleanly

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Pi Media Hub — Uninstall           ║"
echo "╚══════════════════════════════════════╝"
echo ""

INSTALL_DIR="$HOME/pi-media-hub"

# Back up uploads before deleting
if [ -d "$INSTALL_DIR/uploads" ]; then
  echo "📦 Backing up your uploads to ~/pi-media-hub-uploads-backup..."
  cp -r "$INSTALL_DIR/uploads" "$HOME/pi-media-hub-uploads-backup"
  echo "✓ Backup saved to ~/pi-media-hub-uploads-backup"
fi

# Stop and remove service
echo "🛑 Stopping service..."
sudo systemctl stop pi-media-hub 2>/dev/null
sudo systemctl disable pi-media-hub 2>/dev/null
sudo rm -f /etc/systemd/system/pi-media-hub.service
sudo systemctl daemon-reload

# Remove autostart
rm -f ~/.config/autostart/player.desktop
echo "✓ Autostart removed"

# Remove app folder
echo "🗑  Removing app folder..."
rm -rf "$INSTALL_DIR"
echo "✓ App folder removed"

echo ""
echo "✓ Uninstall complete."
echo "  Your media backup is at: ~/pi-media-hub-uploads-backup"
echo "  Now clone fresh: git clone https://github.com/darkhousemaster-hue/Pi-Media-Hub.git pi-media-hub"
echo ""
