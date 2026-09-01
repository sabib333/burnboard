// High-Res 1080x1080 Viral OG Card Generator
// Generates pixel-perfect PNG blobs for direct instant download or sharing

export interface OgCardOptions {
  template?: 'roast' | 'battle';
  username: string;
  text?: string;
  platform?: string;
  anonId?: string;
  username2?: string;
  votes1?: string;
  votes2?: string;
}

export function generateOgCanvas(options: OgCardOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas 2D context not available'));
      return;
    }

    const {
      template = 'roast',
      username,
      text = '',
      platform = 'Social',
      anonId = 'Anonymous Burner',
      username2 = 'target2',
      votes1 = '50%',
      votes2 = '50%'
    } = options;

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 1080, 1080);

    // Subtle grid dots pattern
    ctx.fillStyle = '#181818';
    for (let x = 40; x < 1080; x += 60) {
      for (let y = 40; y < 1080; y += 60) {
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Outer Border
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, 1064, 1064);

    // Inner subtle glow accent
    const gradient = ctx.createLinearGradient(0, 0, 1080, 0);
    gradient.addColorStop(0, '#ff4d00');
    gradient.addColorStop(1, '#ff8533');

    // Header: BURNBOARD Logo + Platform Pill
    ctx.font = 'italic 900 42px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🔥 BURNBOARD', 70, 120);

    if (template === 'battle') {
      // Battle Pill Header
      ctx.fillStyle = '#ff4d00';
      ctx.beginPath();
      ctx.roundRect(740, 75, 270, 58, 29);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 22px Inter, system-ui, sans-serif';
      ctx.fillText('⚔️ BATTLE ARENA', 775, 112);

      // Candidate 1 Card
      ctx.fillStyle = '#111111';
      ctx.strokeStyle = '#ff4d00';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(70, 240, 390, 480, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff4d00';
      ctx.font = '800 36px Inter, system-ui, sans-serif';
      ctx.fillText(`@${username}`, 100, 320);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 64px Inter, system-ui, sans-serif';
      ctx.fillText(votes1, 100, 440);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '600 24px Inter, system-ui, sans-serif';
      ctx.fillText('Most Roasted', 100, 500);

      // VS Circle in center
      ctx.fillStyle = '#0a0a0a';
      ctx.strokeStyle = '#ff4d00';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(540, 480, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VS', 540, 492);
      ctx.textAlign = 'start';

      // Candidate 2 Card
      ctx.fillStyle = '#111111';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(620, 240, 390, 480, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#60a5fa';
      ctx.font = '800 36px Inter, system-ui, sans-serif';
      ctx.fillText(`@${username2}`, 650, 320);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 64px Inter, system-ui, sans-serif';
      ctx.fillText(votes2, 650, 440);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '600 24px Inter, system-ui, sans-serif';
      ctx.fillText('Most Roasted', 650, 500);

    } else {
      // Roast Template Header Platform Pill
      ctx.fillStyle = '#161616';
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(830, 75, 180, 56, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff4d00';
      ctx.font = 'bold 22px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(platform.toUpperCase(), 920, 110);
      ctx.textAlign = 'start';

      // Anon Author Line
      ctx.font = '600 28px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#ff4d00';
      ctx.fillText(anonId, 70, 300);

      ctx.fillStyle = '#71717a';
      ctx.fillText(' •  targeted on  ', 70 + ctx.measureText(anonId).width, 300);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px Inter, system-ui, sans-serif';
      ctx.fillText(`@${username}`, 70 + ctx.measureText(anonId).width + 180, 300);

      // Large Roast Text Center (Inter Bold 48px, wrapped)
      ctx.font = '800 48px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';

      const wrapWords = `"${text}"`.split(' ');
      let currentLine = '';
      let y = 390;
      const maxWidth = 940;
      const lineHeight = 66;

      for (let i = 0; i < wrapWords.length; i++) {
        const testLine = currentLine + wrapWords[i] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
          ctx.fillText(currentLine, 70, y);
          currentLine = wrapWords[i] + ' ';
          y += lineHeight;
        } else {
          currentLine = testLine;
        }
      }
      ctx.fillText(currentLine, 70, y);
    }

    // Divider Line
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(70, 920);
    ctx.lineTo(1010, 920);
    ctx.stroke();

    // Bottom Footer Watermark
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#a1a1aa';
    ctx.fillText('Target: ', 70, 980);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px Inter, system-ui, sans-serif';
    ctx.fillText(`@${username}`, 160, 980);

    // Right Watermark
    ctx.textAlign = 'right';
    ctx.font = '900 26px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🔥 BURNBOARD  |  ', 980, 980);
    ctx.fillStyle = '#ff4d00';
    ctx.fillText('burnboard.xyz', 1010, 980);
    ctx.textAlign = 'start';

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/png');
  });
}

/**
 * Downloads a generated 1080x1080 OG image directly to the user's filesystem
 */
export async function downloadOgImage(options: OgCardOptions, filename = 'burnboard-roast.png') {
  const blob = await generateOgCanvas(options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
