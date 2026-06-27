import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { Compass, Mail, Lock, Shield, Loader, Github } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [useOtp, setUseOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (useOtp) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Magic link sent! Check your email.' });
      } else if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Registration successful! Please check your email to verify.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Authentication failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'OAuth authentication failed' });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background p-4 relative overflow-hidden select-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md glass-panel p-8 rounded-2xl glow-primary animate-fade-in relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
            <Compass className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Welcome to CloudLens</h2>
          <p className="text-zinc-500 text-xs mt-1">Connect and govern your AWS resources in real-time</p>
        </div>

        {message && (
          <div
            className={`p-3 rounded-lg text-xs font-medium mb-5 border ${
              message.type === 'success'
                ? 'bg-success/10 border-success/20 text-success'
                : 'bg-destructive/10 border-destructive/20 text-destructive'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs font-medium mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-border text-white rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
              />
            </div>
          </div>

          {!useOtp && (
            <div>
              <label className="block text-zinc-400 text-xs font-medium mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required={!useOtp}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-border text-white rounded-lg text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all duration-200"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-accent transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/20"
          >
            {loading ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : useOtp ? (
              'Send Magic Link'
            ) : isSignUp ? (
              'Sign Up'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => {
              setUseOtp(!useOtp);
              setMessage(null);
            }}
            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {useOtp ? 'Use Email & Password' : 'Sign in with Magic Link'}
          </button>
          {!useOtp && (
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="text-[11px] text-primary hover:text-accent font-medium transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>
          )}
        </div>

        <div className="relative my-6 select-none">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-[#121215] px-2 text-zinc-600 font-semibold tracking-wider">Or continue with</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleOAuth('github')}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-border text-white text-xs rounded-lg font-medium transition-colors cursor-pointer"
          >
            <Github className="h-4 w-4" />
            <span>GitHub</span>
          </button>
          <button
            onClick={() => handleOAuth('google')}
            disabled={loading}
            className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-border text-white text-xs rounded-lg font-medium transition-colors cursor-pointer"
          >
            <Shield className="h-4 w-4" />
            <span>Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}
