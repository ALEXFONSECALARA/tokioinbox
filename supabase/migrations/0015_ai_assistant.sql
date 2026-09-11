-- ═══════════════════════════════════════════════════════════════════════
-- TokioInbox — Fase 4: IA de atendimento + histórico (itens 32-40)
-- ═══════════════════════════════════════════════════════════════════════
-- Uma conversa por sessão de atendimento. session_id identifica o
-- navegador do visitante sem conta (gerado no frontend, guardado no
-- localStorage); customer_id preenchido quando o cliente está logado —
-- os dois nunca são obrigatórios ao mesmo tempo, mas pelo menos um deve
-- existir pra conseguirmos retomar a conversa depois.
--
-- status: 'bot' (IA responde normalmente) | 'human' (transferido pro
-- atendente, item 38 — a IA para de responder automaticamente) | 'closed'.
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  restaurant_slug text not null references restaurants(slug) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  session_id text,
  status text not null default 'bot',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null, -- 'user' | 'assistant' | 'human_agent'
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_restaurant_idx on ai_conversations (restaurant_slug);
create index if not exists ai_conversations_session_idx on ai_conversations (session_id);
create index if not exists ai_conversations_customer_idx on ai_conversations (customer_id);
create index if not exists ai_messages_conversation_idx on ai_messages (conversation_id);

comment on table ai_conversations is
  'Conversas do assistente de atendimento (Fase 4, itens 32-39). status=human = aguardando atendente humano.';
comment on column ai_messages.role is
  '''user'' (cliente), ''assistant'' (IA) ou ''human_agent'' (atendente humano assumiu, item 38).';
