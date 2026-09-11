-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: motor de cálculo de entrega (itens 9-13)
-- ═══════════════════════════════════════════════════════════════════════
-- Tudo aditivo e opcional: sem essas colunas preenchidas, o restaurante
-- continua exatamente no método por bairro de sempre (delivery_zones já
-- existente desde a Fase 2). Nenhuma coluna existente é alterada.
-- ═══════════════════════════════════════════════════════════════════════

alter table restaurant_configs
  add column if not exists restaurant_location jsonb,
  add column if not exists delivery_calc_method text,
  add column if not exists delivery_hybrid_priority jsonb,
  add column if not exists cep_ranges jsonb not null default '[]'::jsonb,
  add column if not exists distance_tiers jsonb not null default '[]'::jsonb,
  add column if not exists delivery_formula jsonb,
  add column if not exists max_delivery_radius_km numeric;

comment on column restaurant_configs.restaurant_location is
  'Endereço + lat/lng do próprio restaurante, origem do cálculo por distância. {cep,street,number,neighborhood,city,state,lat,lng}';
comment on column restaurant_configs.delivery_calc_method is
  'neighborhood (padrão/ausente) | cep | distance | formula | hybrid — ver src/utils/helpers.ts calculateDeliveryFee()';
comment on column restaurant_configs.delivery_hybrid_priority is
  'Ordem de métodos tentados quando delivery_calc_method=hybrid, ex: ["cep","neighborhood","distance"]';
comment on column restaurant_configs.cep_ranges is
  'Método CEP: [{id,cepStart,cepEnd,fee,estimatedMinutes,active}]';
comment on column restaurant_configs.distance_tiers is
  'Método distância: [{id,fromKm,toKm,fee,prepMinutes,deliveryMinutes,active}]';
comment on column restaurant_configs.delivery_formula is
  'Método fórmula: {baseFee,includedKm,extraFeePerKm}';
comment on column restaurant_configs.max_delivery_radius_km is
  'Raio máximo de entrega — além dele, endereço é recusado em vez de usar a primeira zona cadastrada como fallback.';
