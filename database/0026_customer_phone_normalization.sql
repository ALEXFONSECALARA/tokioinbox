-- TokioInbox v27 — normaliza telefones de clientes para login consistente.
-- Mantém somente dígitos; a API aceita entradas com máscara e com/sem 55.
update customers set phone = regexp_replace(phone, '\D', '', 'g') where phone is not null;

-- Detecta duplicidade antes de reforçar unicidade. Se houver números duplicados
-- após a normalização, a migration falha de propósito para evitar escolher uma
-- conta arbitrariamente. Resolva os duplicados no banco e rode novamente.
do $$
begin
  if exists (
    select 1 from customers group by phone having count(*) > 1
  ) then
    raise exception 'Existem clientes com telefones duplicados após normalização; resolva os duplicados antes de continuar.';
  end if;
end $$;

create unique index if not exists customers_phone_normalized_uidx on customers(phone);
