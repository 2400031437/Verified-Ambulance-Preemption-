import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import { Field, useRun } from '../components/ui.jsx';

/** The ONE login page for admin, driver and hospital. The role comes from the database. */
export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const run = useRun();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  if (user?.role) {
    return <Navigate to={`/${user.role.toLowerCase()}`} replace />;
  }

  const submit = (e) => {
    e.preventDefault();
    setBusy(true);
    run(async () => {
      const d = await api('/auth/login', 'POST', { phone, pin });
      login(d);
      nav(`/${d.user.role}`);
    }).finally(() => setBusy(false));
  };

  return (
    <AuthLayout>
      <h2>Welcome</h2>
      <p className="lead">Login with your phone number and PIN</p>
      <form onSubmit={submit}>
        <Field label="Phone number">
          <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))} inputMode="numeric" maxLength={13}
            placeholder="10-digit mobile number" autoFocus required />
        </Field>
        <Field label="PIN">
          <div className="pinbox"><input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
            maxLength={6} placeholder="••••" required /></div>
        </Field>
        <div className="auth-links"><span /><Link to="/forgot">Forgot PIN?</Link></div>
        <button className="btn primary block lg" disabled={busy}><LogIn size={18} />Login</button>
      </form>
      <div className="auth-foot">New driver or hospital? <Link to="/signup"><b>Sign up</b></Link></div>
    </AuthLayout>
  );
}
