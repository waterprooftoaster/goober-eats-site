/**
 * @file make-fixtures.js
 * @description Generates four image fixtures for the verification spec:
 *   square (in-band), 9:16 (in-band), 9:19.5 (in-band edge), 16:9 (out-of-band).
 *   Called by: manual run before tests/e2e/verification/image-refactor.spec.ts
 * @dependencies sharp
 */

const sharp = require('sharp')

async function makeSvg(name, w, h, label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" fill="${color}"/>
    <rect x="${w * 0.05}" y="${h * 0.1}" width="${w * 0.9}" height="${h * 0.12}" fill="#ff8000"/>
    <text x="${w * 0.5}" y="${h * 0.18}" font-family="Arial" font-size="${Math.min(w, h) * 0.06}" fill="white" text-anchor="middle">${label}</text>
    <rect x="${w * 0.05}" y="${h * 0.3}" width="${w * 0.9}" height="${h * 0.5}" fill="white" stroke="#ddd"/>
    <text x="${w * 0.1}" y="${h * 0.4}" font-family="Arial" font-size="${Math.min(w, h) * 0.04}" fill="#222">Sample cart contents</text>
    <text x="${w * 0.1}" y="${h * 0.5}" font-family="Arial" font-size="${Math.min(w, h) * 0.04}" fill="#666">Item 1 - 9.50</text>
    <text x="${w * 0.1}" y="${h * 0.58}" font-family="Arial" font-size="${Math.min(w, h) * 0.04}" fill="#666">Item 2 - 4.50</text>
    <text x="${w * 0.1}" y="${h * 0.7}" font-family="Arial" font-size="${Math.min(w, h) * 0.05}" fill="#000">Total: 14.00</text>
    <rect x="${w * 0.05}" y="${h * 0.85}" width="${w * 0.9}" height="${h * 0.08}" fill="#ff8000" rx="6"/>
    <text x="${w * 0.5}" y="${h * 0.91}" font-family="Arial" font-size="${Math.min(w, h) * 0.04}" fill="white" text-anchor="middle">Place Order</text>
  </svg>`

  await sharp(Buffer.from(svg)).png().toFile(`/tmp/fixture-${name}.png`)
  console.log(`generated /tmp/fixture-${name}.png (${w}x${h})`)
}

async function main() {
  await makeSvg('square', 1024, 1024, 'Square Menu Crop', '#f0f0f0')
  await makeSvg('9x16', 720, 1280, 'Phone 9:16', '#f0f0f0')
  await makeSvg('9x195', 720, 1560, 'Tall Phone 9:19.5', '#f0f0f0')
  await makeSvg('16x9', 1600, 900, 'Landscape 16:9 (out-of-band)', '#fee')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
