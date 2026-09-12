import { inject } from "@angular/core";
import { HttpInterceptorFn } from "@angular/common/http";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { AuthService } from "../services/auth.service";
import { ToastService } from "../../features/toast/toast.service";
import { parseApiError } from "../utils/api-error";
import { SKIP_ERROR_TOAST } from "../http/error-toast.context";

function isAuthRequest(url: string): boolean {
  return url.includes("/api/auth/login") || url.includes("/api/auth/register");
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  // withCredentials stays on for the cookie fallback (same-site/local-dev);
  // the Authorization header is the primary mechanism — it's what actually
  // survives Safari's ITP once frontend/backend are cross-site.
  const token = authService.getToken();
  const authorizedReq = req.clone({
    withCredentials: true,
    setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return next(authorizedReq).pipe(
    catchError((error) => {
      const skipToast = req.context.get(SKIP_ERROR_TOAST);
      const parsed = parseApiError(error);

      if (!skipToast) {
        toast.error(parsed.message, parsed.detail);
      }

      if (error?.status === 401 && !isAuthRequest(req.url)) {
        authService.forceLogout();
        router.navigate(["/auth/login"]);
      }

      return throwError(() => error);
    })
  );
};
