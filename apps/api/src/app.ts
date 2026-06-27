import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { supabaseAuthMiddleware } from './middleware/supabase-auth.middleware.js';
import {
  saveAccount,
  listAccounts,
  deleteAccount,
  getDecryptedCredentials,
  updateAccountStatus,
  rotateCredentials,
} from './services/supabase/accounts.repo.js';
import { validateAWSCredentials } from './services/aws/sts.service.js';
import { z } from 'zod';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

fastify.get('/health', async () => {
  return { status: 'OK' };
});

fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.startsWith('/api/')) {
    try {
      await supabaseAuthMiddleware(request, reply);
    } catch (err: any) {
      return reply.status(401).send({ error: err.message || 'Unauthorized' });
    }
  }
});

const saveAccountSchema = z.object({
  alias: z.string().min(1),
  awsAccountId: z.string().min(12).max(12),
  roleArn: z.string().min(1),
  credentialType: z.enum(['iam_user', 'sts_assume_role', 'sts_session']),
  regions: z.array(z.string()).default([]),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  sessionToken: z.string().optional(),
});

const rotateCredsSchema = z.object({
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  sessionToken: z.string().optional(),
});

fastify.get('/api/accounts', async (request, reply) => {
  const user = (request as any).user;
  try {
    const list = await listAccounts(user.id);
    return list;
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to retrieve accounts' });
  }
});

fastify.post('/api/accounts', async (request, reply) => {
  const user = (request as any).user;
  try {
    const body = saveAccountSchema.parse(request.body);
    const account = await saveAccount(
      user.id,
      body.alias,
      body.awsAccountId,
      body.roleArn,
      body.credentialType,
      body.regions,
      {
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
        sessionToken: body.sessionToken,
      }
    );
    const {
      encrypted_access_key_id,
      encrypted_secret_access_key,
      encrypted_session_token,
      encrypted_dek,
      ...safeAccount
    } = account;
    return safeAccount;
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation failed', details: err.format() });
    }
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message || 'Failed to save account' });
  }
});

fastify.delete('/api/accounts/:id', async (request, reply) => {
  const user = (request as any).user;
  const { id } = request.params as { id: string };
  try {
    const deleted = await deleteAccount(user.id, id);
    const {
      encrypted_access_key_id,
      encrypted_secret_access_key,
      encrypted_session_token,
      encrypted_dek,
      ...safeAccount
    } = deleted;
    return safeAccount;
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to delete account' });
  }
});

fastify.post('/api/accounts/:id/validate', async (request, reply) => {
  const { id } = request.params as { id: string };

  try {
    const creds = await getDecryptedCredentials(id);
    await validateAWSCredentials(creds);
    const updated = await updateAccountStatus(id, 'active', new Date());
    const {
      encrypted_access_key_id,
      encrypted_secret_access_key,
      encrypted_session_token,
      encrypted_dek,
      ...safeAccount
    } = updated;

    return { success: true, account: safeAccount };
  } catch (err: any) {
    fastify.log.error(err);
    try {
      await updateAccountStatus(id, 'invalid', new Date());
    } catch (dbErr) {
      fastify.log.error('Failed to update invalid status:', dbErr);
    }
    return reply.status(400).send({ error: err.message || 'Validation failed' });
  }
});

fastify.patch('/api/accounts/:id/credentials', async (request, reply) => {
  const user = (request as any).user;
  const { id } = request.params as { id: string };

  try {
    const body = rotateCredsSchema.parse(request.body);
    const updated = await rotateCredentials(user.id, id, {
      accessKeyId: body.accessKeyId,
      secretAccessKey: body.secretAccessKey,
      sessionToken: body.sessionToken,
    });
    const {
      encrypted_access_key_id,
      encrypted_secret_access_key,
      encrypted_session_token,
      encrypted_dek,
      ...safeAccount
    } = updated;
    return safeAccount;
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return reply.status(400).send({ error: 'Validation failed', details: err.format() });
    }
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to rotate credentials' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`Server listening on port ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
