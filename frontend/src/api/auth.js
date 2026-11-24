import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

function withBearerToken(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
}

export const authApi = {
  async register(payload) {
    const response = await api.post('/auth/register', payload);
    return response.data;
  },

  async login(payload) {
    const response = await api.post('/auth/login', payload);
    return response.data;
  },

  async currentUser(token) {
    const response = await api.get('/auth/me', withBearerToken(token));
    return response.data;
  },

  async logout(token) {
    const response = await api.post('/auth/logout', {}, withBearerToken(token));
    return response.data;
  },
};

export function getApiErrorMessage(error) {
  return (
    error.response?.data?.error?.message ||
    error.response?.data?.message ||
    (error.request
      ? 'Could not reach the server. Check your connection and try again.'
      : 'Something went wrong. Please try again.')
  );
}
