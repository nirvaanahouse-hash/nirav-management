import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(["/auth/login"]);
  }

  if (!authService.isActive()) {
    authService.forceLogout();
    return router.createUrlTree(["/auth/login"]);
  }

  const currentRole = authService.role();
  const allowedRoles = route.data["roles"] as string[] | undefined;

  if (!allowedRoles?.length) {
    return true;
  }

  if (allowedRoles.includes(currentRole as string)) {
    return true;
  }

  if (currentRole === "SA") {
    return router.createUrlTree(["/sa/dashboard"]);
  }

  return router.createUrlTree(["/employee/dashboard"]);
};
