/** Modelo Gemini único e configurável (GEMINI_MODEL). Antes havia nomes diferentes espalhados pelo código. */
export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.5-flash';
}
