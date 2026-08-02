import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { useApp } from '../context.js';
import Icon from './Icon.jsx';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

const FOLDER_META = {
  pictures:          { label: 'Pictures',   icon: 'image', color: 'oklch(0.68 0.15 250)' },
  videos:            { label: 'Videos',     icon: 'film',  color: 'oklch(0.62 0.19 32)' },
  music:             { label: 'Music',      icon: 'music', color: 'oklch(0.72 0.16 148)' },
  instructionvideos: { label: 'Clips',      icon: 'cue',   color: 'oklch(0.66 0.15 300)' },
};

// Pi OS Wayland (default on Pi 4/5) vs X11 (legacy): let the OS place the
// window and use xrandr to set the primary display before launching Chromium.
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

const DISK_GB = 32;

export default function SystemPanel() {
  const { config, saveConfig, toast_, version } = useApp();
  const [network, setNetwork] = useState(null);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayOutput, setDisplayOutput] = useState('auto');
  const [displayRes, setDisplayRes] = useState('auto');
  const [busy, setBusy] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showHotspot, setShowHotspot] = useState(false);

  useEffect(() => {
    if (config?.display) {
      setDisplayOutput(config.display.output || 'auto');
      setDisplayRes(config.display.resolution || 'auto');
    }
  }, [config]);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/network').then(r => r.json()).catch(() => null),
      apiFetch('/api/storage').then(r => r.json()).catch(() => null),
    ]).then(([net, stor]) => { setNetwork(net); setStorage(stor); setLoading(false); });
  }, []);

  async function handleRestartNetwork() {
    if (!confirm('Restart networking? Clients disconnect for a few seconds.')) return;
    setBusy('net');
    try { await apiFetch('/api/system/restart-network', { method: 'POST' }); toast_('Restarting the network…'); }
    catch { toast_('Restart command sent'); }
    setTimeout(() => setBusy(''), 5000);
  }

  async function handleReboot() {
    if (!confirm('Reboot the Raspberry Pi?\nThe lobby screen goes dark for about a minute.')) return;
    setBusy('reboot');
    try { await apiFetch('/api/system/reboot', { method: 'POST' }); toast_('Rebooting…'); }
    catch { toast_('Reboot command sent'); }
  }

  // The old server keeps answering while git, npm and the build run, so a
  // response means nothing. A changed bootTime is the only proof of a restart.
  async function handleUpdate() {
    if (!confirm('Pull the latest version from GitHub and rebuild?\nThe app restarts on its own.')) return;
    setUpdating(true);
    toast_('Update started…');

    let bootBefore = null;
    try { bootBefore = (await apiFetch('/api/system/info').then(r => r.json())).bootTime; } catch {}

    try { await apiFetch('/api/system/update', { method: 'POST' }); }
    catch { toast_('Could not start the update. Check the Pi has git and internet access.', true); setUpdating(false); return; }

    let attempts = 0, sawDown = false;
    const retry = () => {
      attempts++;
      if (attempts < 100) setTimeout(poll, 3000);      // about five minutes
      else { setUpdating(false); toast_('Update timed out. See /tmp/pi-media-hub-update.log', true); }
    };
    function poll() {
      fetch('/api/system/info').then(r => r.json())
        .then(info => {
          const restarted = bootBefore === null ? sawDown : info.bootTime !== bootBefore;
          if (restarted) { setUpdating(false); window.location.reload(); return; }
          if (info.update?.state === 'failed') {
            setUpdating(false);
            toast_(`Update failed while ${info.update.step}. See /tmp/pi-media-hub-update.log`, true);
            return;
          }
          retry();
        })
        .catch(() => { sawDown = true; retry(); });
    }
    setTimeout(poll, 3000);
  }

  const totalBytes = storage ? Object.values(storage.folders).reduce((s, f) => s + f.size, 0) : 0;
  const diskBytes = DISK_GB * 1024 * 1024 * 1024;
  const usedPct = (totalBytes / diskBytes) * 100;

  const port = network?.port || 3000;
  const chromiumCmd = displayOutput === 'auto'
    ? `chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:${port}/player.html`
    : `DISPLAY=:0 xrandr --output ${displayOutput === 'hdmi0' ? 'HDMI-1' : 'HDMI-2'} --primary && chromium --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required http://localhost:${port}/player.html`;

  return (
    <div className="cols cols-2">
      <div>
        <div className="slab slab-first">Connection</div>
        <div className="group">
          {loading ? <div className="empty"><p>Loading…</p></div> : (
            <>
              <div className="srow">
                <div className="srow-l"><div className="srow-t">Status</div></div>
                <div className="srow-v" style={{ color: network?.connected ? 'var(--live)' : 'var(--tx-3)' }}>
                  {network?.connected ? 'Online' : 'Offline'}
                </div>
              </div>
              <div className="srow">
                <div className="srow-l"><div className="srow-t">Wi-Fi network</div></div>
                <div className="srow-v">{network?.ssid || 'PiMediaHub'}</div>
              </div>
              <div className="srow">
                <div className="srow-l">
                  <div className="srow-t">Address</div>
                  <div className="srow-d">Join the Pi's Wi-Fi, then open this on any device</div>
                </div>
                <div className="srow-v">{network?.ip || '192.168.4.1'}:{port}</div>
              </div>
            </>
          )}
        </div>

        <div className="slab">Display output</div>
        <div className="group">
          <div className="group-pad">
            <label className="field">
              <span className="flabel">HDMI output</span>
              <select className="select" value={displayOutput} onChange={e => setDisplayOutput(e.target.value)}>
                {DISPLAY_OUTPUTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <span className="fhint">Pi 4 has two micro-HDMI ports. Pi 3 and earlier have one.</span>
            </label>
            <label className="field">
              <span className="flabel">Resolution</span>
              <select className="select" value={displayRes} onChange={e => setDisplayRes(e.target.value)}>
                {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <span className="fhint">Auto usually wins: the TV reports its own native resolution.</span>
            </label>
            <span className="flabel">Launch command</span>
            <div className="code">{chromiumCmd}</div>
            <span className="fhint">Run this on the Pi to open the TV player in kiosk mode on the selected output.</span>
            <button className="b b-key b-full" style={{ marginTop: 12 }}
              onClick={async () => {
                await saveConfig({ display: { output: displayOutput, resolution: displayRes } });
              }}>
              <Icon name="save" size="sm" />Save display settings
            </button>
          </div>
        </div>

        <div className="slab">Storage</div>
        <div className="group">
          <div className="group-pad">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="srow-t">Media on disk</span>
              <span className="srow-v">{formatSize(totalBytes)} / {DISK_GB} GB</span>
            </div>
            <div className="bar">
              <div className="bar-f" style={{ width: `${Math.min(100, usedPct)}%`, background: 'var(--live)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span className="srow-d">{usedPct.toFixed(1)}% used</span>
              <span className="srow-d">{formatSize(diskBytes - totalBytes)} free</span>
            </div>
          </div>
          <div className="stor-grid">
            {Object.entries(FOLDER_META).map(([key, { label, icon, color }]) => {
              const f = storage?.folders?.[key] || { size: 0, count: 0 };
              return (
                <div key={key} className="stor">
                  <div className="stor-h"><Icon name={icon} size="sm" />{label}</div>
                  <div className="stor-v">{formatSize(f.size)}</div>
                  <div className="stor-c">{f.count} file{f.count !== 1 ? 's' : ''}</div>
                  <div className="bar">
                    <div className="bar-f" style={{ width: `${totalBytes ? (f.size / totalBytes) * 100 : 0}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
          {totalBytes > diskBytes * 0.8 && (
            <div className="warn-note">Storage is running low. Consider removing unused files.</div>
          )}
        </div>
      </div>

      <div>
        <div className="slab slab-first">Careful</div>
        <div className="danger-zone">
          <div className="srow">
            <div className="srow-l">
              <div className="srow-t">Update from GitHub</div>
              <div className="srow-d">Pulls, rebuilds, then restarts the app. Your settings and media are kept.</div>
            </div>
            <button className="b b-danger b-sm" onClick={handleUpdate} disabled={updating}>
              <Icon name="up" size="sm" />{updating ? 'Updating…' : 'Update'}
            </button>
          </div>
          <div className="srow">
            <div className="srow-l">
              <div className="srow-t">Restart networking</div>
              <div className="srow-d">Drops Wi-Fi for a few seconds</div>
            </div>
            <button className="b b-danger b-sm" onClick={handleRestartNetwork} disabled={busy === 'net'}>
              <Icon name="wifi" size="sm" />{busy === 'net' ? 'Restarting…' : 'Restart'}
            </button>
          </div>
          <div className="srow">
            <div className="srow-l">
              <div className="srow-t">Reboot the Pi</div>
              <div className="srow-d">The lobby screen goes dark for about a minute</div>
            </div>
            <button className="b b-danger b-sm" onClick={handleReboot} disabled={busy === 'reboot'}>
              <Icon name="power" size="sm" />{busy === 'reboot' ? 'Rebooting…' : 'Reboot'}
            </button>
          </div>
        </div>

        <div className="slab">Wi-Fi hotspot</div>
        <div className="group">
          <button className="srow" onClick={() => setShowHotspot(s => !s)}
            style={{ width: '100%', background: 'none', border: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left', borderBottom: showHotspot ? '1px solid var(--line)' : 0 }}>
            <Icon name="plug" size="sm" />
            <div className="srow-l">
              <div className="srow-t">Set up a standalone hotspot</div>
              <div className="srow-d">Run these on the Pi to work without a router</div>
            </div>
            <Icon name="chevron" size="sm" />
          </button>
          {showHotspot && (
            <div className="group-pad" style={{ display: 'grid', gap: 12 }}>
              <div>
                <span className="flabel">1. Install packages</span>
                <div className="code">sudo apt install -y hostapd dnsmasq</div>
              </div>
              <div>
                <span className="flabel">2. Configure the hotspot</span>
                <div className="code">{`# /etc/hostapd/hostapd.conf\ninterface=wlan0\nssid=PiMediaHub\nwpa_passphrase=mediahub123\nhw_mode=g\nchannel=7\nwpa=2`}</div>
              </div>
              <div>
                <span className="flabel">3. Static IP and DHCP</span>
                <div className="code">{`# /etc/dhcpcd.conf (add)\ninterface wlan0\nstatic ip_address=192.168.4.1/24\n\n# /etc/dnsmasq.conf\ninterface=wlan0\ndhcp-range=192.168.4.2,192.168.4.20,24h`}</div>
              </div>
              <div>
                <span className="flabel">4. Enable and reboot</span>
                <div className="code">{`sudo systemctl unmask hostapd\nsudo systemctl enable hostapd dnsmasq\nsudo reboot`}</div>
              </div>
            </div>
          )}
        </div>

        <div className="slab">About</div>
        <div className="group">
          <div className="srow">
            <div className="srow-l"><div className="srow-t">Version</div></div>
            <div className="srow-v">v{version}</div>
          </div>
          <div className="srow">
            <div className="srow-l"><div className="srow-t">Port</div></div>
            <div className="srow-v">{port}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
