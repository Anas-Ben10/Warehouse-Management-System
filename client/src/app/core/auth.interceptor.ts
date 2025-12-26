import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;

  const base = req.clone({ withCredentials: true });

  if (!token) return next(base);

  return next(base.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};
