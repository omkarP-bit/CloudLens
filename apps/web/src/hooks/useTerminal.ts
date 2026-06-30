import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/api.js';
import { supabase } from '../lib/supabase.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface TerminalSession {
  id: string;
  accountId: string;
  accountAlias: string;
  createdAt: string;
  lastActivityAt?: string;
}

export function useTerminalSessions() {
  return useQuery<TerminalSession[]>({
    queryKey: ['terminal-sessions'],
    queryFn: () => apiRequest<TerminalSession[]>('/api/terminal/sessions'),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useCreateTerminalSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      apiRequest<TerminalSession>('/api/terminal/sessions', {
        method: 'POST',
        body: JSON.stringify({ accountId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminal-sessions'] });
    },
  });
}

export function useCloseTerminalSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/api/terminal/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminal-sessions'] });
    },
  });
}

export interface TerminalMessage {
  type: 'output' | 'error' | 'session-created' | 'session-closed' | 'exit';
  data?: string;
  message?: string;
  id?: string;
  accountAlias?: string;
  code?: number;
}

export function useTerminalWebSocket() {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef<((msg: TerminalMessage) => void) | null>(null);

  const connect = useCallback(async (): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    return new Promise((resolve) => {
      const ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/api/terminal/ws?token=${session.access_token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        resolve();
      };
      ws.onclose = () => setConnected(false);
      ws.onerror = () => setConnected(false);

      ws.onmessage = (event) => {
        try {
          const msg: TerminalMessage = JSON.parse(event.data);
          setMessages((prev) => [...prev, msg]);
          onMessageRef.current?.(msg);

          if (msg.type === 'session-created' && msg.id) {
            setSessionId(msg.id);
          }
          if (msg.type === 'session-closed') {
            setSessionId(null);
          }
        } catch {}
      };
    });
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setSessionId(null);
    setMessages([]);
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const createSession = useCallback((accountId: string) => {
    send({ type: 'create-session', accountId });
  }, [send]);

  const exec = useCallback((command: string) => {
    send({ type: 'exec', command });
  }, [send]);

  const closeSession = useCallback(() => {
    send({ type: 'close-session' });
  }, [send]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  return {
    connected,
    sessionId,
    messages,
    connect,
    disconnect,
    createSession,
    exec,
    closeSession,
    clearMessages,
    setOnMessage: (cb: ((msg: TerminalMessage) => void) | null) => { onMessageRef.current = cb; },
  };
}
