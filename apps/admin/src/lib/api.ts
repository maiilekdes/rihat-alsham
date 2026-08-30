import axios from 'axios';
import { auth } from './firebase';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Staff/owner sign in with email+password via Firebase Auth (see login page);
// every request attaches a fresh ID token so the backend's requireAuth +
// requireRole middleware can authorize it.
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
