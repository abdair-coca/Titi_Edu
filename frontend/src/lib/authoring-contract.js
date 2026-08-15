export function readAuthoringEvaluation(responseData, { isFinal = false } = {}) {
  const payload = responseData?.data ?? responseData;
  return isFinal
    ? payload?.course?.evaluacionFinal ?? null
    : payload?.module?.evaluacion ?? null;
}

export function readMutationEvaluation(responseData) {
  return responseData?.data?.evaluation ?? null;
}
