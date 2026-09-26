import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * Gera o QR Code 100% no navegador (biblioteca "qrcode"), sem depender de
 * nenhum serviço externo. Antes, o QR era montado como uma <img> apontando
 * para "api.qrserver.com" — se esse serviço de terceiros estivesse fora do
 * ar, bloqueado por firewall/rede da loja, ou lento, o QR simplesmente não
 * aparecia ("não gera"). Gerando localmente, o QR sempre aparece.
 */
export async function generateQrCodeDataUrl(url: string, size = 300): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    color: {
      // Preto sobre branco: máxima taxa de leitura em qualquer leitor de
      // QR/câmera de celular. Cores "temáticas" reduzem o contraste e podem
      // fazer o QR falhar ao ser escaneado.
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

interface QrCodeImageProps {
  url: string;
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Gera o QR Code 100% no navegador do usuário (biblioteca "qrcode"), sem
 * depender de nenhum serviço externo pela internet. Antes, o QR era montado
 * como uma <img> apontando para "api.qrserver.com" — se esse serviço de
 * terceiros estivesse fora do ar, bloqueado por firewall/rede da loja, ou
 * simplesmente lento, o QR Code da mesa/vitrine/cardápio simplesmente não
 * aparecia ("não gera"). Gerando localmente, o QR sempre aparece, mesmo sem
 * internet no momento da impressão.
 */
export const QrCodeImage: React.FC<QrCodeImageProps> = ({ url, size = 300, className, alt }) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setDataUrl(null);
      return;
    }
    setError(null);
    generateQrCodeDataUrl(url, size)
      .then((generated) => {
        if (!cancelled) setDataUrl(generated);
      })
      .catch((err) => {
        console.error('[QR] Falha ao gerar QR Code local:', err);
        if (!cancelled) setError('Não foi possível desenhar o QR Code.');
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (error) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        role="img"
        aria-label="Erro ao gerar QR Code"
      >
        <div className="w-full h-full flex items-center justify-center text-center text-xs text-rose-400 bg-black/30 rounded-xl p-2">
          {error}
        </div>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-busy="true"
        aria-label="Gerando QR Code..."
      >
        <div className="w-full h-full flex items-center justify-center animate-pulse bg-black/20 rounded-xl">
          <span className="text-[10px] text-slate-500 font-bold uppercase">Gerando QR...</span>
        </div>
      </div>
    );
  }

  return <img src={dataUrl} width={size} height={size} className={className} alt={alt || 'QR Code'} />;
};
