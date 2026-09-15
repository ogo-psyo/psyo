import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');
const component = readFileSync('components/profile/ProfileMemoryWorkspace.tsx', 'utf8');
const journey = readFileSync('components/journey/ProductionJourney.tsx', 'utf8');
const css = readFileSync('components/profile/ProfileMemoryWorkspace.module.css', 'utf8');
const bootstrap = readFileSync('app/api/app/bootstrap/route.ts', 'utf8');

const exactProfile = readFileSync('components/exact/ExactProfile.tsx', 'utf8');
const fields = readFileSync('components/exact/ExactProfileFields.tsx', 'utf8');
const exactShell = readFileSync('components/exact/ExactShell.tsx', 'utf8');
const sourceCss = readFileSync('components/exact/exact-interface.css', 'utf8');
assert.match(page, /<ExactProfile/);
assert.doesNotMatch(page, /tab === 'profile'[^\n]+<ProductionJourney route="profile"/);
for (const view of ['memory', 'documents', 'document', 'editprofile', 'identity']) {
  assert.match(exactProfile, new RegExp(`props.view === '${view}'`), `missing profile view: ${view}`);
}
for (const group of ['Паспорт и внешность','Характер и общение','Здоровье и уход']) assert.ok(fields.includes(group));
for (const path of ['onPhotoChange','onGenerateAvatar','onUseNoAvatar','onRollbackAvatar','onActivateAvatar','onDiscardAvatarDraft','onSaveProfile','onOpenHealth','onOpenHabits','onOpenCard','onOpenSettings','onDeleteDocument']) assert.ok(exactProfile.includes(path), `missing profile action: ${path}`);
assert.match(exactProfile, /avatarCapabilities\.uploadsEnabled/);
assert.match(exactProfile, /avatarCapabilities\.generationEnabled/);
assert.match(exactProfile, /avatarConsent/);
assert.match(exactProfile, /if \(id\) \{ props.onDraft\(null\); back\(\); \}/);
assert.match(exactShell, /heading.focus\(\{ preventScroll: true \}\)/);
assert.match(page, /onSaveProfile=\{savePrivateProfile\}/);
assert.match(sourceCss, /Naris/);
// Legacy contracts remain documented; active UI uses the exact source components above.
assert.match(component, /Неподтверждённое не влияет на выводы/);
assert.match(journey, /data-observation-timeline/);
assert.match(css, /prefers-reduced-motion/);

assert.match(bootstrap, /uploadsEnabled:\s*rc1Config\.flags\.uploads_enabled/);
assert.match(bootstrap, /generationEnabled:\s*rc1Config\.flags\.avatar_generation_enabled && providerReady/);

console.log('profile memory production contract: ok');
