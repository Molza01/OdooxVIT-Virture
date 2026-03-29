import { useState, useEffect } from 'react';
import { userAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineSearch, HiOutlineTrash } from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

const ROLES = ['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER', 'EMPLOYEE'];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'EMPLOYEE', managerId: '' });

  useEffect(() => { loadUsers(); }, []);
  const loadUsers = async () => {
    try { const { data } = await userAPI.getAll(); setUsers(data); }
    catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  const managers = users.filter((u) => ['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER'].includes(u.role));

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await userAPI.create(form); toast.success('User created'); setShowCreate(false); resetForm(); loadUsers(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await userAPI.update(editUser.id, { firstName: editUser.firstName, lastName: editUser.lastName, role: editUser.role, managerId: editUser.managerId || null, isActive: editUser.isActive });
      toast.success('Updated'); setEditUser(null); loadUsers();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${name}? This cannot be undone.`)) return;
    try {
      await userAPI.delete(id);
      toast.success(`${name} has been deleted`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const resetForm = () => setForm({ email: '', password: '', firstName: '', lastName: '', role: 'EMPLOYEE', managerId: '' });

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const roleBadge = {
    ADMIN: 'bg-accent-500/15 text-accent-300 border border-accent-500/30',
    DIRECTOR: 'bg-neon-purple/15 text-neon-purple border border-neon-purple/30',
    FINANCE: 'bg-neon-orange/10 text-neon-orange border border-neon-orange/30',
    MANAGER: 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30',
    EMPLOYEE: 'bg-neon-green/10 text-neon-green border border-neon-green/30',
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><HiOutlinePlus className="w-4 h-4" />Add User</button>
      </div>

      <div className="card flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <HiOutlineSearch className="w-5 h-5 text-dark-400" />
        <input type="text" className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-gray-200 placeholder-dark-400" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card p-0 overflow-x-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700/50">
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Name</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Email</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Manager</th>
              <th className="text-center px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u, i) => (
              <tr key={u.id} className="table-row-hover border-b border-dark-700/30 animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-600 to-neon-purple flex items-center justify-center text-white text-xs font-bold">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <span className="text-sm font-medium text-white">{u.firstName} {u.lastName}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-dark-300">{u.email}</td>
                <td className="px-6 py-4"><span className={`badge ${roleBadge[u.role]}`}>{u.role}</span></td>
                <td className="px-6 py-4 text-sm text-dark-400">{u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : '-'}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`badge ${u.isActive ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${u.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditUser({ ...u })} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-all" title="Edit">
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    {u.id !== currentUser.id && (
                      <button onClick={() => handleDelete(u.id, `${u.firstName} ${u.lastName}`)} className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title="Create User" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">First Name *</label><input type="text" className="input-field" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Last Name *</label><input type="text" className="input-field" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
          </div>
          <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Email *</label><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Password *</label><input type="password" className="input-field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Role *</label>
              <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Manager</label>
              <select className="input-field" value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
                <option value="">None</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/50">
            <button type="button" className="btn-secondary" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</button>
            <button type="submit" className="btn-primary">Create User</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-dark-300 mb-1.5">First Name</label><input type="text" className="input-field" value={editUser.firstName} onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })} /></div>
              <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Last Name</label><input type="text" className="input-field" value={editUser.lastName} onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })} /></div>
            </div>
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Role</label>
              <select className="input-field" value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Manager</label>
              <select className="input-field" value={editUser.managerId || ''} onChange={(e) => setEditUser({ ...editUser, managerId: e.target.value })}>
                <option value="">None</option>{managers.filter((m) => m.id !== editUser.id).map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={editUser.isActive} onChange={(e) => setEditUser({ ...editUser, isActive: e.target.checked })} className="rounded bg-dark-700 border-dark-500" />
              <label htmlFor="isActive" className="text-sm text-dark-300">Active</label>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/50">
              <button type="button" className="btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              <button type="submit" className="btn-primary">Update User</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
