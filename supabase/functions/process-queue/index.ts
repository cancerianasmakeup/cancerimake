// Edge Function: process-queue
// Corre cada 30 segundos vía Supabase Cron Jobs.
// Expira locks vencidos y avanza la fila de espera.
//
// Configurar el cron desde Supabase Dashboard → Database → Cron:
//   SELECT cron.schedule(
//     'process-live-queue',
//     '*/30 * * * * *',  -- cada 30 segundos
//     $$ SELECT net.http_post(
//       url := 'https://TU_PROYECTO.supabase.co/functions/v1/process-queue',
//       headers := jsonb_build_object('Authorization', 'Bearer SUPABASE_SERVICE_ROLE_KEY')
//     ); $$
//   );

import { corsHeaders, getSupabaseAdmin, jsonResponse } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("expire_old_locks");

    if (error) {
      console.error("[process-queue] error:", error);
      return jsonResponse({ ok: false, error: error.message }, 500);
    }

    console.log(`[process-queue] expired ${data} locks`);
    return jsonResponse({ ok: true, expired: data });

  } catch (error: any) {
    console.error("[process-queue] error:", error);
    return jsonResponse({ ok: false, error: error.message }, 500);
  }
});
