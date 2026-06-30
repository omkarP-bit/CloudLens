import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeCommand,
  createSession,
  getSession,
  listSessions,
  closeSession,
  executeCommand,
  cleanExpiredSessions,
  clearSessions,
  type TerminalSession,
} from './terminal.service.js';

vi.mock('../../config/supabase.js', () => ({
  supabaseAdmin: {},
}));

vi.mock('../supabase/accounts.repo.js', () => ({
  getDecryptedCredentials: vi.fn().mockResolvedValue({
    accessKeyId: 'AKIA-test',
    secretAccessKey: 'secret-test',
    sessionToken: 'token-test',
  }),
}));

vi.mock('../supabase/audit.repo.js', () => ({
  insertAuditLog: vi.fn().mockResolvedValue(undefined),
}));

async function mockSupabaseOnce(data: any) {
  const mod = await import('../../config/supabase.js');
  (mod.supabaseAdmin as any).from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data, error: null }),
        })),
        single: vi.fn().mockResolvedValue({ data, error: null }),
      })),
      single: vi.fn().mockResolvedValue({ data, error: null }),
    })),
  }));
}

async function mockSupabaseError() {
  const mod = await import('../../config/supabase.js');
  (mod.supabaseAdmin as any).from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        })),
      })),
    })),
  }));
}

describe('sanitizeCommand', () => {
  it('allows aws commands', () => {
    const result = sanitizeCommand('aws ec2 describe-instances');
    expect(result.error).toBeUndefined();
    expect(result.command).toBe('aws');
    expect(result.args).toEqual(['ec2', 'describe-instances']);
  });

  it('allows basic utilities', () => {
    expect(sanitizeCommand('ls -la').error).toBeUndefined();
    expect(sanitizeCommand('pwd').error).toBeUndefined();
    expect(sanitizeCommand('echo hello').error).toBeUndefined();
    expect(sanitizeCommand('cat /tmp/file').error).toBeUndefined();
    expect(sanitizeCommand('grep foo').error).toBeUndefined();
    expect(sanitizeCommand('date').error).toBeUndefined();
  });

  it('rejects disallowed commands', () => {
    const result = sanitizeCommand('rm -rf /');
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('Command not allowed');
  });

  it('rejects dangerous AWS commands', () => {
    const result = sanitizeCommand('aws iam create-user --name hacker');
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('blocked');
  });

  it('rejects empty command', () => {
    const result = sanitizeCommand('   ');
    expect(result.error).toBe('Empty command');
  });

  it('allows safe AWS commands', () => {
    expect(sanitizeCommand('aws s3 ls').error).toBeUndefined();
    expect(sanitizeCommand('aws ec2 describe-instances --region us-east-1').error).toBeUndefined();
    expect(sanitizeCommand('aws sts get-caller-identity').error).toBeUndefined();
  });
});

describe('createSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessions();
  });

  it('creates a session with credentials', async () => {
    await mockSupabaseOnce({ alias: 'TestAccount' });

    const session = await createSession('user-1', 'acct-1');
    expect(session.id).toBeTruthy();
    expect(session.userId).toBe('user-1');
    expect(session.accountId).toBe('acct-1');
    expect(session.accountAlias).toBe('TestAccount');
    expect(session.envVars.AWS_ACCESS_KEY_ID).toBe('AKIA-test');
    expect(session.envVars.AWS_SECRET_ACCESS_KEY).toBe('secret-test');
    expect(session.envVars.AWS_SESSION_TOKEN).toBe('token-test');
    expect(session.closed).toBe(false);
  });

  it('sets AWS_DEFAULT_REGION and AWS_PAGER', async () => {
    await mockSupabaseOnce({ alias: 'Test' });
    const session = await createSession('user-1', 'acct-1');
    expect(session.envVars.AWS_DEFAULT_REGION).toBe('us-east-1');
    expect(session.envVars.AWS_PAGER).toBe('');
  });

  it('throws for unknown account', async () => {
    await mockSupabaseError();
    await expect(createSession('user-1', 'bad-id')).rejects.toThrow();
  });
});

describe('getSession / listSessions / closeSession', () => {
  let session: TerminalSession;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { clearSessions } = await import('./terminal.service.js');
    clearSessions();
    await mockSupabaseOnce({ alias: 'Test' });
    session = await createSession('user-1', 'acct-1');
  });

  it('getSession returns session by id', () => {
    const found = getSession(session.id);
    expect(found?.id).toBe(session.id);
    expect(found?.userId).toBe('user-1');
  });

  it('getSession returns undefined for unknown id', () => {
    expect(getSession('nonexistent')).toBeUndefined();
  });

  it('listSessions returns active sessions for user', () => {
    const sessions = listSessions('user-1');
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions.some((s) => s.id === session.id)).toBe(true);
  });

  it('listSessions does not return other users sessions', () => {
    const sessions = listSessions('other-user');
    expect(sessions.length).toBe(0);
  });

  it('closeSession marks session as closed', async () => {
    await closeSession(session.id, 'user-1');
    expect(getSession(session.id)).toBeUndefined();
  });

  it('closeSession throws for wrong user', async () => {
    await expect(closeSession(session.id, 'wrong-user')).rejects.toThrow('Session not found');
  });

  it('closeSession throws for unknown id', async () => {
    await expect(closeSession('bad-id', 'user-1')).rejects.toThrow('Session not found');
  });
});

describe('executeCommand', () => {
  let session: TerminalSession;

  beforeEach(async () => {
    vi.clearAllMocks();
    clearSessions();
    await mockSupabaseOnce({ alias: 'Test' });
    session = await createSession('user-1', 'acct-1');
  });

  it('executes a simple command and returns stdout', async () => {
    const result = await executeCommand(session, 'echo hello');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.timedOut).toBe(false);
  });

  it('returns error for disallowed command', async () => {
    const result = await executeCommand(session, 'rm -rf /');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Command not allowed');
  });

  it('handles command with stderr', async () => {
    const result = await executeCommand(session, 'ls /nonexistent_path_xyz');
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBeTruthy();
  });

  it('updates lastActivityAt', async () => {
    const before = session.lastActivityAt.getTime();
    await new Promise((r) => setTimeout(r, 5));
    await executeCommand(session, 'echo test');
    expect(session.lastActivityAt.getTime()).toBeGreaterThan(before);
  });

  it('handles timeout', async () => {
    const result = await executeCommand(session, 'sleep 10', 50);
    expect(result.exitCode).not.toBe(0);
  });
});

describe('cleanExpiredSessions', () => {
  beforeEach(async () => {
    const { clearSessions } = await import('./terminal.service.js');
    clearSessions();
  });

  it('removes expired sessions', async () => {
    vi.clearAllMocks();
    await mockSupabaseOnce({ alias: 'Test' });
    const session = await createSession('user-1', 'acct-1');
    session.lastActivityAt = new Date(Date.now() - 60 * 60 * 1000);

    await cleanExpiredSessions();
    expect(getSession(session.id)).toBeUndefined();
  });

  it('keeps recent sessions', async () => {
    vi.clearAllMocks();
    await mockSupabaseOnce({ alias: 'Test' });
    const session = await createSession('user-1', 'acct-1');

    await cleanExpiredSessions();
    expect(getSession(session.id)).toBeDefined();
  });
});
