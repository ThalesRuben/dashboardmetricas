-- Reconhece o formato efetivamente usado no atendimento:
-- "Agendado [serviço] dia [data] às [hora] com [profissional]".
-- Perguntas, ofertas e políticas continuam excluídas.
create or replace function public.classificar_agendamento_whatsapp(p_texto text)
returns text
language plpgsql immutable
set search_path = public
as $$
declare
  v_texto text := regexp_replace(translate(lower(coalesce(p_texto, '')),
    'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[*_~`]', '', 'g');
  v_parte text[];
  v_frase text;
  v_evento text := null;
begin
  for v_parte in select regexp_matches(v_texto, '([^.!?\n]+)([.!?\n]|$)', 'g') loop
    if v_parte[2] = '?' then continue; end if;
    v_frase := regexp_replace(btrim(v_parte[1]), '^[^a-z0-9]+', '');

    if v_frase ~ '(\m(nao|nunca|nem)\M.{0,50}\m(agendei|reservei|marquei|confirmei|agendad[oa]|confirmad[oa]|reservad[oa]|marcad[oa]|cancelad[oa]|desmarcad[oa]|cancelei|desmarquei)\M|\m(se|caso|quando|apos|mediante|somente|apenas|ideal|pretende|pretendo|gostaria|poderia|podera|sera|seria|ficara|ficaria|posso|podemos|preciso|precisamos|quero|vamos)\M|\m(para|pra)\M\s+\m(confirmar|agendar|reservar|marcar)\M)' then
      continue;
    end if;

    if v_frase ~ '(\m(agendamento|horario|reserva|vaga)\M\s+(ja\s+)?(esta|foi|ficou|segue|permanece|ta)\M\s+(ja\s+)?(cancelad[oa]|desmarcad[oa])\M|^(?:(?:seu|sua|o|a)\s+)?(agendamento|horario|reserva|vaga)\s+(cancelad[oa]|desmarcad[oa])\M|\m(cancelei|desmarquei|cancelamos|desmarcamos)\M.{0,45}\m(agendamento|horario|reserva|vaga)\M)' then
      v_evento := 'cancelamento';
      continue;
    end if;

    -- O texto pode começar pelo resultado sem a palavra "horário":
    -- "Agendado corte...", "Remarcado para o dia..." ou "Agendado!".
    if v_frase ~ '^(?:(?:ok|certo|pronto)\s*,?\s*)?(?:(?:foi|ficou|esta|ja esta)\s+)?(agendad[oa]|remarcad[oa]|reagendad[oa])\M' then
      v_evento := 'confirmacao';
      continue;
    end if;

    if v_frase ~ '(\m(agendamento|horario|reserva|vaga)\M\s+(ja\s+)?(esta|foi|ficou|segue|permanece|ta)\M\s+(ja\s+)?(confirmad[oa]|agendad[oa]|reservad[oa]|marcad[oa])\M|^(?:(?:seu|sua|o|a)\s+)?(agendamento|horario|reserva|vaga)\s+(confirmad[oa]|agendad[oa]|reservad[oa]|marcad[oa])\M|\m(agendei|reservei|marquei|confirmei|agendamos|reservamos|marcamos|confirmamos)\M.{0,60}\m(voce|seu|sua|para|pra)\M|\m(ficou|deixei|deixamos)\M\s+(tudo\s+)?(agendad[oa]|reservad[oa]|marcad[oa])\M)' then
      v_evento := 'confirmacao';
    end if;
  end loop;
  return v_evento;
end;
$$;

revoke all on function public.classificar_agendamento_whatsapp(text) from public, anon;
grant execute on function public.classificar_agendamento_whatsapp(text) to authenticated, service_role;
notify pgrst, 'reload schema';
