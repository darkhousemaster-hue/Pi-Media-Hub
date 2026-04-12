import { useRef, useEffect } from 'react';

/**
 * Mobile-safe range slider.
 * Only blocks touchmove (not touchstart) so:
 *   - touchstart: browser recognises initial finger position on the slider
 *   - touchmove: we block page scroll so the drag stays on the slider
 */
export default function Slider({ min = 0, max = 100, step = 1, value, onChange, width = 130 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const block = e => { if (e.cancelable) e.preventDefault(); };
    // Only block touchmove — touchstart must NOT be blocked or the drag never starts
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  return (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        width,
        cursor: 'pointer',
        accentColor: 'var(--primary)',
        touchAction: 'none',
        display: 'block',
        height: 22,
        flexShrink: 0,
      }}
    />
  );
}
