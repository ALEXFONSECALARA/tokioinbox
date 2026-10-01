import { DEFAULT_SYSTEM_SETTINGS, SystemSettings } from '../src/types/restaurant';
import { getDoc } from './stateService';

/**
 * Lê as configurações globais (documento `systemSettings`, editado em
 * Ferramentas > Configurações do sistema) já mescladas com os padrões.
 * É o que permite ao SERVIDOR respeitar, na hora de enviar um pedido,
 * os botões de liga/desliga (impressão por setor, envio automático, 10%).
 */
export function getSystemSettings(): SystemSettings {
  let raw: Partial<SystemSettings> = {};
  try {
    const v = getDoc('systemSettings')?.value;
    if (v && typeof v === 'object') raw = v as Partial<SystemSettings>;
  } catch {
    /* sem documento salvo: usa os padrões */
  }
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...raw,
    stationPrint: { ...DEFAULT_SYSTEM_SETTINGS.stationPrint, ...(raw.stationPrint || {}) },
  };
}
