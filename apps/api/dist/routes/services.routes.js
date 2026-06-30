import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { getDecryptedCredentials } from '../services/supabase/accounts.repo.js';
import { getCachedCost, setCachedCost, buildCacheKey } from '../services/supabase/cost-cache.repo.js';
import { discoverResources } from '../services/aws/services-discovery.service.js';
const CACHE_TTL = 15;
async function verifyAccountOwnership(accountId, userId) {
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
const validTypes = ['EC2', 'RDS', 'ECS', 'Lambda', 'S3', 'ElastiCache'];
export async function servicesRoutes(fastify) {
    fastify.get('/api/services', async (request, reply) => {
        const user = request.user;
        const query = z.object({
            accountId: z.string().uuid(),
            region: z.string().optional(),
            type: z.enum(validTypes).optional(),
            state: z.string().optional(),
        }).parse(request.query);
        try {
            await verifyAccountOwnership(query.accountId, user.id);
        }
        catch (err) {
            return reply.status(404).send({ error: err.message });
        }
        const cacheKeyParts = ['services'];
        if (query.region)
            cacheKeyParts.push(query.region);
        if (query.type)
            cacheKeyParts.push(query.type);
        if (query.state)
            cacheKeyParts.push(query.state);
        const cacheKey = buildCacheKey(...cacheKeyParts);
        try {
            const cached = await getCachedCost(query.accountId, cacheKey);
            if (cached)
                return cached;
            const creds = await getDecryptedCredentials(query.accountId);
            const resources = await discoverResources(creds, query.accountId, {
                region: query.region,
                type: query.type,
                state: query.state,
            });
            const payload = {
                resources,
                total: resources.length,
                cachedAt: new Date().toISOString(),
            };
            await setCachedCost(query.accountId, cacheKey, payload, CACHE_TTL);
            return payload;
        }
        catch (err) {
            fastify.log.error({ accountId: query.accountId, route: 'services', err: err.message || err });
            return reply.status(500).send({ error: `Service discovery failed: ${err.message || 'Unknown error'}` });
        }
    });
}
