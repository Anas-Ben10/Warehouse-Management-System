import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService, Location, Division } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import * as L from 'leaflet';

@Component({
  standalone: true,
  selector: 'app-maps-page',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h2>Locations • Map</h2>

      <div class="toolbar">
        <label style="display:flex;gap:8px;align-items:center;">
          <input type="checkbox" [(ngModel)]="showAllWarehouses" (change)="reload()" [disabled]="!auth.isManager()" />
          Show all warehouses (Managers)
        </label>

        <button (click)="reload()">Reload</button>
      </div>

      <div class="grid">
        <div class="panel">
          <h3>Locations</h3>

          <div class="list">
            <button class="row" *ngFor="let l of locations" (click)="select(l)" [class.active]="selected?.id===l.id">
              <div class="rowhead">
                <div style="font-weight:700">{{ l.code }}</div>
                <a
                  *ngIf="l.lat!=null && l.lng!=null"
                  class="mini"
                  (click)="$event.stopPropagation()"
                  [href]="googleMapsUrl(l.lat!, l.lng!)"
                  target="_blank"
                  rel="noreferrer">Open</a>
              </div>
              <div class="muted">{{ l.name }}</div>
              <div class="muted" *ngIf="l.lat!=null && l.lng!=null">({{ l.lat }}, {{ l.lng }})</div>
              <div class="muted" *ngIf="l.address">{{ l.address }}</div>
            </button>

            <div class="muted" *ngIf="!locations.length">No locations.</div>
          </div>
        </div>

        <div class="panel">
          <h3>Map</h3>

          <div class="muted" *ngIf="!selected">Select a location to view it on the map.</div>

          <div class="mapwrap">
            <!-- Leaflet map (interactive). Admin can click to set coordinates. -->
            <div class="map" [id]="mapId"></div>
          </div>

          <div *ngIf="selected" style="margin-top:10px">
            <div class="muted" style="margin-bottom:8px">
              <b>{{ selected.code }}</b> — {{ selected.name }}
            </div>

            <div class="muted" *ngIf="selected.lat==null || selected.lng==null">
              No coordinates saved yet.
              <span *ngIf="auth.isAdmin()">Click on the map to choose the location, then click <b>Create/Update</b>.</span>
            </div>

            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap" *ngIf="selected.lat!=null && selected.lng!=null">
              <a class="linkbtn" [href]="googleMapsUrl(selected.lat!, selected.lng!)" target="_blank" rel="noreferrer">Open in Google Maps</a>
              <a class="linkbtn" [href]="openStreetMapUrl(selected.lat!, selected.lng!)" target="_blank" rel="noreferrer">Open in OpenStreetMap</a>
            </div>
          </div>

          <!-- Admin panel should be available even if there are no locations yet -->
          <div class="admin" *ngIf="auth.isAdmin()">
            <h3 style="margin-top:18px">Admin • Create / Edit warehouse location</h3>
            <p class="muted" style="margin-top:6px">Tip: Select a location to edit it, or use <b>New</b> to create your first one.</p>

            <div class="form">
              <select [(ngModel)]="form.divisionId">
                <option value="">Select division</option>
                <option *ngFor="let d of divisions" [value]="d.id">{{ d.name }}</option>
              </select>
              <input [(ngModel)]="form.code" placeholder="Code (e.g., WH-RIY-01)" />
              <input [(ngModel)]="form.name" placeholder="Name" />
              <input [(ngModel)]="form.address" placeholder="Address (optional)" />
              <input [(ngModel)]="form.lat" type="number" step="0.000001" placeholder="Latitude" />
              <input [(ngModel)]="form.lng" type="number" step="0.000001" placeholder="Longitude" />
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
              <button (click)="save()" [disabled]="saving">{{ saving ? 'Saving...' : (form.id ? 'Update' : 'Create') }}</button>
              <button (click)="newForm()">New</button>
              <button class="danger" *ngIf="form.id" (click)="remove()">Delete</button>
            </div>

            <p class="muted" style="margin-top:10px" *ngIf="message">{{ message }}</p>
            <p class="muted">Note: Only admins can add/update/delete warehouse locations.</p>
          </div>
        </div>
      </div>

      <p class="muted" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [`
    .container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .toolbar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom: 12px; }
    .grid { display:grid; grid-template-columns: 1fr 1.3fr; gap: 12px; }
    .panel { border: 1px solid #ddd; border-radius: 10px; padding: 14px; }
    .list { display:grid; gap:8px; max-height: 520px; overflow:auto; padding-right: 4px; }
    .row { text-align:left; border: 1px solid #eee; background: #fff; border-radius: 10px; padding: 10px; cursor: pointer; }
    .row.active { border-color: #cfd3ff; background: #f7f7ff; }
    .muted { margin: 0; color: #555; font-size: 13px; }
    .rowhead { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .mini { font-size:12px; color:#111; text-decoration:underline; }
    .mapwrap { border-radius: 12px; overflow:hidden; border: 1px solid #eee; }
    .map { width: 100%; height: 380px; border: 0; }
    button { padding: 9px 12px; border: 0; border-radius: 8px; cursor: pointer; }
    .danger { background: #ffe7e7; }
    .linkbtn { display:inline-block; padding: 9px 12px; border-radius: 8px; background: #f3f3f3; color:#111; text-decoration:none; }
    .form { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
    input { padding: 9px; border: 1px solid #ccc; border-radius: 8px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .map { height: 320px; } .form { grid-template-columns: 1fr; } }
  `]
})
export class MapsPage {
  api = inject(ApiService);
  auth = inject(AuthService);
  route = inject(ActivatedRoute);

