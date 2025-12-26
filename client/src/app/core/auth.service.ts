import { Injectable } from '@angular/core';

export type User = { id: string; email: string; name: string; role: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'wms_access_token';
  private userKey = 'wms_user';

  get token(): string | null { return localStorage.getItem(this.tokenKey); }
  get user(): User | null {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) as User : null;
  }

  isAuthed(): boolean { return !!this.token; }

  setSession(accessToken: string, user: User){
    localStorage.setItem(this.tokenKey, accessToken);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clear(){
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  logout(){ this.clear(); }
}
