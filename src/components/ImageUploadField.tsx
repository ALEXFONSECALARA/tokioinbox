import React, { useId, useState } from 'react';
import { uploadImage } from '../utils/api';
import { Upload, Loader2, ImageOff } from 'lucide-react';

interface ImageUploadFieldProps {
  slug: string;
  token: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: 'square' | 'wide';
  mediaKind?: string;
  entityType?: string;
  entityId?: string;
  // Avisa o formulário-pai quando um upload está em andamento, pra ele poder
  // desabilitar o botão de Salvar enquanto isso — sem isso, clicar em Salvar
  // durante o envio da foto salvava o item com a foto ANTIGA (a nova só
  // chegava depois, e o clique em Salvar já tinha ignorado ela). Foi uma
  // causa real de "troquei a foto e não salvou" encontrada nesta rodada.
  onUploadingChange?: (uploading: boolean) => void;
}

// Campo de upload de foto local: mostra a prévia da imagem atual, um botão pra
// escolher um arquivo do computador do restaurante, e envia pro backend
// (POST /api/:slug/upload). Ao terminar, preenche `value` com a URL retornada.
export const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  slug,
  token,
  label,
  value,
  onChange,
  aspect = 'wide',
  mediaKind = 'other',
  entityType,
  entityId,
  onUploadingChange,
}) => {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;
    setError(null);

    // Validação no navegador ANTES de gastar uma requisição — feedback
    // imediato em vez de esperar a viagem até o servidor pra descobrir que
    // o arquivo é grande/tipo errado demais (o servidor também valida isso,
    // essa é só a camada rápida que evita o vai-e-volta).
    if (!/^image\//.test(file.type)) {
      setError('Envie um arquivo de imagem (jpg, png, webp, gif ou avif).');
      return;
    }
    const MAX_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setError(`Imagem muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). O limite é 8MB.`);
      return;
    }
    if (!token) {
      // Acontece se a sessão do admin expirou e o token some do estado —
      // sem isso a requisição ia falhar lá na frente com um 401 confuso.
      setError('Sua sessão expirou. Saia e faça login novamente antes de enviar fotos.');
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);
    try {
      const url = await uploadImage(slug, token, file, { kind: mediaKind, entityType, entityId, altText: label });
      if (!url) {
        throw new Error('O servidor não retornou a URL da imagem enviada.');
      }
      onChange(url);
    } catch (err: any) {
      console.error('Falha ao enviar imagem:', err);
      setError(err?.message || 'Não foi possível enviar a foto. Verifique sua conexão e tente novamente.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div>
      <label className="block font-bold text-stone-700 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        <div
          className={`relative shrink-0 rounded-xl bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center ${
            aspect === 'square' ? 'w-16 h-16' : 'w-24 h-14'
          }`}
        >
          {value ? (
            <img src={value} alt={label} className="w-full h-full object-cover" />
          ) : (
            <ImageOff className="w-5 h-5 text-stone-300" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* <label htmlFor=...> é mais confiável que onClick + ref.click()
              pra abrir o seletor de arquivo — funciona mesmo em navegadores/
              extensões que bloqueiam cliques disparados via JavaScript em
              inputs ocultos. O estado `uploading` desabilita visualmente e
              via pointer-events, já que <label> não tem atributo disabled. */}
          <label
            htmlFor={inputId}
            aria-disabled={uploading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-bold transition-colors select-none ${
              uploading ? 'opacity-50 pointer-events-none cursor-default' : 'hover:bg-stone-800 cursor-pointer'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Enviando...' : value ? 'Trocar foto' : 'Enviar foto do computador'}</span>
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
          {error && <p className="text-[11px] text-red-600 font-medium">⚠️ {error}</p>}
        </div>
      </div>
    </div>
  );
};
