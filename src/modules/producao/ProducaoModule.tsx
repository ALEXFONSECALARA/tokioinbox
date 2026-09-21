import React, { useState } from 'react';
import { StationKdsView } from '../../components/StationKdsView';
import { ProductionStation } from '../../types/restaurant';
import { ChefHat, Fish, Beer, ArrowLeft, Layers } from 'lucide-react';

interface ProducaoModuleProps {
  initialStation?: ProductionStation;
  onBackToApp?: () => void;
}

/**
 * MÓDULO 6: PRODUÇÃO / KDS MULTI-PRAÇAS
 * Telas dedicadas para COZINHA (quentes/chapa), SUSHIBAR (frios/combinados) e BAR (bebidas/drinks/vinhos).
 * Fluxo estrito: RECEBIDO -> EM PREPARO -> PRONTO.
 * O pedido global só vai para PRONTO quando todas as praças participantes finalizarem seus respectivos itens.
 */
export const ProducaoModule: React.FC<ProducaoModuleProps> = ({
  initialStation = 'cozinha',
  onBackToApp,
}) => {
  const [selectedStation, setSelectedStation] = useState<ProductionStation>(initialStation);

  return (
    <div className="w-full h-full min-h-screen bg-[#07090E] flex flex-col">
      {/* Top Station Selector Tab */}
      <div className="bg-[#090D16] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <div>
              <h1 className="text-xs font-black tracking-wider text-white uppercase">
                KDS Sistema de Produção
              </h1>
              <p className="text-[10px] text-slate-400">Roteamento por Praças Especializadas</p>
            </div>
          </div>
        </div>

        {/* Praça Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setSelectedStation('cozinha')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              selectedStation === 'cozinha'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" />
            <span>Cozinha</span>
          </button>

          <button
            onClick={() => setSelectedStation('sushibar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              selectedStation === 'sushibar'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Fish className="w-3.5 h-3.5" />
            <span>Sushibar</span>
          </button>

          <button
            onClick={() => setSelectedStation('bar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
              selectedStation === 'bar'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Beer className="w-3.5 h-3.5" />
            <span>Bar</span>
          </button>
        </div>
      </div>

      {/* Main KDS Station View */}
      <div className="flex-1 w-full">
        <StationKdsView
          key={selectedStation}
          station={selectedStation}
          onBack={onBackToApp}
          standalone={false}
        />
      </div>
    </div>
  );
};
