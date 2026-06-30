import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { supabaseAdmin } from '../../config/supabase.js';
import { getDecryptedCredentials } from '../supabase/accounts.repo.js';
import { insertAuditLog } from '../supabase/audit.repo.js';
const ALLOWED_COMMANDS = new Set([
    'aws', 'ls', 'cat', 'echo', 'pwd', 'whoami', 'env',
    'head', 'tail', 'wc', 'sort', 'uniq', 'cut', 'tr', 'grep',
    'find', 'which', 'date', 'cal', 'df', 'du', 'ps', 'top',
    'uname', 'hostname', 'id', 'printenv', 'dir',
]);
const BLOCKED_AWS_COMMANDS = new Set([
    'iam create-user', 'iam create-access-key', 'iam delete-user',
    'iam update-user', 'organizations', 'sts assume-role',
]);
const SESSION_TTL_MS = 30 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 30_000;
const sessions = new Map();
export function sanitizeCommand(input) {
    const trimmed = input.trim();
    if (!trimmed)
        return { command: '', args: [], error: 'Empty command' };
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    if (!ALLOWED_COMMANDS.has(command)) {
        return { command, args: [], error: `Command not allowed: ${command}. Allowed: ${[...ALLOWED_COMMANDS].join(', ')}` };
    }
    if (command === 'aws') {
        const subcommand = parts.slice(1).join(' ');
        for (const blocked of BLOCKED_AWS_COMMANDS) {
            if (subcommand.startsWith(blocked)) {
                return { command, args: [], error: `AWS command blocked for security: ${blocked}` };
            }
        }
    }
    return { command, args: parts.slice(1) };
}
export async function createSession(userId, accountId) {
    const { data: account, error } = await supabaseAdmin
        .from('aws_accounts')
        .select('alias')
        .eq('id', accountId)
        .eq('user_id', userId)
        .single();
    if (error || !account)
        throw new Error('Account not found or access denied');
    const creds = await getDecryptedCredentials(accountId);
    const session = {
        id: randomUUID(),
        userId,
        accountId,
        accountAlias: account.alias,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        closed: false,
        envVars: {
            AWS_ACCESS_KEY_ID: creds.accessKeyId,
            AWS_SECRET_ACCESS_KEY: creds.secretAccessKey,
            ...(creds.sessionToken ? { AWS_SESSION_TOKEN: creds.sessionToken } : {}),
            AWS_DEFAULT_REGION: 'us-east-1',
            AWS_PAGER: '',
            CLOUDLENS_SESSION_ID: randomUUID(),
        },
    };
    sessions.set(session.id, session);
    await insertAuditLog(supabaseAdmin, {
        user_id: userId,
        account_id: accountId,
        action: 'terminal:session:create',
        resource_type: 'Terminal',
        resource_id: session.id,
        region: 'global',
        policy_result: 'ALLOW',
        policy_reason: 'Terminal session created',
    });
    return session;
}
export function getSession(sessionId) {
    return sessions.get(sessionId);
}
export function listSessions(userId) {
    const now = Date.now();
    const active = [];
    for (const [, session] of sessions) {
        if (session.userId !== userId)
            continue;
        if (session.closed)
            continue;
        if (now - session.lastActivityAt.getTime() > SESSION_TTL_MS) {
            session.closed = true;
            continue;
        }
        active.push(session);
    }
    return active;
}
export async function closeSession(sessionId, userId) {
    const session = sessions.get(sessionId);
    if (!session || session.userId !== userId)
        throw new Error('Session not found');
    session.closed = true;
    sessions.delete(sessionId);
    await insertAuditLog(supabaseAdmin, {
        user_id: userId,
        account_id: session.accountId,
        action: 'terminal:session:close',
        resource_type: 'Terminal',
        resource_id: sessionId,
        region: 'global',
        policy_result: 'ALLOW',
        policy_reason: 'Terminal session closed',
    });
}
export function executeCommand(session, commandLine, timeoutMs = COMMAND_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const { command, args, error } = sanitizeCommand(commandLine);
        if (error) {
            resolve({ exitCode: 1, stdout: '', stderr: error, timedOut: false });
            return;
        }
        session.lastActivityAt = new Date();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGTERM');
            setTimeout(() => {
                try {
                    proc.kill('SIGKILL');
                }
                catch { }
            }, 2000);
        }, timeoutMs);
        const proc = spawn(command, args, {
            env: { ...process.env, ...session.envVars },
            cwd: '/tmp',
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        proc.on('close', (code) => {
            clearTimeout(timer);
            resolve({ exitCode: code, stdout, stderr, timedOut });
        });
        proc.on('error', (err) => {
            clearTimeout(timer);
            resolve({ exitCode: 1, stdout: '', stderr: err.message, timedOut });
        });
        proc.stdin?.end();
    });
}
export function clearSessions() {
    sessions.clear();
}
export async function cleanExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastActivityAt.getTime() > SESSION_TTL_MS) {
            session.closed = true;
            sessions.delete(id);
        }
    }
}
