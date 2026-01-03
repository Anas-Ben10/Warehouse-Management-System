import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService, Location, Division } from '../core/api.service';
import { AuthService } from '../core/auth.service';

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
              <div style="font-weight:700">{{ l.code }}</div>
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

          <div *ngIf="selected">
            <div class="muted" style="margin-bottom:8px">
              <b>{{ selected.code }}</b> — {{ selected.name }}
            </div>

            <div *ngIf="selected.lat!=null && selected.lng!=null; else noCoords">
              <iframe
                class="map"
                [src]="mapUrl(selected.lat!, selected.lng!)"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade">
              </iframe>

              <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
                <a class="linkbtn" [href]="googleMapsUrl(selected.lat!, selected.lng!)" target="_blank" rel="noreferrer">Open in Google Maps</a>
              </div>
            </div>

            <ng-template #noCoords>
              <div class="muted">
                No coordinates saved for this location. (Admin can add lat/lng below.)
              </div>
            </ng-template>

            <div class="admin" *ngIf="auth.isAdmin()">
              <h3 style="margin-top:18px">Admin • Edit / Create warehouse location</h3>

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
    .map { width: 100%; height: 380px; border: 0; border-radius: 12px; }
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
  sanitizer = inject(DomSanitizer);

  locations: Location[] = [];
  selected: Location | null = null;

  divisions: Division[] = [];

  showAllWarehouses = false;

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
    if (this.auth.isAdmin()) {
      this.api.listDivisions().subscribe({ next: (d) => (this.divisions = d || []) });
    }
    this.reload();
  }

  reload() {
    this.error = '';
    const scope = (this.showAllWarehouses && this.auth.isManager()) ? 'all' : 'own';
    this.api.listLocations(scope as any).subscribe({
      next: (x) => {
        // Map page focuses on warehouses
        this.locations = (x || []).filter(l => !l.kind || l.kind === 'WAREHOUSE' || l.kind === 'WAREHOUSE');
        if (this.selected) {
          const refreshed = this.locations.find(l => l.id === this.selected!.id) || null;
          this.select(refreshed || (this.locations[0] || null));
        } else if (this.locations.length) {
          this.select(this.locations[0]);
        }
      },
      error: (e) => this.error = e?.error?.error || 'Failed to load locations'
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
  }

  newForm() {
    this.selected = null;
    this.message = '';
    this.form = { id: null, code: '', name: '', divisionId: '', address: '', lat: null, lng: null };
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

  mapUrl(lat: number, lng: number): SafeResourceUrl {
    // OpenStreetMap embed supports a marker for a single location
    const d = 0.01;
    const left = lng - d, right = lng + d, bottom = lat - d, top = lat + d;
    const url = new URL('https://www.openstreetmap.org/export/embed.html');
    url.searchParams.set('bbox', `${left},${bottom},${right},${top}`);
    url.searchParams.set('layer', 'mapnik');
    url.searchParams.set('marker', `${lat},${lng}`);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url.toString());
  }

  googleMapsUrl(lat: number, lng: number) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
}
