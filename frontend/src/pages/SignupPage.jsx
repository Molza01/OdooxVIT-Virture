import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { currencyAPI } from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineCollection } from 'react-icons/hi';

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [countries, setCountries] = useState([]);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    companyName: '', country: '', currency: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    currencyAPI.getCountries()
      .then((res) => setCountries(res.data))
      .catch(() => toast.error('Failed to load countries'));
  }, []);

  const handleCountryChange = (e) => {
    const selectedCountry = e.target.value;
    const countryData = countries.find((c) => c.name === selectedCountry);
    setForm({ ...form, country: selectedCountry, currency: countryData?.currencyCode || '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (!form.country) { toast.error('Please select a country'); return; }
    setLoading(true);
    try {
      await signup({
        firstName: form.firstName, lastName: form.lastName, email: form.email,
        password: form.password, companyName: form.companyName, country: form.country, currency: form.currency,
      });
      toast.success('Account created! Welcome aboard.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-neon-purple/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-500 to-neon-purple flex items-center justify-center shadow-2xl shadow-accent-500/30 animate-float">
              <HiOutlineCollection className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-4xl font-extrabold text-gradient">ReimburseFlow</h1>
          </div>
          <p className="text-dark-400">Create your company account</p>
        </div>

        <div className="card-glass glow-border">
          <h2 className="text-xl font-bold text-white mb-4">Company Admin Sign Up</h2>
          <div className="bg-accent-500/10 border border-accent-500/20 rounded-xl px-4 py-3 mb-5 text-xs text-dark-300">
            <p>This creates a <strong className="text-accent-300">new company</strong> with you as the <strong className="text-accent-300">Admin</strong>.</p>
            <p className="mt-1 text-dark-400">Employees, Managers, Finance, and Directors should be added by the Admin from the Users page after login.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Company Name *</label>
              <input type="text" className="input-field" value={form.companyName} onChange={update('companyName')} required placeholder="Your company" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">First Name *</label>
                <input type="text" className="input-field" value={form.firstName} onChange={update('firstName')} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Last Name *</label>
                <input type="text" className="input-field" value={form.lastName} onChange={update('lastName')} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Country *</label>
              <select className="input-field" value={form.country} onChange={handleCountryChange} required>
                <option value="">Select country</option>
                {countries.map((c) => <option key={c.name} value={c.name}>{c.flag} {c.name} ({c.currencyCode})</option>)}
              </select>
              {form.currency && (
                <p className="text-xs text-accent-400 mt-1.5">
                  Company currency: <strong>{form.currency}</strong>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Email *</label>
              <input type="email" className="input-field" value={form.email} onChange={update('email')} required placeholder="you@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Password *</label>
              <input type="password" className="input-field" value={form.password} onChange={update('password')} required placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Confirm Password *</label>
              <input type="password" className="input-field" value={form.confirmPassword} onChange={update('confirmPassword')} required placeholder="Repeat password" />
              {form.confirmPassword && form.password !== form.confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>
            <button type="submit" className="btn-primary w-full text-base py-3" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-center text-sm text-dark-400 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 font-semibold transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
