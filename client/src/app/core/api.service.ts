import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Item = { id: string; sku: string; name: string; barcode?: string | null; reorderLevel: number; };
export type Location = { id: string; code: string; name: string; };
export type StockRow = { id: string; itemId: string; locationId: string; qty: number; item: Item; location: Location; };

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  login(email: string, password: string){
    return this.http.post<any>('/api/auth/login', { email, password });
  }
  me(){ return this.http.get<any>('/api/auth/me'); }

  listInventory(){ return this.http.get<StockRow[]>('/api/inventory'); }
  listItems(){ return this.http.get<Item[]>('/api/items'); }
  listLocations(){ return this.http.get<Location[]>('/api/locations'); }

  createTxn(body: any){ return this.http.post<any>('/api/transactions', body); }

  syncPush(ops: any[]){ return this.http.post<any>('/api/sync/push', { ops }); }
  syncPull(since: number){ return this.http.get<any>(`/api/sync/pull?since=${since}`); }
}
