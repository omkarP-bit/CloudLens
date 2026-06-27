import { supabaseAdmin } from '../config/supabase.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

export async function supabaseAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);

  // Verify Supabase JWT - validates signature, expiry, and audience
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }

  // Fetch the user role from user_profiles
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Attach user and role to request context
  (request as any).user = {
    ...user,
    role: profile?.role || 'viewer'
  };
}
