import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const outDir = path.resolve('out/threads-launch');
await fs.mkdir(outDir, { recursive: true });

const W = 1080, H = 1350;
const cards = [
  {
    file: '01-walk-vibecode.png',
    kicker: 'ПСЁ MVP',
    title: 'Погулял с собакой.\nПовайбкодил Псё.',
    text: 'Началось как мини-MVP, закончилось маленьким цифровым миром собаки.',
    chips: ['герой', 'today', 'карта', 'ассистент'],
  },
  {
    file: '02-hero-care.png',
    kicker: 'ПЕРВЫЙ КАЙФ',
    title: 'Сначала — герой.\nПотом забота.',
    text: 'Аватар, профиль, напоминания и первый care-loop без регистрации и скучной анкеты.',
    chips: ['аватар', '6 полей', 'напоминания'],
  },
  {
    file: '03-care-os.png',
    kicker: 'НЕ PET CRM',
    title: 'Скорее care OS\nдля пса.',
    text: 'Паспорт, зоны прогулок, правила знакомства, ассистент по профилю и вещи по делу.',
    chips: ['паспорт', 'зоны', 'вещи'],
  },
];

function esc(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function lines(text, x, y, size, weight=800, fill='#071c20', lh=1.05) {
  return esc(text).split('\n').map((line, i) => `<text x="${x}" y="${y + i * size * lh}" font-size="${size}" font-weight="${weight}" fill="${fill}">${line}</text>`).join('');
}
function chip(label, x, y) {
  return `<g><rect x="${x}" y="${y}" width="${label.length * 22 + 58}" height="54" rx="27" fill="#ffffff" stroke="#b9deda"/><text x="${x+29}" y="${y+36}" font-size="24" font-weight="760" fill="#31565c">${esc(label)}</text></g>`;
}
function phoneMock(x, y, scale=1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect width="350" height="620" rx="54" fill="#fafeff" stroke="#b7deda" stroke-width="3"/>
    <rect x="28" y="32" width="294" height="102" rx="34" fill="#edf9f4" stroke="#c7e6de"/>
    <circle cx="82" cy="83" r="36" fill="#10191b"/>
    <text x="132" y="78" font-size="18" font-weight="800" fill="#47666c">✨ Метис</text>
    <text x="132" y="108" font-size="34" font-weight="900" fill="#071c20">Мята</text>
    <rect x="28" y="158" width="294" height="150" rx="34" fill="#ffffff" stroke="#c7e6de"/>
    <text x="54" y="205" font-size="22" font-weight="900" fill="#071c20">Сегодня спокойно</text>
    <rect x="54" y="238" width="240" height="44" rx="22" fill="#087f73"/>
    <text x="112" y="268" font-size="18" font-weight="800" fill="#fff">Спросить Псё</text>
    <rect x="28" y="332" width="294" height="110" rx="30" fill="#eef9f4" stroke="#c7e6de"/>
    <text x="54" y="378" font-size="20" font-weight="900" fill="#071c20">Задачи ухода</text>
    <rect x="54" y="400" width="220" height="28" rx="14" fill="#c9eee5"/>
    <rect x="28" y="470" width="294" height="96" rx="32" fill="#ffffff" stroke="#c7e6de"/>
    <text x="58" y="528" font-size="19" font-weight="800" fill="#31565c">Сегодня  Собака  Карта</text>
  </g>`;
}

for (let i=0; i<cards.length; i++) {
  const c = cards[i];
  const chips = c.chips.map((label, idx) => chip(label, 84 + idx * 230, 1140)).join('');
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><style>text{font-family:Inter,Arial,sans-serif}</style>
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbfffd"/><stop offset="1" stop-color="#dff5f3"/></linearGradient>
      <radialGradient id="orb" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#65c8c9" stop-opacity=".42"/><stop offset="1" stop-color="#65c8c9" stop-opacity="0"/></radialGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#4f7d82" flood-opacity=".18"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="860" cy="180" r="290" fill="url(#orb)"/>
    <circle cx="170" cy="1110" r="260" fill="url(#orb)"/>
    <rect x="54" y="54" width="972" height="1242" rx="72" fill="#ffffff" opacity=".74" stroke="#c3e4df"/>
    <text x="84" y="150" font-size="27" font-weight="900" letter-spacing="4" fill="#087f73">${esc(c.kicker)}</text>
    ${lines(c.title, 84, 270, 82, 930, '#071c20', 1.02)}
    <foreignObject x="84" y="510" width="510" height="210"><div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Inter,Arial,sans-serif;font-size:36px;line-height:1.18;font-weight:700;color:#47666c">${esc(c.text)}</div></foreignObject>
    <g filter="url(#shadow)">${phoneMock(i === 0 ? 620 : i === 1 ? 600 : 585, i === 0 ? 520 : 500, i === 0 ? .92 : .96)}</g>
    ${chips}
    <text x="84" y="1260" font-size="28" font-weight="800" fill="#47666c">pso-mvp-uglanovrms-projects.vercel.app</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, c.file));
}

await fs.writeFile(path.join(outDir, 'post-text.md'), `# Threads post\n\nЯ хотел “быстро набросать штуку для собаки”. Ну да, классика. Теперь там аватар, Today, паспорт, карта безопасных/стрёмных мест, ассистент по профилю и вишлист. Называется «Псё». Показываю MVP, который родился где-то между прогулкой и vibe coding.\n\nCTA: Хочу 5–10 владельцев собак на быстрый тест. Если интересно — напиши “Псё”.\n`);
console.log(outDir);
