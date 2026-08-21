import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');
const component = readFileSync('components/profile/ProfileMemoryWorkspace.tsx', 'utf8');
const journey = readFileSync('components/journey/ProductionJourney.tsx', 'utf8');
const css = readFileSync('components/profile/ProfileMemoryWorkspace.module.css', 'utf8');
const bootstrap = readFileSync('app/api/app/bootstrap/route.ts', 'utf8');

assert.match(page, /<ProfileMemoryWorkspace/);
assert.doesNotMatch(page, /tab === 'profile'[^\n]+<ProductionJourney route="profile"/);

for (const surface of ['overview', 'health', 'character', 'social', 'passport', 'history', 'capture']) {
  assert.match(component, new RegExp(`surface === '${surface}'`), `missing production profile surface: ${surface}`);
}

for (const path of ['Использовать фото', 'Создать образ', 'Без изображения']) {
  assert.match(component, new RegExp(path), `missing owner-controlled identity path: ${path}`);
}

assert.match(component, /avatarCapabilities\.uploadsEnabled/);
assert.match(component, /avatarCapabilities\.generationEnabled/);
assert.match(component, /Появится после подключения генератора изображений/);
assert.match(component, /ничего не попадёт в память без подтверждения/i);
assert.match(component, /Неподтверждённое не влияет на выводы/);
assert.match(component, /showModal\(\)/);
assert.match(component, /identityTriggerRef\.current\?\.focus\(\)/);
assert.match(component, /editorTriggerRef\.current\?\.focus\(\)/);
assert.match(component, /openEditor\('health'/);
assert.match(component, /openEditor\('character'/);
assert.match(component, /openEditor\('social'/);
assert.match(component, /openEditor\('passport'/);
assert.match(component, /onSaveProfile/);
assert.doesNotMatch(component, /onEditProfile|onAddObservation/);
assert.match(page, /onOpenIdentity=\{\(\) =>/);
assert.match(page, /onSaveProfile=\{savePrivateProfile\}/);
assert.match(journey, /production-today-identity/);
assert.match(css, /min-height:\s*72px/);
assert.match(css, /font:\s*650 16px/);
assert.match(css, /prefers-reduced-motion/);

assert.match(bootstrap, /uploadsEnabled:\s*rc1Config\.flags\.uploads_enabled/);
assert.match(bootstrap, /generationEnabled:\s*rc1Config\.flags\.avatar_generation_enabled && providerReady/);

console.log('profile memory production contract: ok');
