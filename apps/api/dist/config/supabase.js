import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
