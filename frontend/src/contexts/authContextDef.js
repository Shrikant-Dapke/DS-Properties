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

export function isPartner(user) {
  return user?.role === 'partner';
}

export function isDeveloper(user) {
  return user?.role === 'developer';
}

// Business-data mutations (transactions, customers, categories, financial
// settings) may only be PROPOSED by partners — every proposal becomes a
// change request requiring unanimous approval from all other active partners.
// Admins supervise (view data/reports/audit, manage users) but cannot mutate
// business data; read-only users can only view. Server-side authorization is
// authoritative; these helpers only control UI affordances.
export function canWrite(user) {
  return user?.role === 'partner';
}

// Mutation controls are visible to partners (propose) and the developer
// (direct apply). Admins get no business-mutation controls.
export function canOperate(user) {
  return user?.role === 'partner' || user?.role === 'developer';
}