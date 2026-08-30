'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';

interface StaffUser {
  id: string;
  fullName?: string;
  role: 'staff' | 'owner';
  email?: string;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  staffUser: StaffUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ firebaseUser: null, staffUser: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const { data } = await api.get('/api/users/me');
          // Reject sign-in for anyone who isn't staff/owner — this dashboard
          // is not the customer app, even though it shares the same auth pool.
          if (data.role === 'staff' || data.role === 'owner') {
            setStaffUser({ id: data.id, fullName: data.full_name, role: data.role, email: data.email });
          } else {
            setStaffUser(null);
          }
        } catch {
          setStaffUser(null);
        }
      } else {
        setStaffUser(null);
      }
      setLoading(false);
    });
  }, []);

  return <AuthContext.Provider value={{ firebaseUser, staffUser, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
