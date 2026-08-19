#!/usr/bin/env node

import fs from 'node:fs';

const requiredFiles = [
  'components/ui/Button.tsx',
  'components/ui/StatusButton.tsx',
  'components/ui/Badge.tsx',
  'components/ui/Surface.tsx',
  'components/ui/PageHeader.tsx',
  'components/ui/FormControls.tsx',
  'components/ui/LongPressButton.tsx',
];

const failures = [];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing shared UI primitive: ${file}`);
}

function requireSource(file, patterns) {
  if (!fs.existsSync(file)) {
    failures.push(`missing source: ${file}`);
    return;
  }

  const source = fs.readFileSync(file, 'utf8');
  for (const [label, pattern] of patterns) {
    if (!pattern.test(source)) failures.push(`${file} must ${label}`);
  }
}

requireSource('components/app/AppNavigation.tsx', [
  ['use the shared Button primitive', /from ['"]@\/components\/ui\/Button['"]/],
  ['render navigation through Button', /<Button\b/],
]);

requireSource('components/today/NextCareCard.tsx', [
  ['use shared UI primitives', /from ['"]@\/components\/ui\//],
  ['render the care status through Badge', /<Badge\b/],
  ['render supporting actions through Button', /<Button\b/],
  ['render the primary care action through StatusButton', /<StatusButton\b/],
  ['render the container through Surface', /<Surface\b/],
]);

requireSource('components/watercolor.tsx', [
  ['use the shared PageHeader primitive', /<PageHeader\b/],
  ['use shared Surface primitives', /<Surface\b/],
  ['include the decorative bloom layer', /ui-decorative-bloom/],
]);

requireSource('components/care/DeleteCareDialog.tsx', [
  ['use the shared LongPressButton for destructive confirmation', /<LongPressButton\b/],
]);

requireSource('app/pouf.css', [
  ['style shared buttons', /\.ui-button\b/],
  ['style status transitions', /\.ui-status-button-label\b/],
  ['style shared surfaces', /\.ui-surface\b/],
  ['style shared badges', /\.ui-badge\b/],
  ['style shared fields', /\.ui-field\b/],
  ['style shared page headers', /\.ui-page-header\b/],
  ['style destructive hold progress', /\.ui-long-press\b/],
  ['style the decorative bloom', /\.ui-decorative-bloom\b/],
]);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, requiredFiles }, null, 2));
