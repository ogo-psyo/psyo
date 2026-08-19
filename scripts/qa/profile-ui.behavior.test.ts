import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');

for (const token of [
  "fetch('/api/v1/pets'",
  "'Idempotency-Key': idempotencyKey",
  "method: 'PATCH'",
  'JSON.stringify({ activePetId: nextPetId })',
  "fetch(`/api/dog-cards?petId=${encodeURIComponent(petId)}`",
  "confirmation: 'DELETE_DOG'",
  "confirmation: 'DELETE_ACCOUNT'",
  'Сохранить личный профиль',
  'primary mini-next-action',
  'details.open = true',
  'Добавить собаку',
  'Удалить собаку',
  'Удалить аккаунт',
  'Введите имя собаки полностью',
  'УДАЛИТЬ АККАУНТ',
]) {
  assert.ok(page.includes(token), `profile lifecycle UI missing ${token}`);
}

assert.ok(
  page.indexOf("fetch('/api/v1/pets'") < page.indexOf("fetch('/api/dog-cards'"),
  'private profile persistence must be implemented independently from public card publishing',
);

assert.equal(
  /savePrivateProfile[\s\S]{0,3000}isPublic:\s*true/.test(page),
  false,
  'private profile save must never publish the dog card',
);

console.log('profile lifecycle UI behavioral contract ok');
