import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../config/supabase.js';
import { getDecryptedCredentials } from '../services/supabase/accounts.repo.js';
import { getCachedCost, setCachedCost, buildCacheKey } from '../services/supabase/cost-cache.repo.js';
import {
  getCostSummary,
  getDailyTrends,
  getServiceBreakdown,
  getTopServices,
  getCredits,
  getDailyCredits,
} from '../services/aws/cost-explorer.service.js';
import { z } from 'zod';

const CACHE_TTL = 60;

async function verifyAccountOwnership(accountId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('aws_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Account not found or access denied');
  }
}

export async function costsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/costs/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.query as any);

    try {
      await verifyAccountOwnership(accountId, user.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }

    const cacheKey = buildCacheKey('summary', new Date().toISOString().slice(0, 7));

    try {
      const cached = await getCachedCost(accountId, cacheKey);
      if (cached) return cached;

      const creds = await getDecryptedCredentials(accountId);
      const data = await getCostSummary(creds);
      await setCachedCost(accountId, cacheKey, data, CACHE_TTL);
      return data;
    } catch (err: any) {
      fastify.log.error({ accountId, route: 'summary', err: err.message || err });
      return reply.status(500).send({ error: `Cost summary failed: ${err.message || 'Unknown error'}` });
    }
  });

  fastify.get('/api/costs/trends', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const query = z.object({
      accountId: z.string().uuid(),
      days: z.coerce.number().int().min(1).max(365).default(30),
    }).parse(request.query as any);

    try {
      await verifyAccountOwnership(query.accountId, user.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }

    const cacheKey = buildCacheKey('trends', String(query.days), new Date().toISOString().slice(0, 10));

    try {
      const cached = await getCachedCost(query.accountId, cacheKey);
      if (cached) return cached;

      const creds = await getDecryptedCredentials(query.accountId);
      const data = await getDailyTrends(creds, query.days);
      await setCachedCost(query.accountId, cacheKey, data, CACHE_TTL);
      return data;
    } catch (err: any) {
      fastify.log.error({ accountId: query.accountId, route: 'trends', err: err.message || err });
      return reply.status(500).send({ error: `Cost trends failed: ${err.message || 'Unknown error'}` });
    }
  });

  fastify.get('/api/costs/breakdown', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { accountId } = z.object({ accountId: z.string().uuid() }).parse(request.query as any);

    try {
      await verifyAccountOwnership(accountId, user.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }

    const cacheKey = buildCacheKey('breakdown', new Date().toISOString().slice(0, 7));

    try {
      const cached = await getCachedCost(accountId, cacheKey);
      if (cached) return cached;

      const creds = await getDecryptedCredentials(accountId);
      const data = await getServiceBreakdown(creds);
      await setCachedCost(accountId, cacheKey, data, CACHE_TTL);
      return data;
    } catch (err: any) {
      fastify.log.error({ accountId, route: 'breakdown', err: err.message || err });
      return reply.status(500).send({ error: `Cost breakdown failed: ${err.message || 'Unknown error'}` });
    }
  });

  fastify.get('/api/costs/credits', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const query = z.object({
      accountId: z.string().uuid(),
      days: z.coerce.number().int().min(1).max(365).optional(),
    }).parse(request.query as any);

    try {
      await verifyAccountOwnership(query.accountId, user.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }

    const cacheKeyParts = ['credits_v2'];
    if (query.days) cacheKeyParts.push(String(query.days));
    const cacheKey = buildCacheKey(...cacheKeyParts);

    try {
      const cached = await getCachedCost(query.accountId, cacheKey);
      if (cached) return cached;

      const creds = await getDecryptedCredentials(query.accountId);
      const summary = await getCredits(creds);
      let dailyCredits: { date: string; amount: number }[] = [];
      if (query.days) {
        dailyCredits = await getDailyCredits(creds, query.days);
      }

      const payload = { ...summary, dailyCredits };
      await setCachedCost(query.accountId, cacheKey, payload, CACHE_TTL);
      return payload;
    } catch (err: any) {
      fastify.log.error({ accountId: query.accountId, route: 'credits', err: err.message || err });
      return reply.status(500).send({ error: `Credits fetch failed: ${err.message || 'Unknown error'}` });
    }
  });

  fastify.get('/api/costs/top-services', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const query = z.object({
      accountId: z.string().uuid(),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }).parse(request.query as any);

    try {
      await verifyAccountOwnership(query.accountId, user.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }

    const cacheKey = buildCacheKey('top-services', String(query.limit), new Date().toISOString().slice(0, 7));

    try {
      const cached = await getCachedCost(query.accountId, cacheKey);
      if (cached) return cached;

      const creds = await getDecryptedCredentials(query.accountId);
      const data = await getTopServices(creds, query.limit);
      await setCachedCost(query.accountId, cacheKey, data, CACHE_TTL);
      return data;
    } catch (err: any) {
      fastify.log.error({ accountId: query.accountId, route: 'top-services', err: err.message || err });
      return reply.status(500).send({ error: `Top services failed: ${err.message || 'Unknown error'}` });
    }
  });
}
