import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, LogOut, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import toast from 'react-hot-toast';
import '../styles/layout.css';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out. Cryptographic state wiped. 🔒');
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar" role="navigation" aria-label="Main navigation">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Shield size={22} strokeWidth={1.5} />
          </div>
          <span className="sidebar-brand">SecureVault</span>
        </div>

        <nav className="sidebar-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            id="nav-dashboard"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
            <ChevronRight size={14} className="nav-chevron" />
          </NavLink>

          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              id="nav-admin"
            >
              <Users size={18} />
              <span>Admin Panel</span>
              <ChevronRight size={14} className="nav-chevron" />
            </NavLink>
          )}
        </nav>

        {/* User Profile */}
        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" aria-hidden="true">
              {user?.username?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username}</span>
              <span className={`badge badge-${user?.role === 'admin' ? 'amber' : 'indigo'}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm logout-btn"
            onClick={handleLogout}
            id="logout-btn"
            title="Logout and wipe cryptographic state"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
