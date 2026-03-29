import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineUsers,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineCollection,
  HiOutlineShieldCheck,
} from 'react-icons/hi';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: HiOutlineHome, roles: ['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER', 'EMPLOYEE'] },
  { to: '/expenses', label: 'Expenses', icon: HiOutlineDocumentText, roles: ['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER', 'EMPLOYEE'] },
  { to: '/approvals', label: 'Approvals', icon: HiOutlineCheckCircle, roles: ['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER'] },
  { to: '/users', label: 'Users', icon: HiOutlineUsers, roles: ['ADMIN'] },
  { to: '/workflows', label: 'Workflows', icon: HiOutlineCog, roles: ['ADMIN'] },
  { to: '/rules', label: 'Rules', icon: HiOutlineShieldCheck, roles: ['ADMIN'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = NAV_ITEMS.filter((item) => item.roles.includes(user?.role));

  const roleBadgeColor = {
    ADMIN: 'bg-accent-500/20 text-accent-300 border border-accent-500/30',
    DIRECTOR: 'bg-neon-purple/15 text-neon-purple border border-neon-purple/30',
    FINANCE: 'bg-neon-orange/10 text-neon-orange border border-neon-orange/30',
    MANAGER: 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30',
    EMPLOYEE: 'bg-neon-green/10 text-neon-green border border-neon-green/30',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-dark-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-dark-700/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500 to-neon-purple flex items-center justify-center shadow-lg shadow-accent-500/30">
                <HiOutlineCollection className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">ReimburseFlow</span>
            </div>
            <button className="lg:hidden text-dark-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <HiOutlineX className="w-5 h-5" />
            </button>
          </div>

          {/* User info */}
          <div className="px-6 py-5 border-b border-dark-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-600 to-neon-purple flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-dark-400 truncate">{user?.email}</p>
              </div>
            </div>
            <span className={`badge mt-3 text-[10px] uppercase tracking-widest ${roleBadgeColor[user?.role] || ''}`}>
              {user?.role}
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {filteredNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group ${
                    isActive
                      ? 'bg-accent-600/15 text-accent-300 shadow-lg shadow-accent-600/5 border border-accent-500/20'
                      : 'text-dark-300 hover:bg-dark-800 hover:text-white border border-transparent'
                  }`
                }
              >
                <item.icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-dark-700/50">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 border border-transparent hover:border-red-500/20"
            >
              <HiOutlineLogout className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50 flex items-center px-6">
          <button className="lg:hidden mr-4 text-dark-300 hover:text-white transition-colors" onClick={() => setSidebarOpen(true)}>
            <HiOutlineMenu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-neon-green animate-pulse" />
            <span className="text-sm text-dark-400">
              {user?.companyName || 'Company'}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gradient-mesh">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
