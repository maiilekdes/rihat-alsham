import axios from 'axios';
import Constants from 'expo-constants';
import { auth } from './firebase';

export const api = axios.create({
  baseURL: Constants.expoConfig?.extra?.apiUrl,
  // Axios waits forever by default. On a phone that cannot reach the server
  // (wrong Wi-Fi, server down) that turns every screen into an indefinite
  // spinner, so fail fast enough to show a real error instead.
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
