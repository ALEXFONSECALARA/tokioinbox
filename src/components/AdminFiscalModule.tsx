import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import {
  FileText,
  ShieldCheck,
  Key,
  Server,
  BarChart3,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  Printer,
  Download,
  CheckCircle2,
  Lock,
  Calendar,
  Search,
  DollarSign,
  TrendingDown,
  Building,
  HelpCircle,
  Clock,
  Ban,
  Upload,
  Eye,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface AdminFiscalModuleProps {
  selectedSlug?: RestaurantSlug | 'all';
}

export const AdminFiscalModule: React.FC<AdminFiscalModuleProps> = ({
  selectedSlug = 'japones',
}) => {
  const { currentUser } = useStore();
  const currentSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;

  const [activeSubTab, setActiveSubTab] = useState<
    'config' | 'certificate' | 'documents' | 'simulation' | 'audit' | 'inutilizacao'
  >('config');

  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fiscal Config state
  const [config, setConfig] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    uf: 'SP',
    municipio: 'São Paulo',
    codigoMunicipioIbge: '3550308',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    complemento: '',
    regimeTributario: 'simples_nacional',
    aliquotaSimplesNacional: 6.8,
    ambiente: 'homologacao',
    serieNfce: 1,
    numeroAtualNfce: 1,
    serieNfe: 1,
    numeroAtualNfe: 1,
    cscId: '000001',
    cscToken: '',
  });

  // Certificate metadata
  const [certMetadata, setCertMetadata] = useState<any | null>(null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [certUploadSuccess, setCertUploadSuccess] = useState<string | null>(null);

  // SEFAZ Status state
  const [sefazStatus, setSefazStatus] = useState<any | null>(null);
  const [isTestingSefaz, setIsTestingSefaz] = useState(false);

  // Documents state & filters
  const [documents, setDocuments] = useState<any[]>([]);
  const [docFilterStatus, setDocFilterStatus] = useState('all');
  const [docFilterType, setDocFilterType] = useState('all');
  const [docSearchTerm, setDocSearchTerm] = useState('');

  // Tax Simulation state
  const [simulationPeriod, setSimulationPeriod] = useState<'mes' | 'trimestre' | 'ano'>('mes');
  const [simulationData, setSimulationData] = useState<any | null>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Inutilização state (Ajuste SINIEF 07/05)
  const [inutilizacoes, setInutilizacoes] = useState<any[]>([]);
  const [inutModelo, setInutModelo] = useState<65 | 55>(65);
  const [inutSerie, setInutSerie] = useState(1);
  const [inutNumeroInicial, setInutNumeroInicial] = useState<number>(1);
  const [inutNumeroFinal, setInutNumeroFinal] = useState<number>(1);
  const [inutJustificativa, setInutJustificativa] = useState('');
  const [isSubmittingInut, setIsSubmittingInut] = useState(false);
  const [inutSuccessMsg, setInutSuccessMsg] = useState<string | null>(null);

  // Cancellation Modal state
  const [cancelModalDoc, setCancelModalDoc] = useState<any | null>(null);
  const [cancelJustification, setCancelJustification] = useState('');
  const [isCancellingDoc, setIsCancellingDoc] = useState(false);

  // Helper token
  const getAuthToken = () => localStorage.getItem('tokio_staff_token') || 'token-demo';

  // Load initial data
  useEffect(() => {
    loadFiscalConfig();
    loadCertificateMetadata();
    checkSefazStatus();
  }, [currentSlug]);

  useEffect(() => {
    if (activeSubTab === 'documents') {
      loadDocuments();
    } else if (activeSubTab === 'simulation') {
      loadTaxSimulation();
    } else if (activeSubTab === 'audit') {
      loadAuditLogs();
    } else if (activeSubTab === 'inutilizacao') {
      loadInutilizacoes();
    }
  }, [activeSubTab, currentSlug, simulationPeriod]);

  // API Callers
  const loadFiscalConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fiscal/config/${currentSlug}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (err: any) {
      console.error('Erro ao carregar config fiscal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/fiscal/config/${currentSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setErrorMessage(data.error || 'Erro ao salvar configuração.');
      }
    } catch (err: any) {
      setErrorMessage(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCertificateMetadata = async () => {
    try {
      const res = await fetch(`/api/fiscal/certificate/${currentSlug}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setCertMetadata(data.metadata);
      }
    } catch (err) {
      console.error('Erro ao buscar certificado:', err);
    }
  };

  const checkSefazStatus = async () => {
    setIsTestingSefaz(true);
    try {
      const res = await fetch(
        `/api/fiscal/sefaz-status?uf=${config.uf || 'SP'}&ambiente=${config.ambiente || 'homologacao'}`,
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      const data = await res.json();
      if (data.success) {
        setSefazStatus(data.status);
      }
    } catch (err) {
      console.error('Erro ao verificar status SEFAZ:', err);
    } finally {
      setIsTestingSefaz(false);
    }
  };

  const handleCertificateUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certFile || !certPassword) {
      alert('Selecione o arquivo .PFX ou .P12 e digite a senha do certificado.');
      return;
    }

    setIsUploadingCert(true);
    setCertUploadSuccess(null);
    setErrorMessage(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/fiscal/certificate/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`,
          },
          body: JSON.stringify({
            restaurantSlug: currentSlug,
            pfxBase64: base64Data,
            password: certPassword,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setCertMetadata(data.metadata);
          setCertPassword('');
          setCertFile(null);
          setCertUploadSuccess('Certificado digital A1 criptografado e instalado com sucesso no servidor.');
        } else {
          setErrorMessage(data.error || 'Falha ao processar certificado A1.');
        }
        setIsUploadingCert(false);
      };
      reader.readAsDataURL(certFile);
    } catch (err: any) {
      setErrorMessage(`Erro ao enviar certificado: ${err.message}`);
      setIsUploadingCert(false);
    }
  };

  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fiscal/documents?restaurantSlug=${currentSlug}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Erro ao buscar documentos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTaxSimulation = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/fiscal/simulation/${currentSlug}?periodo=${simulationPeriod}`,
        { headers: { Authorization: `Bearer ${getAuthToken()}` } }
      );
      const data = await res.json();
      if (data.success) {
        setSimulationData(data.simulation);
      }
    } catch (err) {
      console.error('Erro ao carregar simulação tributária:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fiscal/audit-logs?restaurantSlug=${currentSlug}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error('Erro ao buscar auditoria fiscal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInutilizacoes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fiscal/inutilizacoes/${currentSlug}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        setInutilizacoes(data.records || []);
      }
    } catch (err) {
      console.error('Erro ao buscar inutilizações:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestInutilizacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inutJustificativa.trim().length < 15) {
      alert('A justificativa de inutilização deve ter no mínimo 15 caracteres (exigência SEFAZ).');
      return;
    }
    if (inutNumeroFinal < inutNumeroInicial) {
      alert('O número final não pode ser menor que o número inicial.');
      return;
    }

    setIsSubmittingInut(true);
    setInutSuccessMsg(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/fiscal/inutilizacoes/${currentSlug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          modelo: inutModelo,
          serie: inutSerie,
          numeroInicial: inutNumeroInicial,
          numeroFinal: inutNumeroFinal,
          justificativa: inutJustificativa,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setInutSuccessMsg(`Inutilização homologada na SEFAZ com sucesso! Protocolo: ${data.record.protocolo}`);
        setInutJustificativa('');
        loadInutilizacoes();
      } else {
        setErrorMessage(data.error || 'Falha ao solicitar inutilização na SEFAZ.');
      }
    } catch (err: any) {
      setErrorMessage(`Erro: ${err.message}`);
    } finally {
      setIsSubmittingInut(false);
    }
  };

  const handleExportAccountant = async () => {
    try {
      const res = await fetch(`/api/fiscal/export-accountant/${currentSlug}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data.exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', jsonStr);
        downloadAnchor.setAttribute('download', `relatorio_fiscal_contador_${currentSlug}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      }
    } catch (err: any) {
      alert(`Erro ao exportar: ${err.message}`);
    }
  };

  const handleReprocessContingency = async (accessKey: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/fiscal/documents/${accessKey}/reprocess`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      if (data.success) {
        alert('Documento em contingência reprocessado e autorizado na SEFAZ!');
        loadDocuments();
      } else {
        alert(data.error || 'Erro ao reprocessar contingência.');
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmCancelDoc = async () => {
    if (!cancelModalDoc || cancelJustification.length < 15) return;
    setIsCancellingDoc(true);

    try {
      const res = await fetch(`/api/fiscal/documents/${cancelModalDoc.accessKey}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ justificativa: cancelJustification }),
      });

      const data = await res.json();
      if (data.success) {
        alert('Documento fiscal cancelado formalmente na SEFAZ!');
        setCancelModalDoc(null);
        setCancelJustification('');
        loadDocuments();
      } else {
        alert(data.error || 'Erro ao cancelar documento na SEFAZ.');
      }
    } catch (err: any) {
      alert(`Erro ao cancelar: ${err.message}`);
    } finally {
      setIsCancellingDoc(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    if (docFilterStatus !== 'all' && doc.status !== docFilterStatus) return false;
    if (docFilterType !== 'all' && doc.documentType !== docFilterType) return false;
    if (docSearchTerm) {
      const q = docSearchTerm.toLowerCase();
      const matchNum = String(doc.documentNumber).includes(q);
      const matchKey = doc.accessKey.toLowerCase().includes(q);
      const matchOrder = doc.orderShortCode.toLowerCase().includes(q);
      const matchCust = doc.customerName?.toLowerCase().includes(q) || doc.customerCpfCnpj?.includes(q);
      return matchNum || matchKey || matchOrder || matchCust;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner / SEFAZ Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shadow-inner">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Módulo Fiscal Profissional
              </h1>
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SEFAZ 4.00
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Emissão de NFC-e / NF-e com Certificado Digital A1, contingência offline e cálculo tributário
            </p>
          </div>
        </div>

        {/* SEFAZ Live Status Pill */}
        <div className="flex items-center gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800 self-stretch md:self-auto justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                sefazStatus?.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <div className="text-xs">
              <span className="text-slate-400 block text-[10px]">SEFAZ-{config.uf}</span>
              <strong className="text-white font-medium">
                {sefazStatus?.online ? `Online (${sefazStatus.tempoRespostaMs}ms)` : 'Verificando...'}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={checkSefazStatus}
            disabled={isTestingSefaz}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Atualizar status da SEFAZ"
          >
            <RefreshCw className={`w-4 h-4 ${isTestingSefaz ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        <button
          onClick={() => setActiveSubTab('config')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeSubTab === 'config'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-4 h-4" />
          1. Configuração Fiscal
        </button>

        <button
          onClick={() => setActiveSubTab('certificate')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeSubTab === 'certificate'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Key className="w-4 h-4" />
          2. Certificado Digital A1
        </button>

        <button
          onClick={() => setActiveSubTab('documents')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeSubTab === 'documents'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          3. Documentos Fiscais
        </button>

        <button
          onClick={() => setActiveSubTab('simulation')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeSubTab === 'simulation'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          4. Simulador Tributário & Cenários
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeSubTab === 'audit'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          5. Auditoria Fiscal
        </button>

        <button
          onClick={() => setActiveSubTab('inutilizacao')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap ${
            activeSubTab === 'inutilizacao'
              ? 'bg-emerald-600 text-white shadow-lg'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Ban className="w-4 h-4" />
          6. Inutilização SEFAZ
        </button>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: CONFIGURAÇÃO FISCAL                               */}
      {/* ======================================================== */}
      {activeSubTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-400" />
                  Dados Cadastrais do Restaurante Emitente
                </h3>
                <p className="text-xs text-slate-400">
                  Informações exigidas pela SEFAZ no grupo &lt;emit&gt; do Layout 4.00 da NFC-e/NF-e
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-400">Ambiente SEFAZ:</span>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, ambiente: 'homologacao' })}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      config.ambiente === 'homologacao'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Homologação (Testes)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, ambiente: 'producao' })}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                      config.ambiente === 'producao'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Produção Oficial
                  </button>
                </div>
              </div>
            </div>

            {/* Grid Cadastral */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={config.razaoSocial}
                  onChange={(e) => setConfig({ ...config, razaoSocial: e.target.value })}
                  placeholder="Ex: TOKIO SAKURA GASTRONOMIA ORIENTAL LTDA"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome Fantasia *
                </label>
                <input
                  type="text"
                  required
                  value={config.nomeFantasia}
                  onChange={(e) => setConfig({ ...config, nomeFantasia: e.target.value })}
                  placeholder="Ex: Tokio Sushi House"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  CNPJ do Emitente *
                </label>
                <input
                  type="text"
                  required
                  value={config.cnpj}
                  onChange={(e) => setConfig({ ...config, cnpj: e.target.value })}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Inscrição Estadual (IE) *
                </label>
                <input
                  type="text"
                  required
                  value={config.inscricaoEstadual}
                  onChange={(e) => setConfig({ ...config, inscricaoEstadual: e.target.value })}
                  placeholder="Ex: 148.920.312.110"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Inscrição Municipal (IM)
                </label>
                <input
                  type="text"
                  value={config.inscricaoMunicipal}
                  onChange={(e) => setConfig({ ...config, inscricaoMunicipal: e.target.value })}
                  placeholder="Ex: 4.892.100-3 (Para NFS-e de serviços)"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Regime Tributário *
                </label>
                <select
                  value={config.regimeTributario}
                  onChange={(e) => setConfig({ ...config, regimeTributario: e.target.value as any })}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="simples_nacional">1 - Simples Nacional (Microempresa / EPP)</option>
                  <option value="simples_nacional_excesso">2 - Simples c/ Excesso de Sublimite</option>
                  <option value="lucro_presumido">3 - Regime Normal (Lucro Presumido)</option>
                  <option value="lucro_real">3 - Regime Normal (Lucro Real)</option>
                  <option value="mei">4 - MEI (Microempreendedor Individual)</option>
                </select>
              </div>

              {config.regimeTributario.startsWith('simples') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Alíquota Efetiva Média Simples (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={config.aliquotaSimplesNacional}
                    onChange={(e) =>
                      setConfig({ ...config, aliquotaSimplesNacional: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="Ex: 6.8"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  UF do Estabelecimento *
                </label>
                <select
                  value={config.uf}
                  onChange={(e) => setConfig({ ...config, uf: e.target.value })}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'GO', 'DF', 'ES'].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Município *
                </label>
                <input
                  type="text"
                  required
                  value={config.municipio}
                  onChange={(e) => setConfig({ ...config, municipio: e.target.value })}
                  placeholder="Ex: São Paulo"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Código Município IBGE *
                </label>
                <input
                  type="text"
                  required
                  value={config.codigoMunicipioIbge}
                  onChange={(e) => setConfig({ ...config, codigoMunicipioIbge: e.target.value })}
                  placeholder="Ex: 3550308"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">CEP *</label>
                <input
                  type="text"
                  required
                  value={config.cep}
                  onChange={(e) => setConfig({ ...config, cep: e.target.value })}
                  placeholder="00000-000"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Logradouro / Endereço *</label>
                <input
                  type="text"
                  required
                  value={config.logradouro}
                  onChange={(e) => setConfig({ ...config, logradouro: e.target.value })}
                  placeholder="Ex: Avenida Paulista"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Número *</label>
                <input
                  type="text"
                  required
                  value={config.numero}
                  onChange={(e) => setConfig({ ...config, numero: e.target.value })}
                  placeholder="Ex: 1578"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Bairro *</label>
                <input
                  type="text"
                  required
                  value={config.bairro}
                  onChange={(e) => setConfig({ ...config, bairro: e.target.value })}
                  placeholder="Ex: Bela Vista"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Complemento</label>
                <input
                  type="text"
                  value={config.complemento}
                  onChange={(e) => setConfig({ ...config, complemento: e.target.value })}
                  placeholder="Ex: Loja 02 / Térreo"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Séries e CSC Token */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Numeração Sequencial e Parâmetros NFC-e (QR-Code)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Série NFC-e *</label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={config.serieNfce}
                    onChange={(e) => setConfig({ ...config, serieNfce: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Número Atual NFC-e *</label>
                  <input
                    type="number"
                    min="1"
                    value={config.numeroAtualNfce}
                    onChange={(e) => setConfig({ ...config, numeroAtualNfce: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Id do Token CSC *</label>
                  <input
                    type="text"
                    value={config.cscId}
                    onChange={(e) => setConfig({ ...config, cscId: e.target.value })}
                    placeholder="000001"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Token CSC (SEFAZ) *</label>
                  <input
                    type="password"
                    value={config.cscToken}
                    onChange={(e) => setConfig({ ...config, cscToken: e.target.value })}
                    placeholder="Código de Segurança do Contribuinte"
                    className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Alerts & Messages */}
            {saveSuccess && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Configurações fiscais salvas com sucesso!
              </div>
            )}

            {errorMessage && (
              <div className="p-4 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm rounded-2xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {errorMessage}
              </div>
            )}

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-2xl flex items-center gap-2 shadow-lg transition"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Salvar Configurações Fiscais
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ======================================================== */}
      {/* ABA 2: CERTIFICADO DIGITAL A1 (VAULT SEGURO)            */}
      {/* ======================================================== */}
      {activeSubTab === 'certificate' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                Cofre de Certificado Digital A1 (ICP-Brasil)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Armazenamento criptografado (AES-256-GCM) no servidor. O certificado e sua chave privada nunca são expostos ao navegador.
              </p>
            </div>

            {/* Current Certificate Status Card */}
            <div
              className={`p-5 rounded-2xl border ${
                certMetadata?.status === 'valido'
                  ? 'bg-emerald-950/30 border-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-2xl ${
                      certMetadata?.status === 'valido'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">
                      {certMetadata?.commonName || 'Nenhum Certificado Instalado'}
                    </h4>
                    <p className="text-xs text-slate-400">
                      Emissor: {certMetadata?.issuer || 'Não configurado'}
                    </p>
                  </div>
                </div>

                {certMetadata && (
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full uppercase ${
                        certMetadata.status === 'valido'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      {certMetadata.status} ({certMetadata.daysRemaining} dias restantes)
                    </span>
                  </div>
                )}
              </div>

              {certMetadata && (
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-400 block">Válido A Partir De:</span>
                    <strong>{new Date(certMetadata.validFrom).toLocaleDateString('pt-BR')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Válido Até:</span>
                    <strong>{new Date(certMetadata.validTo).toLocaleDateString('pt-BR')}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Algoritmo de Chave:</span>
                    <strong className="font-mono">RSA 2048-bit (SHA-256)</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Form de Upload */}
            <form onSubmit={handleCertificateUpload} className="p-6 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                Instalar Novo Certificado A1 (.PFX ou .P12)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Arquivo do Certificado (.pfx / .p12) *
                  </label>
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => setCertFile(e.target.files ? e.target.files[0] : null)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Senha do Certificado Digital *
                  </label>
                  <input
                    type="password"
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="Digite a senha do arquivo .pfx"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {certUploadSuccess && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {certUploadSuccess}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isUploadingCert}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition"
                >
                  {isUploadingCert ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Criptografar e Instalar no Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: DOCUMENTOS FISCAIS EMITIDOS                      */}
      {/* ======================================================== */}
      {activeSubTab === 'documents' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={docSearchTerm}
                  onChange={(e) => setDocSearchTerm(e.target.value)}
                  placeholder="Buscar por nº, pedido, cliente, chave..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <select
                value={docFilterStatus}
                onChange={(e) => setDocFilterStatus(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="all">Todos os Status</option>
                <option value="autorizado">Autorizadas</option>
                <option value="contingencia">Contingência</option>
                <option value="cancelado">Canceladas</option>
                <option value="rejeitado">Rejeitadas</option>
              </select>

              <select
                value={docFilterType}
                onChange={(e) => setDocFilterType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                <option value="all">Todos os Modelos</option>
                <option value="nfce">NFC-e (Mod. 65)</option>
                <option value="nfe">NF-e (Mod. 55)</option>
                <option value="nfse">NFS-e (Serviços)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                Total: <strong>{filteredDocuments.length}</strong> notas
              </span>
              <button
                onClick={loadDocuments}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/95 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Doc / Nº</th>
                    <th className="py-3 px-4">Pedido</th>
                    <th className="py-3 px-4">Consumidor</th>
                    <th className="py-3 px-4">Emissão</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        Nenhum documento fiscal encontrado com os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono">
                          <span className="font-bold text-white block">
                            {doc.documentType.toUpperCase()} #{doc.documentNumber}
                          </span>
                          <span className="text-[10px] text-slate-500">Série {doc.series}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            #{doc.orderShortCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="max-w-[150px] truncate text-slate-200 font-medium">
                            {doc.customerName || 'Consumidor Final'}
                          </div>
                          {doc.customerCpfCnpj && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {doc.customerCpfCnpj}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {new Date(doc.dataEmissao).toLocaleDateString('pt-BR')}{' '}
                          <span className="text-[10px] text-slate-400">
                            {new Date(doc.dataEmissao).toLocaleTimeString('pt-BR')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          R$ {doc.total.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                              doc.status === 'autorizado'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : doc.status === 'contingencia'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : doc.status === 'cancelado'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                window.open(`/api/fiscal/documents/${doc.accessKey}/danfce`, '_blank');
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                              title="Visualizar e Imprimir DANFE"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                window.open(`/api/fiscal/documents/${doc.accessKey}/xml`, '_blank');
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                              title="Baixar XML assinado SEFAZ"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>

                            {doc.status === 'contingencia' && (
                              <button
                                onClick={() => handleReprocessContingency(doc.accessKey)}
                                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold transition flex items-center gap-1 border border-amber-500/30"
                                title="Transmitir para SEFAZ"
                              >
                                <RefreshCw className="w-3 h-3" /> Transmitir
                              </button>
                            )}

                            {doc.status === 'autorizado' && (
                              <button
                                onClick={() => {
                                  setCancelModalDoc(doc);
                                  setCancelJustification('');
                                }}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                                title="Cancelar Documento"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 4: SIMULADOR TRIBUTÁRIO & CENÁRIOS                  */}
      {/* ======================================================== */}
      {activeSubTab === 'simulation' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                Simulador Tributário & Inteligência Fiscal para Restaurantes
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Comparativo de Regimes, Segregação de Monofásicos de Bebidas e Prevenção de Bitributação
              </p>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                {(['mes', 'trimestre', 'ano'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSimulationPeriod(p)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg uppercase transition ${
                      simulationPeriod === p
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExportAccountant}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar para Contador
              </button>
            </div>
          </div>

          {/* Legal Disclaimer Banner (Mandatory) */}
          <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <strong>AVISO LEGAL OBRIGATÓRIO:</strong> {simulationData?.avisoLegal || 'SIMULAÇÃO — NÃO REPRESENTA APURAÇÃO FISCAL DEFINITIVA. Os cálculos e projeções fiscais possuem caráter orientativo e educacional para auxílio ao restaurante e não substituem a escrituração oficial, a apuração do PGDAS-D e a validação do profissional contábil responsável.'}
            </div>
          </div>

          {simulationData && (
            <>
              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
                  <span className="text-xs text-slate-400 block mb-1">Faturamento Bruto ({simulationPeriod.toUpperCase()})</span>
                  <strong className="text-2xl font-black text-white">
                    R$ {simulationData.faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[10px] text-slate-500 block mt-1">100% da receita operacional</span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
                  <span className="text-xs text-slate-400 block mb-1">Receita de Bebidas Frias (Monofásicos)</span>
                  <strong className="text-2xl font-black text-amber-400">
                    R$ {simulationData.receitaMonofasica.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[10px] text-amber-400/80 block mt-1">
                    Direito legal de exclusão de PIS/COFINS e ICMS-ST
                  </span>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl">
                  <span className="text-xs text-slate-400 block mb-1">Carga Tributária Atual</span>
                  <strong className="text-2xl font-black text-slate-200">
                    R$ {simulationData.cenarioAtual.impostosEstimados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Alíquota efetiva média: {simulationData.cenarioAtual.aliquotaEfetiva}%
                  </span>
                </div>

                <div className="bg-slate-900 border border-emerald-500/30 p-5 rounded-3xl bg-emerald-950/10">
                  <span className="text-xs text-emerald-400 block mb-1">Potencial de Economia Legal</span>
                  <strong className="text-2xl font-black text-emerald-400">
                    R$ {simulationData.cenariosSimulados[0].diferencaEstimada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[10px] text-emerald-300 block mt-1">
                    +{simulationData.cenariosSimulados[0].impactoMargem}% de margem líquida direta
                  </span>
                </div>
              </div>

              {/* Scenarios Comparison */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {simulationData.cenariosSimulados.map((cenario: any) => (
                  <div
                    key={cenario.id}
                    className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-base">{cenario.nome}</h4>
                        <p className="text-xs text-slate-400 mt-1">{cenario.descricao}</p>
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30">
                        {cenario.aliquotaEfetiva}% efetiva
                      </span>
                    </div>

                    <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Impostos Totais Estimados:</span>
                        <strong className="text-white font-mono">
                          R$ {cenario.impostosEstimados.toFixed(2)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Economia em Relação ao Cenário Atual:</span>
                        <strong className="text-emerald-400 font-bold">
                          R$ {cenario.diferencaEstimada.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                      <strong>Fundamentação Legal:</strong> {cenario.fundamentacao}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legal Opportunities */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h4 className="font-bold text-white text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Oportunidades Neutras de Planejamento Tributário para Restaurantes
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {simulationData.oportunidadesPlanejamento.map((op: any, i: number) => (
                    <div key={i} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          op.tipo === 'beneficio'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {op.tipo}
                      </span>
                      <h5 className="font-bold text-slate-200 text-xs">{op.titulo}</h5>
                      <p className="text-[11px] text-slate-400">{op.descricao}</p>
                      <span className="text-[10px] text-emerald-400 font-semibold block pt-1">
                        {op.impactoEstimado}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 5: AUDITORIA FISCAL & LOGS SEFAZ                     */}
      {/* ======================================================== */}
      {activeSubTab === 'audit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Trilha de Auditoria Fiscal Imutável
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Registro detalhado de emissões, cancelamentos e alterações de configurações para conformidade fiscal
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="py-8 text-center text-slate-400 text-xs">
                Nenhum evento registrado ainda na trilha de auditoria.
              </p>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono uppercase bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                        {log.action}
                      </span>
                      <span className="text-slate-400">
                        por <strong>{log.userName}</strong> ({log.userRole})
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs">{log.details}</p>
                    {log.accessKey && (
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Chave: {log.accessKey}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 6: INUTILIZAÇÃO DE NUMERAÇÃO (AJUSTE SINIEF 07/05)  */}
      {/* ======================================================== */}
      {activeSubTab === 'inutilizacao' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-amber-400" />
                Inutilização de Numeração na SEFAZ
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Conforme o <strong>Ajuste SINIEF 07/05</strong> e legislação fiscal brasileira, caso ocorra quebra na sequência da numeração fiscal (por erro operacional, oscilação de energia ou salto de numeração), a empresa é <strong>obrigada</strong> a formalizar o pedido de inutilização da faixa de números não utilizados na SEFAZ até o 10º dia do mês subsequente, evitando autuações de sonegação fiscal.
              </p>
            </div>

            {inutSuccessMsg && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{inutSuccessMsg}</span>
              </div>
            )}

            {/* Formulário de Inutilização */}
            <form onSubmit={handleRequestInutilizacao} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-200">
                Solicitar Nova Inutilização de Faixa
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Modelo de Documento *
                  </label>
                  <select
                    value={inutModelo}
                    onChange={(e) => setInutModelo(Number(e.target.value) as 65 | 55)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value={65}>NFC-e (Modelo 65 - Consumidor)</option>
                    <option value={55}>NF-e (Modelo 55 - Mercantil)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Série *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={inutSerie}
                    onChange={(e) => setInutSerie(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Número Inicial *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={inutNumeroInicial}
                    onChange={(e) => setInutNumeroInicial(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Número Final *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={inutNumeroFinal}
                    onChange={(e) => setInutNumeroFinal(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Justificativa Legal (Mínimo 15 caracteres) *
                </label>
                <textarea
                  rows={2}
                  value={inutJustificativa}
                  onChange={(e) => setInutJustificativa(e.target.value)}
                  placeholder="Exemplo: Quebra de numeração decorrente de reinicialização do PDV após falha no fornecimento elétrico."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  required
                />
                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                  <span>A SEFAZ exige explicação clara para o salto da sequência numérica.</span>
                  <span className={inutJustificativa.trim().length >= 15 ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {inutJustificativa.trim().length} / mín 15 caracteres
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingInut || inutJustificativa.trim().length < 15 || inutNumeroFinal < inutNumeroInicial}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg"
                >
                  {isSubmittingInut ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                  Transmitir Inutilização para SEFAZ
                </button>
              </div>
            </form>

            {/* Histórico de Inutilizações */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-300">
                Histórico de Inutilizações Homologadas
              </h4>

              {inutilizacoes.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800 text-xs text-slate-400">
                  Nenhuma faixa de numeração inutilizada até o momento. Toda a sequência fiscal está íntegra.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="pb-3 px-3">Data / Hora</th>
                        <th className="pb-3 px-3">Modelo</th>
                        <th className="pb-3 px-3">Série</th>
                        <th className="pb-3 px-3">Faixa Numérica</th>
                        <th className="pb-3 px-3">Protocolo SEFAZ</th>
                        <th className="pb-3 px-3">Justificativa</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3">Operador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {inutilizacoes.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3 text-slate-300 font-mono whitespace-nowrap">
                            {new Date(rec.dataSolicitacao).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-800 text-slate-200">
                              {rec.modelo === 65 ? 'NFC-e (65)' : 'NF-e (55)'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-white">
                            {rec.serie}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-amber-400">
                            #{rec.numeroInicial} até #{rec.numeroFinal}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                            {rec.protocolo || 'N/D'}
                          </td>
                          <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={rec.justificativa}>
                            {rec.justificativa}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-max">
                              <CheckCircle2 className="w-3 h-3" />
                              Homologado (102)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                            {rec.usuario}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento Formal SEFAZ */}
      {cancelModalDoc && (
        <div className="modal-viewport fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto my-auto p-6 space-y-4">
            <h4 className="text-base font-bold text-rose-300 flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-400" />
              Cancelar Documento Fiscal na SEFAZ
            </h4>

            <p className="text-xs text-slate-300">
              Você está cancelando a <strong>{cancelModalDoc.documentType.toUpperCase()} #{cancelModalDoc.documentNumber}</strong> (Série {cancelModalDoc.series}).
              O cancelamento é irreversível e homologado diretamente na SEFAZ.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Justificativa Legal de Cancelamento (Mínimo 15 caracteres) *
              </label>
              <textarea
                rows={3}
                value={cancelJustification}
                onChange={(e) => setCancelJustification(e.target.value)}
                placeholder="Exemplo: Erro no lançamento dos itens do pedido pelo operador"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalDoc(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelDoc}
                disabled={isCancellingDoc || cancelJustification.trim().length < 15}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                {isCancellingDoc ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Confirmar Cancelamento SEFAZ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
