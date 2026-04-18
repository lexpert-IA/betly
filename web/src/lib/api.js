/**
 * Authenticated fetch wrapper.
 * Adds Firebase Bearer token to every request automatically.
 * Usage: import { apiFetch } from '../lib/api';
 *        const res = await apiFetch('/api/some/endpoint', { method: 'POST', ... });
 */
import { auth } from './firebase';

const BASE = import.meta.env.VITE_API_URL || '';

export async function apiFetch(path, options = {}) {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  } catch {}
  return fetch(`${BASE}${path}`, options);
}