  // Leaflet map
  private map: L.Map | null = null;
  private marker: L.CircleMarker | null = null;
  readonly mapId = 'leafletMap';
  // Default center (Riyadh-ish) to avoid showing (0,0) when there are no coordinates.
  private readonly defaultCenter: [number, number] = [24.7136, 46.6753];

  locations: Location[] = [];
  selected: Location | null = null;

  divisions: Division[] = [];

  showAllWarehouses = false;

  // Query params
  private focusLocationId: string | null = null;
  private openedAllScope = false;

  // Remember the admin's current position to keep the map centered when creating a new location
  private adminCurrentCenter: [number, number] | null = null;

  // admin form (warehouse only)
  form: { id?: string | null; code: string; name: string; divisionId: string; address: string; lat: number | null; lng: number | null } = {
    id: null,
    code: '',
    name: '',
    divisionId: '',
    address: '',
    lat: null,
    lng: null
  };

  saving = false;
  message = '';
  error = '';

  ngOnInit() {
    // Read query params (one-shot)
    const qp = this.route.snapshot.queryParamMap;
    this.focusLocationId = qp.get('focus');
    this.openedAllScope = qp.get('all') === '1' || qp.get('scope') === 'all';
    if (this.auth.isManager() && this.openedAllScope) {
      this.showAllWarehouses = true;
    }

    if (this.auth.isAdmin()) {
      this.api.listDivisions().subscribe({ next: (d) => (this.divisions = d || []) });
    }
    this.reload();
  }

  ngAfterViewInit() {
    this.ensureMap();
  }

  ngOnDestroy() {
    try {
      this.map?.remove();
    } catch {}
    this.map = null;
    this.marker = null;
  }

  reload() {
    this.error = '';
    const scope = (this.showAllWarehouses && this.auth.isManager()) ? 'all' : 'own';
    this.api.listLocations(scope as any).subscribe({
      next: (x) => {
        // Map page focuses on warehouses
        this.locations = (x || []).filter(l => !l.kind || l.kind === 'WAREHOUSE');

        // If we were opened with a focus id but we didn't load 'all' ...
        // allow managers to temporarily load all to locate the requested warehouse.
        if (this.focusLocationId && this.auth.isManager() && !this.showAllWarehouses) {
          const foundInOwn = this.locations.some(l => l.id === this.focusLocationId);
          if (!foundInOwn) {
            this.showAllWarehouses = true;
            this.reload();
            return;
          }
        }

        // If a focused location was requested, select it (if present).
        if (this.focusLocationId) {
          const focused = this.locations.find(l => l.id === this.focusLocationId) || null;
          if (focused) {
            this.select(focused);
            return;
          }
        }

        // Keep current selection if possible
        if (this.selected) {
          const refreshed = this.locations.find(l => l.id === this.selected!.id) || null;
          if (refreshed) {
            this.select(refreshed);
            return;
          }
          // selection disappeared
          this.selected = null;
        }

        // Default behavior
        if (this.auth.isAdmin()) {
          // Admin starts on current location (new location form). Clicking a location will move the map.
          this.newForm();
          this.centerAdminToCurrentIfNeeded();
          return;
        }

        const preferred = this.pickPreferredLocation(this.locations);
        if (preferred) this.select(preferred);
      },
      error: (e) => this.error = e?.error?.error || 'Failed to load locations'
    });
  }

  private pickPreferredLocation(list: Location[]): Location | null {
    if (!list?.length) return null;
    const divisionId = this.auth.user?.division?.id;

    // Managers should start on their division/warehouse even when showing all warehouses.
    const inDivision = divisionId ? list.filter(l => l.divisionId === divisionId) : list;
    const firstWithCoords = inDivision.find(l => (l.lat ?? null) !== null && (l.lng ?? null) !== null);
    return firstWithCoords || inDivision[0] || list[0] || null;
  }

