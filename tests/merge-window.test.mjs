import test from 'node:test'
import assert from 'node:assert/strict'
import { isMergeOpen, MERGE_CLOSE_AT } from '../src/utils/mergeWindow.js'
test('merge draft closes exactly November 4 at 8:20 PM EST', () => {
  assert.equal(new Date(MERGE_CLOSE_AT).toISOString(), '2026-11-05T01:20:00.000Z')
  assert.equal(isMergeOpen(MERGE_CLOSE_AT - 1), true)
  assert.equal(isMergeOpen(MERGE_CLOSE_AT), false)
  assert.equal(isMergeOpen(MERGE_CLOSE_AT + 1), false)
})
