// Decide se uma campanha/notificação agendada deve disparar "agora" (Fase 4,
// itens 29-30). Função pura de propósito — sem I/O, sem depender de banco ou
// rede — pra dar pra testar isoladamente com datas fixas, sem precisar
// esperar o relógio de verdade rodar.
function pad2(n) {
  return String(n).padStart(2, '0');
}

// Identifica a janela (dia + hora:minuto) em que estamos agora. Evita
// disparo duplicado se o agendador rodar mais de uma vez dentro do mesmo
// minuto, ou se o servidor reiniciar logo depois de já ter enviado.
export function currentWindowKey(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export function isCampaignDueNow(campaign, now = new Date()) {
  if (!campaign.active) return false;
  const schedule = campaign.schedule || {};
  const window = currentWindowKey(now);
  if (campaign.lastSentWindow === window) return false; // já disparou nesta janela exata

  // Disparo único agendado (item 29: "enviar agora" ou "agendar" uma data/hora).
  if (schedule.sendAt) {
    if (campaign.lastSentAt) return false; // "uma vez" — nunca mais depois de já ter enviado
    const target = new Date(schedule.sendAt);
    if (Number.isNaN(target.getTime())) return false;
    // <= agora cobre o caso do servidor ter ficado fora do ar exatamente
    // no minuto agendado — dispara assim que voltar, em vez de perder o envio.
    return target.getTime() <= now.getTime();
  }

  // Campanha recorrente (item 30: diário / semanal com dias específicos / mensal).
  if (!schedule.time) return false;
  const [h, m] = String(schedule.time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  if (now.getHours() !== h || now.getMinutes() !== m) return false;

  if (schedule.repeat === 'daily') return true;
  if (schedule.repeat === 'weekly') {
    const days = Array.isArray(schedule.days) ? schedule.days : [];
    return days.includes(now.getDay()); // 0=domingo … 6=sábado
  }
  if (schedule.repeat === 'monthly') {
    return now.getDate() === Number(schedule.dayOfMonth);
  }
  return false;
}
