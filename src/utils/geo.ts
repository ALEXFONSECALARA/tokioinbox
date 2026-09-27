// V8 PRO PLUS: utilitários de geolocalização para "Entrega por Distância (KM)".
// Geocodificação via Nominatim (OpenStreetMap) — serviço público, gratuito,
// sem necessidade de chave de API. Se falhar (fora do ar, CEP não localizado
// etc.), o chamador deve cair de volta para a taxa de entrega fixa do
// restaurante — nunca travar o checkout por causa disso.

export interface LatLng {
  lat: number;
  lng: number;
}

/** Distância em linha reta (KM) entre duas coordenadas — fórmula de Haversine. */
export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371; // raio médio da Terra em km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

/**
 * Geocodifica um endereço em texto (rua, número, bairro, cidade, CEP) para
 * coordenadas lat/lng usando o Nominatim (OpenStreetMap). Retorna null em
 * qualquer falha — nunca lança exceção, para o checkout sempre poder cair
 * de volta para a taxa fixa.
 */
export async function geocodeAddress(query: string): Promise<LatLng | null> {
  if (!query || query.trim().length < 5) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export interface DeliveryZoneLike {
  id: string;
  name: string;
  maxRadiusKm: number;
  fee: number;
  estimatedMinutes?: string;
  minOrder?: number;
  active: boolean;
}

/** Encontra a menor faixa ativa cujo raio cobre a distância informada. */
export function findMatchingDeliveryZone(
  distanceKm: number,
  zones: DeliveryZoneLike[] | undefined
): DeliveryZoneLike | null {
  if (!zones || zones.length === 0) return null;
  const active = zones.filter((z) => z.active).sort((a, b) => a.maxRadiusKm - b.maxRadiusKm);
  return active.find((z) => distanceKm <= z.maxRadiusKm) || null;
}
