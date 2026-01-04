import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Item, Location, Project } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { SyncService } from '../core/sync.service';
import { OfflineService } from '../core/offline.service';
import { BarcodeScannerComponent } from '../shared/barcode-scanner.component';

type TxnType =
  | 'RECEIVE'
  | 'SHIP'
  | 'TRANSFER'
  | 'DIVISION_TRANSFER'
  | 'PROJECT_ISSUE'
  | 'PROJECT_RETURN';

@Component({
  standalone: true,
  selector: 'app-transactions-page',
  imports: [CommonModule, FormsModule, BarcodeScannerComponent],
  template: `
    <div class="container">
      <h2>Transactions</h2>

      <div class="card">
        <label>Type</label>
        <select [(ngModel)]="type" (ngModelChange)="onTypeChange()">
          <option value="RECEIVE">Receive (IN)</option>
          <option value="SHIP">Ship / Consume (OUT)</option>
          <option value="TRANSFER">Move within my division</option>

          <option *ngIf="auth.isManager()" value="DIVISION_TRANSFER">Transfer to another division (Manager)</option>
          <option *ngIf="auth.isManager()" value="PROJECT_ISSUE">Issue to a project (Manager)</option>
          <option *ngIf="auth.isManager()" value="PROJECT_RETURN">Return from a project (Manager)</option>
        </select>

        <div class="hint">
          <div *ngIf="type==='TRANSFER'">Managers can only move items inside their own division.</div>
          <div *ngIf="type==='DIVISION_TRANSFER'">Transfers between divisions are tracked as a division transfer.</div>
          <div *ngIf="type==='PROJECT_ISSUE'">Issuing to a project reduces stock in the source warehouse AND increases stock in the project location.</div>
          <div *ngIf="type==='PROJECT_RETURN'">Returning from a project reduces project stock AND increases stock back in your warehouse.</div>
        </div>

        
<label>Scan barcode / QR (or type)</label>
<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
  <input style="flex:1;min-width:220px" [(ngModel)]="barcode" (keyup.enter)="lookupByBarcode()" placeholder="Scan / type / paste then press Enter" />
  <button type="button" (click)="openScanner()">Scan</button>
  <button type="button" (click)="lookupByBarcode()">Lookup</button>
</div>

<app-barcode-scanner
  [active]="showScanner"
  (scanned)="onScanned($event)"
  (closed)="showScanner=false">
</app-barcode-scanner>

        <label>Item</label>
        <select [(ngModel)]="itemId">
          <option value="">-- Select item --</option>
          <option *ngFor="let i of items" [value]="i.id">
            {{ i.sku }} — {{ i.name }} {{ i.barcode ? '(' + i.barcode + ')' : '' }}
          </option>
        </select>

        <label>Quantity</label>
        <input [(ngModel)]="qty" type="number" min="1" />

        <!-- Source / Destination -->
        <div *ngIf="needsSrc()">
          <label>Source location</label>
          <select [(ngModel)]="srcLocationId">
            <option value="">-- Select --</option>
            <option *ngFor="let l of srcLocations()" [value]="l.id">{{ l.code }} — {{ l.name }}</option>
          </select>
        </div>

        <div *ngIf="needsDst()">
          <label>Destination location</label>
          <select [(ngModel)]="dstLocationId">
            <option value="">-- Select --</option>
            <option *ngFor="let l of dstLocations()" [value]="l.id">{{ l.code }} — {{ l.name }}</option>
          </select>
        </div>

        <!-- Map helpers for managers during division transfers -->
        <div *ngIf="type === 'DIVISION_TRANSFER' && auth.isManager()" class="row">
          <p class="hint">Need to view warehouses on a map while transferring? Use these shortcuts.</p>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" (click)="openMapAllWarehouses()">Open map (all warehouses)</button>
            <button type="button" [disabled]="!srcLocationId" (click)="openMapForLocation(srcLocationId)">View source on map</button>
            <button type="button" [disabled]="!dstLocationId" (click)="openMapForLocation(dstLocationId)">View destination on map</button>
          </div>
        </div>

        <!-- Project selection -->
        <div *ngIf="needsProject()">
          <label>Project</label>
          <select [(ngModel)]="projectId">
            <option value="">-- Select --</option>
            <option *ngFor="let p of projects" [value]="p.id">{{ p.code }} — {{ p.name }}</option>
          </select>

          <p class="hint" *ngIf="projectPreview()">
            Project location: <b>{{ projectPreview()!.location?.code || '-' }}</b>
          </p>
        </div>

        <!-- Receive pricing -->
        <div *ngIf="type === 'RECEIVE'" class="row">
          <label style="display:flex; gap:8px; align-items:center;">
            <input type="checkbox" [(ngModel)]="isFree" />
            Received for free
          </label>

          <div *ngIf="!isFree" style="display:grid; gap:6px;">
            <label>Unit price (optional)</label>
            <input [(ngModel)]="unitPrice" type="number" min="0" step="0.01" placeholder="e.g., 19.99" />
          </div>
        </div>

        <label>Description (optional)</label>
        <textarea [(ngModel)]="note" rows="2" placeholder="Add details about this transaction..."></textarea>

        <button (click)="submit()">Submit</button>

        <p class="hint" *ngIf="message">{{ message }}</p>
        <p class="hint" *ngIf="offline.isOffline()">You are offline. Transaction will be queued and synced later.</p>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 760px; margin: 24px auto; padding: 0 16px; }
    .card { display: grid; gap: 10px; padding: 16px; border: 1px solid #ddd; border-radius: 10px; }
    input, select, textarea { padding: 9px; border: 1px solid #ccc; border-radius: 6px; }
    button { padding: 10px 12px; border: 0; border-radius: 6px; cursor: pointer; }
    .hint { margin: 0; color: #555; font-size: 13px; }
    .row { display: grid; gap: 8px; padding: 10px; border: 1px dashed #eee; border-radius: 10px; }
  `]
})
export class TransactionsPage {
  api = inject(ApiService);
  auth = inject(AuthService);
  sync = inject(SyncService);
  offline = inject(OfflineService);

