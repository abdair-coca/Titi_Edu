import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const integrations = await readFile(new URL('../src/pages/teacher/Integrations.jsx', import.meta.url), 'utf8');
assert.match(integrations, /<ConfirmModal/);
assert.match(integrations, /authoringMutation\('delete', `\/service-tokens\/\$\{tokenToDelete\.id\}`, \{\}\)/);
assert.match(integrations, /token\.revokedAt && <button[\s\S]*?Eliminar<\/button>/);

const modulesEditor = await readFile(new URL('../src/pages/teacher/ModulesEditor.jsx', import.meta.url), 'utf8');
assert.match(modulesEditor, /\/lessons\/\$\{lesson\.id\}\/publish/);
assert.match(modulesEditor, /\/lessons\/\$\{lesson\.id\}\/archive/);
assert.match(modulesEditor, /\/lessons\/\$\{lesson\.id\}\/restore/);
assert.match(modulesEditor, /\/lessons\/\$\{lesson\.id\}\/revisions/);
assert.match(modulesEditor, /expectedFingerprint: lessonFingerprint\(module\.id, lesson\.id\)/);
assert.match(modulesEditor, /<ConfirmationDialog[\s\S]*?onArchive=/);
assert.doesNotMatch(modulesEditor, /window\.confirm/);

console.log('Authoring evaluation contracts OK');
