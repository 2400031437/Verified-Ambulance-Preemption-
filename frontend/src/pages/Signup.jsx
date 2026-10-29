import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import AuthLayout from '../components/AuthLayout.jsx';
import { Field, useRun, useToast } from '../components/ui.jsx';

export const QUESTIONS = [
  'What is the name of your first school?',
  'What is your mother’s first name?',
  'What was the name of your first pet?',
  'In which town were you born?',
  'What is your favourite teacher’s name?',
];

export default function Signup() {
  const nav = useNavigate();
  const run = useRun();
  const toast = useToast();
  const [role, setRole] = useState('driver');
  const [busy, setBusy] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    setBusy(true);
    run(async () => {
      const d = await api('/auth/register', 'POST', { ...body, role });
      toast(d.message);
      nav('/');
    }).finally(() => setBusy(false));
  };

  return (
    <AuthLayout>
      <h2>Create account</h2>
      <p className="lead">The admin approves new accounts before the first login</p>
      <div className="seg">
        <button type="button" className={role === 'driver' ? 'on' : ''} onClick={() => setRole('driver')}>🚑 Ambulance driver</button>
        <button type="button" className={role === 'hospital' ? 'on' : ''} onClick={() => setRole('hospital')}>🏥 Hospital</button>
      </div>
      <form onSubmit={submit} key={role}>
        <Field label={role === 'driver' ? 'Driver name' : 'Contact person name'}><input name="name" required /></Field>
        <Field label="Phone number (used to login)"><input name="phone" inputMode="numeric" maxLength={13} pattern="[0-9+]{10,13}" placeholder="10-digit mobile number" required /></Field>
        <div className="grid2">
          <Field label="PIN (4-6 digits)"><input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} required /></Field>
          <Field label="Confirm PIN"><input name="confirm_pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} required /></Field>
        </div>
        <Field label="Security question (to reset a forgotten PIN)">
          <select name="recovery_question">{QUESTIONS.map((q) => <option key={q}>{q}</option>)}</select>
        </Field>
        <Field label="Your answer"><input name="recovery_answer" required /></Field>
        {role === 'driver' ? (
          <>
            <Field label="Ambulance number"><input name="ambulance_number" placeholder="AP39 XX 1234" required /></Field>
            <Field label="Ambulance type"><select name="ambulance_type"><option>BASIC</option><option>ADVANCED</option><option>ICU</option><option>NEONATAL</option></select></Field>
          </>
        ) : (
          <>
            <Field label="Hospital name"><input name="hospital_name" required /></Field>
            <Field label="Hospital address"><input name="address" /></Field>
            <p className="mut small" style={{ marginTop: -4 }}>After the first login, set the hospital location on the map under “Profile &amp; beds”.</p>
          </>
        )}
        <button className="btn primary block lg" disabled={busy}>Register</button>
      </form>
      <div className="auth-foot">Already registered? <Link to="/"><b>Login</b></Link></div>
    </AuthLayout>
  );
}
