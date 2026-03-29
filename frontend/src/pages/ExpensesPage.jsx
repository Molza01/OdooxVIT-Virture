import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { expenseAPI, currencyAPI, ocrAPI } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePaperAirplane, HiOutlineUpload, HiOutlineCamera, HiOutlineSparkles, HiOutlineCheckCircle } from 'react-icons/hi';

const CATEGORIES = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Hardware', 'Training', 'Client Entertainment', 'Transportation', 'Accommodation', 'Miscellaneous', 'Other'];
const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Waiting Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [countries, setCountries] = useState([]);
  const [convertedPreview, setConvertedPreview] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [form, setForm] = useState({
    title: '', amount: '', currency: user?.companyCurrency || 'USD', selectedCountry: '', category: '',
    paidBy: 'PERSONAL', description: '', expenseDate: new Date().toISOString().split('T')[0],
    receipt: null, submitNow: false,
  });

  useEffect(() => {
    loadExpenses();
    currencyAPI.getCountries().then((res) => setCountries(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab) {
      setExpenses(allExpenses.filter(e => e.status === activeTab));
    } else {
      setExpenses(allExpenses);
    }
  }, [activeTab, allExpenses]);

  useEffect(() => {
    if (form.amount && form.currency && form.currency !== user?.companyCurrency) {
      const timer = setTimeout(() => {
        currencyAPI.convert(form.amount, form.currency, user.companyCurrency)
          .then((res) => setConvertedPreview(res.data)).catch(() => setConvertedPreview(null));
      }, 500);
      return () => clearTimeout(timer);
    } else { setConvertedPreview(null); }
  }, [form.amount, form.currency]);

  const loadExpenses = async () => {
    try {
      const { data } = await expenseAPI.getAll();
      setAllExpenses(data);
      setExpenses(activeTab ? data.filter(e => e.status === activeTab) : data);
    } catch { toast.error('Failed to load expenses'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (parseFloat(form.amount) <= 0) { toast.error('Amount must be greater than 0'); return; }
    try {
      const payload = { ...form };
      if (form.receipt) payload.receipt = form.receipt;
      await expenseAPI.create(payload);
      toast.success(form.submitNow ? 'Expense submitted for approval' : 'Expense saved as draft');
      setShowModal(false); resetForm(); loadExpenses();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create expense'); }
  };

  const handleSubmit = async (id) => {
    try { await expenseAPI.submit(id); toast.success('Expense submitted'); loadExpenses(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to submit'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft?')) return;
    try { await expenseAPI.delete(id); toast.success('Deleted'); loadExpenses(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const handleOcrScan = async (file) => {
    if (!file) return;
    setScanning(true);
    setOcrResult(null);
    try {
      const { data } = await ocrAPI.scanReceipt(file);
      setOcrResult(data);

      // Auto-fill the form with OCR results
      const updates = { receipt: file };
      if (data.title) updates.title = data.title;
      if (data.amount) updates.amount = String(data.amount);
      if (data.currency) {
        updates.currency = data.currency;
        const country = countries.find((c) => c.currencyCode === data.currency);
        if (country) updates.selectedCountry = country.name;
      }
      if (data.date) updates.expenseDate = data.date;
      if (data.category && data.category !== 'Other') updates.category = data.category;
      if (data.description) updates.description = data.description;

      setForm((prev) => ({ ...prev, ...updates }));
      toast.success('Receipt scanned! Fields auto-filled.');
    } catch (err) {
      toast.error('OCR scan failed. Please fill the form manually.');
      // Still attach the receipt even if OCR fails
      setForm((prev) => ({ ...prev, receipt: file }));
    } finally {
      setScanning(false);
    }
  };

  const resetForm = () => {
    setForm({ title: '', amount: '', currency: user?.companyCurrency || 'USD', selectedCountry: '', category: '',
      paidBy: 'PERSONAL', description: '', expenseDate: new Date().toISOString().split('T')[0],
      receipt: null, submitNow: false });
    setConvertedPreview(null);
    setOcrResult(null);
  };

  const handleCountrySelect = (e) => {
    const selectedCountry = e.target.value;
    const countryData = countries.find((c) => c.name === selectedCountry);
    setForm({ ...form, currency: countryData?.currencyCode || 'USD', selectedCountry });
  };

  // Find the selected country name from currency (for initial display)
  const selectedCountryName = form.selectedCountry || countries.find((c) => c.currencyCode === form.currency)?.name || '';
  const getTabCount = (status) => status ? allExpenses.filter(e => e.status === status).length : allExpenses.length;

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin" />
    </div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between animate-fade-in-up">
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
        {(user.role === 'EMPLOYEE' || user.role === 'ADMIN') && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <HiOutlinePlus className="w-4 h-4" /> Add Expense
          </button>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 bg-dark-800/80 backdrop-blur rounded-xl p-1 border border-dark-700/50 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === tab.value
                ? 'bg-accent-600/20 text-accent-300 border border-accent-500/30 shadow-lg shadow-accent-600/10'
                : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${activeTab === tab.value ? 'text-accent-400' : 'text-dark-500'}`}>
              ({getTabCount(tab.value)})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-700/50">
              {user.role !== 'EMPLOYEE' && <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Employee</th>}
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Description</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Date</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Category</th>
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Paid By</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Amount</th>
              {user.companyCurrency && <th className="text-right px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">({user.companyCurrency})</th>}
              <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Receipt</th>
              <th className="text-center px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Status</th>
              <th className="text-right px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-16 text-dark-400">No expenses found</td></tr>
            ) : (
              expenses.map((exp, i) => (
                <tr key={exp.id} className="table-row-hover border-b border-dark-700/30 animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                  {user.role !== 'EMPLOYEE' && <td className="px-6 py-4 text-sm text-dark-200">{exp.user.firstName} {exp.user.lastName}</td>}
                  <td className="px-6 py-4 text-sm text-white max-w-xs truncate">
                    <Link to={`/expenses/${exp.id}`} className="hover:text-accent-300 transition-colors">{exp.title || exp.description || '-'}</Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-dark-300">{format(new Date(exp.expenseDate), 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-4 text-sm text-dark-300">{exp.category}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`badge ${exp.paidBy === 'COMPANY' ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/30' : 'bg-dark-600/50 text-dark-300 border border-dark-500/30'}`}>
                      {exp.paidBy}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-white text-right">{exp.currency} {parseFloat(exp.amount).toFixed(2)}</td>
                  {user.companyCurrency && (
                    <td className="px-6 py-4 text-sm text-dark-400 text-right">
                      {exp.convertedAmount ? `${parseFloat(exp.convertedAmount).toFixed(2)}` : '-'}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm">
                    {exp.receiptPath ? (
                      <a href={`/uploads/${exp.receiptPath}`} target="_blank" rel="noopener noreferrer" className="text-accent-400 hover:text-accent-300 text-xs">View</a>
                    ) : <span className="text-dark-500 text-xs">None</span>}
                  </td>
                  <td className="px-6 py-4 text-center"><StatusBadge status={exp.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {exp.status === 'DRAFT' && exp.userId === user.id && (
                        <>
                          <button onClick={() => handleSubmit(exp.id)} className="p-2 rounded-lg text-accent-400 hover:bg-accent-500/10 transition-all" title="Submit">
                            <HiOutlinePaperAirplane className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(exp.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title="New Expense" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          {/* OCR Scan Section */}
          <div className={`border-2 border-dashed rounded-xl p-5 text-center transition-all duration-300 ${
            scanning ? 'border-accent-500/50 bg-accent-500/5' : ocrResult ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-dark-600 hover:border-accent-500/30 hover:bg-dark-700/30'
          }`}>
            {scanning ? (
              <div className="animate-fade-in">
                <div className="w-10 h-10 border-2 border-accent-500/30 border-t-accent-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-accent-300 font-medium">Scanning receipt with OCR...</p>
                <p className="text-xs text-dark-400 mt-1">Extracting amount, date, merchant, and category</p>
              </div>
            ) : ocrResult ? (
              <div className="animate-fade-in">
                <HiOutlineSparkles className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-emerald-300 font-medium">Receipt scanned successfully!</p>
                <p className="text-xs text-dark-400 mt-1">
                  {ocrResult.merchant && `Merchant: ${ocrResult.merchant}`}
                  {ocrResult.amount && ` | Amount: ${ocrResult.currency || ''} ${ocrResult.amount}`}
                  {ocrResult.expenseLines?.length > 0 && ` | ${ocrResult.expenseLines.length} item(s) found`}
                </p>
                <button type="button" onClick={() => document.getElementById('ocr-file-input').click()}
                  className="mt-3 text-xs text-accent-400 hover:text-accent-300 underline">Scan a different receipt</button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <HiOutlineCamera className="w-10 h-10 text-dark-400 mx-auto mb-2 group-hover:text-accent-400 transition-colors" />
                <p className="text-sm text-dark-300 font-medium">Scan Receipt with OCR</p>
                <p className="text-xs text-dark-500 mt-1">Upload a receipt image and auto-fill all fields</p>
                <input id="ocr-file-input" type="file" accept=".jpg,.jpeg,.png,.gif" className="hidden"
                  onChange={(e) => { if (e.target.files[0]) handleOcrScan(e.target.files[0]); }} />
                <span className="inline-block mt-3 text-xs bg-accent-600/20 text-accent-300 border border-accent-500/30 px-3 py-1.5 rounded-lg">
                  Choose Image
                </span>
              </label>
            )}
          </div>

          {/* Expense Lines from OCR */}
          {ocrResult?.expenseLines?.length > 0 && (
            <div className="bg-dark-700/50 rounded-xl border border-dark-600/30 p-3 animate-fade-in">
              <p className="text-xs font-semibold text-dark-300 mb-2">Detected Items:</p>
              <div className="space-y-1">
                {ocrResult.expenseLines.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-dark-400">
                    <span>{item.item}</span>
                    <span className="text-white font-medium">{ocrResult.currency || ''} {item.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-dark-700/30 pt-4">
            <p className="text-xs text-dark-500 mb-3">Fields below are auto-filled from OCR. Review and edit as needed.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Title</label>
            <input type="text" className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Client dinner at restaurant" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Amount *</label>
              <input type="number" step="0.01" min="0.01" className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Currency Country</label>
              <select className="input-field" value={selectedCountryName} onChange={handleCountrySelect}>
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={`${c.name}-${c.currencyCode}`} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
              {form.currency && (
                <p className="text-xs text-accent-400 mt-1">Currency: <strong>{form.currency}</strong></p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Paid By</label>
              <select className="input-field" value={form.paidBy} onChange={(e) => setForm({ ...form, paidBy: e.target.value })}>
                <option value="PERSONAL">Personal</option><option value="COMPANY">Company</option>
              </select>
            </div>
          </div>
          {convertedPreview && (
            <div className="bg-accent-500/10 border border-accent-500/20 rounded-xl px-4 py-3 text-sm text-accent-300 animate-fade-in">
              {form.amount} {form.currency} = <strong>{convertedPreview.convertedAmount.toFixed(2)} {user.companyCurrency}</strong>
              <span className="text-accent-500 text-xs ml-2">(Rate: {convertedPreview.exchangeRate.toFixed(4)})</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Category *</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Date *</label>
              <input type="date" className="input-field" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Description</label>
            <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5"><HiOutlineUpload className="inline w-4 h-4 mr-1" />Attach Receipt</label>
            {form.receipt ? (
              <div className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl border border-dark-600/30">
                <HiOutlineCheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-dark-200 truncate flex-1">{form.receipt.name}</span>
                <button type="button" onClick={() => setForm({ ...form, receipt: null })} className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            ) : (
              <input type="file" accept=".jpg,.jpeg,.png,.gif,.pdf" className="input-field" onChange={(e) => setForm({ ...form, receipt: e.target.files[0] })} />
            )}
            <p className="text-xs text-dark-500 mt-1">JPEG, PNG, GIF, or PDF. Max 5MB.</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="submitNow" checked={form.submitNow} onChange={(e) => setForm({ ...form, submitNow: e.target.checked })} className="rounded bg-dark-700 border-dark-500" />
            <label htmlFor="submitNow" className="text-sm text-dark-300">Submit for approval immediately</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/50">
            <button type="button" className="btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
            <button type="submit" className="btn-primary">{form.submitNow ? 'Submit Expense' : 'Save as Draft'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
