const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { selectPerksWithPriority } = require('../js/dbdrandomperk.js');

const readScript = name => fs.readFileSync(path.join(__dirname, '..', 'js', name), 'utf8');
const context = vm.createContext({});
vm.runInContext(readScript('library.js'), context);
const { newContent, killers, survivors, killerPerkData, survivorPerkData } = vm.runInContext(
    '({ newContent, killers, survivors, killerPerkData, survivorPerkData })', context
);

for (const [group, characters, perks] of [
    ['killers', killers, killerPerkData],
    ['survivors', survivors, survivorPerkData]
]) {
    for (const id of newContent[group]) {
        const character = characters.find(entry => entry.id === id);
        assert.ok(character, `Unknown character: ${group}/${id}`);
        assert.ok(perks.some(perk => perk.category === character.name), `No perks for ${character.name}`);
    }
}

const newPerks = Array.from({ length: 5 }, (_, index) => ({
    name: `New ${index + 1}`,
    category: 'New'
}));
const generalPerks = Array.from({ length: 5 }, (_, index) => ({
    name: `General ${index + 1}`,
    category: 'General'
}));
const categories = new Set(['New']);
const pickFirst = (pool, count) => pool.slice(0, count);

const threeNew = selectPerksWithPriority(
    [...newPerks.slice(0, 3), newPerks[0], ...generalPerks], categories, 4, [], pickFirst
);
assert.equal(threeNew.length, 4);
assert.equal(new Set(threeNew.map(perk => perk.name)).size, 4);
assert.ok(newPerks.slice(0, 3).every(perk => threeNew.includes(perk)));
assert.equal(threeNew[3], generalPerks[0]);

const fiveNew = selectPerksWithPriority([...newPerks, ...generalPerks], categories, 4, [], () => {
    assert.fail('General perks are unnecessary');
});
assert.equal(fiveNew.length, 4);
assert.equal(new Set(fiveNew).size, 4);
assert.ok(fiveNew.every(perk => newPerks.includes(perk)));

const locked = selectPerksWithPriority(
    [...newPerks.slice(0, 3), ...generalPerks], categories, 3, [newPerks[0].name], () => []
);
assert.equal(locked.length, 3);
assert.ok(!locked.includes(newPerks[0]));
assert.ok(locked.includes(newPerks[1]) && locked.includes(newPerks[2]));
assert.ok(generalPerks.includes(locked[2]));

vm.runInContext(readScript('dbdrandomperk.js'), context);
assert.ok(vm.runInContext(`
    dbdBucket.newPerksOnly = true;
    dbdBucket.currentFilterType = 'chosung';
    dbdBucket.currentChosungFilter = ['ㄱ'];
    const pool = [{ name: '가', category: 'General' }, { name: '나', category: 'General' }];
    const fallback = getRandomPerks(pool);
    fallback.length === 1 && fallback[0] === pool[0];
`, context));

console.log('New-only tests passed.');
