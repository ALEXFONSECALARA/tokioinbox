// Classificação ÚNICA de item -> setor (cozinha / sushibar / bar).
// Usada pelo servidor (roteamento de pedido e impressão) E pela impressão offline do navegador,
// para que o mesmo item nunca saia em setores diferentes online e offline.
export type ProductionStation = 'cozinha' | 'sushibar' | 'bar';

// Automatic item classification into kitchen, sushibar or bar stations
export function resolveItemStation(name: string, explicitStation?: string): ProductionStation {
  if (explicitStation === 'cozinha' || explicitStation === 'sushibar' || explicitStation === 'bar') {
    return explicitStation;
  }
  const lower = (name || '').toLowerCase();
  // Bar & Drinks Station keywords
  if (
    lower.includes('drink') ||
    lower.includes('cerveja') ||
    lower.includes('chopp') ||
    lower.includes('refrigerante') ||
    lower.includes('suco') ||
    lower.includes('água') ||
    lower.includes('agua') ||
    lower.includes('mojito') ||
    lower.includes('caipirinha') ||
    lower.includes('gin') ||
    lower.includes('vinho') ||
    lower.includes('coquetel') ||
    lower.includes('café') ||
    lower.includes('cafe') ||
    lower.includes('sake') ||
    lower.includes('saquê') ||
    lower.includes('saque') ||
    lower.includes('chá') ||
    lower.includes('cha') ||
    lower.includes('coca') ||
    lower.includes('guaraná') ||
    lower.includes('guarana') ||
    lower.includes('cocktail') ||
    lower.includes('whisky') ||
    lower.includes('whiskey') ||
    lower.includes('vodka') ||
    lower.includes('energético') ||
    lower.includes('energetico') ||
    lower.includes('red bull') ||
    lower.includes('tônica') ||
    lower.includes('tonica') ||
    lower.includes('aperol') ||
    lower.includes('heineken') ||
    lower.includes('stella') ||
    lower.includes('corona') ||
    lower.includes('bebida') ||
    lower.includes('dose') ||
    lower.includes('long neck') ||
    lower.includes('lata') ||
    lower.includes('garrafa') ||
    lower.includes('sangria') ||
    lower.includes('soda') ||
    lower.includes('limonada') ||
    lower.includes('prosecco') ||
    lower.includes('espumante') ||
    lower.includes('tequila') ||
    lower.includes('rum') ||
    lower.includes('licor')
  ) {
    return 'bar';
  }
  // Sushibar Station keywords
  if (
    lower.includes('sushi') ||
    lower.includes('sashimi') ||
    lower.includes('temaki') ||
    lower.includes('uramaki') ||
    lower.includes('hossomaki') ||
    lower.includes('niguiri') ||
    lower.includes('nigiri') ||
    lower.includes('gunkan') ||
    lower.includes('combinado') ||
    lower.includes('hot roll') ||
    lower.includes('ceviche') ||
    lower.includes('tataki') ||
    lower.includes('sunomono') ||
    lower.includes('edamame') ||
    lower.includes('carpaccio de salmão') ||
    lower.includes('carpaccio salmão') ||
    lower.includes('joy') ||
    lower.includes('djou') ||
    lower.includes('poke')
  ) {
    return 'sushibar';
  }
  // Default is kitchen (cozinha) for all hot meals, burgers, pizzas, pastas, desserts, portions
  return 'cozinha';
}
