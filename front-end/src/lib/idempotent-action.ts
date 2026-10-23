/**
 * Garante uma requisição por intenção: clique repetido enquanto envia não dispara outra,
 * e nova tentativa do mesmo corpo após falha reaproveita a chave (o back devolve o original).
 */
export function createIdempotentAction<T>(
  send: (body: string, key: string) => Promise<T>,
  newKey: () => string = () => crypto.randomUUID(),
) {
  let inFlight: Promise<T> | null = null;
  let pending: { body: string; key: string } | null = null;

  function run(body: string): Promise<T> {
    if (inFlight) return inFlight;
    if (!pending || pending.body !== body) pending = { body, key: newKey() };
    const attempt = pending;
    inFlight = send(attempt.body, attempt.key)
      .then((result) => {
        pending = null;
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return { run, isRunning: () => inFlight !== null };
}
