import { z } from 'zod';
import { listPolicies, getPolicy, createPolicy, updatePolicy, deletePolicy, listFindings, getComplianceStats, } from '../services/supabase/compliance.repo.js';
const createPolicySchema = z.object({
    accountId: z.string().uuid().nullable().optional(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    framework: z.string().nullable().optional(),
    ruleDefinition: z.object({
        conditions: z.object({
            all: z.array(z.object({
                field: z.string(),
                operator: z.string(),
                value: z.unknown(),
            })).optional(),
            any: z.array(z.object({
                field: z.string(),
                operator: z.string(),
                value: z.unknown(),
            })).optional(),
            not: z.object({
                conditions: z.object({
                    all: z.array(z.any()).optional(),
                    any: z.array(z.any()).optional(),
                }),
            }).optional(),
        }),
    }),
    action: z.enum(['ALLOW', 'DENY', 'WARN']),
    severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});
const updatePolicySchema = z.object({
    accountId: z.string().uuid().nullable().optional(),
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    enabled: z.boolean().optional(),
    framework: z.string().nullable().optional(),
    ruleDefinition: z.object({
        conditions: z.object({
            all: z.array(z.any()).optional(),
            any: z.array(z.any()).optional(),
            not: z.any().optional(),
        }),
    }).optional(),
    action: z.enum(['ALLOW', 'DENY', 'WARN']).optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
});
export async function complianceRoutes(fastify) {
    fastify.get('/api/compliance/policies', async (request, reply) => {
        const user = request.user;
        const query = z.object({
            accountId: z.string().uuid().optional(),
        }).parse(request.query);
        try {
            const policies = await listPolicies(user.id, query.accountId);
            return policies;
        }
        catch (err) {
            fastify.log.error({ route: 'list-policies', err: err.message || err });
            return reply.status(500).send({ error: `Failed to list policies: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.get('/api/compliance/policies/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        try {
            const policy = await getPolicy(id, user.id);
            if (!policy) {
                return reply.status(404).send({ error: 'Policy not found' });
            }
            return policy;
        }
        catch (err) {
            fastify.log.error({ route: 'get-policy', id, err: err.message || err });
            return reply.status(500).send({ error: `Failed to get policy: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.post('/api/compliance/policies', async (request, reply) => {
        const user = request.user;
        const body = createPolicySchema.parse(request.body);
        try {
            const policy = await createPolicy(user.id, {
                account_id: body.accountId ?? null,
                name: body.name,
                description: body.description ?? null,
                framework: body.framework ?? null,
                rule_definition: body.ruleDefinition,
                action: body.action,
                severity: body.severity,
            });
            return reply.status(201).send(policy);
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation failed', details: err.format() });
            }
            fastify.log.error({ route: 'create-policy', err: err.message || err });
            return reply.status(500).send({ error: `Failed to create policy: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.patch('/api/compliance/policies/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        const body = updatePolicySchema.parse(request.body);
        try {
            const existing = await getPolicy(id, user.id);
            if (!existing) {
                return reply.status(404).send({ error: 'Policy not found' });
            }
            const updateData = {};
            if (body.name)
                updateData.name = body.name;
            if (body.description !== undefined)
                updateData.description = body.description;
            if (body.enabled !== undefined)
                updateData.enabled = body.enabled;
            if (body.framework !== undefined)
                updateData.framework = body.framework;
            if (body.ruleDefinition)
                updateData.rule_definition = body.ruleDefinition;
            if (body.action)
                updateData.action = body.action;
            if (body.severity)
                updateData.severity = body.severity;
            if (body.accountId !== undefined)
                updateData.account_id = body.accountId;
            const updated = await updatePolicy(id, user.id, updateData);
            return updated;
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation failed', details: err.format() });
            }
            fastify.log.error({ route: 'update-policy', id, err: err.message || err });
            return reply.status(500).send({ error: `Failed to update policy: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.delete('/api/compliance/policies/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        try {
            const existing = await getPolicy(id, user.id);
            if (!existing) {
                return reply.status(404).send({ error: 'Policy not found' });
            }
            await deletePolicy(id, user.id);
            return reply.status(204).send();
        }
        catch (err) {
            fastify.log.error({ route: 'delete-policy', id, err: err.message || err });
            return reply.status(500).send({ error: `Failed to delete policy: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.get('/api/compliance/findings', async (request, reply) => {
        const user = request.user;
        const query = z.object({
            accountId: z.string().uuid().optional(),
            policyId: z.string().uuid().optional(),
            status: z.enum(['PASS', 'FAIL', 'WARN', 'SKIPPED']).optional(),
            limit: z.coerce.number().int().min(1).max(200).default(50),
            offset: z.coerce.number().int().min(0).default(0),
        }).parse(request.query);
        try {
            const result = await listFindings(user.id, {
                accountId: query.accountId,
                policyId: query.policyId,
                status: query.status,
                limit: query.limit,
                offset: query.offset,
            });
            return result;
        }
        catch (err) {
            fastify.log.error({ route: 'list-findings', err: err.message || err });
            return reply.status(500).send({ error: `Failed to list findings: ${err.message || 'Unknown error'}` });
        }
    });
    fastify.get('/api/compliance/stats', async (request, reply) => {
        const user = request.user;
        const query = z.object({
            accountId: z.string().uuid().optional(),
        }).parse(request.query);
        try {
            const stats = await getComplianceStats(user.id, query.accountId);
            return stats;
        }
        catch (err) {
            fastify.log.error({ route: 'compliance-stats', err: err.message || err });
            return reply.status(500).send({ error: `Failed to get compliance stats: ${err.message || 'Unknown error'}` });
        }
    });
}
