import assert from 'node:assert/strict';
import { inflectPetName } from '../../lib/copy';

assert.equal(inflectPetName('Мята', 'accs'), 'Мяту');
assert.equal(inflectPetName('Боня', 'accs'), 'Боню');
assert.equal(inflectPetName('Марс', 'accs'), 'Марса');

console.log('pet name accusative inflection behavior ok');
