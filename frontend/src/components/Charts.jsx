import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtDay } from '../lib/format.js';
import { Empty } from './ui.jsx';

export const COLORS = ['#b4534a', '#4d7ea8', '#4f8a63', '#b8893c', '#7a6a9a', '#4a8f94'];
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' } };

export function AreaTrend({ data, series }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <defs>{series.map((s, i) => (
          <linearGradient key={s.key} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={s.color} stopOpacity={0.35} /><stop offset="95%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="day" tickFormatter={fmtDay} stroke="var(--mut)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="var(--mut)" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip {...tip} labelFormatter={fmtDay} />
        {series.map((s, i) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} fill={`url(#g${i})`} />)}
        {series.length > 1 && <Legend />}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsDay({ data, dataKey = 'trips', name = 'Trips', color = '#4d7ea8' }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
        <XAxis dataKey="day" tickFormatter={fmtDay} stroke="var(--mut)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis allowDecimals={false} stroke="var(--mut)" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip {...tip} labelFormatter={fmtDay} cursor={{ fill: 'var(--surface2)' }} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data }) {
  const rows = (data || []).map((d) => ({ name: String(d.name).replace(/_/g, ' '), value: Number(d.n) }));
  if (!rows.length) return <Empty>No data yet</Empty>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
          {rows.map((r, i) => <Cell key={r.name} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip {...tip} /><Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HBars({ data }) {
  const rows = (data || []).map((d) => ({ name: d.name, n: Number(d.n) }));
  if (!rows.length) return <Empty>No data yet</Empty>;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={rows} layout="vertical" margin={{ left: 10, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke="var(--mut)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" width={120} stroke="var(--mut)" fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip {...tip} cursor={{ fill: 'var(--surface2)' }} />
        <Bar dataKey="n" name="Cases" fill="#b4534a" radius={[0, 8, 8, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
