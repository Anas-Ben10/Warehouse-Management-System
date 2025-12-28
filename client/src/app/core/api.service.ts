import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Item = { id: string; sku: string; name: string; barcode?: string | null; reorderLevel: number; };
export type Location = { id: string; code: string; name: string; };
export type StockRow = { id: string; itemId: string; locationId: string; qty: number; item: Item; location: Location; };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl =
    (typeof window !== 'undefined' && window.location.hostname.includes('localhost'))
      ? 'http://localhost:8080'
      : 'https://warehouse-management-system-6f19.onrender.com';

  // If your auth uses cookies (you have cookieParser + cors credentials),
  // you MUST send withCredentials:
  private readonly opts = { withCredentials: true };

  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<any>(`${this.baseUrl}/api/auth/login`, { email, password }, this.opts);
  }

  me() {
    return this.http.get<any>(`${this.baseUrl}/api/auth/me`, this.opts);
  }

  listInventory() {
    return this.http.get<StockRow[]>(`${this.baseUrl}/api/inventory`, this.opts);
  }

  listItems() {
    return this.http.get<Item[]>(`${this.baseUrl}/api/items`, this.opts);
  }

  listLocations() {
    return this.http.get<Location[]>(`${this.baseUrl}/api/locations`, this.opts);
  }

  createTxn(body: any) {
    return this.http.post<any>(`${this.baseUrl}/api/transactions`, body, this.opts);
  }

  syncPush(ops: any[]) {
    return this.http.post<any>(`${this.baseUrl}/api/sync/push`, { ops }, this.opts);
  }

  syncPull(since: number) {
    return this.http.get<any>(`${this.baseUrl}/api/sync/pull?since=${since}`, this.opts);
  }
}
