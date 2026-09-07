import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PermissionService } from '../services/permission.service';

/**
 * Route guard driven by `data.permission` (a key or array of keys — any-of).
 * SA always passes. On failure the user is bounced to their own dashboard,
 * mirroring role.guard.ts.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login']);
  }
  if (!auth.isActive()) {
    auth.forceLogout();
    return router.createUrlTree(['/auth/login']);
  }

  const need = route.data['permission'] as string | string[] | undefined;
  const keys = need ? (Array.isArray(need) ? need : [need]) : [];

  if (keys.length === 0 || permissions.canAny(keys)) {
    return true;
  }

  return router.createUrlTree([
    auth.role() === 'SA' ? '/sa/dashboard' : '/employee/dashboard',
  ]);
};
