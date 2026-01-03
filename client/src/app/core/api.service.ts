import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export type Division = { id: string; name: string };

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: 'STAFF' | 'MANAGER' | 'ADMIN';
  isActive: boolean;
  division?: Division | null;
  createdAt?: string;
};

export type Item = {
  id: string;
  sku: string;
  name: string;
  barcode?: string | null;
  reorderLevel: number;
  isDeleted?: boolean;
};

export type LocationKind = 'WAREHOUSE' | 'PROJECT';

export type Location = {
  id: string;
  code: string;
  name: string;
  kind?: LocationKind;
  divisionId?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type Project = {
  id: string;
  code: string;
  name: string;
  divisionId: string;
  division?: Division | null;
  locationId: string;
  location?: Location | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StockRow = {
  id: string;
  itemId: string;
  locationId: string;
  qty: number;
  item: Item;
  location: Location;
};

export type Kpis = {
  itemsCount: number;
  locationsCount: number;
  totalStockQty: number;
  txCount24h: number;
  txCount7d: number;
  topPerformers7d: Array<{ user: { id: string; name: string; email: string }; txCount7d: number }>;
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = (environment.apiBaseUrl || '').replace(/\/$/, '');

  constructor(private http: HttpClient) {}

  // ---------- Auth ----------
  login(email: string, password: string) {
    return this.http.post<any>(
      `${this.base}/api/auth/login`,
      { email, password },
      { withCredentials: true }
    );
  }

  register(email: string, name: string, password: string) {
    return this.http.post<any>(
      `${this.base}/api/auth/register`,
      { email, name, password },
      { withCredentials: true }
    );
  }

  setPassword(email: string, token: string, password: string) {
    return this.http.post<any>(
      `${this.base}/api/auth/set-password`,
      { email, token, password },
      { withCredentials: true }
    );
  }

  forgotPassword(email: string) {
    return this.http.post<any>(`${this.base}/api/auth/forgot-password`, { email }, { withCredentials: true });
  }

  resetPassword(email: string, token: string, password: string) {
    return this.http.post<any>(`${this.base}/api/auth/reset-password`, { email, token, password }, { withCredentials: true });
  }

  adminSendReset(email: string) {
    return this.http.post<any>(`${this.base}/api/auth/send-reset`, { email }, { withCredentials: true });
  }

  me() {
    return this.http.get<any>(`${this.base}/api/auth/me`, { withCredentials: true });
  }

  refresh() {
    return this.http.post<any>(`${this.base}/api/auth/refresh`, {}, { withCredentials: true });
  }

  logout() {
    return this.http.post<any>(`${this.base}/api/auth/logout`, {}, { withCredentials: true });
  }

  // ---------- Admin: users / roles / divisions ----------
  listUsers() {
    return this.http.get<UserRow[]>(`${this.base}/api/auth/users`, { withCredentials: true });
  }

  updateUser(id: string, patch: Partial<{ name: string; role: UserRow['role']; isActive: boolean; divisionId: string | null }>) {
    return this.http.patch<UserRow>(`${this.base}/api/auth/users/${id}`, patch, { withCredentials: true });
  }

  inviteUser(body: { email: string; name: string; role?: UserRow['role']; divisionId?: string | null; expiresHours?: number }) {
    return this.http.post<any>(`${this.base}/api/auth/invite`, body, { withCredentials: true });
  }

  listDivisions() {
    return this.http.get<Division[]>(`${this.base}/api/auth/divisions`, { withCredentials: true });
  }

  createDivision(name: string) {
    return this.http.post<Division>(`${this.base}/api/auth/divisions`, { name }, { withCredentials: true });
  }

  // ---------- Manager ----------
  team() {
    return this.http.get<UserRow[]>(`${this.base}/api/auth/team`, { withCredentials: true });
  }

  kpis() {
    return this.http.get<Kpis>(`${this.base}/api/reports/kpis`, { withCredentials: true });
  }

  activity() {
    return this.http.get<any[]>(`${this.base}/api/reports/activity`, { withCredentials: true });
  }

  // ---------- Inventory ----------
  listInventory() {
    return this.http.get<StockRow[]>(`${this.base}/api/inventory/stock`, { withCredentials: true });
  }

  listItems() {
    return this.http.get<Item[]>(`${this.base}/api/items`, { withCredentials: true });
  }

  lookupItem(params: { barcode?: string; sku?: string }) {
    const qs = new URLSearchParams();
    if (params.barcode) qs.set('barcode', params.barcode);
    if (params.sku) qs.set('sku', params.sku);
    return this.http.get<Item>(`${this.base}/api/items/lookup?${qs.toString()}`, { withCredentials: true });
  }

  listLocations(scope: "own" | "all" = "own") {
    const qs = new URLSearchParams();
    if (scope) qs.set("scope", scope);
    return this.http.get<Location[]>(`${this.base}/api/locations?${qs.toString()}`, { withCredentials: true });
  }

  
  createLocation(body: { code: string; name: string; kind?: LocationKind; divisionId?: string | null; address?: string | null; lat?: number | null; lng?: number | null; }) {
    return this.http.post<Location>(`${this.base}/api/locations`, body, { withCredentials: true });
  }

  updateLocation(id: string, body: { code: string; name: string; kind?: LocationKind; divisionId?: string | null; address?: string | null; lat?: number | null; lng?: number | null; }) {
    return this.http.put<Location>(`${this.base}/api/locations/${id}`, body, { withCredentials: true });
  }

  deleteLocation(id: string) {
    return this.http.delete<Location>(`${this.base}/api/locations/${id}`, { withCredentials: true });
  }

// ---------- Projects ----------
  listProjects() {
    return this.http.get<Project[]>(`${this.base}/api/projects`, { withCredentials: true });
  }

  createProject(body: { code?: string; name: string; divisionId?: string }) {
    return this.http.post<Project>(`${this.base}/api/projects`, body, { withCredentials: true });
  }

  projectStock(projectId: string) {
    return this.http.get<any[]>(`${this.base}/api/projects/${projectId}/stock`, { withCredentials: true });
  }

  // ---------- Transactions ----------
  createTxn(body: {
    offlineOpId?: string;
    type: 'RECEIVE' | 'SHIP' | 'TRANSFER' | 'DIVISION_TRANSFER' | 'PROJECT_ISSUE' | 'PROJECT_RETURN';
    itemId: string;
    qty: number;
    srcLocationId?: string | null;
    dstLocationId?: string | null;
    projectId?: string | null;
    note?: string | null; // description
    isFree?: boolean;
    unitPrice?: number | null;
  }) {
    return this.http.post<any>(`${this.base}/api/transactions`, body, { withCredentials: true });
  }


  // ---------- Sync ----------
  syncPush(ops: any[]) {
    return this.http.post<any>(`${this.base}/api/sync/push`, { ops }, { withCredentials: true });
  }

  syncPull(since: number) {
    return this.http.get<any>(`${this.base}/api/sync/pull?since=${since}`, { withCredentials: true });
  }
}
