import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { getDecryptedCredentials } from '../services/supabase/accounts.repo.js';
import { getCachedCost, setCachedCost, buildCacheKey } from '../services/supabase/cost-cache.repo.js';
import { discoverResources, type ResourceType } from '../services/aws/services-discovery.service.js';

const CACHE_TTL = 15;

async function verifyAccountOwnership(accountId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('aws_accounts')
    .select('regions, id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Account not found or access denied');
  }
}

const validTypes = ['EC2', 'RDS', 'ECS', 'Lambda', 'S3', 'ElastiCache'] as const;

export async function servicesRoutes(fastify: FastifyInstance) {
  fastify.get('/api/services', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const query = z.object({
      accountId: z.string().uuid(),
      region: z.string().optional(),
      type: z.enum(validTypes).optional(),
      state: z.string().optional(),
    }).parse(request.query as any);

    try {
      await verifyAccountOwnership(query.accountId, user.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }

    const cacheKeyParts = ['services'];
    if (query.region) cacheKeyParts.push(query.region);
    if (query.type) cacheKeyParts.push(query.type);
    if (query.state) cacheKeyParts.push(query.state);
    const cacheKey = buildCacheKey(...cacheKeyParts);

    try {
      const cached = await getCachedCost(query.accountId, cacheKey);
      if (cached) return cached;

      const creds = await getDecryptedCredentials(query.accountId);
      const resources = await discoverResources(creds, query.accountId, {
        region: query.region,
        type: query.type as ResourceType | undefined,
        state: query.state,
      });

      const payload = {
        resources,
        total: resources.length,
        cachedAt: new Date().toISOString(),
      };

      await setCachedCost(query.accountId, cacheKey, payload, CACHE_TTL);
      return payload;
    } catch (err: any) {
      fastify.log.error({ accountId: query.accountId, route: 'services', err: err.message || err });
      return reply.status(500).send({ error: `Service discovery failed: ${err.message || 'Unknown error'}` });
    }
  });
}
