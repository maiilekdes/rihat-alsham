'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api';

interface Summary {
  revenue: number;
  orderCount: number;
  byPaymentType: { method: string; count: number; revenue: number }[];
  bestSellers: { name_en: string; name_ar: string; units_sold: number }[];
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<'daily' | 'weekly'>('daily');
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    api.get(`/api/analytics/summary?range=${range}`).then((res) => setSummary(res.data));
  }, [range]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24 }}>Analytics</h1>
        <select className="input" style={{ width: 160 }} value={range} onChange={(e) => setRange(e.target.value as any)}>
          <option value="daily">Today</option>
          <option value="weekly">Last 7 Days</option>
        </select>
      </div>

      {!summary ? (
        <p>Loading…</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card">
              <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Revenue (SAR)</p>
              <p style={{ fontSize: 28, fontWeight: 700 }}>{summary.revenue.toFixed(2)}</p>
            </div>
            <div className="card">
              <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Completed Orders</p>
              <p style={{ fontSize: 28, fontWeight: 700 }}>{summary.orderCount}</p>
            </div>
            {summary.byPaymentType.map((p) => (
              <div className="card" key={p.method}>
                <p style={{ color: 'var(--ink-soft)', fontSize: 13, textTransform: 'capitalize' }}>{p.method}</p>
                <p style={{ fontSize: 22, fontWeight: 700 }}>{p.count} orders</p>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{Number(p.revenue).toFixed(2)} SAR</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Best Sellers</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={summary.bestSellers} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name_en" width={160} />
                <Tooltip />
                <Bar dataKey="units_sold" fill="#f28c1c" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
