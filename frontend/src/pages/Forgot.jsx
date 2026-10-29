import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import AuthLayout from '../components/AuthLayout.jsx';
import { Field, useRun, useToast } from '../components/ui.jsx';

export default function Forgot() {
  const nav = useNavigate();
  const run = useRun();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);

  const step1 = (e) => {
    e.preventDefault();
    setBusy(true);
    run(async () => { const d = await api('/auth/forgot/question', 'POST', { phone }); setQuestion(d.question); }).finally(() => setBusy(false));
  };
  const step2 = (e) => {
    e.preventDefault();
    if (pin !== pin2) { toast('PIN and confirm PIN do not match', 'err'); return; }
    setBusy(true);
    run(async () => { const d = await api('/auth/forgot/reset', 'POST', { phone, answer, new_pin: pin }); toast(d.message); nav('/'); }).finally(() => setBusy(false));
  };

  return (
    <AuthLayout>
      <h2>Forgot PIN</h2>
      <p className="lead">{question ? 'Answer your security question and choose a new PIN' : 'Enter your registered phone number'}</p>
      {!question ? (
        <form onSubmit={step1}>
          <Field label="Phone number"><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))} inputMode="numeric" maxLength={13} required autoFocus /></Field>
          <button className="btn primary block lg" disabled={busy}>Continue</button>
        </form>
      ) : (
        <form onSubmit={step2}>
          <Field label="Security question"><input value={question} readOnly /></Field>
          <Field label="Your answer"><input value={answer} onChange={(e) => setAnswer(e.target.value)} required autoFocus /></Field>
          <div className="grid2">
            <Field label="New PIN"><input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" minLength={4} maxLength={6} required /></Field>
            <Field label="Confirm new PIN"><input type="password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} inputMode="numeric" minLength={4} maxLength={6} required /></Field>
          </div>
          <button className="btn primary block lg" disabled={busy}>Change PIN</button>
        </form>
      )}
      <p className="mut small center" style={{ marginTop: 14 }}>Forgot the answer too? Ask the admin to reset your PIN.</p>
      <div className="auth-foot"><Link to="/"><b>Back to login</b></Link></div>
    </AuthLayout>
  );
}
