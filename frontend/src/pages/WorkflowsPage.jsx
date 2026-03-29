import { useState, useEffect } from 'react';
import { workflowAPI, userAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineTrash, HiOutlineChevronRight } from 'react-icons/hi';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', minAmount: '', maxAmount: '', category: '',
    isDefault: false, isManagerApprover: false,
    steps: [{ approverRole: '', approverId: '', description: '', isRequired: true }],
  });

  useEffect(() => {
    Promise.all([workflowAPI.getAll().then((r) => setWorkflows(r.data)), userAPI.getAll().then((r) => setUsers(r.data))])
      .catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, []);

  const loadWorkflows = async () => { const { data } = await workflowAPI.getAll(); setWorkflows(data); };
  const addStep = () => setForm({ ...form, steps: [...form.steps, { approverRole: '', approverId: '', description: '', isRequired: true }] });
  const removeStep = (i) => { if (form.steps.length <= 1) return; setForm({ ...form, steps: form.steps.filter((_, idx) => idx !== i) }); };
  const updateStep = (i, field, value) => {
    const steps = [...form.steps]; steps[i] = { ...steps[i], [field]: value };
    if (field === 'approverId' && value) steps[i].approverRole = '';
    if (field === 'approverRole' && value) steps[i].approverId = '';
    setForm({ ...form, steps });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await workflowAPI.create({ ...form, minAmount: form.minAmount ? parseFloat(form.minAmount) : undefined, maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined, category: form.category || undefined });
      toast.success('Workflow created'); setShowCreate(false); resetForm(); loadWorkflows();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workflow?')) return;
    try { await workflowAPI.delete(id); toast.success('Deleted'); loadWorkflows(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const resetForm = () => setForm({ name: '', description: '', minAmount: '', maxAmount: '', category: '', isDefault: false, isManagerApprover: false, steps: [{ approverRole: '', approverId: '', description: '', isRequired: true }] });
  const approverUsers = users.filter((u) => ['ADMIN', 'DIRECTOR', 'FINANCE', 'MANAGER'].includes(u.role));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">Approval Workflows</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2"><HiOutlinePlus className="w-4 h-4" />New Workflow</button>
      </div>

      {workflows.length === 0 ? (
        <div className="card text-center py-16 text-dark-400 animate-scale-in">No workflows configured yet</div>
      ) : (
        <div className="space-y-4 stagger-children">
          {workflows.map((wf) => (
            <div key={wf.id} className="card hover:border-dark-600 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-white">{wf.name}</h3>
                    {wf.isDefault && <span className="badge bg-accent-500/15 text-accent-300 border border-accent-500/30">Default</span>}
                    {!wf.isActive && <span className="badge bg-dark-600/50 text-dark-400 border border-dark-500/30">Inactive</span>}
                    {wf.isManagerApprover && <span className="badge bg-neon-green/10 text-neon-green border border-neon-green/30">Manager Approver</span>}
                  </div>
                  {wf.description && <p className="text-sm text-dark-400 mt-1">{wf.description}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-dark-500">
                    {wf.minAmount && <span>Min: ${parseFloat(wf.minAmount).toFixed(0)}</span>}
                    {wf.maxAmount && <span>Max: ${parseFloat(wf.maxAmount).toFixed(0)}</span>}
                    {wf.category && <span>Category: {wf.category}</span>}
                  </div>
                </div>
                {!wf.isDefault && (
                  <button onClick={() => handleDelete(wf.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all">
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {wf.steps.map((step, i) => (
                  <div key={step.id} className="flex items-center gap-2">
                    <div className="bg-dark-700/80 border border-dark-600/50 rounded-xl px-4 py-2.5 hover:border-accent-500/30 transition-all duration-300">
                      <p className="text-sm font-medium text-white">Step {step.stepNumber}</p>
                      <p className="text-xs text-dark-400">{step.approver ? `${step.approver.firstName} ${step.approver.lastName}` : step.approverRole || 'Unassigned'}</p>
                      {step.description && <p className="text-xs text-dark-500">{step.description}</p>}
                    </div>
                    {i < wf.steps.length - 1 && <HiOutlineChevronRight className="w-4 h-4 text-dark-500" />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title="Create Workflow" size="xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-dark-300 mb-1.5">Name *</label><input type="text" className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-dark-300 mb-1.5">Description</label><input type="text" className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Min Amount</label><input type="number" step="0.01" className="input-field" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} placeholder="Optional" /></div>
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Max Amount</label><input type="number" step="0.01" className="input-field" value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} placeholder="Optional" /></div>
            <div><label className="block text-sm font-medium text-dark-300 mb-1.5">Category</label><input type="text" className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Optional" /></div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="rounded bg-dark-700 border-dark-500" /><span className="text-sm text-dark-300">Set as default workflow</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isManagerApprover} onChange={(e) => setForm({ ...form, isManagerApprover: e.target.checked })} className="rounded bg-dark-700 border-dark-500" /><span className="text-sm text-dark-300">Is Manager Approver</span><span className="text-xs text-dark-500">(Manager auto-approves first)</span></label>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Approval Steps</h3>
              <button type="button" onClick={addStep} className="text-sm text-accent-400 hover:text-accent-300 flex items-center gap-1"><HiOutlinePlus className="w-3 h-3" /> Add Step</button>
            </div>
            <div className="space-y-3">
              {form.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl border border-dark-600/30">
                  <span className="text-sm font-bold text-accent-400 w-16">Step {i + 1}</span>
                  <select className="input-field flex-1" value={step.approverRole} onChange={(e) => updateStep(i, 'approverRole', e.target.value)}>
                    <option value="">By specific person</option><option value="MANAGER">By role: MANAGER</option><option value="FINANCE">By role: FINANCE</option><option value="DIRECTOR">By role: DIRECTOR</option><option value="ADMIN">By role: ADMIN</option>
                  </select>
                  {!step.approverRole && (
                    <select className="input-field flex-1" value={step.approverId} onChange={(e) => updateStep(i, 'approverId', e.target.value)}>
                      <option value="">Select approver</option>{approverUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>)}
                    </select>
                  )}
                  <input type="text" className="input-field w-36" placeholder="Description" value={step.description} onChange={(e) => updateStep(i, 'description', e.target.value)} />
                  <label className="flex items-center gap-1 text-xs text-dark-400 whitespace-nowrap">
                    <input type="checkbox" checked={step.isRequired} onChange={(e) => updateStep(i, 'isRequired', e.target.checked)} className="rounded bg-dark-700 border-dark-500" /> Required
                  </label>
                  {form.steps.length > 1 && <button type="button" onClick={() => removeStep(i)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><HiOutlineTrash className="w-4 h-4" /></button>}
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/50">
            <button type="button" className="btn-secondary" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</button>
            <button type="submit" className="btn-primary">Create Workflow</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