  private async centerAdminToCurrentIfNeeded() {
    if (!this.auth.isAdmin()) return;
    if (this.selected) return;
    if (this.adminCurrentCenter) {
      // already have it
      this.updateMapFromCoords(null, null);
      return;
    }

    const coords = await this.getBrowserLocation();
    if (!coords) {
      // fallback to default center
      this.updateMapFromCoords(null, null);
      return;
    }

    this.adminCurrentCenter = coords;
    this.updateMapFromCoords(null, null);
  }

  private getBrowserLocation(): Promise<[number, number] | null> {
    return new Promise((resolve) => {
      try {
        if (!('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } catch {
        resolve(null);
      }
    });
  }

  select(l: Location | null) {
    this.selected = l;
    this.message = '';
    if (!l) return;
    if (this.auth.isAdmin()) {
      this.form = {
        id: l.id,
        code: l.code || '',
        name: l.name || '',
        divisionId: (l.divisionId || ''),
        address: l.address || '',
        lat: (l.lat ?? null),
        lng: (l.lng ?? null),
      };
    }

    // Update map preview when selecting a location.
    this.updateMapFromLocation(l);
  }

  newForm() {
    this.selected = null;
    this.message = '';
    this.form = { id: null, code: '', name: '', divisionId: '', address: '', lat: null, lng: null };
    // Keep map visible; allow admin to click map to choose coordinates.
    this.updateMapFromCoords(this.form.lat, this.form.lng);
  }

  save() {
    if (!this.auth.isAdmin()) return;
    const code = (this.form.code || '').trim();
    const name = (this.form.name || '').trim();
    if (!code || !name) {
      this.message = 'Code and Name are required.';
      return;
    }
    if (!this.form.divisionId) {
      this.message = 'Division is required.';
      return;
    }

    this.saving = true;
    this.message = '';

    const body = {
      code,
      name,
      kind: 'WAREHOUSE' as any,
      address: this.form.address ? this.form.address.trim() : null,
      lat: this.form.lat != null ? Number(this.form.lat) : null,
      lng: this.form.lng != null ? Number(this.form.lng) : null,
      divisionId: this.form.divisionId,
    };

    const obs = this.form.id ? this.api.updateLocation(this.form.id, body) : this.api.createLocation(body);
    obs.subscribe({
      next: (loc) => {
        this.message = 'Saved.';
        this.saving = false;
        this.reload();
        this.select(loc);
      },
      error: (e) => {
        this.message = e?.error?.error || 'Save failed';
        this.saving = false;
      }
    });
  }

  remove() {
    if (!this.auth.isAdmin() || !this.form.id) return;
    if (!confirm('Delete this location?')) return;
    this.saving = true;
    this.api.deleteLocation(this.form.id).subscribe({
      next: () => {
        this.saving = false;
        this.message = 'Deleted.';
        this.newForm();
        this.reload();
      },
      error: (e) => {
        this.saving = false;
        this.message = e?.error?.error || 'Delete failed';
      }
    });
  }

  /** External map links */
  googleMapsUrl(lat: number, lng: number) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  openStreetMapUrl(lat: number, lng: number) {
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
  }

  /** Leaflet setup */
  private ensureMap() {
    if (this.map) return;
    const el = document.getElementById(this.mapId);
    if (!el) return;

    this.map = L.map(el, {
      center: this.defaultCenter,
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    // Circle marker avoids dealing with image assets.
    this.marker = L.circleMarker(this.defaultCenter, {
      radius: 9,
      weight: 2,
      opacity: 1,
      fillOpacity: 0.45,
    }).addTo(this.map);

    // Allow admin to pick coordinates directly from the map.
    this.map.on('click', (ev: L.LeafletMouseEvent) => {
      if (!this.auth.isAdmin()) return;
      const lat = Number(ev.latlng.lat.toFixed(6));
      const lng = Number(ev.latlng.lng.toFixed(6));
      this.form.lat = lat;
      this.form.lng = lng;
      this.updateMapFromCoords(lat, lng);
    });

    // If a location is already selected, render it.
    if (this.selected) this.updateMapFromLocation(this.selected);
  }

  private updateMapFromLocation(l: Location) {
    this.ensureMap();
    const lat = (l.lat ?? null);
    const lng = (l.lng ?? null);
    this.updateMapFromCoords(lat, lng);
  }

  private updateMapFromCoords(lat: number | null, lng: number | null) {
    this.ensureMap();
    if (!this.map || !this.marker) return;

    // If coords are missing, keep a sensible center.
    if (lat == null || lng == null) {
      const fallback = (this.auth.isAdmin() && this.adminCurrentCenter) ? this.adminCurrentCenter : this.defaultCenter;
      this.map.setView(fallback, 10, { animate: true });
      this.marker.setLatLng(fallback);
      return;
    }

    const pt: [number, number] = [lat, lng];
    this.map.setView(pt, 15, { animate: true });
    this.marker.setLatLng(pt);
  }
}