  items: Item[] = [];
  projects: Project[] = [];

  ownLocations: Location[] = [];
  allWarehouses: Location[] = [];

  type: TxnType = 'RECEIVE';
  barcode = '';
  showScanner = false;

  openScanner(){
    this.showScanner = true;
  }

  onScanned(code: string){
    this.showScanner = false;
    this.barcode = code;
    this.lookupByBarcode();
  }

  itemId = '';
  qty = 1;

  srcLocationId = '';
  dstLocationId = '';
  projectId = '';

  // receiving info
  isFree = false;
  unitPrice: number | null = null;

  note = '';
  message = '';

  ngOnInit() {
    this.api.listItems().subscribe({ next: (x) => (this.items = x || []) });

    // own division locations (warehouse+project if returned)
    this.api.listLocations('own').subscribe({ next: (x) => (this.ownLocations = (x || [])) });

    // managers can fetch all warehouses to transfer to another division
    if (this.auth.isManager()) {
      this.api.listLocations('all').subscribe({ next: (x) => (this.allWarehouses = (x || []).filter(l => (l.kind || 'WAREHOUSE') === 'WAREHOUSE')) });
      this.api.listProjects().subscribe({ next: (x) => (this.projects = x || []) });
    } else {
      // staff can still view projects in their division (read-only)
      this.api.listProjects().subscribe({ next: (x) => (this.projects = x || []) });
    }
  }

  onTypeChange() {
    this.message = '';
    this.srcLocationId = '';
    this.dstLocationId = '';
    this.projectId = '';

    if (this.type !== 'RECEIVE') {
      this.isFree = false;
      this.unitPrice = null;
    }
  }

