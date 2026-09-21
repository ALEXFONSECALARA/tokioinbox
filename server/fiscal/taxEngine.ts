import {
  ItemTaxBreakdown,
  RestaurantFiscalConfig,
  TaxRegime,
  TaxRule,
  FiscalDocumentType,
} from './types';

/**
 * Versioned Tax Rules for Brazilian Restaurants (UF-aware and operation-aware)
 */
export const VERSIONED_TAX_RULES: TaxRule[] = [
  {
    id: 'rule-pratos-refeicoes-v1',
    versao: '2026.1',
    vigenciaInicio: '2024-01-01',
    uf: 'SP',
    tipoOperacao: 'venda_consumidor',
    categoria: 'pratos_refeicoes',
    ncmPadrao: '2106.90.90', // Preparações alimentícias diversas
    cfopPadrao: '5.102', // Venda de mercadoria adquirida ou fabricação própria no estabelecimento (5.101/5.102)
    csosnPadrao: '102', // Tributada pelo Simples Nacional sem permissão de crédito
    cstPadrao: '00', // Tributada integralmente
    aliquotaIcmsPadrao: 12.0, // Alíquota restaurante regime especial SP (Decreto 51.597/2007)
    aliquotaPisPadrao: 1.65,
    aliquotaCofinsPadrao: 7.6,
    isMonofasico: false,
    isSubstituicaoTributaria: false,
    fundamentoLegal: 'RICMS/SP Dec. 45.490/00 e Lei Complementar 123/2006 Anexo I',
  },
  {
    id: 'rule-bebidas-refrigerantes-v1',
    versao: '2026.1',
    vigenciaInicio: '2024-01-01',
    uf: 'SP',
    tipoOperacao: 'venda_consumidor',
    categoria: 'bebidas_nao_alcoolicas',
    ncmPadrao: '2202.10.00', // Águas adicionadas de açúcar / refrigerantes
    cestPadrao: '03.007.00',
    cfopPadrao: '5.405', // Venda de mercadoria com substituição tributária (ST)
    csosnPadrao: '500', // ICMS cobrado anteriormente por substituição tributária
    cstPadrao: '60', // ICMS cobrado por ST
    aliquotaIcmsPadrao: 0.0, // Já retido na fonte por ST
    aliquotaPisPadrao: 0.0, // Monofásico Lei 10.833/2003 art. 2º (Alíquota Zero no Varejo)
    aliquotaCofinsPadrao: 0.0, // Monofásico Lei 10.833/2003
    isMonofasico: true,
    isSubstituicaoTributaria: true,
    fundamentoLegal: 'Lei Federal 10.833/03 art. 2º (PIS/COFINS Monofásico) e Convênio ICMS 142/2018 (ICMS-ST)',
  },
  {
    id: 'rule-bebidas-cervejas-v1',
    versao: '2026.1',
    vigenciaInicio: '2024-01-01',
    uf: 'SP',
    tipoOperacao: 'venda_consumidor',
    categoria: 'bebidas_alcoolicas',
    ncmPadrao: '2203.00.00', // Cervejas de malte
    cestPadrao: '03.001.00',
    cfopPadrao: '5.405',
    csosnPadrao: '500',
    cstPadrao: '60',
    aliquotaIcmsPadrao: 0.0,
    aliquotaPisPadrao: 0.0,
    aliquotaCofinsPadrao: 0.0,
    isMonofasico: true,
    isSubstituicaoTributaria: true,
    fundamentoLegal: 'Lei 10.833/03 e Protocolo ICMS de Bebidas Frias com Substituição Tributária',
  },
  {
    id: 'rule-sobremesas-v1',
    versao: '2026.1',
    vigenciaInicio: '2024-01-01',
    uf: 'SP',
    tipoOperacao: 'venda_consumidor',
    categoria: 'sobremesas',
    ncmPadrao: '1905.90.90', // Outros produtos de padaria/confeitaria
    cfopPadrao: '5.102',
    csosnPadrao: '102',
    cstPadrao: '00',
    aliquotaIcmsPadrao: 12.0,
    aliquotaPisPadrao: 1.65,
    aliquotaCofinsPadrao: 7.6,
    isMonofasico: false,
    isSubstituicaoTributaria: false,
    fundamentoLegal: 'Tributação normal de confeitos e doces preparados no restaurante',
  },
  {
    id: 'rule-servico-couvert-v1',
    versao: '2026.1',
    vigenciaInicio: '2024-01-01',
    uf: 'SP',
    municipio: 'Sao Paulo',
    tipoOperacao: 'servico',
    categoria: 'servicos_restaurante',
    ncmPadrao: '0000.00.00',
    cfopPadrao: '0.000',
    csosnPadrao: '900',
    cstPadrao: '00',
    aliquotaIcmsPadrao: 0.0,
    aliquotaPisPadrao: 0.65,
    aliquotaCofinsPadrao: 3.0,
    isMonofasico: false,
    isSubstituicaoTributaria: false,
    fundamentoLegal: 'Lei Complementar 116/2003 - Subitem 12.07 e Lei Municipal de ISS',
  },
];

