import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { Login } from './pages/Login/Login.js';
import { PageShell } from './components/layout/PageShell.js';
import { Dashboard } from './pages/Dashboard/Dashboard.js';
import { Services } from './pages/Services/Services.js';
import { Budgets } from './pages/Budgets/Budgets.js';
import { Controls } from './pages/Controls/Controls.js';
import { Compliance } from './pages/Compliance/Compliance.js';
import { Terminal } from './pages/Terminal/Terminal.js';
import { Accounts as Settings } from './pages/Settings/Accounts.js';
import { Loader } from 'lucide-react';

export function App() {
  const { user, loading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-[#0a0a0c] flex flex-col items-center justify-center gap-3">
        <Loader className="h-8 w-8 text-primary animate-spin" />
        <span className="text-zinc-500 text-xs">Authenticating session...</span>
      </div>
    );
  }

  return (
    <Routes>
      {user ? (
        <Route element={<PageShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/services" element={<Services />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/controls" element={<Controls />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  );
}
export default App;
