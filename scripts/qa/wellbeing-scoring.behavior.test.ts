import assert from 'node:assert/strict';
import test from 'node:test';
import { wellbeingValue } from '../../lib/wellbeingScoring';

test('scores sleeping more than usual as reduced energy, not normal energy', () => {
  assert.equal(wellbeingValue('energy', 'спит больше обычного'), 1);
});

test('scores positive natural-language values consistently', () => {
  assert.equal(wellbeingValue('energy', 'бодрая'), 3);
  assert.equal(wellbeingValue('appetite', 'поела хорошо'), 3);
  assert.equal(wellbeingValue('mood', 'довольная'), 4);
});
