export type FiscalEnvironment = 'homologacao' | 'producao';

export type FiscalDocumentType = 'nfce' | 'nfe' | 'nfse';

export type FiscalDocumentStatus =
  | 'autorizado'
  | 'pendente'
  | 'rejeitado'
  | 'denegado'
  | 'cancelado'
  | 'contingencia'
  | 'erro_comunicacao';

export type TaxRegime =
  | 'simples_nacional'
  | 'simples_nacional_excesso'
  | 'lucro_presumido'
  | 'lucro_real';

export interface RestaurantFiscalConfig {
  restaurantSlug: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal?: string;
  uf: string;
  municipio: string;
  codigoMunicipioIbge: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento?: string;
  regimeTributario: TaxRegime;
  aliquotaSimplesNacional?: number; // % estimada da faixa do Simples
  ambiente: FiscalEnvironment;
  serieNfce: number;
  numeroAtualNfce: number;
  serieNfe: number;
  numeroAtualNfe: number;
  serieNfse?: number;
  numeroAtualNfse?: number;
  cscId?: string; // ID do Token CSC (ex: 000001)
  cscToken?: string; // Código de Segurança do Contribuinte fornecido pela SEFAZ
  updatedAt: string;
  updatedBy: string;
}

export interface CertificateMetadata {
  hasCertificate: boolean;
  subjectCommonName?: string;
  issuerCommonName?: string;
  cnpj?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
  status: 'valido' | 'proximo_vencimento' | 'vencido' | 'nao_configurado';
  lastTestedAt?: string;
  algorithm?: string;
}

export interface ItemTaxBreakdown {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  ncm: string;
  cest?: string;
  cfop: string;
  cst?: string; // Se Lucro Presumido/Real
  csosn?: string; // Se Simples Nacional (102, 500, etc)
  origem: number; // 0: Nacional
  isService?: boolean;
  // Valores calculados
  baseCalculoIcms: number;
  aliquotaIcms: number;
  valorIcms: number;
  baseCalculoPis: number;
  aliquotaPis: number;
  valorPis: number;
  baseCalculoCofins: number;
  aliquotaCofins: number;
  valorCofins: number;
  baseCalculoIss?: number;
  aliquotaIss?: number;
  valorIss?: number;
  // IBPT Lei 12.741/2012
  tributosAproximadosFederais: number;
  tributosAproximadosEstaduais: number;
  tributosAproximadosMunicipais: number;
  totalTributosAproximados: number;
  memoriaCalculo: string;
  regrasAplicadas: string[];
}

export interface FiscalDocument {
  id: string;
  idempotencyKey: string;
  restaurantSlug: string;
  restaurantName: string;
  orderId: string;
  orderShortCode: string;
  customerId?: string;
  customerName?: string;
  customerCpfCnpj?: string;
  customerEmail?: string;
  orderType: string;
  documentType: FiscalDocumentType; // nfce, nfe, nfse
  documentNumber: number;
  series: number;
  accessKey: string; // 44 dígitos
  status: FiscalDocumentStatus;
  ambiente: FiscalEnvironment;
  subtotal: number;
  descontos: number;
  acrescimos: number;
  total: number;
  formaPagamento: string;
  // Tributos agregados
  totalIcms: number;
  totalPis: number;
  totalCofins: number;
  totalIss: number;
  totalTributosAproximados: number;
  items: ItemTaxBreakdown[];
  // SEFAZ / Provedor
  protocolo?: string;
  dataEmissao: string;
  dataAutorizacao?: string;
  motivoStatus?: string;
  codigoStatusSefaz?: number;
  xmlAssinado?: string;
  xmlAutorizado?: string;
  qrCodeUrl?: string;
  contingenciaJustificativa?: string;
  contingenciaDataHora?: string;
  cancelamento?: {
    protocolo: string;
    justificativa: string;
    dataHora: string;
    usuario: string;
    codigoSefaz: number;
    respostaSefaz: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TaxRule {
  id: string;
  versao: string;
  vigenciaInicio: string;
  vigenciaFim?: string;
  uf: string;
  municipio?: string;
  tipoOperacao: 'venda_consumidor' | 'venda_pj' | 'servico';
  categoria: string;
  ncmPadrao: string;
  cestPadrao?: string;
  cfopPadrao: string;
  csosnPadrao: string;
  cstPadrao: string;
  aliquotaIcmsPadrao: number;
  aliquotaPisPadrao: number;
  aliquotaCofinsPadrao: number;
  isMonofasico: boolean;
  isSubstituicaoTributaria: boolean;
  fundamentoLegal: string;
}

export interface TaxSimulationResult {
  periodo: string;
  faturamentoTotal: number;
  receitaTributavel: number;
  receitaIsentaOuSubstituicao: number;
  receitaMonofasica: number;
  receitaPorCategoria: {
    categoria: string;
    total: number;
    percentual: number;
  }[];
  cenarioAtual: {
    nome: string;
    regime: TaxRegime;
    impostosEstimados: number;
    aliquotaEfetiva: number;
    detalhes: {
      icms: number;
      pis: number;
      cofins: number;
      iss: number;
      simplesNacional?: number;
    };
  };
  cenariosSimulados: {
    id: string;
    nome: string;
    descricao: string;
    regime: TaxRegime;
    impostosEstimados: number;
    aliquotaEfetiva: number;
    diferencaEstimada: number;
    impactoMargem: number;
    detalhes: {
      icms: number;
      pis: number;
      cofins: number;
      iss: number;
      simplesNacional?: number;
    };
    fundamentacao: string;
  }[];
  oportunidadesPlanejamento: {
    tipo: 'alerta' | 'beneficio' | 'cadastro';
    titulo: string;
    descricao: string;
    fundamento: string;
    impactoEstimado?: string;
  }[];
  alertasCadastrais: {
    produtoId: string;
    produtoNome: string;
    problema: string;
    gravidade: 'alta' | 'media' | 'baixa';
    sugestao: string;
  }[];
  avisoLegal: string;
}

export interface FiscalAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  restaurantSlug: string;
  documentNumber?: number;
  accessKey?: string;
  details: string;
  ipAddress?: string;
}

export interface InutilizacaoRecord {
  id: string;
  restaurantSlug: string;
  modelo: 65 | 55; // 65=NFC-e, 55=NF-e
  serie: number;
  numeroInicial: number;
  numeroFinal: number;
  justificativa: string;
  protocolo?: string;
  dataSolicitacao: string;
  status: 'homologado' | 'rejeitado';
  mensagemSefaz: string;
  usuario: string;
}
