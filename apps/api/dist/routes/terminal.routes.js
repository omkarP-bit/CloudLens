import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { createSession, getSession, listSessions, closeSession, executeCommand, } from '../services/terminal/terminal.service.js';
import { WebSocketServer } from 'ws';
const createSessionSchema = z.object({
    accountId: z.string().uuid(),
});
export async function terminalRoutes(fastify) {
    fastify.post('/api/terminal/sessions', async (request, reply) => {
        const user = request.user;
        const body = createSessionSchema.parse(request.body);
        try {
            const session = await createSession(user.id, body.accountId);
            return reply.status(201).send({
                id: session.id,
                accountId: session.accountId,
                accountAlias: session.accountAlias,
                createdAt: session.createdAt,
            });
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation failed', details: err.format() });
            }
            fastify.log.error({ route: 'create-terminal-session', err: err.message || err });
            return reply.status(500).send({ error: err.message || 'Failed to create terminal session' });
        }
    });
    fastify.get('/api/terminal/sessions', async (request, reply) => {
        const user = request.user;
        try {
            const sessions = listSessions(user.id);
            return sessions.map((s) => ({
                id: s.id,
                accountId: s.accountId,
                accountAlias: s.accountAlias,
                createdAt: s.createdAt,
                lastActivityAt: s.lastActivityAt,
            }));
        }
        catch (err) {
            fastify.log.error({ route: 'list-terminal-sessions', err: err.message || err });
            return reply.status(500).send({ error: 'Failed to list sessions' });
        }
    });
    fastify.delete('/api/terminal/sessions/:id', async (request, reply) => {
        const user = request.user;
        const { id } = request.params;
        try {
            await closeSession(id, user.id);
            return reply.status(204).send();
        }
        catch (err) {
            if (err.message === 'Session not found') {
                return reply.status(404).send({ error: 'Session not found' });
            }
            fastify.log.error({ route: 'delete-terminal-session', id, err: err.message || err });
            return reply.status(500).send({ error: 'Failed to close session' });
        }
    });
    fastify.post('/api/terminal/exec', async (request, reply) => {
        const user = request.user;
        const body = z.object({
            sessionId: z.string().uuid(),
            command: z.string().min(1).max(5000),
        }).parse(request.body);
        try {
            const session = getSession(body.sessionId);
            if (!session || session.userId !== user.id) {
                return reply.status(404).send({ error: 'Session not found or expired' });
            }
            const result = await executeCommand(session, body.command);
            return {
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                timedOut: result.timedOut,
            };
        }
        catch (err) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: 'Validation failed', details: err.format() });
            }
            fastify.log.error({ route: 'terminal-exec', err: err.message || err });
            return reply.status(500).send({ error: err.message || 'Command execution failed' });
        }
    });
}
export function attachTerminalWebSocket(fastify) {
    const wss = new WebSocketServer({
        noServer: true,
        maxPayload: 1024 * 1024,
    });
    fastify.server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
        if (url.pathname !== '/api/terminal/ws')
            return;
        const token = url.searchParams.get('token');
        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }
        supabaseAdmin.auth.getUser(token).then(({ data: { user }, error }) => {
            if (error || !user) {
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }
            wss.handleUpgrade(request, socket, head, (ws) => {
                ws.on('message', (raw) => handleWsMessage(ws, raw, user.id));
                ws.on('close', () => { });
                ws.on('error', () => ws.terminate());
            });
        }).catch(() => {
            socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
            socket.destroy();
        });
    });
    return wss;
}
const wsSessions = new WeakMap();
async function handleWsMessage(ws, raw, userId) {
    let data;
    try {
        data = JSON.parse(raw.toString());
    }
    catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        return;
    }
    switch (data.type) {
        case 'create-session': {
            try {
                const session = await createSession(userId, data.accountId);
                wsSessions.set(ws, { sessionId: session.id, abortController: null });
                ws.send(JSON.stringify({
                    type: 'session-created',
                    id: session.id,
                    accountAlias: session.accountAlias,
                }));
            }
            catch (err) {
                ws.send(JSON.stringify({ type: 'error', message: err.message }));
            }
            break;
        }
        case 'exec': {
            const wsSession = wsSessions.get(ws);
            if (!wsSession?.sessionId) {
                ws.send(JSON.stringify({ type: 'error', message: 'No active session. Create one first.' }));
                return;
            }
            const session = getSession(wsSession.sessionId);
            if (!session) {
                ws.send(JSON.stringify({ type: 'error', message: 'Session expired' }));
                return;
            }
            const result = await executeCommand(session, data.command);
            ws.send(JSON.stringify({
                type: 'output',
                data: result.stdout,
            }));
            if (result.stderr) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: `\x1b[91m${result.stderr}\x1b[0m`,
                }));
            }
            if (result.timedOut) {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: '\x1b[91mCommand timed out\x1b[0m\r\n',
                }));
            }
            ws.send(JSON.stringify({
                type: 'exit',
                code: result.exitCode,
            }));
            break;
        }
        case 'close-session': {
            const wsSession = wsSessions.get(ws);
            if (wsSession?.sessionId) {
                try {
                    await closeSession(wsSession.sessionId, userId);
                }
                catch { }
            }
            wsSessions.set(ws, { sessionId: '', abortController: null });
            ws.send(JSON.stringify({ type: 'session-closed' }));
            break;
        }
        default:
            ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${data.type}` }));
    }
}
