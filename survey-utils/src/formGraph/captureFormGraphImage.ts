export type DiagramImage = {
  data: Uint8Array;
  width: number;
  height: number;
};

const MIN_PNG_BYTES = 500;
const RENDER_SCALE = 2;

let mermaidInitialized = false;

function parseViewBoxDimensions(svg: string): { width: number; height: number } {
  const parser = new DOMParser();
  const root = parser.parseFromString(svg, 'image/svg+xml').documentElement;
  const svgEl = root as unknown as SVGSVGElement;
  const viewBox = svgEl.viewBox?.baseVal;

  let width = viewBox?.width ?? 0;
  let height = viewBox?.height ?? 0;

  if (!width || !height) {
    const viewBoxAttr = root.getAttribute('viewBox');
    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/\s+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    }
  }

  if (!width || !height) {
    const attrWidth = parseFloat(root.getAttribute('width') ?? '0');
    const attrHeight = parseFloat(root.getAttribute('height') ?? '0');
    if (attrWidth > 0 && attrHeight > 0) {
      width = attrWidth;
      height = attrHeight;
    }
  }

  return {
    width: Math.ceil(width > 0 ? width : 800),
    height: Math.ceil(height > 0 ? height : 600),
  };
}

/** Normalize SVG for Image → canvas rasterization (explicit size, no foreignObject taint). */
function prepareSvgForRasterization(svg: string): { svg: string; width: number; height: number } {
  const { width, height } = parseViewBoxDimensions(svg);
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;

  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  if (!root.getAttribute('viewBox')) {
    root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }
  root.removeAttribute('style');

  // foreignObject labels taint canvas and break toBlob/toDataURL.
  root.querySelectorAll('foreignObject').forEach(el => el.remove());

  return {
    svg: new XMLSerializer().serializeToString(root),
    width,
    height,
  };
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('canvas.toBlob returned null'));
          return;
        }
        blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
      },
      'image/png',
      1
    );
  });
}

/** Rasterize Mermaid SVG via Image → canvas (user's recommended pipeline). */
async function svgStringToPng(svg: string): Promise<DiagramImage | null> {
  const { svg: preparedSvg, width, height } = prepareSvgForRasterization(svg);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(preparedSvg)}`;

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load SVG as image'));
      img.src = url;
    });
    if (typeof img.decode === 'function') {
      await img.decode();
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * RENDER_SCALE);
    canvas.height = Math.ceil(height * RENDER_SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const data = await canvasToPngBytes(canvas);
    if (data.length < MIN_PNG_BYTES) return null;

    return { data, width, height };
  } catch (err) {
    console.error('Mermaid SVG rasterization failed:', err);
    return null;
  }
}

/** Render a Mermaid flowchart definition to a PNG suitable for Word embedding. */
export async function captureFormGraphImage(mermaidSource: string): Promise<DiagramImage | null> {
  const trimmed = mermaidSource.trim();
  if (!trimmed) return null;

  try {
    const mermaid = (await import('mermaid')).default;

    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        fontFamily: 'Arial, sans-serif',
        // Mermaid 11: root-level htmlLabels (flowchart.htmlLabels is deprecated).
        htmlLabels: false,
        flowchart: {
          useMaxWidth: false,
        },
      });
      mermaidInitialized = true;
    }

    const renderId = `form-graph-${crypto.randomUUID().replace(/-/g, '')}`;
    const { svg } = await mermaid.render(renderId, trimmed);
    return svgStringToPng(svg);
  } catch (err) {
    console.error('Mermaid render failed:', err);
    return null;
  }
}
