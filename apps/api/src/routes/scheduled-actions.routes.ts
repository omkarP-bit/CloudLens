import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';

async function verifyAccountOwnership(accountId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('aws_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) throw new Error('Account not found or access denied');
}

export async function scheduledActionsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/scheduled-actions', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    try {
      const { data, error } = await supabaseAdmin
        .from('scheduled_actions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (err: any) {
      fastify.log.error({ route: 'list-scheduled-actions', err: err.message || err });
      return reply.status(500).send({ error: `Failed to list scheduled actions: ${err.message || 'Unknown error'}` });
    }
  });

  fastify.post('/api/scheduled-actions', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const body = z.object({
      account_id: z.string().uuid(),
      name: z.string().min(1),
      resource_type: z.enum(['EC2', 'RDS', 'ECS', 'Lambda']),
      resource_id: z.string().min(1),
      action: z.enum(['STOP', 'START', 'TERMINATE', 'REBOOT']),
      cron_expression: z.string().min(1),
      timezone: z.string().default('UTC'),
    }).parse(request.body);

    try {
      await verifyAccountOwnership(body.account_id, user.id);

      const { data, error } = await supabaseAdmin
        .from('scheduled_actions')
        .insert({
          user_id: user.id,
          account_id: body.account_id,
          name: body.name,
          resource_type: body.resource_type,
          resource_id: body.resource_id,
          action: body.action,
          cron_expression: body.cron_expression,
          timezone: body.timezone,
        })
        .select()
        .single();
      if (error) throw error;
      return reply.status(201).send(data);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Validation failed', details: err.format() });
      }
      fastify.log.error({ route: 'create-scheduled-action', err: err.message || err });
      return reply.status(500).send({ error: `Failed to create scheduled action: ${err.message || 'Unknown error'}` });
    }
  });

  fastify.patch('/api/scheduled-actions/:id/toggle', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    try {
      const { data: existing } = await supabaseAdmin
        .from('scheduled_actions')
        .select('enabled')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (!existing) {
        return reply.status(404).send({ error: 'Scheduled action not found' });
      }

      const { data, error } = await supabaseAdmin
        .from('scheduled_actions')
        .update({ enabled: !existing.enabled })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err: any) {
      fastify.log.error({ route: 'toggle-scheduled-action', id, err: err.message || err });
      return reply.status(500).send({ error: `Failed to toggle scheduled action: ${err.message || 'Unknown error'}` });
    }
  });

  fastify.delete('/api/scheduled-actions/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { id } = request.params as { id: string };

    try {
      const { error } = await supabaseAdmin
        .from('scheduled_actions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      return reply.status(204).send();
    } catch (err: any) {
      fastify.log.error({ route: 'delete-scheduled-action', id, err: err.message || err });
      return reply.status(500).send({ error: `Failed to delete scheduled action: ${err.message || 'Unknown error'}` });
    }
  });
}
