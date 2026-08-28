import { createContext } from 'react';

export const AuthContext = createContext(null);

export const initialUser = {
  publicId: null,
  username: null,
  fullName: null,
  role: null,
};

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function canWrite(user) {
  return user?.role === 'admin';
}