'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface MenuItem {
  id: string;
  nameAr: string;
  nameEn: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable: boolean;
}
interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  items: MenuItem[];
}

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/api/menu');
    setCategories(data);
    setLoading(false);
  }

  async function toggleAvailability(item: MenuItem) {
    // Optimistic update — the single most frequent admin action, must feel instant.
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i)),
      }))
    );
    await api.patch(`/api/menu/items/${item.id}/availability`, { isAvailable: !item.isAvailable });
  }

  if (loading) return <p>Loading menu…</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Menu Management</h1>
      {categories.map((cat) => (
        <section key={cat.id} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>
            {cat.nameEn} <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>· {cat.nameAr}</span>
          </h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'start', background: 'var(--bg)', fontSize: 12 }}>
                  <th style={{ padding: 12 }}>Item</th>
                  <th style={{ padding: 12 }}>Price (SAR)</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12 }}></th>
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item) => (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: 12 }}>
                      <strong>{item.nameEn}</strong>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{item.nameAr}</div>
                    </td>
                    <td style={{ padding: 12 }}>{item.basePrice.toFixed(2)}</td>
                    <td style={{ padding: 12 }}>
                      <span className={item.isAvailable ? 'badge badge-completed' : 'badge badge-cancelled'}>
                        {item.isAvailable ? 'In stock' : 'Out of stock'}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <button className="btn btn-outline" onClick={() => toggleAvailability(item)}>
                        {item.isAvailable ? 'Mark Out of Stock' : 'Mark In Stock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
