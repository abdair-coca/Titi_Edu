import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { intentos: [], intentosHtml: [], resultados: [] };
  const client = {
    inscripcion: { findMany: vi.fn() },
    evaluacion: { findMany: vi.fn() },
    intento: {
      findMany: vi.fn(() => Promise.resolve(state.intentos)),
      createMany: vi.fn(({ data }) => {
        state.intentos.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    intentoHtmlLeccion: {
      findMany: vi.fn(() => Promise.resolve(state.intentosHtml)),
      create: vi.fn(({ data }) => {
        const intento = { id: `html-${state.intentosHtml.length + 1}`, ...data };
        state.intentosHtml.push(intento);
        return Promise.resolve(intento);
      }),
    },
    resultadoHtmlLeccion: {
      findMany: vi.fn(() => Promise.resolve(state.resultados)),
      create: vi.fn(({ data }) => {
        state.resultados.push(data);
        return Promise.resolve(data);
      }),
    },
  };
  client.$transaction = vi.fn((callback) => callback(client));
  return { client, state };
});

vi.mock('../../src/prisma.js', () => ({ default: mocks.client }));

import { historicalAttemptToken, runRepair } from '../../scripts/repair-completed-grades.js';

const completedEnrollment = {
  id: 'i-completed',
  usuarioId: 'u-completed',
  cursoId: 'c-1',
  curso: {
    modulos: [{
      evaluacion: { id: 'e-module' },
      lecciones: [{ recursoHtml: { id: 'rh-1', evaluable: true } }],
    }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.intentos.length = 0;
  mocks.state.intentosHtml.length = 0;
  mocks.state.resultados.length = 0;
  mocks.client.inscripcion.findMany.mockResolvedValue([completedEnrollment]);
  mocks.client.evaluacion.findMany.mockResolvedValue([{ id: 'e-final', cursoId: 'c-1' }]);
});

describe('repair-completed-grades', () => {
  it('defaults to dry-run and filters to completed enrollments without writes', async () => {
    const summary = await runRepair({ client: mocks.client });

    expect(summary).toEqual({
      mode: 'dry-run',
      completedEnrollments: 1,
      quizAttemptsCreated: 2,
      htmlResultsCreated: 1,
    });
    expect(mocks.client.inscripcion.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { completado: true },
    }));
    expect(mocks.client.$transaction).not.toHaveBeenCalled();
    expect(mocks.client.intento.createMany).not.toHaveBeenCalled();
    expect(mocks.client.intentoHtmlLeccion.create).not.toHaveBeenCalled();
  });

  it('creates only missing official 100 cells and becomes idempotent after apply', async () => {
    mocks.client.inscripcion.findMany.mockResolvedValue([completedEnrollment]);
    const first = await runRepair({ apply: true, client: mocks.client });
    const second = await runRepair({ apply: true, client: mocks.client });

    expect(first).toEqual({ mode: 'apply', completedEnrollments: 1, quizAttemptsCreated: 2, htmlResultsCreated: 1 });
    expect(mocks.state.intentos).toEqual(expect.arrayContaining([
      expect.objectContaining({ evaluacionId: 'e-module', numero: 1, nota: 100, aprobado: true }),
      expect.objectContaining({ evaluacionId: 'e-final', numero: 1, nota: 100, aprobado: true }),
    ]));
    expect(mocks.state.intentosHtml[0]).toMatchObject({ numero: 1, puntaje: 100, token: historicalAttemptToken('i-completed', 'rh-1') });
    expect(mocks.state.resultados[0]).toMatchObject({ mejorPuntaje: 100, recursoHtmlId: 'rh-1' });
    expect(second).toEqual({ mode: 'apply', completedEnrollments: 1, quizAttemptsCreated: 0, htmlResultsCreated: 0 });
  });

  it('does not overwrite existing scores', async () => {
    mocks.client.inscripcion.findMany.mockResolvedValue([completedEnrollment]);
    mocks.state.intentos.push({ usuarioId: 'u-completed', evaluacionId: 'e-module', nota: 73 });
    mocks.state.intentosHtml.push({ usuarioId: 'u-completed', recursoHtmlId: 'rh-1', numero: 4, puntaje: 83 });
    mocks.state.resultados.push({ usuarioId: 'u-completed', recursoHtmlId: 'rh-1', mejorPuntaje: 83 });

    const summary = await runRepair({ apply: true, client: mocks.client });

    expect(summary).toEqual({ mode: 'apply', completedEnrollments: 1, quizAttemptsCreated: 1, htmlResultsCreated: 0 });
    expect(mocks.state.intentos).toContainEqual({ usuarioId: 'u-completed', evaluacionId: 'e-module', nota: 73 });
    expect(mocks.state.resultados).toContainEqual({ usuarioId: 'u-completed', recursoHtmlId: 'rh-1', mejorPuntaje: 83 });
  });
});
