import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Item = { id: string; sku: string; name: string; barcode?: string | null; reorderLevel: number; };
export type Location = { id: string; code: string; name: string; };
export type StockRow = { id: string; itemId: string; locationId: string; qty: number; item: Item; location: Location; };

@Injectable({ providedIn: 'root' })
export class ApiService {
  // ✅ Local dev: keep relative /api (works with your local nginx proxy)
  // ✅ Render prod: use the backend URL directly
  private readonly apiOrigin =
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? ''
      : 'https://warehouse-management-system-6f19.onrender.com';

  private url(path: string) {
    return `${this.apiOrigin}${path}`;
  }

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<any>(this.url('/api/auth/login'), { email, password }, { withCredentials: true });
  }

  me() {
    return this.http.get<any>(this.url('/api/auth/me'), { withCredentials: true });
  }

  listInventory() {
    return this.http.get<StockRow[]>(this.url('/api/inventory'), { withCredentials: true });
  }

  listItems() {
    return this.http.get<Item[]>(this.url('/api/items'), { withCredentials: true });
  }

  listLocations() {
    return this.http.get<Location[]>(this.url('/api/locations'), { withCredentials: true });
  }

  createTxn(body: any) {
    return this.http.post<any>(this.url('/api/transactions'), body, { withCredentials: true });
  }

  syncPush(ops: any[]) {
    return this.http.post<any>(this.url('/api/sync/push'), { ops }, { withCredentials: true });
  }

  syncPull(since: number) {
    return this.http.get<any>(this.url(`/api/sync/pull?since=${since}`), { withCredentials: true });
  }
}
