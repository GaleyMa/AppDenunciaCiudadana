-- ============================================================================
-- Incremento 3 — Adjuntar foto también a reportes ya validados
--
-- La primera versión de adjuntar_foto() exigía que el reporte siguiera
-- pendiente. Eso dejaba sin imagen para siempre a los que se moderaron antes
-- de que la subida de fotos existiera: el dispositivo todavía tiene el archivo,
-- pero el servidor lo rechazaba.
--
-- Se admite ahora también 'validado'. Sigue sin poder REEMPLAZAR una foto ya
-- adjunta (la condición foto_ruta is null no se toca) y sigue haciendo falta
-- conocer el UUID del reporte, que es aleatorio y no se publica.
-- Los descartados y fusionados se quedan fuera: ya no se van a revisar.
-- ============================================================================

create or replace function public.adjuntar_foto(p_id uuid, p_foto_ruta text)
returns boolean
language plpgsql
security definer
set search_path = privado, public, pg_temp
as $fn$
declare
    v_actualizados integer;
begin
    if p_foto_ruta is null or btrim(p_foto_ruta) = '' then
        raise exception 'Falta la ruta de la foto.';
    end if;

    update privado.reportes
       set foto_ruta = btrim(p_foto_ruta)
     where id = p_id
       and foto_ruta is null
       and estado in ('pendiente', 'validado');

    get diagnostics v_actualizados = row_count;
    return v_actualizados > 0;
end;
$fn$;
