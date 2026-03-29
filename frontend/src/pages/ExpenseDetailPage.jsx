import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { expenseAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { HiOutlineArrowLeft, HiOutlinePaperAirplane } from 'react-icons/hi';

export default function ExpenseDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadExpense(); }, [id]);
  const loadExpense = async () => {
    try { const { data } = await expenseAPI.getById(id); setExpense(data); }
    catch { toast.error('Not found'); navigate('/expenses'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    try { await expenseAPI.submit(id); toast.success('Submitted'); loadExpense(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" /></div>;
  if (!expense) return null;

  return (
    <div className="space-y-6 max-w-3xl animate-fade-in">
      <button onClick={() => navigate('/expenses')} className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back to Expenses
      </button>

      <div className="card animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">{expense.title || 'Expense Details'}</h1>
          <StatusBadge status={expense.status} />
        </div>
        <dl className="grid grid-cols-2 gap-5">
          <div>
            <dt className="text-sm text-dark-400 mb-1">Amount</dt>
            <dd className="text-2xl font-bold text-white">{expense.currency} {parseFloat(expense.amount).toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-sm text-dark-400 mb-1">Category</dt>
            <dd className="text-lg font-medium text-white">{expense.category}</dd>
          </div>
          <div>
            <dt className="text-sm text-dark-400 mb-1">Date</dt>
            <dd className="text-dark-200">{format(new Date(expense.expenseDate), 'MMMM dd, yyyy')}</dd>
          </div>
          <div>
            <dt className="text-sm text-dark-400 mb-1">Submitted By</dt>
            <dd className="text-dark-200">{expense.user.firstName} {expense.user.lastName}</dd>
          </div>
          <div>
            <dt className="text-sm text-dark-400 mb-1">Paid By</dt>
            <dd><span className={`badge ${expense.paidBy === 'COMPANY' ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30' : 'bg-dark-600/50 text-dark-300 border border-dark-500/30'}`}>{expense.paidBy}</span></dd>
          </div>
          {expense.convertedAmount && expense.currency !== expense.companyCurrency && (
            <div>
              <dt className="text-sm text-dark-400 mb-1">Converted</dt>
              <dd className="text-lg font-bold text-accent-300">{expense.companyCurrency} {parseFloat(expense.convertedAmount).toFixed(2)}</dd>
              <dd className="text-xs text-dark-500">Rate: {parseFloat(expense.exchangeRate).toFixed(4)}</dd>
            </div>
          )}
          {expense.description && (
            <div className="col-span-2">
              <dt className="text-sm text-dark-400 mb-1">Description</dt>
              <dd className="text-dark-200">{expense.description}</dd>
            </div>
          )}
          {expense.receiptPath && (
            <div className="col-span-2">
              <dt className="text-sm text-dark-400 mb-1">Receipt</dt>
              <dd><a href={`/uploads/${expense.receiptPath}`} target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300 transition-colors">View Receipt</a></dd>
            </div>
          )}
        </dl>
        {expense.status === 'DRAFT' && expense.userId === user.id && (
          <div className="mt-6 pt-4 border-t border-dark-700/50">
            <button onClick={handleSubmit} className="btn-primary flex items-center gap-2">
              <HiOutlinePaperAirplane className="w-4 h-4" /> Submit for Approval
            </button>
          </div>
        )}
      </div>

      {expense.approvals?.length > 0 && (
        <div className="card animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-lg font-semibold text-white mb-4">Approval History</h2>
          <div className="space-y-3 stagger-children">
            {expense.approvals.map((a) => (
              <div key={a.id} className={`p-4 rounded-xl border ${
                a.action === 'APPROVED' ? 'border-emerald-500/20 bg-emerald-500/5'
                : a.action === 'REJECTED' ? 'border-red-500/20 bg-red-500/5'
                : 'border-amber-500/20 bg-amber-500/5'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {a.stepNumber === -1 ? 'Admin Override' : a.stepNumber === 0 ? 'Manager Pre-Approval' : `Step ${a.stepNumber}`}: {a.approver.firstName} {a.approver.lastName}
                    </p>
                    {a.comment && <p className="text-sm text-dark-400 mt-1">"{a.comment}"</p>}
                  </div>
                  <StatusBadge status={a.action} />
                </div>
                {a.decidedAt && <p className="text-xs text-dark-500 mt-2">{format(new Date(a.decidedAt), 'MMM dd, yyyy HH:mm')}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {expense.workflow && (
        <div className="card animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-lg font-semibold text-white mb-4">Workflow: {expense.workflow.name}</h2>
          <div className="flex items-center gap-3">
            {expense.workflow.steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-300 ${
                  expense.currentStep > step.stepNumber
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : expense.currentStep === step.stepNumber
                    ? 'bg-accent-500/15 text-accent-300 border-accent-500/30 animate-pulse-glow'
                    : 'bg-dark-700/50 text-dark-400 border-dark-600'
                }`}>{step.description || `Step ${step.stepNumber}`}</div>
                {i < expense.workflow.steps.length - 1 && <span className="text-dark-600">&rarr;</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
