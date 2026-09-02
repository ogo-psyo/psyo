import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync('components/health/HealthTimelineScreen.tsx', 'utf8');
const editor = readFileSync('components/care/ObservationEditor.tsx', 'utf8');
const fields = readFileSync('components/health/ObservationMetricFields.tsx', 'utf8');

for (const marker of [
  'health-capture-progress',
  '<ObservationMetricFields',
  'Добавить контекст',
  'data-observation-metrics',
  'health-observation-grid',
  'data-observation-calendar',
  'health-calendar-grid',
  'selectedDayEntries',
  'В этот день отметок нет',
  'Контекст владельца',
  'не отмечено',
]) assert.ok(screen.includes(marker), `structured observation screen must expose: ${marker}`);

for (const metric of ['mood', 'appetite', 'stool', 'energy']) {
  assert.ok(fields.includes(`key: '${metric}'`), `shared observation fields must include ${metric}`);
}

assert.ok(editor.includes('<ObservationMetricFields'), 'editing must reuse the same structured metric controls');
assert.ok(editor.includes('Изменить контекст'), 'editing note must remain secondary');
assert.ok(!editor.includes('<label>Настроение<input'), 'editing must not fall back to free-text metric inputs');
assert.ok(!screen.includes('entrySummary(entry).slice'), 'history must not flatten metrics into a comment-like sentence');
assert.ok(!screen.includes('entries.map((entry)'), 'calendar must not render the full observation backlog at once');

console.log('structured observations behavior ok');
