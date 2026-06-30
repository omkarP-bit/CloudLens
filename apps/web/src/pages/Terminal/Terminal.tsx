import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import {
  Terminal as TerminalIcon, Plus, X, Loader, Wifi, WifiOff,
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore.js';
import { useAWS } from '../../hooks/useAWS.js';
import { useTerminalWebSocket } from '../../hooks/useTerminal.js';

const WELCOME = [
  '\x1b[36m\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
  '\u2551  \x1b[33mCloudLens Cloud Terminal Shell\x1b[36m                    \u2551',
  '\u2551  \x1b[90mAWS CLI commands for your infrastructure\x1b[36m          \u2551',
  '\u2551  \x1b[90mType \x1b[33mhelp\x1b[90m or \x1b[33mexit\x1b[90m to get started                  \x1b[36m\u2551',
  '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255a\x1b[0m',
].join('\r\n') + '\r\n';

const PROMPT = '\x1b[32mcloudlens\x1b[0m@\x1b[34mterminal\x1b[0m $ ';

export function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const inputBufferRef = useRef('');
  const commandHistoryRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const cursorPosRef = useRef(0);

  const { activeAccountId } = useAccountStore();
  const { accounts } = useAWS();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const ws = useTerminalWebSocket();

  const redrawInput = useCallback(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    const cursor = cursorPosRef.current;
    const line = inputBufferRef.current;
    xterm.write('\r\x1b[K' + PROMPT + line);
    if (cursor < line.length) {
      xterm.write('\r'.repeat(PROMPT.length + line.length - cursor));
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Menlo', monospace",
      theme: {
        background: '#0a0a0c',
        foreground: '#f4f4f5',
        cursor: '#6366f1',
        selectionBackground: '#6366f160',
        black: '#18181b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#6366f1',
        magenta: '#a855f7',
        cyan: '#22d3ee',
        white: '#f4f4f5',
        brightBlack: '#3f3f46',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#818cf8',
        brightMagenta: '#c084fc',
        brightCyan: '#67e8f9',
        brightWhite: '#fafafa',
      },
      allowTransparency: true,
      cols: 80,
      rows: 40,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();
    xterm.focus();

    fitAddonRef.current = fitAddon;
    xtermRef.current = xterm;

    xterm.write(WELCOME);
    xterm.write('\r\n\x1b[90mSelect an account to start a terminal session.\x1b[0m\r\n');
    xterm.write(PROMPT);

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    xterm.onData((data: string) => {
      for (const char of data) {
        if (char === '\r') {
          const input = inputBufferRef.current;
          inputBufferRef.current = '';
          cursorPosRef.current = 0;

          if (input.trim()) {
            commandHistoryRef.current.push(input);
            historyIndexRef.current = -1;
          }

          xterm.write('\r\n');

          if (input.trim().toLowerCase() === 'exit') {
            ws.closeSession();
            ws.disconnect();
            xterm.write('\x1b[33mSession closed. Create a new one.\x1b[0m\r\n');
            xterm.write(PROMPT);
          } else if (input.trim().toLowerCase() === 'help') {
            showHelp(xterm);
            xterm.write(PROMPT);
          } else if (input.trim().toLowerCase() === 'clear') {
            xterm.clear();
            xterm.write(PROMPT);
          } else if (input.trim()) {
            ws.exec(input);
          } else {
            xterm.write(PROMPT);
          }
        } else if (char === '\x7f') {
          if (cursorPosRef.current > 0) {
            inputBufferRef.current =
              inputBufferRef.current.slice(0, cursorPosRef.current - 1) +
              inputBufferRef.current.slice(cursorPosRef.current);
            cursorPosRef.current--;
            redrawInput();
          }
        } else if (char === '\x1b[A') {
          if (commandHistoryRef.current.length > 0) {
            if (historyIndexRef.current === -1) {
              historyIndexRef.current = commandHistoryRef.current.length - 1;
            } else {
              historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
            }
            inputBufferRef.current = commandHistoryRef.current[historyIndexRef.current] || '';
            cursorPosRef.current = inputBufferRef.current.length;
            redrawInput();
          }
        } else if (char === '\x1b[B') {
          if (historyIndexRef.current >= 0) {
            historyIndexRef.current++;
            if (historyIndexRef.current >= commandHistoryRef.current.length) {
              historyIndexRef.current = -1;
              inputBufferRef.current = '';
            } else {
              inputBufferRef.current = commandHistoryRef.current[historyIndexRef.current] || '';
            }
            cursorPosRef.current = inputBufferRef.current.length;
            redrawInput();
          }
        } else if (char === '\x1b[D') {
          if (cursorPosRef.current > 0) {
            cursorPosRef.current--;
            xterm.write('\x1b[D');
          }
        } else if (char === '\x1b[C') {
          if (cursorPosRef.current < inputBufferRef.current.length) {
            cursorPosRef.current++;
            xterm.write('\x1b[C');
          }
        } else if (char === '\x03') {
          inputBufferRef.current = '';
          cursorPosRef.current = 0;
          xterm.write('^C\r\n' + PROMPT);
        } else if (char.length === 1 && char >= ' ') {
          const before = inputBufferRef.current.slice(0, cursorPosRef.current);
          const after = inputBufferRef.current.slice(cursorPosRef.current);
          inputBufferRef.current = before + char + after;
          cursorPosRef.current++;
          redrawInput();
        }
      }
    });

    ws.setOnMessage((msg) => {
      if (msg.type === 'output' && msg.data) {
        xterm.write(msg.data.replace(/\n/g, '\r\n'));
        xterm.write('\r\n' + PROMPT);
      } else if (msg.type === 'error' && msg.message) {
        xterm.write(`\x1b[91m${msg.message}\x1b[0m\r\n`);
        xterm.write(PROMPT);
      } else if (msg.type === 'session-created') {
        setShowAccountPicker(false);
        setConnecting(false);
        xterm.write(`\x1b[32m✓ Connected to ${msg.accountAlias || 'account'}\x1b[0m\r\n`);
        xterm.write(PROMPT);
      } else if (msg.type === 'session-closed') {
        xterm.write('\x1b[33mSession closed.\x1b[0m\r\n');
        xterm.write(PROMPT);
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  const handleStartSession = async (accountId: string) => {
    setSelectedAccountId(accountId);
    setConnecting(true);
    await ws.connect();
    ws.createSession(accountId);
  };

  const handleDisconnect = () => {
    ws.closeSession();
    ws.disconnect();
    setShowAccountPicker(true);
    setSelectedAccountId(null);
    setConnecting(false);
    const xterm = xtermRef.current;
    if (xterm) {
      xterm.write('\r\n\x1b[33mSession terminated.\x1b[0m\r\n');
    }
  };

  const handleNewSession = () => {
    ws.disconnect();
    setShowAccountPicker(true);
    setSelectedAccountId(null);
    setConnecting(false);
    const xterm = xtermRef.current;
    if (xterm) {
      xterm.write('\r\n\x1b[33mDisconnected.\x1b[0m\r\n');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <TerminalIcon className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Terminal</h1>
            <p className="text-[10px] text-zinc-500">
              {selectedAccountId && !showAccountPicker
                ? `AWS CLI session — ${accounts?.find((a: any) => a.id === selectedAccountId)?.alias || selectedAccountId}`
                : 'No active session'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            {connecting ? (
              <span className="flex items-center gap-1.5 text-yellow-400">
                <Loader className="h-3 w-3 animate-spin" />
                Connecting
              </span>
            ) : ws.connected ? (
              <span className="flex items-center gap-1.5 text-success">
                <Wifi className="h-3 w-3" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </span>
            )}
          </div>
          {!showAccountPicker && (
            <>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-border text-zinc-400 hover:text-destructive rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
                Disconnect
              </button>
              <button
                onClick={handleNewSession}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-border text-zinc-400 hover:text-white rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                New Session
              </button>
            </>
          )}
        </div>
      </div>

      {showAccountPicker ? (
        <div className="glass-panel rounded-xl p-6 animate-fade-in shrink-0">
          <div className="flex items-center gap-2 mb-6">
            <TerminalIcon className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold text-white">Select an Account</h2>
          </div>

          {!accounts || accounts.length === 0 ? (
            <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
              <TerminalIcon className="h-8 w-8 text-zinc-600" />
              <h3 className="text-sm font-semibold text-white">No Accounts Available</h3>
              <p className="text-zinc-500 text-xs max-w-sm">Add an AWS account in Settings to start a terminal session.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {accounts.map((account: any) => (
                <button
                  key={account.id}
                  onClick={() => handleStartSession(account.id)}
                  disabled={connecting}
                  className="glass-panel rounded-xl p-5 text-left hover:border-primary/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <TerminalIcon className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    <h3 className="text-sm font-bold text-white">{account.alias}</h3>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-500">
                      <span>Account ID</span>
                      <span className="text-zinc-300 font-mono">{account.aws_account_id}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-500">
                      <span>Status</span>
                      <span className={`font-medium ${account.status === 'active' ? 'text-success' : 'text-zinc-500'}`}>
                        {account.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-500">
                      <span>Regions</span>
                      <span className="text-zinc-300">{(account.regions?.length || 1)} configured</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div
        ref={terminalRef}
        className={`flex-1 min-h-0 rounded-xl overflow-hidden border border-border ${showAccountPicker ? 'hidden' : ''}`}
      />

      <div className="text-[10px] text-zinc-600 shrink-0">
        {showAccountPicker
          ? 'Select an AWS account above to open a terminal session'
          : <>Type <span className="text-zinc-400 font-mono">help</span> for commands,{' '}
            <span className="text-zinc-400 font-mono">exit</span> to close session,{' '}
            <span className="text-zinc-400 font-mono">↑↓</span> for history</>
        }
      </div>
    </div>
  );
}

function showHelp(xterm: XTerm) {
  const help = [
    '\x1b[36m\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
    '\u2551  \x1b[33mCloudLens Terminal Help\x1b[36m                          \u2551',
    '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255a\x1b[0m',
    '',
    '\x1b[33mAWS CLI Commands:\x1b[0m',
    '  aws ec2 describe-instances       List EC2 instances',
    '  aws s3 ls                        List S3 buckets',
    '  aws rds describe-db-instances    List RDS instances',
    '  aws lambda list-functions        List Lambda functions',
    '  aws sts get-caller-identity      Show current identity',
    '  aws budgets describe-budgets     List budgets',
    '',
    '\x1b[33mCost Explorer requires params:\x1b[0m',
    '  aws ce get-cost-and-usage --time-period 2025-01-01,2025-12-31 \u005c',
    '    --granularity MONTHLY --metrics BlendedCost',
    '',
    '\x1b[33mBuilt-in Commands:\x1b[0m',
    '  help           Show this help message',
    '  clear          Clear terminal screen',
    '  exit           Close the terminal session',
    '',
    '\x1b[33mUtility Commands:\x1b[0m',
    '  ls, pwd, echo, cat, head, tail, grep, sort, wc, date',
    '',
    '\x1b[33mNotes:\x1b[0m',
    '  - All AWS CLI commands run with your connected account credentials',
    '  - Commands are sandboxed for security',
    '  - Session expires after 30 minutes of inactivity',
    '\x1b[0m',
  ];

  for (const line of help) {
    xterm.writeln(line);
  }
}
