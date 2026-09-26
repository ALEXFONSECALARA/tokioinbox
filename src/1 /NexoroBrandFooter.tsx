import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { BRAND_CONFIG, BRAND_NAME, BRAND_SLOGAN, BRAND_TAGLINE } from '../config/brand';
import {
  ShieldCheck,
  Zap,
  Smartphone,
  TrendingUp,
  Award,
  Sparkles,
  CheckCircle2,
  Copy,
  Download,
} from 'lucide-react';

export const NexoroBrandFooter: React.FC = () => {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const colors = [
    { name: 'Dourado Premium', hex: '#D4AF37', border: 'border-[#D4AF37]', role: 'Acentos Nobres, Botões e Brasão' },
    { name: 'Preto Elegante', hex: '#0B0B0B', border: 'border-[#333333]', role: 'Fundo Primário e Cards de Alto Contraste' },
    { name: 'Cinza Sofisticado', hex: '#2A2A2A', border: 'border-[#444444]', role: 'Divisores e Contornos Subtis' },
    { name: 'Verde Sucesso', hex: '#00C896', border: 'border-[#00C896]', role: 'Status Online, Sucesso e Métricas Positivas' },
  ];

  const handleCopyColor = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  return (
    <footer className="mt-12 pt-8 border-t border-[#222222] bg-[#070707] rounded-3xl p-6 sm:p-10 space-y-8 text-slate-300">
      {/* 1. Header with Logo, Slogan and Pillars */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[#1A1A1A]">
        <div className="flex items-center gap-4">
          <BrandLogo size="md" showTagline={true} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] text-[#D4AF37] font-bold">
            <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Gastronomia de Excelência</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] text-[#00C896] font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00C896]" />
            <span>Segurança RLS &amp; Supabase</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] text-blue-400 font-bold">
            <Zap className="w-3.5 h-3.5 text-blue-400" />
            <span>KDS &amp; Impressão Instantânea</span>
          </span>
        </div>
      </div>

      {/* 2. Paleta de Cores e Ícones do App (food nexoro.png showcase) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Colors (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37]" />
              <span>Paleta Oficial NEXORO FOOD SYSTEM</span>
            </h4>
            <span className="text-[11px] text-slate-500 font-mono">Design System Tokens</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {colors.map((c) => (
              <div
                key={c.hex}
                onClick={() => handleCopyColor(c.hex)}
                className="p-3 rounded-2xl bg-[#0E0E0E] border border-[#222222] hover:border-[#D4AF37]/50 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div
                    className={`w-full h-8 rounded-xl ${c.border} border mb-2 group-hover:scale-105 transition-transform flex items-center justify-center`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {copiedColor === c.hex && (
                      <span className="text-[10px] font-black text-slate-950 bg-white/90 px-1.5 py-0.5 rounded shadow">
                        Copiado!
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                    {c.name}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400">{c.hex}</p>
                </div>
                <p className="text-[9px] text-slate-500 mt-2 leading-tight">{c.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* App Icons (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Ícones do Aplicativo PWA</span>
            </h4>
            <span className="text-[11px] text-slate-500">Android &amp; iOS</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {/* Dark Icon */}
            <div className="p-3 rounded-2xl bg-[#0E0E0E] border border-[#222222] text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0B0B0B] border-2 border-[#D4AF37]/40 flex items-center justify-center shadow-lg">
                <span className="font-serif font-black text-lg text-[#D4AF37]">N</span>
              </div>
              <span className="text-[10px] font-bold text-slate-300 block">Ícone Escuro</span>
            </div>

            {/* Gold Icon */}
            <div className="p-3 rounded-2xl bg-[#0E0E0E] border border-[#222222] text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#FFF2C6] via-[#D4AF37] to-[#8C6214] border-2 border-white/40 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.4)]">
                <span className="font-serif font-black text-lg text-slate-950">N</span>
              </div>
              <span className="text-[10px] font-bold text-[#D4AF37] block">Ícone Dourado</span>
            </div>

            {/* Light Icon */}
            <div className="p-3 rounded-2xl bg-[#0E0E0E] border border-[#222222] text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F5F5F5] border-2 border-[#D4AF37] flex items-center justify-center shadow-lg">
                <span className="font-serif font-black text-lg text-slate-900">N</span>
              </div>
              <span className="text-[10px] font-bold text-slate-300 block">Ícone Claro</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom 4 Pilares do Nexoro Food System */}
      <div className="pt-6 border-t border-[#1A1A1A] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] flex items-center justify-center shrink-0">
            ⚡
          </div>
          <div>
            <span className="font-bold text-white block">Sistema Completo</span>
            <span className="text-[11px] text-slate-400">Pedidos • KDS • Gestão • Delivery</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#00C896]/10 text-[#00C896] flex items-center justify-center shrink-0">
            📱
          </div>
          <div>
            <span className="font-bold text-white block">Todos os Dispositivos</span>
            <span className="text-[11px] text-slate-400">Desktop • Tablet • Mobile • PWA</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            🔒
          </div>
          <div>
            <span className="font-bold text-white block">Seguro e Confiável</span>
            <span className="text-[11px] text-slate-400">Backups automáticos e RLS</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            🚀
          </div>
          <div>
            <span className="font-bold text-white block">Mais Vendas e Resultados</span>
            <span className="text-[11px] text-slate-400">Tecnologia que converte</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-[#151515] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
        <p>© 2025-2026 {BRAND_NAME}. Todos os direitos reservados.</p>
        <p className="font-medium text-slate-400">
          TokioInbox Multirestaurante • Versão 4.8 Pro
        </p>
      </div>
    </footer>
  );
};
