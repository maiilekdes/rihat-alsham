'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ItemVariant {
  id: string;
  nameAr: string;
  nameEn: string;
  price: number;
  calories?: number;
  isDefault?: boolean;
}
interface MenuItem {
  id: string;
  nameAr: string;
  nameEn: string;
  basePrice: number;
  imageUrl?: string;
  isAvailable: boolean;
  calories?: number;
  variants: ItemVariant[];
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
  const [editing, setEditing] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

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

  // Sizes carry this menu's real prices, so they are edited in place: click a
  // price, change it, save. No modal, no separate screen.
  async function saveVariant(variantId: string, patch: Partial<ItemVariant>) {
    setSavingId(variantId);
    try {
      await api.patch(`/api/menu/variants/${variantId}`, patch);
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          items: c.items.map((i) => ({
            ...i,
            variants: i.variants?.map((v) => (v.id === variantId ? { ...v, ...patch } : v)) ?? [],
          })),
        }))
      );
    } finally {
      setSavingId(null);
      setEditing(null);
    }
  }

  async function addVariant(item: MenuItem) {
    const nameAr = window.prompt('اسم الحجم بالعربي (e.g. كيلو)');
    if (!nameAr) return;
    const nameEn = window.prompt('Size name in English (e.g. One Kilo)') || nameAr;
    const priceText = window.prompt('Price in SAR');
    const price = Number(priceText);
    if (!priceText || Number.isNaN(price)) return;
    await api.post(`/api/menu/items/${item.id}/variants`, { nameAr, nameEn, price });
    await load();
  }

  async function deleteVariant(variant: ItemVariant) {
    if (!window.confirm(`Remove the size "${variant.nameAr}"? Past orders keep their own record.`)) return;
    await api.delete(`/api/menu/variants/${variant.id}`);
    await load();
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
                  <th style={{ padding: 12 }}>Sizes &amp; Prices (SAR)</th>
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
                    <td style={{ padding: 12 }}>
                      {item.variants?.length ? (
                        // Sizes matter to the counter: "Sfeeha 15" is ambiguous
                        // where the same dish sells by quarter, half and full kilo.
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {item.variants.map((v) => (
                            <div key={v.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 13, minWidth: 150 }}>
                                {v.nameAr}
                                <span style={{ color: 'var(--ink-soft)' }}> · {v.nameEn}</span>
                              </span>

                              {editing === v.id ? (
                                <>
                                  <input
                                    className="input"
                                    style={{ width: 90, padding: '4px 8px', fontVariantNumeric: 'tabular-nums' }}
                                    value={draftPrice}
                                    autoFocus
                                    inputMode="decimal"
                                    onChange={(e) => setDraftPrice(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const n = Number(draftPrice);
                                        if (!Number.isNaN(n) && n >= 0) saveVariant(v.id, { price: n });
                                      }
                                      if (e.key === 'Escape') setEditing(null);
                                    }}
                                  />
                                  <button
                                    className="btn"
                                    style={{ padding: '4px 12px' }}
                                    disabled={savingId === v.id}
                                    onClick={() => {
                                      const n = Number(draftPrice);
                                      if (!Number.isNaN(n) && n >= 0) saveVariant(v.id, { price: n });
                                    }}
                                  >
                                    {savingId === v.id ? 'Saving…' : 'Save'}
                                  </button>
                                  <button className="btn btn-outline" style={{ padding: '4px 12px' }} onClick={() => setEditing(null)}>
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditing(v.id);
                                      setDraftPrice(String(v.price));
                                    }}
                                    title="Click to change this price"
                                    style={{
                                      border: '1px solid transparent',
                                      background: 'transparent',
                                      cursor: 'pointer',
                                      font: 'inherit',
                                      fontWeight: 700,
                                      fontVariantNumeric: 'tabular-nums',
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      color: 'var(--ink)',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                                  >
                                    {v.price.toFixed(2)}
                                  </button>
                                  {v.calories ? (
                                    <span style={{ fontSize: 11, color: 'var(--brand-orange)' }}>{v.calories} cal</span>
                                  ) : null}
                                  {v.isDefault ? (
                                    <span className="badge badge-completed" style={{ fontSize: 10 }}>default</span>
                                  ) : (
                                    <button
                                      className="btn btn-outline"
                                      style={{ padding: '2px 8px', fontSize: 11 }}
                                      onClick={() => saveVariant(v.id, { isDefault: true })}
                                    >
                                      Make default
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-outline"
                                    style={{ padding: '2px 8px', fontSize: 11, color: 'var(--danger)' }}
                                    onClick={() => deleteVariant(v)}
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                          <button
                            className="btn btn-outline"
                            style={{ padding: '3px 10px', fontSize: 11, alignSelf: 'flex-start', marginTop: 2 }}
                            onClick={() => addVariant(item)}
                          >
                            + Add size
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{item.basePrice.toFixed(2)}</strong>
                          {item.calories ? (
                            <span style={{ fontSize: 11, color: 'var(--brand-orange)' }}>{item.calories} cal</span>
                          ) : null}
                          <button
                            className="btn btn-outline"
                            style={{ padding: '2px 10px', fontSize: 11 }}
                            onClick={() => addVariant(item)}
                          >
                            + Add size
                          </button>
                        </div>
                      )}
                    </td>
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
