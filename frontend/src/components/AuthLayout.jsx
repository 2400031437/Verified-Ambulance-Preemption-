import { Link } from 'react-router-dom';
import { MapPinned, ShieldCheck, Siren, Stethoscope } from 'lucide-react';

export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="logo"><i>🚑</i><span>Verified Ambulance<br />Preemption System</span></div>
        <h1>Every second counts. Let the signal clear the way.</h1>
        <p>Verified ambulances turn traffic signals green automatically, and the hospital is alerted and ready before the patient arrives.</p>
        <ul>
          <li><i><Siren size={16} /></i>Driver saves patient details, the RFID tag becomes ACTIVE</li>
          <li><i><ShieldCheck size={16} /></i>Road-side reader verifies the tag and the signal turns green</li>
          <li><i><Stethoscope size={16} /></i>Hospital reception sees the patient and live arrival time</li>
          <li><i><MapPinned size={16} /></i>Patients can see free ambulances near them</li>
        </ul>
        <Link to="/find" className="btn" style={{ width: 'fit-content', background: '#ffffff1a', color: '#fff', border: '1px solid #ffffff30' }}>
          <MapPinned size={16} />Find a free ambulance near me
        </Link>
      </aside>
      <main className="auth-main"><div className="auth-card">{children}</div></main>
    </div>
  );
}
