import { supabaseAdmin } from '../../config/supabase.js';

function getExpiresAt(ttlMinutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + ttlMinutes);
  return d.toISOString();
}

export async function getCachedCost<T = unknown>(
  accountId: string,
  cacheKey: string
): Promise<T | null> {
  const { data, error } = await supabaseAdmin
    .from('cost_cache')
    .select('data')
    .eq('account_id', accountId)
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return data.data as T;
}

export async function setCachedCost(
  accountId: string,
  cacheKey: string,
  data: unknown,
  ttlMinutes: number = 60
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('cost_cache')
    .upsert(
      {
        account_id: accountId,
        cache_key: cacheKey,
        data: JSON.parse(JSON.stringify(data)),
        expires_at: getExpiresAt(ttlMinutes),
      },
      {
        onConflict: 'account_id, cache_key',
        ignoreDuplicates: false,
      }
    );

  if (error) {
    console.error('Failed to set cost cache:', error);
  }
}

export async function invalidateCostCache(accountId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('cost_cache')
    .delete()
    .eq('account_id', accountId);

  if (error) {
    console.error('Failed to invalidate cost cache:', error);
  }
}

export function buildCacheKey(...parts: string[]): string {
  return parts.join(':');
}
