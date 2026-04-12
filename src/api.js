// All reads go through Vite proxy (relative URLs, same-origin, no CORS).
// Uploads go directly to port 3000 — Vite's proxy drops large multipart bodies.

const isDev = typeof window !== 'undefined' && window.location.port === '5173';
export const DIRECT_BASE = isDev ? 'http://localhost:3000' : '';

export async function apiFetch(path, options = {}) {
  return fetch(path, options);
}

// Upload files in batches of 10 to handle hundreds of files reliably
export async function uploadFiles(folder, fileList, onProgress) {
  const files = Array.from(fileList);
  const BATCH = 10;
  let totalUploaded = 0;
  const allSaved = [];

  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const formData = new FormData();
    batch.forEach(f => formData.append('files', f));

    const res = await fetch(`${DIRECT_BASE}/api/files/${folder}`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Upload failed (${res.status})`);

    totalUploaded += data.files.length;
    allSaved.push(...data.files);

    if (onProgress) onProgress(totalUploaded, files.length);
  }

  return { success: true, files: allSaved };
}
