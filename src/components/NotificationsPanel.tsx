import React, { useEffect, useState } from 'react';
import { Send, Plus, Trash2, Power, Loader2, Bell, Sparkles } from 'lucide-react';

// Espelha o formato salvo em notification_campaigns.schedule (ver
// server/lib/campaignScheduler.js) — mantido aqui em vez de em types.ts
// porque é um detalhe interno deste painel, não um dado de domínio usado
// em outro lugar do app.
interface CampaignSchedule {
  repeat?: 'daily' | 'weekly' | 'monthly';
  time?: string;
  days?: number[];
  dayOfMonth?: number;
}

interface Campaign {
  id: string;
  name: string;
  title: string;
  message: string;
  imageUrl?: string;
  audience: 'all' | 'customers';
  schedule: CampaignSchedule;
  active: boolean;
  lastSentAt?: string | null;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const EMPTY_CAMPAIGN = {
  name: '',
  title: '',
  message: '',
  imageUrl: '',
  audience: 'all' as const,
  repeat: 'weekly' as 'daily' | 'weekly' | 'monthly',
  time: '18:00',
  days: [2, 3, 4] as number[],
  dayOfMonth: 1,
};

interface NotificationsPanelProps {
  slug: string;
  token: string;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ slug, token }) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Envio manual imediato ("📢 Nova notificação", itens 27-28)
  const [sendTitle, setSendTitle] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendImageUrl, setSendImageUrl] = useState('');
  const [sendAudience, setSendAudience] = useState<'all' | 'customers'>('all');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Nova campanha automática (itens 29-30)
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_CAMPAIGN });
  const [savingCampaign, setSavingCampaign] = useState(false);

  // "✨ Criar campanha com IA" (item 31) — só preenche o formulário acima
  // com uma sugestão; quem revisa, edita e decide enviar é sempre o dono.
  const [aiBrief, setAiBrief] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const API_BASE = String((import.meta as any).env.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');
  const API_PREFIX = API_BASE ? `${API_BASE}/api` : '/api';
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadCampaigns = () => {
    setLoading(true);
    fetch(`${API_PREFIX}/admin/${slug}/push/campaigns`, { headers: authHeaders })
      .then((r) => r.json())
      .then(setCampaigns)
      .catch(() => setError('Não foi possível carregar as campanhas.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleSendNow = async () => {
    if (!sendTitle.trim() || !sendMessage.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`${API_PREFIX}/admin/${slug}/push/send`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: sendTitle, message: sendMessage, imageUrl: sendImageUrl || undefined, audience: sendAudience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar.');
      setSendResult(`Enviado para ${data.sentCount} de ${data.totalCount} inscrito(s).`);
      setSendTitle('');
      setSendMessage('');
      setSendImageUrl('');
    } catch (err: any) {
      setSendResult(err.message || 'Não foi possível enviar.');
    } finally {
      setSending(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.message.trim()) return;
    setSavingCampaign(true);
    try {
      const schedule: CampaignSchedule =
        form.repeat === 'weekly'
          ? { repeat: 'weekly', time: form.time, days: form.days }
          : form.repeat === 'monthly'
            ? { repeat: 'monthly', time: form.time, dayOfMonth: form.dayOfMonth }
            : { repeat: 'daily', time: form.time };
      const res = await fetch(`${API_PREFIX}/admin/${slug}/push/campaigns`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: form.name,
          title: form.title,
          message: form.message,
          imageUrl: form.imageUrl || undefined,
          audience: form.audience,
          schedule,
        }),
      });
      if (!res.ok) throw new Error('Falha ao criar campanha.');
      setForm({ ...EMPTY_CAMPAIGN });
      setShowNewCampaign(false);
      loadCampaigns();
    } catch (err) {
      setError('Não foi possível criar a campanha.');
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleToggleActive = async (campaign: Campaign) => {
    await fetch(`${API_PREFIX}/admin/${slug}/push/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ active: !campaign.active }),
    });
    loadCampaigns();
  };

  const handleDeleteCampaign = async (id: string) => {
    await fetch(`${API_PREFIX}/admin/${slug}/push/campaigns/${id}`, { method: 'DELETE', headers: authHeaders });
    loadCampaigns();
  };

  const handleAiSuggest = async () => {
    if (!aiBrief.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`${API_PREFIX}/admin/${slug}/ai/campaign-suggest`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ brief: aiBrief.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar sugestão.');
      setShowNewCampaign(true);
      setForm((f) => ({
        ...f,
        name: aiBrief.trim().slice(0, 40),
        title: data.title,
        message: data.message,
        time: data.suggestedTime || f.time,
        audience: data.suggestedAudience || f.audience,
      }));
    } catch (err: any) {
      setAiError(err.message || 'Não foi possível gerar a sugestão.');
    } finally {
      setAiLoading(false);
    }
  };

  const describeSchedule = (s: CampaignSchedule) => {
    if (s.repeat === 'daily') return `Todo dia às ${s.time}`;
    if (s.repeat === 'weekly') return `Toda ${(s.days || []).map((d) => WEEKDAYS[d]).join(', ')} às ${s.time}`;
    if (s.repeat === 'monthly') return `Todo dia ${s.dayOfMonth} do mês às ${s.time}`;
    return '—';
  };

  return (
    <div className="space-y-6">
      {/* Envio manual imediato */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <h3 className="font-black text-stone-800 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-500" /> Nova notificação
        </h3>
        <input
          value={sendTitle}
          onChange={(e) => setSendTitle(e.target.value)}
          placeholder="Título (ex: 🔥 Hoje tem Rodízio!)"
          className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
        />
        <textarea
          value={sendMessage}
          onChange={(e) => setSendMessage(e.target.value)}
          rows={2}
          placeholder="Mensagem"
          className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
        />
        <input
          value={sendImageUrl}
          onChange={(e) => setSendImageUrl(e.target.value)}
          placeholder="URL de imagem grande (opcional)"
          className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-2">
          <select
            value={sendAudience}
            onChange={(e) => setSendAudience(e.target.value as 'all' | 'customers')}
            className="border border-stone-200 rounded-xl px-2 py-2 text-xs"
          >
            <option value="all">Todos os inscritos</option>
            <option value="customers">Só clientes cadastrados</option>
          </select>
          <button
            onClick={handleSendNow}
            disabled={sending || !sendTitle.trim() || !sendMessage.trim()}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar agora
          </button>
        </div>
        {sendResult && <p className="text-xs text-stone-500">{sendResult}</p>}
      </div>

      {/* Campanhas automáticas */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-stone-800">Campanhas automáticas</h3>
          <button
            onClick={() => setShowNewCampaign((v) => !v)}
            className="flex items-center gap-1 text-xs font-bold text-stone-700"
          >
            <Plus className="w-3.5 h-3.5" /> Nova campanha
          </button>
        </div>

        <div className="flex gap-1.5">
          <input
            value={aiBrief}
            onChange={(e) => setAiBrief(e.target.value)}
            placeholder="✨ Ex: Quero divulgar o rodízio de hoje"
            className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-xs"
          />
          <button
            onClick={handleAiSuggest}
            disabled={aiLoading || !aiBrief.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50 whitespace-nowrap"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Criar com IA
          </button>
        </div>
        {aiError && <p className="text-[11px] text-red-500">{aiError}</p>}

        {showNewCampaign && (
          <div className="border border-stone-200 rounded-xl p-3 space-y-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome da campanha (ex: Rodízio)"
              className="w-full border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
            />
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Título da notificação"
              className="w-full border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
            />
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              rows={2}
              placeholder="Mensagem"
              className="w-full border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
            />
            <div className="grid grid-cols-3 gap-1.5">
              <select
                value={form.repeat}
                onChange={(e) => setForm({ ...form, repeat: e.target.value as any })}
                className="border border-stone-200 rounded-lg px-2 py-2 text-xs"
              >
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="border border-stone-200 rounded-lg px-2 py-2 text-xs"
              />
              {form.repeat === 'monthly' && (
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={form.dayOfMonth}
                  onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
                  placeholder="Dia do mês"
                  className="border border-stone-200 rounded-lg px-2 py-2 text-xs"
                />
              )}
            </div>
            {form.repeat === 'weekly' && (
              <div className="flex gap-1 flex-wrap">
                {WEEKDAYS.map((label, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        days: form.days.includes(idx) ? form.days.filter((d) => d !== idx) : [...form.days, idx],
                      })
                    }
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                      form.days.includes(idx) ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <select
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value as 'all' | 'customers' })}
              className="w-full border border-stone-200 rounded-lg px-2.5 py-2 text-xs"
            >
              <option value="all">Todos os inscritos</option>
              <option value="customers">Só clientes cadastrados</option>
            </select>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowNewCampaign(false)} className="px-3 py-2 text-xs font-bold text-stone-500">
                Cancelar
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={savingCampaign}
                className="px-3 py-2 rounded-lg bg-stone-900 text-white text-xs font-bold disabled:opacity-50"
              >
                Criar campanha
              </button>
            </div>
          </div>
        )}

        {loading && <p className="text-xs text-stone-400">Carregando...</p>}
        {!loading && campaigns.length === 0 && (
          <p className="text-xs text-stone-400">Nenhuma campanha automática criada ainda.</p>
        )}
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 border border-stone-100 rounded-xl p-3 bg-stone-50">
            <div className="min-w-0">
              <p className="text-xs font-bold text-stone-800 truncate">
                {c.name} {!c.active && <span className="text-red-500">(pausada)</span>}
              </p>
              <p className="text-[11px] text-stone-500">{describeSchedule(c.schedule)}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleToggleActive(c)}
                className={`p-1.5 rounded-lg text-white ${c.active ? 'bg-amber-500/80 hover:bg-amber-500' : 'bg-emerald-600/70 hover:bg-emerald-600'}`}
                title={c.active ? 'Pausar' : 'Reativar'}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteCampaign(c.id)}
                className="p-1.5 rounded-lg bg-stone-200 hover:bg-red-100 text-stone-600 hover:text-red-600"
                title="Excluir"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
};
