export const ROLES = {
  DEVELOPER: 'developer',
  PARTNER: 'partner',
  ADMIN: 'admin',
};

// Every authenticated role may read official business data.
export const ALL_ROLES = [ROLES.DEVELOPER, ROLES.PARTNER, ROLES.ADMIN];

// Mutation permissions for Phase 1.
// Developer may perform all write operations. Partner write operations are
// introduced in Phase 2 (via the Partner Change Request workflow) and are NOT
// enabled here, so Partner has no direct write access yet. Admin is read-only.
export const WRITE_ROLES = [ROLES.DEVELOPER];
