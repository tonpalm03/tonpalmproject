// Draws the shareable donate card: the PromptPay QR with น้องพุงเด้ง saying thanks.

const W = 1080;
const H = 1440;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Draws `img` inside a box, keeping its aspect ratio, anchored to the box's bottom. */
function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh);
}

export async function renderDonateCard(input: { qrUrl: string; name?: string; number?: string }): Promise<Blob> {
  const [qr, mascot] = await Promise.all([loadImage(input.qrUrl), loadImage('/mascots/pung-deng-thanks.webp')]);
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้สร้างรูปไม่ได้');

  ctx.fillStyle = '#E1F5EE';
  ctx.fillRect(0, 0, W, H);

  // Soft wave lines, like the app's headers.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    const y = 220 + i * 70;
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.bezierCurveTo(W * 0.3, y - 90, W * 0.6, y + 90, W + 20, y - 20);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F6E56';
  ctx.font = `700 40px ${font}`;
  ctx.fillText('CPRUFood', W / 2, 110);
  ctx.fillStyle = '#04342C';
  ctx.font = `900 64px ${font}`;
  ctx.fillText('ช่วยให้น้องพุงเด้งได้ไปต่อ', W / 2, 200);

  const qrBox = 620;
  const qrX = (W - qrBox) / 2;
  const qrY = 260;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, qrX, qrY, qrBox, qrBox, 48);
  const pad = 40;
  drawContained(ctx, qr, qrX + pad, qrY + pad, qrBox - pad * 2, qrBox - pad * 2);

  let y = qrY + qrBox + 80;
  if (input.name) {
    ctx.fillStyle = '#04342C';
    ctx.font = `800 48px ${font}`;
    ctx.fillText(input.name, W / 2, y);
    y += 64;
  }
  if (input.number) {
    ctx.fillStyle = '#0F6E56';
    ctx.font = `700 42px ${font}`;
    ctx.fillText(`พร้อมเพย์ ${input.number}`, W / 2, y);
  }

  const mascotSize = 330;
  drawContained(ctx, mascot, W - mascotSize - 40, H - mascotSize - 30, mascotSize, mascotSize);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#085041';
  ctx.font = `700 44px ${font}`;
  ctx.fillText('ขอบคุณผู้ใจดี', 80, H - 170);
  ctx.fillText('ที่ช่วยให้น้องพุงเด้งได้ไปต่อ', 80, H - 105);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('สร้างรูปไม่สำเร็จ'))), 'image/png'));
}