export interface InputItemForTax {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  // Explicit item fiscal properties if saved in catalog:
  ncm?: string;
  cest?: string;
  cfop?: string;
  cst?: string;
  csosn?: string;
  origem?: number;
  isService?: boolean;
}

/**
 * Resolves the correct Brazilian Fiscal Document Type based on operation, customer and nature:
 * - NFC-e (modelo 65): Consumer sales within state (Mesa, Balcão, Delivery to final consumer)
 * - NF-e (modelo 55): PJ / Corporate B2B (with CNPJ/IE), Inter-state sales, Returns, Remittances
 * - NFS-e (modelo 00): Municipal service taxes (Couvert Artístico, Service Fee if municipal)
 */
export function resolveDocumentType(
  orderType: string,
  customerCpfCnpj?: string,
  isCompanyB2B?: boolean,
  hasOnlyServices?: boolean
): FiscalDocumentType {
  if (hasOnlyServices) {
    return 'nfse';
  }

  // If customer is a PJ demanding NF-e with Inscrição Estadual or inter-state operation
  if (isCompanyB2B) {
    return 'nfe';
  }

  // Retail restaurant customer: NFC-e
  return 'nfce';
}

/**
 * Matches an item to a versioned tax rule using its fiscal classification
 */
function findTaxRule(
  item: InputItemForTax,
  uf: string,
  isService: boolean
): TaxRule {
  const ufRules = VERSIONED_TAX_RULES.filter((r) => r.uf === uf || !r.uf);

  if (isService || item.isService) {
    return (
      ufRules.find((r) => r.tipoOperacao === 'servico') ||
      VERSIONED_TAX_RULES[4]
    );
  }

  const ncm = (item.ncm || '').replace(/\D/g, '');

  // Match by NCM prefix
  if (ncm.startsWith('2202') || ncm.startsWith('2201')) {
    // Águas e Refrigerantes
    return ufRules.find((r) => r.categoria === 'bebidas_nao_alcoolicas') || VERSIONED_TAX_RULES[1];
  }
  if (ncm.startsWith('2203') || ncm.startsWith('2204') || ncm.startsWith('2208')) {
    // Cervejas e Alcoólicos
    return ufRules.find((r) => r.categoria === 'bebidas_alcoolicas') || VERSIONED_TAX_RULES[2];
  }
  if (ncm.startsWith('1905') || ncm.startsWith('1806')) {
    // Sobremesas / Confeitaria
    return ufRules.find((r) => r.categoria === 'sobremesas') || VERSIONED_TAX_RULES[3];
  }

  // Default to General Food/Meals Rule
  return ufRules.find((r) => r.categoria === 'pratos_refeicoes') || VERSIONED_TAX_RULES[0];
}

/**
 * Calculates accurate item-level tax breakdown according to restaurant fiscal config
 */
