import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { getDecryptedCredentials } from '../services/supabase/accounts.repo.js';
import { executeAction, type ResourceType, type ActionType } from '../services/aws/controls.service.js';
import { insertAuditLog } from '../services/supabase/audit.repo.js';
import { evaluateAction } from '../services/compliance/policy-engine.service.js';

async function verifyAccountOwnership(accountId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('aws_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Account not found or access denied');
}

const actionBodySchema = z.object({
  action: z.enum(['STOP', 'START', 'TERMINATE', 'REBOOT']),
  accountId: z.string().uuid(),
  region: z.string().min(1),
});

const validResourceTypes = ['EC2', 'RDS', 'ECS', 'Lambda'] as const;

export async function controlsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const query = z.object({
      accountId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    }).parse(request.query as any);

    try {
      let dbQuery = supabaseAdmin
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(query.offset, query.offset + query.limit - 1);

      if (query.accountId) {
        dbQuery = dbQuery.eq('account_id', query.accountId);
      }

      const { data, error, count } = await dbQuery;
      if (error) throw error;
      return { logs: data, total: count, offset: query.offset, limit: query.limit };
    } catch (err: any) {
      fastify.log.error({ route: 'audit-logs', err: err.message || err });
      return reply.status(500).send({ error: `Failed to fetch audit logs: ${err.message || 'Unknown error'}` });
    }
  });
  fastify.post('/api/controls/:resourceType/:resourceId/action', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { resourceType, resourceId } = request.params as { resourceType: string; resourceId: string };

    if (!validResourceTypes.includes(resourceType as any)) {
      return reply.status(400).send({ error: `Unsupported resource type: ${resourceType}` });
    }

    const body = actionBodySchema.parse(request.body);

    try {
      await verifyAccountOwnership(body.accountId, user.id);
    } catch (err: any) {
      return reply.status(404).send({ error: err.message });
    }

    try {
      const creds = await getDecryptedCredentials(body.accountId);

      const policy = await evaluateAction(user.id, body.accountId, resourceType, resourceId, body.action, body.region);

      if (policy.result === 'DENY') {
        await insertAuditLog(supabaseAdmin, {
          user_id: user.id,
          account_id: body.accountId,
          action: `${resourceType}:${body.action}`,
          resource_type: resourceType,
          resource_id: resourceId,
          region: body.region,
          policy_result: 'DENY',
          policy_reason: policy.reason,
          request_ip: request.ip,
          user_agent: request.headers['user-agent'],
        });
        return reply.status(403).send({ error: 'Action denied by compliance policy', reason: policy.reason });
      }

      const result = await executeAction(creds, resourceType as ResourceType, resourceId, body.action as ActionType, body.region);

      await insertAuditLog(supabaseAdmin, {
        user_id: user.id,
        account_id: body.accountId,
        action: `${resourceType}:${body.action}`,
        resource_type: resourceType,
        resource_id: resourceId,
        region: body.region,
        policy_result: policy.result,
        policy_reason: policy.result === 'ALLOW' ? undefined : policy.reason,
        request_ip: request.ip,
        user_agent: request.headers['user-agent'],
        metadata: { success: result.success, message: result.message },
      });

      return result;
    } catch (err: any) {
      fastify.log.error({ resourceType, resourceId, action: body.action, err: err.message || err });
      return reply.status(500).send({ error: `Action failed: ${err.message || 'Unknown error'}` });
    }
  });
}
