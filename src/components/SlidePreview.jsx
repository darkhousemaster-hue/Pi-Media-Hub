// Shared component: renders a mini replica of the TV player layout
// using actual image URLs from the current batch.

const LAYOUT_CSS = {
  'single':   { cols:'1fr',              rows:'1fr',           spans:[] },
  'grid-2h':  { cols:'1fr 1fr',          rows:'1fr',           spans:[] },
  'grid-2v':  { cols:'1fr',              rows:'1fr 1fr',       spans:[] },
  'triptych': { cols:'1fr 1.4fr 1fr',    rows:'1fr',           spans:[] },
  'grid-3':   { cols:'2fr 1fr',          rows:'1fr 1fr',       spans:[{i:0,row:'span 2'}] },
  'grid-4':   { cols:'1fr 1fr',          rows:'1fr 1fr',       spans:[] },
  'focus':    { cols:'1fr 1fr 1fr',      rows:'3fr 1fr',       spans:[{i:0,col:'span 3'}] },
  'grid-5':   { cols:'2fr 1fr',          rows:'repeat(4,1fr)', spans:[{i:0,row:'span 4'}] },
  'grid-6':   { cols:'1fr 1fr 1fr',      rows:'1fr 1fr',       spans:[] },
  'grid-8':   { cols:'repeat(4,1fr)',    rows:'1fr 1fr',       spans:[] },
  'grid-9':   { cols:'1fr 1fr 1fr',      rows:'1fr 1fr 1fr',   spans:[] },
};

const LAYOUT_COUNTS = {
  'single':1,'grid-2h':2,'grid-2v':2,'triptych':3,'grid-3':3,
  'grid-4':4,'focus':4,'grid-5':5,'grid-6':6,'grid-8':8,'grid-9':9,
};

export function layoutCount(id) {
  return LAYOUT_COUNTS[id] || 1;
}

export default function SlidePreview({ urls = [], layout = 'single', style = {} }) {
  const cfg = LAYOUT_CSS[layout] || LAYOUT_CSS['single'];
  const count = layoutCount(layout);
  // Pad with repeats if we don't have enough images
  const padded = count > 0 && urls.length > 0
    ? Array.from({ length: count }, (_, i) => urls[i % urls.length])
    : [];

  if (padded.length === 0) {
    return (
      <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,color:'rgba(255,255,255,0.3)',background:'#111',...style }}>
        <span style={{ fontSize:28 }}>🖼️</span>
        <span style={{ fontSize:11 }}>No images</span>
      </div>
    );
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:cfg.cols, gridTemplateRows:cfg.rows, gap:3, width:'100%', height:'100%', background:'#000', overflow:'hidden', ...style }}>
      {padded.map((url, i) => {
        const span = cfg.spans.find(s => s.i === i);
        return (
          <img
            key={i}
            src={url}
            alt=""
            style={{
              width:'100%',
              height:'100%',
              objectFit: 'contain',
              display:'block',
              minHeight:0,
              minWidth:0,
              gridRow: span?.row,
              gridColumn: span?.col,
            }}
          />
        );
      })}
    </div>
  );
}
