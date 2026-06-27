import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  DollarSign,
  Sliders,
  ShieldCheck,
  Terminal,
  Settings,
  LogOut,
  Compass,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';

export function Sidebar() {
  const { signOut, user, role } = useAuthStore();

  const links = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/services', label: 'Services', icon: Server },
    { to: '/budgets', label: 'Budgets', icon: DollarSign },
    { to: '/controls', label: 'Controls', icon: Sliders },
    { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
    { to: '/terminal', label: 'Terminal', icon: Terminal },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-screen select-none">
      <div className="p-6 flex items-center gap-3 border-b border-border">
        <Compass className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold tracking-tight text-white">CloudLens</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border bg-black/20 flex flex-col gap-3">
        <div className="flex items-center gap-3 px-2">
          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{user?.email}</p>
            <p className="text-[10px] text-zinc-500 font-medium capitalize">{role || 'viewer'}</p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
