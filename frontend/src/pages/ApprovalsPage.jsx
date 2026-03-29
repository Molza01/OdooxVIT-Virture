import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { approvalAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { HiOutlineCheck, HiOutlineX, HiOutlineExclamation } from 'react-icons/hi';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState(null);
  const [comment, setComment] = useState('');

  useEffect(() => { loadApprovals(); }, []);

  const loadApprovals = async () => {
    try { const { data } = await approvalAPI.getPending(); setApprovals(data); }
    catch { toast.error('Failed to load approvals'); }
    finally { setLoading(false); }
  };

  const handleAction = async () => {
    if (!actionModal) return;
    try {
      if (actionModal.type === 'approve') { await approvalAPI.approve(actionModal.expenseId, comment); toast.success('Expense approved'); }
      else if (actionModal.type === 'reject') { await approvalAPI.reject(actionModal.expenseId, comment); toast.success('Expense rejected'); }
      else if (actionModal.type === 'override') { await approvalAPI.override(actionModal.expenseId, actionModal.action, comment); toast.success(`Expense ${actionModal.action.toLowerCase()}`); }
      setActionModal(null); setComment(''); loadApprovals();
    } catch (err) { toast.error(err.response?.data?.error || 'Action failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-white animate-fade-in-up">Approvals to Review</h1>

      {approvals.length === 0 ? (
        <div className="card text-center py-16 animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <HiOutlineCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <p className="text-dark-400 text-lg">No pending approvals. You're all caught up!</p>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Subject</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Request Owner</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Category</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Date</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Step</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Amount ({user?.companyCurrency})</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval, i) => (
                <tr key={approval.id} className="table-row-hover border-b border-dark-700/30 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <td className="px-6 py-4 text-sm text-white font-medium">{approval.expense.title || approval.expense.description || approval.expense.category}</td>
                  <td className="px-6 py-4 text-sm text-dark-300">{approval.expense.user.firstName} {approval.expense.user.lastName}</td>
                  <td className="px-6 py-4 text-sm text-dark-300">{approval.expense.category}</td>
                  <td className="px-6 py-4 text-sm text-dark-300">{format(new Date(approval.expense.expenseDate), 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-4 text-center">
                    {approval.expense.workflow ? (
                      <div className="flex items-center justify-center gap-1">
                        {approval.expense.workflow.steps.map((step) => (
                          <div key={step.id}
                            title={`${step.description}: ${step.approver ? `${step.approver.firstName} ${step.approver.lastName}` : step.approverRole}`}
                            className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center font-bold transition-all duration-300 ${
                              approval.expense.currentStep > step.stepNumber
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : approval.expense.currentStep === step.stepNumber
                                ? 'bg-accent-500/20 text-accent-300 border border-accent-500/40 ring-2 ring-accent-500/20 animate-pulse-glow'
                                : 'bg-dark-700 text-dark-400 border border-dark-600'
                            }`}
                          >{step.stepNumber}</div>
                        ))}
                      </div>
                    ) : <span className="badge bg-dark-600/50 text-dark-300">Step {approval.stepNumber}</span>}
                  </td>
                  <td className="px-6 py-4 text-center"><StatusBadge status={approval.expense.status} /></td>
                  <td className="px-6 py-4 text-sm font-semibold text-white text-right">
                    {approval.expense.convertedAmount
                      ? `${approval.expense.companyCurrency} ${parseFloat(approval.expense.convertedAmount).toFixed(2)}`
                      : `${approval.expense.currency} ${parseFloat(approval.expense.amount).toFixed(2)}`}
                    {approval.expense.currency !== approval.expense.companyCurrency && (
                      <span className="block text-xs font-normal text-dark-500">({approval.expense.currency} {parseFloat(approval.expense.amount).toFixed(2)})</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setActionModal({ type: 'approve', expenseId: approval.expense.id })} className="btn-success text-xs py-1.5 px-3">Approve</button>
                      <button onClick={() => setActionModal({ type: 'reject', expenseId: approval.expense.id })} className="btn-danger text-xs py-1.5 px-3">Reject</button>
                      {user.role === 'ADMIN' && (
                        <button onClick={() => setActionModal({ type: 'override', expenseId: approval.expense.id, action: 'APPROVED' })} className="btn-secondary text-xs py-1.5 px-3">Override</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={!!actionModal} onClose={() => { setActionModal(null); setComment(''); }}
        title={actionModal?.type === 'approve' ? 'Approve Expense' : actionModal?.type === 'reject' ? 'Reject Expense' : 'Admin Override'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Comment {actionModal?.type === 'reject' ? '(recommended)' : '(optional)'}</label>
            <textarea className="input-field" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..." />
          </div>
          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={() => { setActionModal(null); setComment(''); }}>Cancel</button>
            <button className={actionModal?.type === 'reject' ? 'btn-danger' : 'btn-success'} onClick={handleAction}>
              Confirm {actionModal?.type === 'override' ? 'Override' : actionModal?.type === 'approve' ? 'Approval' : 'Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
