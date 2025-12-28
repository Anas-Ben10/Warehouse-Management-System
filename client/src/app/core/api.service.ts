import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Item = { id: string; sku: string; name: string; barcode?: string | null; reorderLevel: number; };
export type Location = { id: string; code: string; name: string; };
export type StockRow = { id: string; itemId: string; locationId: string; qty: number; item: Item; location: Location; };

// ✅ Your deployed backend base URL
const API_BASE = 'https://warehouse-management-system-6f19.onrender.com';
const API = `${API_BASE}/api`;

// ✅ If your auth uses cookies (very likely), keep this ON
const OPTS = { withCredentials: true };

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  login(email: string, password: string) {
    return this.http.post<any>(`${API}/auth/login`, { email, password }, OPTS);
  }

  me() {
    return this.http.get<any>(`${API}/auth/me`, OPTS);
  }

  listInventory() {
    return this.http.get<StockRow[]>(`${API}/inventory`, OPTS);
  }

  listItems() {
    return this.http.get<Item[]>(`${API}/items`, OPTS);
  }

  listLocations() {
    return this.http.get<Location[]>(`${API}/locations`, OPTS);
  }

  createTxn(body: any) {
    return this.http.post<any>(`${API}/transactions`, body, OPTS);
  }

  syncPush(ops: any[]) {
    return this.http.post<any>(`${API}/sync/push`, { ops }, OPTS);
  }

  syncPull(since: number) {
    return this.http.get<any>(`${API}/sync/pull?since=${since}`, OPTS);
  }
}
