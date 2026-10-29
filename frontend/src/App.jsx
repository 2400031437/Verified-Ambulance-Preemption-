import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Ambulance, Building2, FileClock, HeartPulse, LayoutDashboard, MapPinned, RadioTower, Siren, UserCheck } from 'lucide-react';
import { RequireRole } from './lib/auth.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Forgot from './pages/Forgot.jsx';
import Find from './pages/Find.jsx';
import { GpsProvider } from './lib/gps.jsx';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const AmbulancesPage = lazy(() => import('./pages/AdminCrud.jsx').then((m) => ({ default: m.AmbulancesPage })));
const HospitalsPage = lazy(() => import('./pages/AdminCrud.jsx').then((m) => ({ default: m.HospitalsPage })));
const ReadersPage = lazy(() => import('./pages/AdminCrud.jsx').then((m) => ({ default: m.ReadersPage })));
const Approvals = lazy(() => import('./pages/AdminOther.jsx').then((m) => ({ default: m.Approvals })));
const ScanLog = lazy(() => import('./pages/AdminOther.jsx').then((m) => ({ default: m.ScanLog })));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard.jsx'));
const DriverRun = lazy(() => import('./pages/DriverRun.jsx'));
const HospitalDashboard = lazy(() => import('./pages/HospitalDashboard.jsx'));
const HospitalIncoming = lazy(() => import('./pages/HospitalIncoming.jsx'));
const HospitalProfile = lazy(() => import('./pages/HospitalProfile.jsx'));

const ADMIN = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/approvals', label: 'Approvals', icon: UserCheck },
  { to: '/admin/ambulances', label: 'Ambulances', icon: Ambulance },
  { to: '/admin/hospitals', label: 'Hospitals', icon: Building2 },
  { to: '/admin/readers', label: 'RFID readers', icon: RadioTower },
  { to: '/admin/scans', label: 'Scan log & test', icon: FileClock },
];
const DRIVER = [
  { to: '/driver', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/driver/run', label: 'Emergency run', icon: Siren },
];
const HOSPITAL = [
  { to: '/hospital', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/hospital/incoming', label: 'Incoming patients', icon: Siren },
  { to: '/hospital/profile', label: 'Profile & beds', icon: HeartPulse },
];

export default function App() {
  return (
    <Suspense fallback={<div className="empty">Loading…</div>}>
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/find" element={<Find />} />
      <Route path="/admin" element={<RequireRole role="admin"><Shell title="Admin console" items={ADMIN} /></RequireRole>}>
        <Route index element={<AdminDashboard />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="ambulances" element={<AmbulancesPage />} />
        <Route path="hospitals" element={<HospitalsPage />} />
        <Route path="readers" element={<ReadersPage />} />
        <Route path="scans" element={<ScanLog />} />
      </Route>
      <Route path="/driver" element={<RequireRole role="driver"><GpsProvider><Shell title="Ambulance driver" items={DRIVER} /></GpsProvider></RequireRole>}>
        <Route index element={<DriverDashboard />} />
        <Route path="run" element={<DriverRun />} />
      </Route>
      <Route path="/hospital" element={<RequireRole role="hospital"><Shell title="Hospital reception" items={HOSPITAL} /></RequireRole>}>
        <Route index element={<HospitalDashboard />} />
        <Route path="incoming" element={<HospitalIncoming />} />
        <Route path="profile" element={<HospitalProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
