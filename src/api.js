// All reads go through Vite proxy (relative URLs, same-origin, no CORS).
// Uploads go directly to port 3000 — Vite's proxy drops large multipart bodies.

const isDev = typeof window !== 'undefined' && window.location.port === '5173';
export const DIRECT_BASE = isDev ? 'http://localhost:3000' : '';

export async function apiFetch(path, options = {}) {
  return fetch(path, options);
}

// Uploads travel in chunks, each its own short request. One request per file
// had to survive minutes of Wi-Fi, a phone that locks and, through the tunnel,
// Cloudflare's 100 MB cap per request. It died at about 1.5 MB, which is just
// the phone's own send buffer: the Pi had received almost nothing. Now any
// hiccup costs one chunk. The client asks the Pi how far it really got and
// carries on from exactly that byte.
const START_CHUNK = 4 * 1024 * 1024;
const MIN_CHUNK = 256 * 1024;
const MAX_RETRIES = 8;          // per stretch of trouble, with backoff: about two minutes
const STALL_MS = 20 * 1000;     // a chunk with no progress for this long is dead
const REPLY_MS = 60 * 1000;     // once a chunk is sent, the Pi only has to close a file

const sleep = ms => new Promise(r => setTimeout(r, ms));
const mb = n => (n / 1048576).toFixed(1);

function describeFailure(status, data) {
  if (data && data.error) return data.error;
  if (status === 413) return 'That file is too large for this connection (HTTP 413).';
  if (status === 408 || status === 504 || status === 524) return 'The Pi took too long to answer.';
  return status ? `Upload failed (HTTP ${status}).` : 'No answer from the Pi.';
}

