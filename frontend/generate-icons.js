const sharp = require('sharp');
const fs = require('fs');

async function generate() {
  const svg = fs.readFileSync('public/icons/icon-512.svg');
  const sizes = [48, 72, 96, 128, 144, 192, 256, 384, 512];

  for (const s of sizes) {
    await sharp(svg).resize(s, s).png().toFile(`public/icons/icon-${s}.png`);
    console.log(`icon-${s}.png OK`);
  }

  const maskSvg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">' +
    '<rect width="512" height="512" fill="#2563eb"/>' +
    '<text x="256" y="340" font-family="Arial,Helvetica,sans-serif" font-size="260" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="-10">K</text>' +
    '</svg>'
  );

  await sharp(maskSvg).resize(192, 192).png().toFile('public/icons/icon-192-maskable.png');
  console.log('icon-192-maskable.png OK');
  await sharp(maskSvg).resize(512, 512).png().toFile('public/icons/icon-512-maskable.png');
  console.log('icon-512-maskable.png OK');

  console.log('ALL_ICONS_DONE');
}

generate().catch(e => { console.error(e); process.exit(1); });
