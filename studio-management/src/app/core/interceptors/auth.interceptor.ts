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

  // No cookie-based auth anymore — the token lives in sessionStorage and
  // goes out as an Authorization header instead, which sidesteps Safari's
  // ITP and every other cross-site-cookie quirk entirely. withCredentials
  // is forced off here (every individual service call still passes `true`
  // itself; clone() only needs to name a property to override it) since
  // there's nothing left for a cookie jar to carry.
  const token = authService.getToken();
  const authorizedReq = req.clone({
    withCredentials: false,
    setHeaders: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // No-op against a normal host; when the API is tunneled through ngrok's
      // free tier, this skips its browser-warning interstitial (an HTML page
      // ngrok injects in front of GET requests from a browser User-Agent —
      // POSTs like login sailed through untouched, which is why only
      // GET-driven pages looked broken).
      "ngrok-skip-browser-warning": "true",
    },
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
