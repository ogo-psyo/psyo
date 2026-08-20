import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');
const hub = readFileSync('components/home/AllFunctionsHub.tsx', 'utf8');
const habitScreen = readFileSync('components/habits/HabitScreen.tsx', 'utf8');
const healthScreen = readFileSync('components/health/HealthTimelineScreen.tsx', 'utf8');

for (const file of [
  'components/habits/HabitScreen.tsx',
  'components/health/HealthTimelineScreen.tsx',
]) {
  assert.ok(existsSync(file), `real module screen missing: ${file}`);
}

for (const route of ["'habits'", "'health'"]) {
  assert.ok(page.includes(route), `app route missing: ${route}`);
}

for (const endpoint of ['/api/habits', '/api/health', '/summary']) {
  assert.ok(page.includes(endpoint), `real module endpoint is not connected: ${endpoint}`);
}

assert.ok(page.includes('onCheckIn={checkInHabit}'), 'existing habit records must remain operable during migration into the care plan');
assert.equal(hub.includes('>Привычки<'), false, 'habits must not compete with the unified care plan on the living home');
assert.ok(hub.includes("onNavigate('health')"), 'health card must open HealthTimeline UI');
for (const source of [habitScreen, healthScreen]) {
  assert.ok(source.includes('role="alert"'), 'module failures must be visible locally');
  assert.ok(source.includes('Повторить'), 'module failures must offer recovery');
}

for (const forbidden of [
  'Каждая функция использует профиль',
  'Профиль остаётся источником контекста',
  'Знания, которые Псё уже собрало',
  'Наблюдения, история и документы',
]) {
  assert.equal(hub.includes(forbidden), false, `manifesto copy must be removed: ${forbidden}`);
}

console.log('real module UI contract ok');
