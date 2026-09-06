// Armazenamento de imagens do TokioInbox.
// Prioridade: Supabase Storage (produção) -> Cloudinary (compatibilidade) -> disco local.
// O banco `media_assets` guarda o catálogo/metadata; o arquivo binário fica no storage.
import crypto from 'crypto';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { supabase, supabaseEnabled } from './supabaseClient.js';
import { isCloudinaryConfigured, uploadImageBuffer } from './cloudinary.js';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'restaurant-media';
const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function safeExt(originalname) {
  const ext = path.extname(originalname || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return /^\.(jpg|jpeg|png|webp|gif|avif)$/.test(ext) ? ext : '.jpg';
}

function safeSlug(slug) {
  return String(slug || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

export function mediaBucketName() {
  return BUCKET;
}

export function mediaStorageMode() {
  if (supabaseEnabled) return 'supabase';
  if (isCloudinaryConfigured()) return 'cloudinary';
  return 'local';
}

async function saveLocal(file, slug) {
  const safe = safeSlug(slug);
  const dir = path.join(UPLOADS_DIR, safe);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt(file.originalname)}`;
  await writeFile(path.join(dir, filename), file.buffer);
  return {
    provider: 'local',
    bucket: null,
    path: `${safe}/${filename}`,
    urlPath: `/uploads/${safe}/${filename}`,
  };
}

async function saveSupabase(file, slug) {
  const safe = safeSlug(slug);
  const ext = safeExt(file.originalname);
  const filename = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${ext}`;
  const storagePath = `${safe}/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return {
    provider: 'supabase',
    bucket: BUCKET,
    path: storagePath,
    urlPath: data.publicUrl,
  };
}

export async function saveImage(file, slug) {
  // Com Supabase configurado, o Storage passa a ser a fonte principal e
  // sobrevive a deploy/restart do Render. Cloudinary continua disponível
  // como fallback de compatibilidade quando não há Supabase.
  if (supabaseEnabled) {
    try {
      return await saveSupabase(file, slug);
    } catch (err) {
      console.error(`Supabase Storage falhou para ${slug}:`, err?.message || err);
      if (isCloudinaryConfigured()) {
        try {
          return {
            provider: 'cloudinary',
            bucket: null,
            path: null,
            urlPath: await uploadImageBuffer(file.buffer, slug),
          };
        } catch (cloudErr) {
          console.error(`Cloudinary também falhou para ${slug}:`, cloudErr?.message || cloudErr);
        }
      }
      // Se Supabase estiver configurado, não mascaramos uma falha de storage
      // gravando no disco efêmero do Render. É melhor retornar erro e pedir
      // retry do que confirmar ao admin uma foto que desaparecerá no deploy.
      throw err;
    }
  }

  if (isCloudinaryConfigured()) {
    try {
      return {
        provider: 'cloudinary',
        bucket: null,
        path: null,
        urlPath: await uploadImageBuffer(file.buffer, slug),
      };
    } catch (err) {
      console.error(`Cloudinary falhou para ${slug}:`, err?.message || err);
    }
  }

  return saveLocal(file, slug);
}

export async function removeStoredImage(asset) {
  if (!asset) return;
  if (asset.provider === 'supabase' && supabaseEnabled && asset.bucket && asset.path) {
    const { error } = await supabase.storage.from(asset.bucket).remove([asset.path]);
    if (error) throw error;
  }
  // Cloudinary/local antigos não são removidos automaticamente nesta primeira
  // versão para evitar apagar uma foto que ainda esteja referenciada por config/menu.
}
