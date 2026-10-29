import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';

export default function Shell({ title, items }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(document.documentElement.dataset.theme === 'dark');
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; localStorage.setItem('theme', next); setDark(!dark);
  };
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="logo"><i>🚑</i><span>Ambulance<br />Preemption</span></div>
        <nav className="nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}><Icon size={18} />{label}</NavLink>
          ))}
        </nav>
        <div className="foot">Signed in as <b>{user.role}</b></div>
      </aside>
      <div className="main">
        <header className="top">
          <div className="row">
            <button className="iconbtn burger" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={18} /></button>
            <h2>{title}</h2>
          </div>
          <div className="row">
            <button className="iconbtn" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
            <div className="small" style={{ lineHeight: 1.2 }}><b>{user.name}</b><br /><span className="mut">{user.phone}</span></div>
            <button className="btn sm" onClick={() => { logout(); nav('/'); }}><LogOut size={15} />Logout</button>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
