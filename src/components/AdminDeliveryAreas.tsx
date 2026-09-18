import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { RestaurantSlug } from '../types/restaurant';
import { MapPin, Navigation, Plus, Trash2, CheckCircle2, Clock, DollarSign } from 'lucide-react';

interface DeliveryZone {
  id: string;
  name: string;
  maxRadiusKm: number;
  fee: number;
  estimatedMinutes: string;
  minOrder: number;
  active: boolean;
}

interface AdminDeliveryAreasProps {
  selectedSlug: RestaurantSlug | 'all';
}

export const AdminDeliveryAreas: React.FC<AdminDeliveryAreasProps> = ({ selectedSlug }) => {
  const { restaurants } = useStore();
  const targetSlug = selectedSlug === 'all' ? 'japones' : selectedSlug;
  const currentRestaurant = restaurants[targetSlug] || restaurants.japones;

  const [zones, setZones] = useState<DeliveryZone[]>([
    {
      id: 'z-1',
      name: 'Zona 1 • Bairros Centrais & Proximidades',
      maxRadiusKm: 3.5,
      fee: 6.9,
      estimatedMinutes: '25 a 35 min',
      minOrder: 35.0,
      active: true,
    },
    {
      id: 'z-2',
      name: 'Zona 2 • Bairros Intermediários',
      maxRadiusKm: 7.0,
      fee: 11.9,
      estimatedMinutes: '35 a 45 min',
      minOrder: 50.0,
      active: true,
    },
    {
      id: 'z-3',
      name: 'Zona 3 • Bairros Expandidos & Condomínios',
      maxRadiusKm: 12.0,
      fee: 17.9,
      estimatedMinutes: '45 a 60 min',
      minOrder: 80.0,
      active: true,
    },
  ]);

  const [allowTakeaway, setAllowTakeaway] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleToggleActive = (id: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, active: !z.active } : z))
    );
  };

  const handleUpdateFee = (id: string, newFee: number) => {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, fee: newFee } : z))
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-[#18130B] via-[#121622] to-[#0A0D14] border border-[#E3BD6A]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E3BD6A] to-[#8F6A1E] flex items-center justify-center text-slate-950 font-black shadow-[0_0_20px_rgba(227,189,106,0.3)] shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">
              Áreas de Entrega &amp; Geofencing • {currentRestaurant.name}
            </h2>
            <p className="text-xs text-slate-400">
              Configure faixas de quilometragem, taxas de entrega escalonadas e tempo estimado por raio
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E3BD6A] to-[#C99C3D] hover:brightness-110 text-slate-950 font-black text-xs shadow flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Salvar Alterações</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Políticas de entrega e zonas salvas com sucesso!</span>
        </div>
      )}

      {/* Global Takeaway Toggle */}
      <div className="p-4 rounded-xl bg-[#121622] border border-slate-800 flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-white">Retirada no Balcão (Takeaway / To-Go)</h4>
          <p className="text-[11px] text-slate-400">Permite que clientes façam o pedido sem taxa de entrega para retirar no local</p>
        </div>
        <input
          type="checkbox"
          checked={allowTakeaway}
          onChange={(e) => setAllowTakeaway(e.target.checked)}
          className="w-5 h-5 accent-[#E3BD6A] cursor-pointer rounded"
        />
      </div>

      {/* Zones List */}
      <div className="space-y-3">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className={`p-4 rounded-xl border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              zone.active ? 'bg-[#121622] border-slate-800' : 'bg-slate-950/40 border-slate-900 opacity-50'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E3BD6A]" />
                <h4 className="text-xs sm:text-sm font-bold text-white">{zone.name}</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-[#E3BD6A] font-bold">
                  Até {zone.maxRadiusKm} km
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" /> {zone.estimatedMinutes}
                </span>
                <span>• Pedido Mínimo: R$ {zone.minOrder.toFixed(2)}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400">Taxa: R$</span>
                <input
                  type="number"
                  step="0.50"
                  value={zone.fee}
                  onChange={(e) => handleUpdateFee(zone.id, parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold text-xs text-center focus:border-[#E3BD6A] focus:outline-none"
                />
              </div>

              <button
                onClick={() => handleToggleActive(zone.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  zone.active
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {zone.active ? 'Ativa' : 'Pausada'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
