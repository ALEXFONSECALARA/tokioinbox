// ═══════════════════════════════════════════════════════════════════════
// Upload de imagens no Cloudinary — armazenamento permanente de fotos
// (logo, banner, splash, pratos, entregadores, e qualquer upload futuro).
// ═══════════════════════════════════════════════════════════════════════
//
// Por quê: o Render (plano free, e mesmo pagos sem disco persistente) tem
// disco EFÊMERO — qualquer arquivo salvo em server/data/uploads/ some no
// próximo redeploy/reinício. Isso já é um problema conhecido do projeto
// (documentado no render.yaml antes desta mudança). O Cloudinary resolve
// isso: a foto sobe pro Cloudinary uma vez e a URL HTTPS retornada é
// permanente, então o que fica salvo no Supabase/JSON é só essa URL —
// nunca um caminho de disco local.
//
// Chave secreta (CLOUDINARY_API_SECRET) só é usada AQUI, no backend. Nunca
// é enviada pro frontend, nunca aparece no bundle do Vite.
//
// Fallback: se as 3 variáveis não estiverem configuradas (dev local sem
// conta Cloudinary, por exemplo), `isCloudinaryConfigured()` retorna false
// e server/index.js volta a usar o armazenamento em disco local de sempre
// — mesmo padrão de fallback automático já usado pro Supabase neste
// projeto (ver server/lib/db.js). Nada quebra sem as variáveis definidas.

import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

export function isCloudinaryConfigured() {
  return !!(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true, // força URL https:// no retorno
  });
}

// Sobe uma imagem (buffer em memória, vinda do multer.memoryStorage()) pro
// Cloudinary, organizada numa pasta por restaurante — igual a estrutura de
// pastas que já existia em disco (server/data/uploads/<slug>/...), só que
// agora no Cloudinary em vez do disco local. Retorna a URL https permanente.
export function uploadImageBuffer(buffer, slug) {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary não configurado (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET ausentes).');
  }
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `tokioinbox/${slug}`,
        resource_type: 'image',
        // Sem transformação forçada aqui — mantém a imagem como o admin
        // enviou (o frontend já cuida de preview/aspecto no editor).
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}
