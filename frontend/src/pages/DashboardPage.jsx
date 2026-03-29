import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { expenseAPI, approvalAPI } from '../services/api';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import {
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineCurrencyDollar,
} from 'react-icons/hi';

export default function DashboardPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [expRes] = await Promise.all([
        expenseAPI.getAll(),
        user.role !== 'EMPLOYEE'
          ? approvalAPI.getPending().then((r) => setPendingApprovals(r.data))
          : Promise.resolve(),
      ]);
      setExpenses(expRes.data);
    } catch (err) {
      console.error('Failed to load dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: expenses.length,
    pending: expenses.filter((e) => e.status === 'PENDING').length,
    approved: expenses.filter((e) => e.status === 'APPROVED').length,
    rejected: expenses.filter((e) => e.status === 'REJECTED').length,
    totalAmount: expenses
      .filter((e) => e.status === 'APPROVED')
      .reduce((sum, e) => sum + parseFloat(e.amount), 0),
  };

  const statCards = [
    { label: 'Total Expenses', value: stats.total, icon: HiOutlineDocumentText, gradient: 'from-accent-600 to-accent-400', shadow: 'shadow-accent-600/20' },
    { label: 'Pending', value: stats.pending, icon: HiOutlineClock, gradient: 'from-amber-600 to-amber-400', shadow: 'shadow-amber-600/20' },
    { label: 'Approved', value: stats.approved, icon: HiOutlineCheckCircle, gradient: 'from-emerald-600 to-emerald-400', shadow: 'shadow-emerald-600/20' },
    { label: 'Rejected', value: stats.rejected, icon: HiOutlineXCircle, gradient: 'from-red-600 to-red-400', shadow: 'shadow-red-600/20' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white">
          Welcome back, <span className="text-gradient">{user?.firstName}</span>!
        </h1>
        <p className="text-dark-400 mt-1">Here's your expense overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {statCards.map((stat) => (
          <div key={stat.label} className="card group hover:scale-[1.02] transition-all duration-300 cursor-default">
            <div className="flex items-center gap-4">
              <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-xl shadow-lg ${stat.shadow} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-dark-400">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total approved */}
      <div className="card glow-border hover:scale-[1.01] transition-all duration-300 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-accent-500 to-neon-purple p-4 rounded-xl shadow-lg shadow-accent-500/30 animate-float">
            <HiOutlineCurrencyDollar className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-3xl font-bold text-white">
              ${stats.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-dark-400">Total Approved Amount</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent expenses */}
        <div className="card animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Recent Expenses</h2>
            <Link to="/expenses" className="text-sm text-accent-400 hover:text-accent-300 transition-colors">
              View all
            </Link>
          </div>
          {expenses.length === 0 ? (
            <p className="text-dark-400 text-sm py-8 text-center">No expenses yet</p>
          ) : (
            <div className="space-y-2">
              {expenses.slice(0, 5).map((exp) => (
                <Link
                  key={exp.id}
                  to={`/expenses/${exp.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-dark-700/50 transition-all duration-200 group"
                >
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-accent-300 transition-colors">{exp.category}</p>
                    <p className="text-xs text-dark-400">{exp.title || exp.description || 'No description'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {exp.currency} {parseFloat(exp.amount).toFixed(2)}
                    </p>
                    <StatusBadge status={exp.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending approvals */}
        {user.role !== 'EMPLOYEE' && (
          <div className="card animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Pending Approvals</h2>
              <Link to="/approvals" className="text-sm text-accent-400 hover:text-accent-300 transition-colors">
                View all
              </Link>
            </div>
            {pendingApprovals.length === 0 ? (
              <p className="text-dark-400 text-sm py-8 text-center">No pending approvals</p>
            ) : (
              <div className="space-y-2">
                {pendingApprovals.slice(0, 5).map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {approval.expense.user.firstName} {approval.expense.user.lastName}
                      </p>
                      <p className="text-xs text-dark-400">{approval.expense.category}</p>
                    </div>
                    <p className="text-sm font-semibold text-amber-300">
                      {approval.expense.currency} {parseFloat(approval.expense.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
