import { useRef, useEffect } from 'react';

export default function Slider({ min = 0, max = 100, step = 1, value, onChange, width = 130 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const block = e => { e.preventDefault(); e.stopPropagation(); };

    // Block BOTH touchstart and touchmove with passive:false
    // touchstart needs blocking too — without it the browser pre-decides
    // this is a scroll gesture before touchmove even fires
    el.addEventListener('touchstart', block, { passive: false });
    el.addEventListener('touchmove',  block, { passive: false });

    return () => {
      el.removeEventListener('touchstart', block);
      el.removeEventListener('touchmove',  block);
    };
  }, []);

  // onTouchEnd fires the onChange with the final value
  const handleTouch = e => {
    const touch = e.changedTouches[0];
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    onChange(Math.round(min + ratio * (max - min)));
  };

  return (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      onTouchEnd={handleTouch}
      style={{
        width,
        cursor: 'pointer',
        accentColor: 'var(--primary)',
        touchAction: 'none',
        display: 'block',
        height: 28,      // taller hit area on mobile
        flexShrink: 0,
      }}
    />
  );
}
