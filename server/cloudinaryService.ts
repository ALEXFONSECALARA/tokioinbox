import crypto from 'crypto';

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  format?: string;
  bytes?: number;
  error?: string;
}

export function isCloudinaryConfigured(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  return Boolean(cloudName && apiKey && apiSecret);
}

export function getCloudinaryCloudName(): string | null {
  return process.env.CLOUDINARY_CLOUD_NAME || null;
}

/**
 * Uploads an image (base64 string or remote image URL) directly to Cloudinary using their REST API.
 * Securely signs the payload using CLOUDINARY_API_SECRET on the server.
 */
export async function uploadImageToCloudinary(options: {
  fileData: string; // data:image/jpeg;base64,... or https://...
  folder?: string;
  tags?: string[];
}): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      success: false,
      error: 'Cloudinary não está configurado no servidor (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ou CLOUDINARY_API_SECRET ausente).',
    };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = options.folder || 'tokioinbox_uploads';

  // Cloudinary signature parameters must be sorted alphabetically:
  // "folder=...&timestamp=..."
  const paramsToSign: Record<string, string> = {
    folder,
    timestamp: timestamp.toString(),
  };

  const sortedKeys = Object.keys(paramsToSign).sort();
  const serializedParams = sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join('&');
  const stringToSign = `${serializedParams}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

  try {
    const formData = new URLSearchParams();
    formData.append('file', options.fileData);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      return {
        success: false,
        error: result.error?.message || `Erro no Cloudinary HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      url: result.secure_url || result.url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Falha ao conectar com o serviço Cloudinary',
    };
  }
}
