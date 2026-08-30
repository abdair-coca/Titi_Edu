import assert from 'node:assert/strict';
import {
  formatDeadline,
  isDeadlineExpired,
  isoToLocalDateTime,
  localDateTimeToIso,
} from '../src/lib/deadline.js';

process.env.TZ = 'America/La_Paz';
const localValue = '2026-09-01T15:30';
const isoValue = localDateTimeToIso(localValue);

assert.equal(isoToLocalDateTime(isoValue), localValue);
assert.equal(isDeadlineExpired('2026-09-01T15:30:00.000Z', Date.parse('2026-09-01T15:30:00.000Z')), false);
assert.equal(isDeadlineExpired('2026-09-01T15:30:00.000Z', Date.parse('2026-09-01T15:30:00.001Z')), true);
assert.notEqual(formatDeadline(isoValue), '');

console.log('Deadline helpers: pass');
