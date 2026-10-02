// All reads go through Vite proxy (relative URLs, same-origin, no CORS).
// Uploads go directly to port 3000 — Vite's proxy drops large multipart bodies.

const isDev = typeof window !== 'undefined' && window.location.port === '5173';
export const DIRECT_BASE = isDev ? 'http://localhost:3000' : '';

export async function apiFetch(path, options = {}) {
  return fetch(path, options);
}

// An upload that has sent nothing for this long is dead (Wi-Fi dropped, phone
// locked). One that is merely slow keeps resetting the clock, however long.
const STALL_MS = 45 * 1000;
// Once every byte is sent the Pi only has to move a file and answer.
const REPLY_MS = 2 * 60 * 1000;

function describeFailure(status, data) {
  if (data && data.error) return data.error;
  if (status === 413) return 'That file is too large for this connection (HTTP 413).';
  if (status === 408 || status === 504 || status === 524) {
    return 'The upload took too long and the server gave up. Try again on a stronger Wi-Fi signal.';
  }
  return status ? `Upload failed (HTTP ${status}).` : 'Upload failed: no answer from the Pi.';
}

// fetch() cannot report upload progress, so a 150 MB clip over Wi-Fi sat on a
// frozen "Uploading…" for minutes, and when the connection died nobody found
// out for another five. XHR reports every chunk sent, which drives both the
// progress bar and the stall detection.
function sendBatch(folder, files, onBytes) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
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
      if (!sentAll && idle > STALL_MS) {
        xhr.abort();
        finish(reject, new Error('The upload stopped moving. Check the Wi-Fi and try again.'));
      } else if (sentAll && idle > REPLY_MS) {
        xhr.abort();
        finish(reject, new Error('The file was sent but the Pi never confirmed it. Refresh to check.'));
      }
    }, 2000);

    // Listeners must be attached before send() or no progress events fire.
    xhr.upload.onprogress = e => { lastMove = Date.now(); onBytes(e.loaded); };
    xhr.upload.onload = () => { sentAll = true; lastMove = Date.now(); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data && !data.error) finish(resolve, data);
      else finish(reject, new Error(describeFailure(xhr.status, data)));
    };
    xhr.onerror = () => finish(reject, new Error('Lost the connection to the Pi during the upload.'));

    xhr.open('POST', `${DIRECT_BASE}/api/files/${folder}`);
    xhr.send(form);
  });
}

// Upload in batches of 10 so hundreds of files go through reliably. Progress
// is reported in bytes across the whole selection, not per batch, so a single
// large clip shows real movement instead of "0 / 1".
export async function uploadFiles(folder, fileList, onProgress) {
  const files = Array.from(fileList);
  const BATCH = 10;
  const total = files.reduce((sum, f) => sum + f.size, 0);
  let doneBytes = 0;
  const allSaved = [];

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const batchBytes = batch.reduce((sum, f) => sum + f.size, 0);
    const data = await sendBatch(folder, batch, loaded => {
      // loaded includes the multipart framing, so clamp to the file bytes
      onProgress?.({ sent: doneBytes + Math.min(loaded, batchBytes), total, files: files.length, filesDone: allSaved.length });
    });
    doneBytes += batchBytes;
    allSaved.push(...data.files);
    onProgress?.({ sent: doneBytes, total, files: files.length, filesDone: allSaved.length });
  }

  return { success: true, files: allSaved };
}
