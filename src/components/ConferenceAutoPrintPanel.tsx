import React, { useEffect, useState } from 'react';
import { Printer, X, RefreshCw } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { ConferenceSource } from '../types/restaurant';
import { fetchCaixaPrinters, getConferenceOptions } from '../utils/conferencePrint';

const SOURCE_LABELS: Record<ConferenceSource, string> = {
  garcom: 'Garçom (PDV Touch)',
  caixa: 'Caixa',
  mesa: 'Salão / Mesas',
  balcao: 'Balcão',
  retirada: 'Retirada',
  delivery: 'Delivery',
  pedidos: 'Pedidos (Kanban)',
};

/**
 * Botão + modal do Caixa: escolhe a impressora do CAIXA e as opções da
 * conferência automática (liga/desliga por tela, cópias e modo de impressão).
 */
export const ConferenceAutoPrintPanel: React.FC = () => {
  const { printerSettings, updatePrinterSettings, activeRestaurantSlug, showToast } = useStore();
  const opts = getConferenceOptions(printerSettings);
  const [open, setOpen] = useState(false);
  const [printers, setPrinters] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setPrinters(await fetchCaixaPrinters(activeRestaurantSlug));
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const save = (patch: Partial<typeof opts>) => updatePrinterSettings({ conferenceAutoPrint: { ...opts, ...patch } });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`min-h-[40px] px-3 py-2 rounded-xl border text-xs font-black uppercase flex items-center gap-1.5 ${
          opts.enabled ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}
        title="Impressão automática do cupom de conferência"
      >
        <Printer className="w-4 h-4" />
        <span className="hidden sm:inline">Conferência {opts.enabled ? 'AUTO' : 'OFF'}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-md max-h-[calc(100dvh-24px)] bg-[#121622] border border-slate-700 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-sm font-black text-white uppercase">Cupom de conferência automático</h3>
              <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 text-xs text-slate-300">
              <label className="flex items-center justify-between gap-3 font-bold text-white">
                <span>Imprimir automático ao clicar em FECHAR</span>
                <input type="checkbox" className="accent-emerald-500 w-5 h-5" checked={opts.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
              </label>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Impressora do Caixa</span>
                  <button type="button" onClick={load} className="text-slate-400 hover:text-white flex items-center gap-1">
                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Atualizar
                  </button>
                </div>
                <select
                  value={opts.printerId || ''}
                  onChange={(e) => {
                    const p = printers.find((x) => x.id === e.target.value);
                    save({ printerId: p?.id, printerName: p?.name });
                    if (p) showToast(`Impressora do Caixa: ${p.name}`, 'success');
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="">Automática (todas as impressoras do Caixa)</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {printers.length === 0 && !loading && (
                  <p className="text-[11px] text-amber-300/90">
                    Nenhuma impressora do Caixa online no Agente de Impressão — a conferência sai pela impressora padrão do navegador.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-white block">Modo</span>
                <select value={opts.mode} onChange={(e) => save({ mode: e.target.value as any })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white">
                  <option value="auto">Automático (Agente e, se não houver, navegador)</option>
                  <option value="agent">Somente Agente de Impressão (silencioso)</option>
                  <option value="browser">Somente navegador (impressora padrão)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-white block">Vias</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => save({ copies: n })} className={`flex-1 py-2 rounded-lg border font-black ${opts.copies === n ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                      {n}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-white block">Imprimir automático em:</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {(Object.keys(SOURCE_LABELS) as ConferenceSource[]).map((k) => (
                    <label key={k} className="flex items-center justify-between rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
                      <span>{SOURCE_LABELS[k]}</span>
                      <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={opts.sources[k]} onChange={(e) => save({ sources: { ...opts.sources, [k]: e.target.checked } })} />
                    </label>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                Para imprimir sem nenhuma janela usando o navegador, abra o Chrome/Edge do Caixa com o atalho <b>--kiosk-printing</b>. Com o Agente de Impressão isso não é necessário.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