async function callJson(method, path, body) {
  const res = await fetch(`${DIRECT_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, data };
}

// One chunk as one PUT. Resolves with the Pi's answer whatever its status,
// and rejects only when no answer came back at all (link gone or stalled).
function putChunk(path, body, onBytes) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastMove = Date.now(), sentAll = false, settled = false, watch = null;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearInterval(watch);
      fn(arg);
    };
    watch = setInterval(() => {
      const idle = Date.now() - lastMove;
      if ((!sentAll && idle > STALL_MS) || (sentAll && idle > REPLY_MS)) {
        xhr.abort();
        finish(reject, { stalled: true });
      }
    }, 1000);
    // Listeners must be attached before send() or no progress events fire.
    xhr.upload.onprogress = e => { lastMove = Date.now(); onBytes(e.loaded); };
    xhr.upload.onload = () => { sentAll = true; lastMove = Date.now(); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch {}
      finish(resolve, { status: xhr.status, data });
    };
    xhr.onerror = () => finish(reject, { network: true });
    xhr.open('PUT', `${DIRECT_BASE}${path}`);
    // Explicit, so no JSON body parser on the way ever tries to read it.
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(body);
  });
}

async function uploadOne(folder, file, pacing, onBytes, onNote) {
  let init = null;
  for (let i = 0; i < 3 && !init; i++) {
    init = await callJson('POST', '/api/uploads', { type: folder, name: file.name, size: file.size }).catch(() => null);
    if (!init) await sleep(1500);
  }
  if (!init) throw new Error('No answer from the Pi. Check that it is switched on and online.');
  if (!init.ok) throw new Error(describeFailure(init.status, init.data));
  const id = init.data.id;
  const abandon = () => callJson('DELETE', `/api/uploads/${id}`).catch(() => {});
  const lost = 'The Pi restarted during the upload. Please upload the file again.';

  // Halve the chunk size after any chunk that got no answer, and never probe
  // back up: a failed probe at a bigger size costs a whole stall window, while
  // smaller chunks cost milliseconds each. On a link that dies after 1.5 MB
  // per request, probing turned a 150 MB clip into a 20 minute crawl. The size
  // carries over to the next file in the same selection.
  let offset = 0, failures = 0, outOfStep = 0;
  const shrink = () => { pacing.chunk = Math.max(MIN_CHUNK, Math.floor(pacing.chunk / 2)); };

  // After any failure, only the Pi knows how much really arrived.
  const resync = async () => {
    const st = await callJson('GET', `/api/uploads/${id}`).catch(() => null);
    if (st?.status === 404) throw new Error(lost);
    if (st?.ok) {
      // The Pi keeps the part of an interrupted chunk that did arrive. If it
      // moved forward, the link works and only big pieces fail: keep going.
      if (st.data.offset > offset) failures = 0;
      offset = st.data.offset;
    }
  };
  const giveUp = async () => {
    await abandon();
    throw new Error(`The Pi stopped receiving data (it has ${mb(offset)} of ${mb(file.size)} MB) and did not ` +
      `recover after ${MAX_RETRIES} retries. If this keeps happening, restart its networking under System, ` +
      'or connect the Pi by cable.');
  };
  const backOff = async () => {
    onNote(`Connection hiccup, retrying (${failures} of ${MAX_RETRIES})…`);
    await sleep(Math.min(15000, 1000 * 2 ** (failures - 1)));
    await resync();
  };

  while (offset < file.size) {
    const end = Math.min(file.size, offset + pacing.chunk);
    // Read the chunk into memory and send those exact bytes. Handed a
    // file-backed slice to upload, WebKit (the engine of every iPhone browser)
    // sent the wrong bytes for every chunk after the first, although slice()
    // itself read correctly. One chunk in memory at a time is at most 4 MB.
    let body;
    try { body = await file.slice(offset, end).arrayBuffer(); }
    catch { await abandon(); throw new Error('This device could not read the file any more. Please choose it again.'); }
    let r;
    try {
      r = await putChunk(`/api/uploads/${id}?offset=${offset}&length=${end - offset}`,
        body, loaded => onBytes(offset + Math.min(loaded, end - offset)));
    } catch (e) {
      // No answer. The link hiccuped, or is choking on big pieces: go on in
      // smaller ones from wherever the Pi got to.
      failures++;
      shrink();
      await backOff();
      if (failures > MAX_RETRIES) await giveUp();
      continue;
    }

    if (r.status === 200) {
      offset = r.data.offset;
      failures = 0; outOfStep = 0;
      onNote('');
      onBytes(offset);
      continue;
    }
    if (r.status === 413) {
      // Something between here and the Pi caps the size of a request.
      if (pacing.chunk <= MIN_CHUNK) { await abandon(); throw new Error(describeFailure(413, r.data)); }
      shrink();
      continue;
    }
    if (r.status === 409) {
      // Out of step: a dead chunk is still settling on the Pi, or offsets differ.
      if (++outOfStep > 20) { await abandon(); throw new Error('The upload got out of step with the Pi. Please try again.'); }
      if (r.data?.retry) { await sleep(1000); await resync(); }
      else if (typeof r.data?.offset === 'number') offset = r.data.offset;
      else await resync();
      continue;
    }
    if (r.status === 404) throw new Error(lost);
    // A disk problem on the Pi (full, read-only card) will not fix itself by
    // retrying, and must not be blamed on the network.
    if (r.data?.fatal) { await abandon(); throw new Error(r.data.error); }
    if (r.status >= 500 || (r.status === 400 && typeof r.data?.offset === 'number')) {
      // A chunk cut short on the way, or a write hiccup: resume.
      failures++;
      shrink();
      await backOff();
      if (failures > MAX_RETRIES) await giveUp();
      continue;
    }
    await abandon();
    throw new Error(describeFailure(r.status, r.data));
  }

  // Every byte is there: have the Pi move the file into place.
  for (let i = 0; i < 10; i++) {
    const done = await callJson('POST', `/api/uploads/${id}/complete`).catch(() => null);
    if (done?.ok) return done.data;
    if (done && done.status !== 409) { await abandon(); throw new Error(describeFailure(done.status, done.data)); }
    await sleep(1000);
  }
  await abandon();
  throw new Error('The file arrived but the Pi could not finish saving it. Please try again.');
}

// One file after another. Progress is reported in bytes across the whole
// selection, so a single large clip shows real movement.
export async function uploadFiles(folder, fileList, onProgress) {
  const files = Array.from(fileList);
  const total = files.reduce((sum, f) => sum + f.size, 0);
  let doneBytes = 0, current = 0, note = '';
  const saved = [];
  const report = () => onProgress?.({ sent: doneBytes + current, total, files: files.length, filesDone: saved.length, note });
  const pacing = { chunk: START_CHUNK };

  for (const file of files) {
    current = 0;
    const data = await uploadOne(folder, file, pacing,
      bytes => { current = bytes; report(); },
      text => { note = text; report(); });
    doneBytes += file.size;
    current = 0;
    saved.push(data);
    report();
  }
  return { success: true, files: saved };
}
