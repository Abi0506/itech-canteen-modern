const ROLE_HOME_PATHS = {
  superadmin: '/admin/reports',
  admin: '/admin/reports',
  inventory_manager: '/inventory/dashboard',
  cashier: '/cashier/tables',
  chef: '/kds',
  customer: '/self-order',
  user: '/self-order',
  dept: '/self-order',
  external: '/self-order',
};

const ROLE_LABELS = {
  superadmin: 'Superadmin',
  admin: 'Superadmin',
  inventory_manager: 'Inventory Manager',
  cashier: 'Cashier',
  chef: 'Chef',
  customer: 'Customer',
  user: 'Customer',
  dept: 'Department',
  external: 'Staff',
};

export const getLandingPath = (role, fallback = '/dashboard') => {
  return ROLE_HOME_PATHS[role] || fallback;
};

export const getRoleLabel = (role) => {
  return ROLE_LABELS[role] || role || 'User';
};

export const roleMatches = (role, allowedRoles = []) => {
  return allowedRoles.includes(role);
};
