import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Item = { id: string; sku: string; name: string; barcode?: string | null; reorderLevel: number; };
export type Location = { id: string; code: string; name: string; };
export type StockRow = { id: string; itemId: string; locationId: string; qty: number; item: Item; location: Location; };

const API_BASE = 'https://warehouse-management-system-6f19.onrender.com';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  private opts = { withCredentials: true };

  login(email: string, password: string) {
    return this.http.post<any>(`${API_BASE}/api/auth/login`, { email, password }, this.opts);
  }

  me() {
    return this.http.get<any>(`${API_BASE}/api/auth/me`, this.opts);
  }

  listInventory() {
    return this.http.get<StockRow[]>(`${API_BASE}/api/inventory`, this.opts);
  }

  listItems() {
    return this.http.get<Item[]>(`${API_BASE}/api/items`, this.opts);
  }

  listLocations() {
    return this.http.get<Location[]>(`${API_BASE}/api/locations`, this.opts);
  }

  createTxn(body: any) {
    return this.http.post<any>(`${API_BASE}/api/transactions`, body, this.opts);
  }

  syncPush(ops: any[]) {
    return this.http.post<any>(`${API_BASE}/api/sync/push`, { ops }, this.opts);
  }

  syncPull(since: number) {
    return this.http.get<any>(`${API_BASE}/api/sync/pull?since=${since}`, this.opts);
  }
}
