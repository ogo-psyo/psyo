import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
mkdirSync('public/icons', { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="g" cx="30%" cy="20%" r="80%">
      <stop offset="0" stop-color="#61e7ff"/>
      <stop offset="0.45" stop-color="#d8ff3e"/>
      <stop offset="1" stop-color="#101219"/>
    </radialGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="36" flood-color="#000" flood-opacity=".35"/></filter>
  </defs>
  <rect width="1024" height="1024" rx="232" fill="#101219"/>
  <circle cx="760" cy="220" r="180" fill="#8f6bff" opacity=".28"/>
  <circle cx="250" cy="820" r="220" fill="#61e7ff" opacity=".18"/>
  <g filter="url(#s)">
    <rect x="150" y="150" width="724" height="724" rx="190" fill="url(#g)"/>
    <text x="512" y="605" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="255" font-weight="1000" letter-spacing="-28" fill="#090a0f">PSЁ</text>
    <text x="512" y="715" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="900" letter-spacing="8" fill="#090a0f" opacity=".75">DOG OS</text>
  </g>
</svg>`;
writeFileSync('public/icons/pso-icon.svg', svg);
for (const size of [180, 192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/pso-icon-${size}.png`);
}
