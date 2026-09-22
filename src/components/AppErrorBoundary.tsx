import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Rede de segurança contra "tela em branco" (principalmente notado no Safari/iOS).
 * Sem isso, qualquer erro de renderização em qualquer tela (ex.: checkout, rastreio de
 * pedido) derruba o app inteiro para uma tela branca sem nenhuma mensagem, obrigando o
 * cliente a fechar e abrir o app de novo — perdendo, na prática, o acompanhamento do pedido.
 * Com o boundary, mostramos uma tela de recuperação amigável e um botão para recarregar.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Mantém rastro no console para diagnóstico; não impede o app de se recuperar.
    console.error('[APP ERROR BOUNDARY]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-matte-black text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-base font-black text-white">Ops, algo deu errado</h1>
              <p className="text-xs text-slate-400 mt-1">
                Não perca seu pedido: toque abaixo para recarregar. Se você já finalizou um
                pedido, ele continua registrado no restaurante normalmente.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
