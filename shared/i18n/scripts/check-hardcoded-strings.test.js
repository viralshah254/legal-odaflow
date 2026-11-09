const { test } = require('node:test')
const assert = require('node:assert/strict')
const { fingerprint, newViolations, scanWeb } = require('./check-hardcoded-strings')
const text = 'Existing untranslated label'
const baseline = { version: 1, referenceCommit: 'prior-main', entries: { 'page.tsx': { [fingerprint(text)]: 1 } } }
const finding = (file, values) => [{ file, hits: values.map((text, index) => ({ text, line: index + 100 })) }]
test('line movement does not manufacture a new legacy violation', () => {
  assert.deepEqual(newViolations(finding('page.tsx', [text]), baseline), [])
})
test('duplicating a legacy message adds debt and fails the regression check', () => {
  assert.equal(newViolations(finding('page.tsx', [text, text]), baseline)[0].hits.length, 1)
})
test('moving a message into another file requires localization', () => {
  assert.equal(newViolations(finding('new.tsx', [text]), baseline)[0].hits.length, 1)
})
test('replacing one legacy message with a new literal still fails', () => {
  assert.equal(newViolations(finding('page.tsx', ['A newly introduced label']), baseline)[0].hits.length, 1)
})
test('removing legacy debt passes', () => assert.deepEqual(newViolations([], baseline), []))
test('invalid baseline fails closed', () => assert.throws(() => newViolations([], {})))
test('JSX conditional syntax is not user-visible copy, while real text is checked', () => {
  const hits = scanWeb('unused.tsx', '<div>{busy ? <i /> : error ? <span>Unable to load results</span> : null}</div>')
  assert(hits.some(hit => hit.text === 'Unable to load results'))
  assert(!hits.some(hit => hit.text === ': error ?'))
})
