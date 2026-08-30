'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/orders');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <form onSubmit={handleSubmit} className="card" style={{ width: 360 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>ريحة الشام</h1>
        <p style={{ color: 'var(--ink-soft)', marginTop: 0, marginBottom: 20 }}>Staff Dashboard Login</p>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Email</label>
        <input className="input" style={{ margin: '6px 0 14px' }} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label style={{ fontSize: 13, fontWeight: 600 }}>Password</label>
        <input className="input" style={{ margin: '6px 0 18px' }} value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        {error && <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
        <button className="btn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
