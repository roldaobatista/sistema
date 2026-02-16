/**
 * Gera PNGs a partir dos SVGs para PWA (todos os tamanhos + maskable).
 * Uso: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');
const SIZES = [48, 72, 96, 128, 144, 192, 256, 384, 512];
const SVG_SOURCE = join(ICONS_DIR, 'icon-512.svg');

async function main() {
  if (!existsSync(SVG_SOURCE)) {
    console.error('Arquivo não encontrado:', SVG_SOURCE);
    process.exit(1);
  }
  mkdirSync(ICONS_DIR, { recursive: true });
  const svgBuffer = readFileSync(SVG_SOURCE);

  for (const size of SIZES) {
    const outPath = join(ICONS_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log('Gerado:', outPath);
  }

  for (const size of [192, 512]) {
    const outPath = join(ICONS_DIR, `icon-${size}-maskable.png`);
    const iconSize = Math.round(size * 0.8);
    const padding = (size - iconSize) / 2;
    const icon = await sharp(svgBuffer).resize(iconSize, iconSize).png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 },
      },
    })
      .composite([{ input: icon, left: Math.round(padding), top: Math.round(padding) }])
      .png()
      .toFile(outPath);
    console.log('Gerado (maskable):', outPath);
  }

  console.log('Concluído.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
