import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { FunctionsResponse } from '@supabase/functions-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const internalApiKey = import.meta.env.VITE_INTERNAL_API_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas. ' +
      'Copie .env.example → .env.local e preencha (ou use VITE_DATA_SOURCE=mock).',
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');

/**
 * Invoca uma Edge Function passando o x-internal-key quando configurado.
 */
export async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown> = {},
): Promise<FunctionsResponse<T>> {
  const headers = internalApiKey ? { 'x-internal-key': internalApiKey } : undefined;
  return supabase.functions.invoke<T>(name, { body, headers });
}
