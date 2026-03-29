import { useState, useEffect } from 'react';
import { workflowAPI, userAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineShieldCheck } from 'react-icons/hi';

const RULE_TYPES = [
  { value: 'PERCENTAGE', label: 'Percentage-Based', desc: 'Requires X% of approvers to approve' },
  { value: 'SPECIFIC_APPROVER', label: 'Specific Approver', desc: 'Auto-advances when a specific person approves' },
  { value: 'HYBRID', label: 'Hybrid', desc: 'Either percentage threshold OR specific approver' },
];

export default function RulesPage() {
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', ruleType: 'PERCENTAGE', percentageThreshold: '', specificApproverId: '', minAmount: '', maxAmount: '' });

  useEffect(() => {
    Promise.all([workflowAPI.getRules().then((r) => setRules(r.data)), userAPI.getAll().then((r) => setUsers(r.data))])
      .catch(() => toast.error('Failed')).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await workflowAPI.createRule({
        ...form, percentageThreshold: form.percentageThreshold ? parseInt(form.percentageThreshold) : undefined,
        specificApproverId: form.specificApproverId || undefined,
        minAmount: form.minAmount ? parseFloat(form.minAmount) : undefined,
        maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined,
      });
      toast.success('Rule created'); setShowCreate(false);
      setForm({ name: '', ruleType: 'PERCENTAGE', percentageThreshold: '', specificApproverId: '', minAmount: '', maxAmount: '' });
      const { data } = await workflowAPI.getRules(); setRules(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const ruleTypeBadge = {
    PERCENTAGE: 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30',
    SPECIFIC_APPROVER: 'bg-neon-purple/15 text-neon-purple border border-neon-purple/30',
    HYBRID: 'bg-neon-orange/10 text-neon-orange border border-neon-orange/30',
  };
  const approverUsers = users.filter((u) => ['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER'].includes(u.role));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">Approval Rules</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><HiOutlinePlus className="w-4 h-4" />New Rule</button>
      </div>

      <div className="card bg-accent-500/5 border-accent-500/20 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex gap-3">
          <HiOutlineShieldCheck className="w-5 h-5 text-accent-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-dark-300">
            <p className="font-semibold text-accent-300">How Conditional Rules Work</p>
            <ul className="mt-2 space-y-1 text-dark-400">
              <li><strong className="text-dark-200">Percentage:</strong> Requires a % of step approvers to approve (e.g., 60% of 5 = 3 needed)</li>
              <li><strong className="text-dark-200">Specific Approver:</strong> If a designated person (e.g., CFO) approves, step auto-advances</li>
              <li><strong className="text-dark-200">Hybrid:</strong> Combines both — either threshold OR specific approver triggers advancement</li>
            </ul>
          </div>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="card text-center py-16 text-dark-400 animate-scale-in">No rules defined yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
          {rules.map((rule) => (
            <div key={rule.id} className="card hover:border-dark-600 transition-all duration-300 group">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white group-hover:text-accent-300 transition-colors">{rule.name}</h3>
                <span className={`badge ${ruleTypeBadge[rule.ruleType]}`}>{rule.ruleType.replace('_', ' ')}</span>
              </div>
              <div className="space-y-1 text-sm text-dark-400">
                {rule.percentageThreshold && <p>Threshold: <span className="text-white font-medium">{rule.percentageThreshold}%</span></p>}
                {rule.specificApproverId && <p>Approver: <span className="text-white font-medium">{users.find((u) => u.id === rule.specificApproverId)?.firstName || 'Unknown'}</span></p>}
                {rule.minAmount && <p>Min: <span className="text-white font-medium">${parseFloat(rule.minAmount).toFixed(2)}</span></p>}
                {rule.maxAmount && <p>Max: <span className="text-white font-medium">${parseFloat(rule.maxAmount).toFixed(2)}</span></p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Rule" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Rule Name *</label><input type="text" className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Rule Type *</label>
            <div className="space-y-2">
              {RULE_TYPES.map((rt) => (
                <label key={rt.value} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${form.ruleType === rt.value ? 'border-accent-500/50 bg-accent-500/10' : 'border-dark-600/50 hover:bg-dark-700/50 hover:border-dark-500'}`}>
                  <input type="radio" name="ruleType" value={rt.value} checked={form.ruleType === rt.value} onChange={(e) => setForm({ ...form, ruleType: e.target.value })} className="mt-0.5" />
                  <div><p className="text-sm font-medium text-white">{rt.label}</p><p className="text-xs text-dark-400">{rt.desc}</p></div>
                </label>
              ))}
            </div>
          </div>
          {(form.ruleType === 'PERCENTAGE' || form.ruleType === 'HYBRID') && (
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Percentage Threshold (%)</label><input type="number" min="1" max="100" className="input-field" value={form.percentageThreshold} onChange={(e) => setForm({ ...form, percentageThreshold: e.target.value })} placeholder="e.g., 60" /></div>
          )}
          {(form.ruleType === 'SPECIFIC_APPROVER' || form.ruleType === 'HYBRID') && (
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Specific Approver</label>
              <select className="input-field" value={form.specificApproverId} onChange={(e) => setForm({ ...form, specificApproverId: e.target.value })}>
                <option value="">Select approver</option>{approverUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>)}
              </select></div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Min Amount</label><input type="number" step="0.01" className="input-field" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} placeholder="Optional" /></div>
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Max Amount</label><input type="number" step="0.01" className="input-field" value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} placeholder="Optional" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/50">
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Create Rule</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