export function calculateItemTax(
  item: InputItemForTax,
  config: RestaurantFiscalConfig
): ItemTaxBreakdown {
  const isService = !!item.isService;
  const rule = findTaxRule(item, config.uf, isService);

  const ncm = item.ncm || rule.ncmPadrao;
  const cest = item.cest || rule.cestPadrao;
  const cfop = item.cfop || rule.cfopPadrao;
  const origem = item.origem ?? 0;

  const isSimples =
    config.regimeTributario === 'simples_nacional' ||
    config.regimeTributario === 'simples_nacional_excesso';

  const csosn = item.csosn || (isSimples ? rule.csosnPadrao : undefined);
  const cst = item.cst || (!isSimples ? rule.cstPadrao : undefined);

  const total = Number(item.totalPrice.toFixed(2));
  const memoryNotes: string[] = [];
  const appliedRules: string[] = [rule.fundamentoLegal];

  let baseCalculoIcms = 0;
  let aliquotaIcms = 0;
  let valorIcms = 0;

  let baseCalculoPis = 0;
  let aliquotaPis = 0;
  let valorPis = 0;

  let baseCalculoCofins = 0;
  let aliquotaCofins = 0;
  let valorCofins = 0;

  let baseCalculoIss: number | undefined;
  let aliquotaIss: number | undefined;
  let valorIss: number | undefined;

  if (isService) {
    baseCalculoIss = total;
    aliquotaIss = 5.0; // 5% ISS padrão serviços de entretenimento/restaurante
    valorIss = Number(((baseCalculoIss * aliquotaIss) / 100).toFixed(2));
    memoryNotes.push(`ISS ${aliquotaIss}% sobre R$ ${baseCalculoIss.toFixed(2)} = R$ ${valorIss.toFixed(2)}`);
  } else {
    // Mercadorias
    if (isSimples) {
      // No Simples Nacional:
      // Se CSOSN 500 (ICMS Cobrado por ST anteriormente) -> Não incide ICMS na faixa do Simples!
      // Se CSOSN 102 (Tributada pelo Simples) -> Recolhido via DAS na alíquota efetiva do Anexo I
      if (csosn === '500') {
        baseCalculoIcms = 0;
        aliquotaIcms = 0;
        valorIcms = 0;
        memoryNotes.push('ICMS-ST: Retido por Substituição Tributária (CSOSN 500) - Segregado no Simples Nacional');
      } else {
        const taxaEfetivaIcmsNoSimples = config.aliquotaSimplesNacional ? config.aliquotaSimplesNacional * 0.34 : 3.5;
        baseCalculoIcms = total;
        aliquotaIcms = Number(taxaEfetivaIcmsNoSimples.toFixed(2));
        valorIcms = Number(((baseCalculoIcms * aliquotaIcms) / 100).toFixed(2));
        memoryNotes.push(`ICMS Simples Nacional (CSOSN ${csosn}) parcela estimada ${aliquotaIcms}% = R$ ${valorIcms.toFixed(2)}`);
      }

      // PIS e COFINS no Simples Nacional:
      // Produtos monofásicos (refrigerantes, cervejas) têm PIS/COFINS alíquota zero para o revendedor
      if (rule.isMonofasico) {
        baseCalculoPis = 0;
        aliquotaPis = 0;
        valorPis = 0;
        baseCalculoCofins = 0;
        aliquotaCofins = 0;
        valorCofins = 0;
        memoryNotes.push('PIS/COFINS Monofásico (Lei 10.833/03): Alíquota 0% para varejo/revenda');
      } else {
        // Alíquota aproximada embutida no DAS
        const taxaPisDAS = config.aliquotaSimplesNacional ? config.aliquotaSimplesNacional * 0.0276 : 0.35;
        const taxaCofinsDAS = config.aliquotaSimplesNacional ? config.aliquotaSimplesNacional * 0.1274 : 1.6;
        baseCalculoPis = total;
        aliquotaPis = Number(taxaPisDAS.toFixed(2));
        valorPis = Number(((baseCalculoPis * aliquotaPis) / 100).toFixed(2));

        baseCalculoCofins = total;
        aliquotaCofins = Number(taxaCofinsDAS.toFixed(2));
        valorCofins = Number(((baseCalculoCofins * aliquotaCofins) / 100).toFixed(2));
        memoryNotes.push(`PIS/COFINS Simples Nacional: PIS ${aliquotaPis}% + COFINS ${aliquotaCofins}%`);
      }
    } else {
      // Regime Normal (Lucro Presumido / Lucro Real)
      if (cst === '60' || rule.isSubstituicaoTributaria) {
        baseCalculoIcms = 0;
        aliquotaIcms = 0;
        valorIcms = 0;
        memoryNotes.push('ICMS retido na fonte (CST 60)');
      } else {
        baseCalculoIcms = total;
        aliquotaIcms = rule.aliquotaIcmsPadrao;
        valorIcms = Number(((baseCalculoIcms * aliquotaIcms) / 100).toFixed(2));
        memoryNotes.push(`ICMS ${aliquotaIcms}% sobre R$ ${baseCalculoIcms.toFixed(2)} = R$ ${valorIcms.toFixed(2)}`);
      }

      if (rule.isMonofasico) {
        baseCalculoPis = 0;
        aliquotaPis = 0;
        valorPis = 0;
        baseCalculoCofins = 0;
        aliquotaCofins = 0;
        valorCofins = 0;
        memoryNotes.push('PIS/COFINS Alíquota Zero - Monofásico na revenda');
      } else {
        baseCalculoPis = total;
        aliquotaPis = rule.aliquotaPisPadrao;
        valorPis = Number(((baseCalculoPis * aliquotaPis) / 100).toFixed(2));

        baseCalculoCofins = total;
        aliquotaCofins = rule.aliquotaCofinsPadrao;
        valorCofins = Number(((baseCalculoCofins * aliquotaCofins) / 100).toFixed(2));
        memoryNotes.push(`PIS ${aliquotaPis}% + COFINS ${aliquotaCofins}%`);
      }
    }
  }

  // IBPT Lei 12.741/2012 (Transparência Fiscal ao Consumidor)
  // Alíquotas médias estimadas por NCM para alimentação/bebidas
  const aliqIbptFed = rule.isMonofasico ? 0.0 : isService ? 13.45 : 4.22;
  const aliqIbptEst = isService ? 0.0 : csosn === '500' || cst === '60' ? 0.0 : 12.0;
  const aliqIbptMun = isService ? 5.0 : 0.0;

  const tributosAproximadosFederais = Number(((total * aliqIbptFed) / 100).toFixed(2));
  const tributosAproximadosEstaduais = Number(((total * aliqIbptEst) / 100).toFixed(2));
  const tributosAproximadosMunicipais = Number(((total * aliqIbptMun) / 100).toFixed(2));
  const totalTributosAproximados = Number(
    (tributosAproximadosFederais + tributosAproximadosEstaduais + tributosAproximadosMunicipais).toFixed(2)
  );

  return {
    itemId: String(item.id || (item as any).itemId || 'ITEM'),
    itemName: String(item.name || (item as any).itemName || 'Item'),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: total,
    ncm,
    cest,
    cfop,
    cst,
    csosn,
    origem,
    isService,
    baseCalculoIcms,
    aliquotaIcms,
    valorIcms,
    baseCalculoPis,
    aliquotaPis,
    valorPis,
    baseCalculoCofins,
    aliquotaCofins,
    valorCofins,
    baseCalculoIss,
    aliquotaIss,
    valorIss,
    tributosAproximadosFederais,
    tributosAproximadosEstaduais,
    tributosAproximadosMunicipais,
    totalTributosAproximados,
    memoriaCalculo: memoryNotes.join(' | '),
    regrasAplicadas: appliedRules,
  };
}

