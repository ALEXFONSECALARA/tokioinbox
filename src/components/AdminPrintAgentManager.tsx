import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { PrintJob, ThermalPrinterDevice, PrintStation } from '../types/printing';
import {
  Printer,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  Wifi,
  WifiOff,
  Sliders,
  Send,
  ShieldCheck,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

const ALL_STATIONS: PrintStation[] = ['CAIXA', 'COZINHA', 'SUSHI_BAR', 'BAR', 'ENTREGA'];

interface AdminPrintAgentManagerProps {
  selectedSlug: RestaurantSlug | 'all';
}

export const AdminPrintAgentManager: React.FC<AdminPrintAgentManagerProps> = ({ selectedSlug }) => {
  const { restaurants, orders, currentUser, showToast } = useStore();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<ThermalPrinterDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testPrintStation, setTestPrintStation] = useState<PrintStation>('CAIXA');
  const [isAgentConnected, setIsAgentConnected] = useState(true);

  // Formulário de cadastro/edição de impressora — permite marcar mais de um
  // local (estação) para a MESMA impressora receber cópias do pedido.
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formStations, setFormStations] = useState<PrintStation[]>([]);
  const [formConnectionType, setFormConnectionType] = useState<ThermalPrinterDevice['connectionType']>('USB');
  const [formIpAddress, setFormIpAddress] = useState('');
  const [formPort, setFormPort] = useState('9100');
  const [formPaperWidth, setFormPaperWidth] = useState<'80mm' | '58mm'>('80mm');
  const [formCopies, setFormCopies] = useState('1');
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);

  const authHeaders: Record<string, string> = currentUser?.token
    ? { Authorization: `Bearer ${currentUser.token}` }
    : {};

  const fetchPrintData = async () => {
    setIsLoading(true);
    try {
      const slugQuery = selectedSlug === 'all' ? '' : `?slug=${selectedSlug}`;
      const [resJobs, resPrinters] = await Promise.all([
        fetch(`/api/print-agent/jobs${slugQuery}`),
        fetch(`/api/print-agent/printers${slugQuery}`),
      ]);

      const dataJobs = await resJobs.json();
      const dataPrinters = await resPrinters.json();

      if (dataJobs.success && Array.isArray(dataJobs.jobs)) {
        setJobs(dataJobs.jobs);
      }
      if (dataPrinters.success && Array.isArray(dataPrinters.printers)) {
        setPrinters(dataPrinters.printers);
      }
    } catch (err) {
      console.error('Error fetching print agent data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrintData();

    let timerId: any = null;
    const schedulePoll = () => {
      const isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
      // Only poll when the browser tab is actively visible
      if (isVisible) {
        fetchPrintData().finally(() => {
          timerId = setTimeout(schedulePoll, 10000);
        });
      } else {
        timerId = setTimeout(schedulePoll, 20000);
      }
    };

    timerId = setTimeout(schedulePoll, 10000);

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchPrintData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedSlug]);

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/print-agent/jobs/${jobId}/retry`, { method: 'POST' });
      if (res.ok) {
        fetchPrintData();
      }
    } catch (err) {
      console.error('Retry failed:', err);
    }
  };

  const resetPrinterForm = () => {
    setEditingPrinterId(null);
    setFormName('');
    setFormStations([]);
    setFormConnectionType('USB');
    setFormIpAddress('');
    setFormPort('9100');
    setFormPaperWidth('80mm');
    setFormCopies('1');
  };

  const openNewPrinterForm = () => {
    resetPrinterForm();
    setIsFormOpen(true);
  };

  const openEditPrinterForm = (printer: ThermalPrinterDevice) => {
    setEditingPrinterId(printer.id);
    setFormName(printer.name);
    setFormStations(printer.stations || []);
    setFormConnectionType(printer.connectionType);
    setFormIpAddress(printer.ipAddress || '');
    setFormPort(printer.port ? String(printer.port) : '9100');
    setFormPaperWidth(printer.paperWidth);
    setFormCopies(String(printer.copies || 1));
    setIsFormOpen(true);
  };

  const toggleFormStation = (station: PrintStation) => {
    setFormStations((prev) =>
      prev.includes(station) ? prev.filter((s) => s !== station) : [...prev, station]
    );
  };

  const handleSavePrinter = async () => {
    if (!formName.trim()) {
      showToast('Informe um nome para a impressora.', 'warning');
      return;
    }
    if (formStations.length === 0) {
      showToast('Marque ao menos um local (estação) para esta impressora.', 'warning');
      return;
    }
    const targetSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;
    setIsSavingPrinter(true);
    try {
      const printerPayload: ThermalPrinterDevice = {
        id: editingPrinterId || `prn-${Date.now().toString(36)}`,
        name: formName.trim(),
        stations: formStations,
        restaurantSlug: targetSlug as RestaurantSlug,
        connectionType: formConnectionType,
        ipAddress: formConnectionType === 'REDE_TCP' ? formIpAddress.trim() || undefined : undefined,
        port: formConnectionType === 'REDE_TCP' ? Number(formPort) || 9100 : undefined,
        paperWidth: formPaperWidth,
        status: 'online',
        lastSeenAt: new Date().toISOString(),
        copies: Math.max(1, Number(formCopies) || 1),
      };

      const res = await fetch('/api/print-agent/printers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(printerPayload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao salvar impressora.');
      }
      showToast(
        editingPrinterId ? 'Impressora atualizada com sucesso!' : 'Impressora cadastrada com sucesso!',
        'success'
      );
      setIsFormOpen(false);
      resetPrinterForm();
      fetchPrintData();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar impressora.', 'error');
    } finally {
      setIsSavingPrinter(false);
    }
  };

  const handleDeletePrinter = async (printer: ThermalPrinterDevice) => {
    if (!confirm(`Excluir a impressora "${printer.name}"?`)) return;
    try {
      const res = await fetch(
        `/api/print-agent/printers/${encodeURIComponent(printer.id)}?slug=${encodeURIComponent(printer.restaurantSlug)}`,
        { method: 'DELETE', headers: { ...authHeaders } }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Falha ao excluir impressora.');
      }
      showToast('Impressora removida.', 'success');
      fetchPrintData();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir impressora.', 'error');
    }
  };

  const handleSendTestPrint = async () => {
    try {
      const targetSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;
      const res = await fetch('/api/print-agent/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: `test-${Date.now().toString().slice(-4)}`,
          orderShortCode: '#TEST-01',
          restaurantSlug: targetSlug,
          station: testPrintStation,
          rawEscPos: `[ESC/POS TESTE]\nAURA PRIME PRINT AGENT\nEstacao: ${testPrintStation}\nData: ${new Date().toLocaleString()}\nImpressao de Teste OK!\n------------------------`,
        }),
      });
      if (res.ok) {
        fetchPrintData();
        alert('Comando de impressão enviado para a fila do Print Agent!');
      }
    } catch (err) {
      console.error('Test print failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#18130B] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(227,189,106,0.3)] shrink-0">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white tracking-tight">
                Aura Print Agent • Fila &amp; Dispositivos Térmicos
              </h2>
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <Wifi className="w-3 h-3" />
                Agente Conectado (Porta 9100 / USB)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Arquitetura desacoplada com roteamento por praças (Caixa, Cozinha, Sushi Bar, Entrega) e isolamento multi-loja
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPrintData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#E3BD6A] border border-[#E3BD6A]/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Atualizar Fila</span>
          </button>
        </div>
      </div>

      {/* Printer Devices Registered */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#E3BD6A] flex items-center gap-1.5">
            <Sliders className="w-4 h-4" />
            <span>Impressoras Térmicas Cadastradas ({printers.length})</span>
          </h3>

          {/* Test print trigger */}
          <div className="flex items-center gap-2">
            <button
              onClick={openNewPrinterForm}
              className="py-1 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Impressora</span>
            </button>
            <select
              value={testPrintStation}
              onChange={(e) => setTestPrintStation(e.target.value as PrintStation)}
              className="px-2.5 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
            >
              <option value="CAIXA">Estação CAIXA (80mm)</option>
              <option value="COZINHA">Estação COZINHA (80mm)</option>
              <option value="SUSHI_BAR">Estação SUSHI BAR (80mm)</option>
              <option value="ENTREGA">Estação ENTREGA (80mm)</option>
            </select>
            <button
              onClick={handleSendTestPrint}
              className="py-1 px-3 rounded-lg bg-[#E3BD6A] hover:bg-[#F5D38A] text-slate-950 font-bold text-xs flex items-center gap-1 shadow-sm"
            >
              <Send className="w-3 h-3" />
              <span>Teste de Impressão</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {printers.map((printer) => (
            <div
              key={printer.id}
              className="p-4 rounded-xl bg-[#121622] border border-slate-800 hover:border-slate-700 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">{printer.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                  {printer.status.toUpperCase()}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 space-y-0.5">
                <p className="flex flex-wrap items-center gap-1">
                  Locais:
                  {(printer.stations || []).map((s) => (
                    <span
                      key={s}
                      className="px-1.5 py-0.5 rounded bg-[#E3BD6A]/15 text-[#E3BD6A] font-bold text-[10px]"
                    >
                      {s}
                    </span>
                  ))}
                </p>
                <p>Conexão: <strong className="text-slate-200">{printer.connectionType} {printer.ipAddress ? `(${printer.ipAddress}:${printer.port})` : ''}</strong></p>
                <p>Largura: <strong className="text-slate-200">{printer.paperWidth}</strong> • Cópias: {printer.copies}</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => openEditPrinterForm(printer)}
                  className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDeletePrinter(printer)}
                  className="py-1.5 px-2.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30"
                  title="Excluir impressora"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Cadastrar / Editar Impressora */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121622] border border-[#E3BD6A]/30 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <h3 className="text-sm font-black text-white">
                {editingPrinterId ? 'Editar Impressora' : 'Nova Impressora'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto min-h-0">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Nome da Impressora</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex.: Térmica Balcão Central"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-[#E3BD6A]/60"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                  Locais que recebem esta impressão (marque quantos quiser)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_STATIONS.map((station) => (
                    <label
                      key={station}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        formStations.includes(station)
                          ? 'bg-[#E3BD6A]/15 border-[#E3BD6A]/50 text-[#E3BD6A]'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formStations.includes(station)}
                        onChange={() => toggleFormStation(station)}
                        className="accent-[#E3BD6A]"
                      />
                      {station}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Conexão</label>
                  <select
                    value={formConnectionType}
                    onChange={(e) => setFormConnectionType(e.target.value as ThermalPrinterDevice['connectionType'])}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    <option value="USB">USB</option>
                    <option value="REDE_TCP">Rede (TCP/IP)</option>
                    <option value="BLUETOOTH">Bluetooth</option>
                    <option value="VIRTUAL">Virtual</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Papel</label>
                  <select
                    value={formPaperWidth}
                    onChange={(e) => setFormPaperWidth(e.target.value as '80mm' | '58mm')}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    <option value="80mm">80mm</option>
                    <option value="58mm">58mm</option>
                  </select>
                </div>
              </div>

              {formConnectionType === 'REDE_TCP' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">IP</label>
                    <input
                      value={formIpAddress}
                      onChange={(e) => setFormIpAddress(e.target.value)}
                      placeholder="192.168.1.150"
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">Porta</label>
                    <input
                      value={formPort}
                      onChange={(e) => setFormPort(e.target.value)}
                      placeholder="9100"
                      className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Cópias por pedido</label>
                <input
                  type="number"
                  min={1}
                  value={formCopies}
                  onChange={(e) => setFormCopies(e.target.value)}
                  className="w-24 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsFormOpen(false)}
                className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePrinter}
                disabled={isSavingPrinter}
                className="flex-1 py-2 rounded-lg bg-[#E3BD6A] hover:bg-[#F5D38A] text-slate-950 text-xs font-black disabled:opacity-50"
              >
                {isSavingPrinter ? 'Salvando...' : 'Salvar Impressora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Jobs Queue */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#E3BD6A]" />
          <span>Fila de Impressão em Tempo Real ({jobs.length} trabalhos)</span>
        </h3>

        {jobs.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-950/40">
            <Printer className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Nenhum trabalho pendente na fila de impressão.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Novos pedidos recebidos entrarão automaticamente aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => {
              const isError = job.status === 'ERRO';
              const isDone = job.status === 'IMPRESSO';
              const isPending = job.status === 'PENDENTE';

              return (
                <div
                  key={job.jobId}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                    isError
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : isDone
                      ? 'bg-slate-900/40 border-slate-800'
                      : 'bg-[#121622] border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isError
                          ? 'bg-rose-500/20 text-rose-400'
                          : isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {job.station[0]}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#E3BD6A]">{job.orderShortCode}</span>
                        <span className="text-xs font-bold text-white">
                          Estação {job.station} ({job.printerName})
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Restaurante: {job.restaurantSlug} • Tentativas: {job.attempts}/{job.maxAttempts}
                        {job.errorMessage && (
                          <span className="text-rose-400 block font-semibold">{job.errorMessage}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isError
                          ? 'bg-rose-500/20 text-rose-400'
                          : isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {job.status}
                    </span>

                    {isError && (
                      <button
                        onClick={() => handleRetryJob(job.jobId)}
                        className="py-1 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reenviar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
