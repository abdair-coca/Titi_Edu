import assert from 'node:assert/strict';
import {
  readAuthoringEvaluation,
  readMutationEvaluation,
} from '../src/lib/authoring-contract.js';

const moduleEvaluation = { id: 'module-evaluation' };
const finalEvaluation = { id: 'final-evaluation' };
const savedEvaluation = { id: 'saved-evaluation' };

assert.equal(readAuthoringEvaluation({
  success: true,
  data: { module: { evaluacion: moduleEvaluation } },
}), moduleEvaluation);

assert.equal(readAuthoringEvaluation({
  success: true,
  data: { course: { evaluacionFinal: finalEvaluation } },
}, { isFinal: true }), finalEvaluation);

assert.equal(readMutationEvaluation({
  success: true,
  data: { evaluation: savedEvaluation },
}), savedEvaluation);

assert.equal(readAuthoringEvaluation({ success: true, data: { module: { evaluacion: null } } }), null);
assert.equal(readMutationEvaluation({ success: true, data: {} }), null);

console.log('Authoring evaluation contracts OK');