  needsSrc() {
    return this.type === 'SHIP' || this.type === 'TRANSFER' || this.type === 'DIVISION_TRANSFER' || this.type === 'PROJECT_ISSUE';
  }

  needsDst() {
    return this.type === 'RECEIVE' || this.type === 'TRANSFER' || this.type === 'DIVISION_TRANSFER' || this.type === 'PROJECT_RETURN';
  }

  needsProject() {
    return this.type === 'PROJECT_ISSUE' || this.type === 'PROJECT_RETURN';
  }

  srcLocations(): Location[] {
    // Always within own division
    return this.ownLocations.filter(l => (l.kind || 'WAREHOUSE') === 'WAREHOUSE');
  }

  dstLocations(): Location[] {
    if (this.type === 'DIVISION_TRANSFER') {
      // Managers can pick any warehouse across divisions
      return this.auth.isManager() ? this.allWarehouses : this.srcLocations();
    }
    return this.ownLocations.filter(l => (l.kind || 'WAREHOUSE') === 'WAREHOUSE');
  }

  projectPreview(): Project | null {
    const id = this.projectId;
    return id ? (this.projects.find(p => p.id === id) || null) : null;
  }

  lookupByBarcode() {
    const b = (this.barcode || '').trim();
    if (!b) return;

    // Offline? try local cached items first
    const local = this.items.find((x) => (x.barcode || '').trim() === b);
    if (local) {
      this.itemId = local.id;
      this.message = `Found (offline): ${local.sku} — ${local.name}`;
      return;
    }

    this.api.lookupItem({ barcode: b }).subscribe({
      next: (item) => {
        this.itemId = item.id;
        this.message = `Found: ${item.sku} — ${item.name}`;
      },
      error: () => {
        this.message = 'No item found for this barcode.';
      },
    });
  }

  // Map helpers (used mainly for Division Transfers)
  openMapAll() {
    window.open('/maps?all=1', '_blank', 'noopener');
  }

  openMapForDestination() {
    if (!this.dstLocationId) return;
    window.open(`/maps?all=1&focus=${encodeURIComponent(this.dstLocationId)}`, '_blank', 'noopener');
  }

  openMapForSource() {
    if (!this.srcLocationId) return;
    window.open(`/maps?focus=${encodeURIComponent(this.srcLocationId)}`, '_blank', 'noopener');
  }

  async submit() {
    this.message = '';

    if (!this.itemId) {
      this.message = 'Please select an item.';
      return;
    }
    if (!Number(this.qty) || Number(this.qty) <= 0) {
      this.message = 'Quantity must be > 0.';
      return;
    }
    if (this.needsSrc() && !this.srcLocationId) {
      this.message = 'Please select a source location.';
      return;
    }
    if (this.needsDst() && !this.dstLocationId) {
      this.message = 'Please select a destination location.';
      return;
    }
    if (this.needsProject() && !this.projectId) {
      this.message = 'Please select a project.';
      return;
    }

    const body: any = {
      type: this.type,
      itemId: this.itemId,
      qty: Number(this.qty),
      srcLocationId: this.needsSrc() ? (this.srcLocationId || null) : null,
      dstLocationId: this.needsDst() ? (this.dstLocationId || null) : null,
      projectId: this.needsProject() ? (this.projectId || null) : null,
      note: this.note || null,
    };

    if (this.type === 'RECEIVE') {
      body.isFree = !!this.isFree;
      body.unitPrice = this.isFree ? null : (this.unitPrice ?? null);
    }

    if (!this.offline.isOffline()) {
      this.api.createTxn(body).subscribe({
        next: () => (this.message = 'Transaction created.'),
        error: (e) => (this.message = e?.error?.error || 'Failed to create transaction'),
      });
    } else {
      await this.sync.enqueue('TXN_CREATE', { ...body, offlineOpId: crypto.randomUUID() });
      this.message = 'Queued (offline). Will sync when online.';
    }
  }
}
