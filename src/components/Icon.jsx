// One stroked icon set at a single weight, replacing the mixed emoji.
// Paths are drawn on a 24×24 grid; stroke styling lives in .ico (App.css).

const P = {
  play:     <path d="M7 4.5v15l12-7.5z" />,
  pause:    <path d="M9 5v14M15 5v14" />,
  stop:     <rect x="6" y="6" width="12" height="12" rx="2" />,
  next:     <path d="M6 5l9 7-9 7zM18 5v14" />,
  restart:  <path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4h-4" />,
  image:    <><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="8.5" cy="10" r="1.6" /><path d="M21 15.5l-4.5-4L7 19.5" /></>,
  film:     <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M7 5v14M17 5v14M2.5 12h19" /></>,
  music:    <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  // The screen, and the screen with a play triangle: send this to it.
  tv:       <><rect x="2.5" y="4.5" width="19" height="13" rx="2.5" /><path d="M8 21h8" /></>,
  cue:      <><rect x="2.5" y="4.5" width="19" height="13" rx="2.5" /><path d="M8 21h8" /><path d="M10.5 9.2v4.6l4-2.3z" /></>,
  search:   <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  sliders:  <><path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2" /><circle cx="10" cy="16" r="2" /></>,
  wifi:     <><path d="M4 9.5a13 13 0 0 1 16 0M7 13a8.5 8.5 0 0 1 10 0" /><circle cx="12" cy="17.5" r="1.4" /></>,
  power:    <><path d="M12 3.5v8" /><path d="M17.5 6.8a8 8 0 1 1-11 0" /></>,
  up:       <path d="M12 20V5M6 11l6-6 6 6" />,
  down:     <path d="M12 4v15M6 13l6 6 6-6" />,
  pencil:   <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z" />,
  trash:    <path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13" />,
  check:    <path d="M5 12.5l5 5 9-11" />,
  close:    <path d="M6 6l12 12M18 6L6 18" />,
  grid:     <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  list:     <path d="M4 7h16M4 12h16M4 17h16" />,
  refresh:  <path d="M4 12a8 8 0 1 1 2.6 5.9M4 20v-4h4" />,
  save:     <><path d="M5 4.5h11l3.5 3.5v11.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" /><path d="M8 4.5v5h7v-5M8 19.5v-5h8v5" /></>,
  disk:     <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M6 12h6" /><circle cx="17" cy="12" r="1.4" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6.5 9.5h.01M10 9.5h.01M13.5 9.5h.01M17 9.5h.01M6.5 12.8h.01M10 12.8h.01M13.5 12.8h.01M17 12.8h.01M8.5 15.8h7" /></>,
  chevron:  <path d="M9 5l7 7-7 7" />,
  dots:     <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  upload:   <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v3.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  plug:     <><path d="M9 3v5M15 3v5" /><path d="M6 8h12v3a6 6 0 0 1-12 0z" /><path d="M12 17v4" /></>,
};

export default function Icon({ name, size, className = '' }) {
  const cls = ['ico', size === 'sm' ? 'ico-sm' : size === 'lg' ? 'ico-lg' : '', className]
    .filter(Boolean).join(' ');
  return (
    <svg className={cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {P[name] || null}
    </svg>
  );
}