/**
 * Calculates complete order tax aggregates
 */
export function calculateOrderTaxes(
  items: InputItemForTax[],
  config: RestaurantFiscalConfig
): {
  itemsBreakdown: ItemTaxBreakdown[];
  totalIcms: number;
  totalPis: number;
  totalCofins: number;
  totalIss: number;
  totalTributosAproximados: number;
  totalSubtotal: number;
} {
  const itemsBreakdown = items.map((it) => calculateItemTax(it, config));

  const totalIcms = Number(itemsBreakdown.reduce((acc, it) => acc + it.valorIcms, 0).toFixed(2));
  const totalPis = Number(itemsBreakdown.reduce((acc, it) => acc + it.valorPis, 0).toFixed(2));
  const totalCofins = Number(itemsBreakdown.reduce((acc, it) => acc + it.valorCofins, 0).toFixed(2));
  const totalIss = Number(itemsBreakdown.reduce((acc, it) => acc + (it.valorIss || 0), 0).toFixed(2));
  const totalTributosAproximados = Number(
    itemsBreakdown.reduce((acc, it) => acc + it.totalTributosAproximados, 0).toFixed(2)
  );
  const totalSubtotal = Number(itemsBreakdown.reduce((acc, it) => acc + it.totalPrice, 0).toFixed(2));

  return {
    itemsBreakdown,
    totalIcms,
    totalPis,
    totalCofins,
    totalIss,
    totalTributosAproximados,
    totalSubtotal,
  };
}
