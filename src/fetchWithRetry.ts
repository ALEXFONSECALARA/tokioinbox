/**
 * Item 3 do pedido de modernização: fallback de rede automático. Tenta de
 * novo (com backoff) em erro de rede/5xx antes de desistir, então uma queda
 * momentânea de wi-fi/4G no salão não derruba a tela do operador — ele nem
 * percebe, a não ser que o problema realmente persista.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: { retries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  const { retries = 3, baseDelayMs = 500 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      // erro de servidor (5xx) também vale retry — pode ser instabilidade momentânea
      if (res.status >= 500 && attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha de rede após múltiplas tentativas.');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
