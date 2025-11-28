/**
 * Role-Based Access Control (RBAC) System
 * 
 * Defines permissions and role hierarchies for the application.
 * Use these functions to check authorization in API routes and middleware.
 */

// Available permissions in the system
export type Permission = 
  | 'cars:read'      // View cars
  | 'cars:write'     // Create/edit cars
  | 'cars:delete'    // Delete cars
  | 'clients:read'   // View clients
  | 'clients:write'  // Create/edit clients
  | 'clients:delete' // Delete clients
  | 'deliveries:read'   // View deliveries
  | 'deliveries:write'  // Create/edit deliveries
  | 'users:read'     // View users
  | 'users:manage'   // Create/edit/delete users
  | 'recon:access'   // Access recon features
  | 'marketing:access' // Access marketing page
  | 'admin:access';  // Access admin panel

// System roles - from lowest to highest privilege
export type Role = 'user' | 'recon' | 'manager' | 'admin';

// Role hierarchy for permission inheritance
const ROLE_HIERARCHY: Record<Role, number> = {
  user: 0,
  recon: 1,
  manager: 2,
  admin: 3,
};

// Permissions assigned to each role
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  user: [
    'cars:read',
    'clients:read',
    'clients:write',
    'deliveries:read',
    'deliveries:write',
  ],
  recon: [
    'cars:read',
    'cars:write',
    'clients:read',
    'clients:write',
    'deliveries:read',
    'deliveries:write',
    'recon:access',
  ],
  manager: [
    'cars:read',
    'cars:write',
    'cars:delete',
    'clients:read',
    'clients:write',
    'clients:delete',
    'deliveries:read',
    'deliveries:write',
    'users:read',
    'recon:access',
    'marketing:access',
  ],
  admin: [
    'cars:read',
    'cars:write',
    'cars:delete',
    'clients:read',
    'clients:write',
    'clients:delete',
    'deliveries:read',
    'deliveries:write',
    'users:read',
    'users:manage',
    'recon:access',
    'marketing:access',
    'admin:access',
  ],
};

/**
 * Check if a role has a specific permission.
 * 
 * @param role - The user's role
 * @param permission - The permission to check
 * @returns true if the role has the permission
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const normalizedRole = role.toLowerCase() as Role;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  
  if (!permissions) {
    return false;
  }
  
  return permissions.includes(permission);
}

/**
 * Check if a role has ALL of the specified permissions.
 * 
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the role has all permissions
 */
export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 * 
 * @param role - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the role has at least one permission
 */
export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Check if role1 is higher or equal to role2 in the hierarchy.
 * 
 * @param role1 - First role to compare
 * @param role2 - Second role to compare
 * @returns true if role1 >= role2 in hierarchy
 */
export function isRoleAtLeast(role1: string, role2: Role): boolean {
  const normalizedRole1 = role1.toLowerCase() as Role;
  const level1 = ROLE_HIERARCHY[normalizedRole1] ?? -1;
  const level2 = ROLE_HIERARCHY[role2];
  
  return level1 >= level2;
}

/**
 * Get all permissions for a role.
 * 
 * @param role - The role to get permissions for
 * @returns Array of permissions for the role
 */
export function getPermissions(role: string): Permission[] {
  const normalizedRole = role.toLowerCase() as Role;
  return ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * Check if a string is a valid role.
 * 
 * @param role - String to check
 * @returns true if it's a valid role
 */
export function isValidRole(role: string): role is Role {
  return Object.keys(ROLE_HIERARCHY).includes(role.toLowerCase());
}

/**
 * Require a specific permission, throwing if not authorized.
 * Use in API routes.
 * 
 * @param role - The user's role
 * @param permission - Required permission
 * @throws Error if not authorized
 */
export function requirePermission(role: string | undefined, permission: Permission): void {
  if (!role || !hasPermission(role, permission)) {
    throw new Error(`Permission denied: ${permission} required`);
  }
}

/**
 * Require a minimum role level, throwing if not authorized.
 * Use in API routes.
 * 
 * @param role - The user's role
 * @param minRole - Minimum required role
 * @throws Error if not authorized
 */
export function requireRole(role: string | undefined, minRole: Role): void {
  if (!role || !isRoleAtLeast(role, minRole)) {
    throw new Error(`Permission denied: ${minRole} role or higher required`);
  }
}
