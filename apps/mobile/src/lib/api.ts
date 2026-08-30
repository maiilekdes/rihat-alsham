import axios from 'axios';
import Constants from 'expo-constants';
import { auth } from './firebase';

export const api = axios.create({
  baseURL: Constants.expoConfig?.extra?.apiUrl,
});

api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
