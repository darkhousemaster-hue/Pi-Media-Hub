import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { useApp } from '../context.js';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function StorageBar({ used, total, color }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="storage-bar">
      <div className="storage-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

const FOLDER_META = {
  pictures:          { label: 'Pictures',          icon: '🖼️', color: '#3b82f6' },
  videos:            { label: 'Videos',             icon: '🎬', color: '#ef4444' },
  music:             { label: 'Music',              icon: '🎵', color: '#22c55e' },
  instructionvideos: { label: 'Instruction Videos', icon: '▶',  color: '#7c3aed' },
};

// Pi OS Wayland (default on Pi 4/5): use --kiosk-display or WAYLAND_DISPLAY env var
// Pi OS X11 (legacy): use DISPLAY=:0 or xrandr output names
// Simplest reliable approach: let the OS decide which display gets the window,
// and use xrandr to set the primary display before launching Chromium.
const DISPLAY_OUTPUTS = [
  { value: 'auto',  label: 'Auto (whichever display is primary)' },
  { value: 'hdmi0', label: 'HDMI-0 (port nearest USB-C on Pi 4)' },
  { value: 'hdmi1', label: 'HDMI-1 (second port on Pi 4)' },
];

const RESOLUTIONS = [
  { value: 'auto',  label: 'Auto (TV decides)' },
  { value: '1080p', label: '1080p (1920×1080)' },
  { value: '4k',    label: '4K (3840×2160)' },
  { value: '720p',  label: '720p (1280×720)' },
];

export default function NetworkStatus() {
  const { config, saveConfig } = useApp();
  const [network, setNetwork] = useState(null);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restartingNetwork, setRestartingNetwork] = useState(false);
  const [rebooting, setRebooting] = useState(false);
  const [toast, setToast] = useState(null);
  const [displayOutput, setDisplayOutput] = useState('auto');
  const [displayRes, setDisplayRes] = useState('auto');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (config?.display) {
      setDisplayOutput(config.display.output || 'auto');
      setDisplayRes(config.display.resolution || 'auto');
    }
  }, [config]);

  useEffect(() => {
    async function load() {
      try {
        const [net, stor] = await Promise.all([
          apiFetch('/api/network').then(r => r.json()),
          apiFetch('/api/storage').then(r => r.json()),
        ]);
        setNetwork(net);
        setStorage(stor);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  async function saveDisplaySettings() {
    await saveConfig({ display: { output: displayOutput, resolution: displayRes } });
    showToast('Display settings saved');
  }

  async function handleRestartNetwork() {
    if (!confirm('Restart network? Clients may briefly disconnect.')) return;
    setRestartingNetwork(true);
    try { await apiFetch('/api/system/restart-network', { method: 'POST' }); showToast('Network restarting...'); }
    catch { showToast('Restart command sent'); }
    setTimeout(() => setRestartingNetwork(false), 5000);
  }

  async function handleReboot() {
    if (!confirm('Reboot the Raspberry Pi? All clients will disconnect for ~60 seconds.')) return;
    setRebooting(true);
    try { await apiFetch('/api/system/reboot', { method: 'POST' }); showToast('Rebooting...'); }
    catch { showToast('Reboot command sent'); }
  }

  const totalBytes = storage ? Object.values(storage.folders).reduce((s, f) => s + f.size, 0) : 0;
  const DISK_GB = 32;
  const diskBytes = DISK_GB * 1024 * 1024 * 1024;

  // Build the Chromium kiosk command from display settings
  // Generate the correct launch command for the selected display
  const chromiumCmd = displayOutput === 'auto'
    ? `chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:${network?.port || 3000}/player.html`
    : displayOutput === 'hdmi0'
    ? `DISPLAY=:0 xrandr --output HDMI-1 --primary && chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:${network?.port || 3000}/player.html`
    : `DISPLAY=:0 xrandr --output HDMI-2 --primary && chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:${network?.port || 3000}/player.html`;

  return (
    <>
      <div className="page-header">
        <h1>Network & Storage</h1>
        <p>Connectivity, storage usage, and display output settings</p>
      </div>

      <div className="network-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Network Status ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span>📡</span> Network Status</div>
            <span className={`status-dot ${network?.connected ? 'green' : 'gray'}`}></span>
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</div>
          ) : (
            <>
              <div className="network-info">
                {[
                  ['IP Address', network?.ip || 'Unknown'],
                  ['WiFi SSID', network?.ssid || 'PiMediaHub'],
                  ['Port', network?.port || 3000],
                  ['Status', network?.connected ? '🟢 Online' : '🔴 Offline'],
                ].map(([label, value]) => (
                  <div key={label} className="network-info-row">
                    <span className="network-info-label">{label}</span>
                    <span className="network-info-value">{String(value)}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: 'var(--primary-light)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 5 }}>📱 Connect your device</div>
                <div style={{ color: 'var(--gray-600)' }}>
                  Join the Pi's WiFi, then open:
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                    http://{network?.ip || '192.168.4.1'}:{network?.port || 3000}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-slate" style={{ flex: 1 }} onClick={handleRestartNetwork} disabled={restartingNetwork}>
                  {restartingNetwork ? '⏳ Restarting...' : '📡 Restart Network'}
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleReboot} disabled={rebooting}>
                  {rebooting ? '⏳...' : '⏻ Reboot Pi'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Display Output ── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><span>🖥️</span> Display Output</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">HDMI Output</label>
              <select className="form-select" value={displayOutput} onChange={e => setDisplayOutput(e.target.value)}>
                {DISPLAY_OUTPUTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <p className="form-hint">Pi 4 has two micro-HDMI ports. Pi 3 and earlier have one.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Resolution</label>
              <select className="form-select" value={displayRes} onChange={e => setDisplayRes(e.target.value)}>
                {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <p className="form-hint">Usually "Auto" works best — the TV reports its native resolution.</p>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>Launch Command</div>
            <div style={{ background: 'var(--gray-900)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#86efac', wordBreak: 'break-all', lineHeight: 1.7 }}>
              {chromiumCmd}
            </div>
            <p className="form-hint" style={{ marginTop: 6 }}>Run this command on the Pi to launch the TV player in kiosk mode on the selected output.</p>
          </div>

          <button className="btn btn-primary" onClick={saveDisplaySettings}>
            💾 Save Display Settings
          </button>
        </div>

        {/* ── Storage Overview ── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title"><span>💾</span> Storage Overview</div>
            <button className="btn btn-ghost btn-sm">⬇ Backup</button>
          </div>

          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)' }}>Loading...</div>
          ) : (
            <>
              <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>Total Media Storage</span>
                  <span style={{ fontWeight: 600 }}>{formatSize(totalBytes)} / {DISK_GB} GB</span>
                </div>
                <StorageBar used={totalBytes} total={diskBytes} color="var(--success)" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>
                  <span>{((totalBytes / diskBytes) * 100).toFixed(1)}% used</span>
                  <span>{formatSize(diskBytes - totalBytes)} available</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {Object.entries(FOLDER_META).map(([key, { label, icon, color }]) => {
                  const folder = storage?.folders?.[key] || { size: 0, count: 0 };
                  return (
                    <div key={key} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>{icon}</span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>{formatSize(folder.size)}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 8 }}>{folder.count} files</div>
                      <StorageBar used={folder.size} total={totalBytes || 1} color={color} />
                    </div>
                  );
                })}
              </div>

              {totalBytes > diskBytes * 0.8 && (
                <div style={{ marginTop: 14, padding: 12, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--warning)' }}>
                  ⚠️ Storage running low — consider removing unused files.
                </div>
              )}
            </>
          )}
        </div>

        {/* ── WiFi Hotspot Setup ── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div className="card-title"><span>📶</span> WiFi Hotspot Setup Guide</div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>
            Run these commands on your Pi to create a standalone WiFi access point — no router needed.
          </p>
          <div className="network-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>1. Install packages</div>
              <div style={{ background: 'var(--gray-900)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#86efac', marginBottom: 16 }}>
                sudo apt install -y hostapd dnsmasq
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>2. Configure hotspot</div>
              <div style={{ background: 'var(--gray-900)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#86efac', lineHeight: 1.8, marginBottom: 16 }}>
                {`# /etc/hostapd/hostapd.conf\ninterface=wlan0\nssid=PiMediaHub\nwpa_passphrase=mediahub123\nhw_mode=g\nchannel=7\nwpa=2`}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>3. Static IP + DHCP</div>
              <div style={{ background: 'var(--gray-900)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#86efac', lineHeight: 1.8, marginBottom: 16 }}>
                {`# /etc/dhcpcd.conf (add)\ninterface wlan0\nstatic ip_address=192.168.4.1/24\n\n# /etc/dnsmasq.conf\ninterface=wlan0\ndhcp-range=192.168.4.2,192.168.4.20,24h`}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>4. Enable & reboot</div>
              <div style={{ background: 'var(--gray-900)', borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#86efac', lineHeight: 1.8 }}>
                {`sudo systemctl unmask hostapd\nsudo systemctl enable hostapd dnsmasq\nsudo reboot`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
