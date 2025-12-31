import { Injectable } from '@angular/core';
import type { Division } from './api.service';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'STAFF' | 'MANAGER' | 'ADMIN';
  isActive?: boolean;
  division?: Division | null;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'wms_access_token';
  private userKey = 'wms_user';

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get user(): User | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? (JSON.parse(raw) as User) : null;
  }

  isAuthed(): boolean {
    return !!this.token;
  }

  isAdmin(): boolean {
    return this.user?.role === 'ADMIN';
  }

  isManager(): boolean {
    return this.user?.role === 'MANAGER';
  }

  setSession(accessToken: string, user: User) {
    localStorage.setItem(this.tokenKey, accessToken);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clear() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }
}
