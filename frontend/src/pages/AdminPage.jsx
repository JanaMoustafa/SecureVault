import { useEffect, useState } from 'react';
import { Users, BarChart3, Shield, CheckCircle, XCircle, Crown, User } from 'lucide-react';
import api from '../services/api.service';
import toast from 'react-hot-toast';
import '../styles/admin.css';

const formatBytes = (b) => {
  if (!b) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(b)/Math.log(k));
  return `${(b/k**i).toFixed(1)} ${sizes[i]}`;
};

export default function AdminPage() {
  const [stats, setStats]   = useState(null);
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users?limit=50'),
      ]);
      setStats(statsRes.data.data.stats);
      setUsers(usersRes.data.data.users);
    } catch {
      toast.error('Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleStatus = async (userId) => {
    try {
      const { data } = await api.patch(`/admin/users/${userId}/status`);
      setUsers((prev) => prev.map((u) => u._id === userId ? data.data.user : u));
      toast.success('User status updated.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status.');
    }
  };

  const changeRole = async (userId, role) => {
    try {
      const { data } = await api.patch(`/admin/users/${userId}/role`, { role });
      setUsers((prev) => prev.map((u) => u._id === userId ? data.data.user : u));
      toast.success(`Role changed to ${role}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change role.');
    }
  };

  return (
    <div className="admin-page animate-fade-in">
      <header className="dashboard-header">
        <div>
          <h1 className="page-title"><Shield size={24} className="title-icon" />Admin Panel</h1>
          <p className="page-subtitle">User management and system statistics. Role-Based Access Control.</p>
        </div>
        <span className="badge badge-amber"><Crown size={12} />Admin Access</span>
      </header>

      {/* Stats */}
      {stats && (
        <div className="stats-row" style={{ marginBottom: 'var(--space-xl)' }}>
          {[
            { label: 'Total Users',    value: stats.totalUsers,    icon: <Users size={20} />,    cls: 'stat-icon-indigo' },
            { label: 'Active Users',   value: stats.activeUsers,   icon: <CheckCircle size={20} />, cls: 'stat-icon-emerald' },
            { label: 'Total Files',    value: stats.totalFiles,    icon: <BarChart3 size={20} />, cls: 'stat-icon-amber' },
            { label: 'Encrypted Data', value: formatBytes(stats.storage?.totalBytes), icon: <Shield size={20} />, cls: 'stat-icon-purple' },
          ].map(({ label, value, icon, cls }) => (
            <div key={label} className="glass-card stat-card">
              <div className={`stat-icon ${cls}`}>{icon}</div>
              <div>
                <p className="stat-label">{label}</p>
                <p className="stat-value">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users Table */}
      <div className="glass-card admin-table-card">
        <div className="panel-header">
          <Users size={20} />
          <h2 className="panel-title">User Management</h2>
          <span className="badge badge-indigo" style={{ marginLeft: 'auto' }}>{users.length} users</span>
        </div>

        {loading ? (
          <div className="files-skeleton">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table" role="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} className={!u.isActive ? 'row-inactive' : ''}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm">{u.username[0].toUpperCase()}</div>
                        <span className="user-name-cell">{u.username}</span>
                      </div>
                    </td>
                    <td><span className="cell-muted">{u.email}</span></td>
                    <td>
                      <span className={`badge badge-${u.role === 'admin' ? 'amber' : 'indigo'}`}>
                        {u.role === 'admin' ? <Crown size={10} /> : <User size={10} />}
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${u.isActive ? 'emerald' : 'red'}`}>
                        {u.isActive ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {u.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td>
                      <span className="cell-muted">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button
                          className={`btn btn-sm ${u.isActive ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleStatus(u._id)}
                          id={`toggle-status-${u._id}`}
                        >
                          {u.isActive ? 'Suspend' : 'Activate'}
                        </button>
                        <select
                          className="role-select"
                          value={u.role}
                          onChange={(e) => changeRole(u._id, e.target.value)}
                          id={`role-select-${u._id}`}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
