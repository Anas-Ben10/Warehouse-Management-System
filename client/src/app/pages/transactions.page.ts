import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Item, Location } from '../core/api.service';
import { SyncService } from '../core/sync.service';
import { OfflineService } from '../core/offline.service';

@Component({
  standalone: true,
  selector: 'app-transactions-page',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h2>Transactions</h2>

      <div class="card">
        <label>Type</label>
        <select [(ngModel)]="type">
          <option value="IN">Receive (IN)</option>
          <option value="OUT">Issue (OUT)</option>
          <option value="MOVE">Move (MOVE)</option>
        </select>

        <label>Scan barcode / QR (or type)</label>
        <input
          [(ngModel)]="barcode"
          (keyup.enter)="lookupByBarcode()"
          placeholder="Scan then press Enter"
        />
        <button (click)="lookupByBarcode()">Lookup</button>

        <label>Item</label>
        <select [(ngModel)]="itemId">
          <option value="">-- Select item --</option>
          <option *ngFor="let i of items" [value]="i.id">
            {{ i.sku }} — {{ i.name }} {{ i.barcode ? '(' + i.barcode + ')' : '' }}
          </option>
        </select>

        <label>Quantity</label>
        <input [(ngModel)]="qty" type="number" min="1" />

        <div *ngIf="type !== 'IN'">
          <label>Source location</label>
          <select [(ngModel)]="srcLocationId">
            <option value="">-- Select --</option>
            <option *ngFor="let l of locations" [value]="l.id">{{ l.code }} — {{ l.name }}</option>
          </select>
        </div>

        <div *ngIf="type !== 'OUT'">
          <label>Destination location</label>
          <select [(ngModel)]="dstLocationId">
            <option value="">-- Select --</option>
            <option *ngFor="let l of locations" [value]="l.id">{{ l.code }} — {{ l.name }}</option>
          </select>
        </div>

        <div *ngIf="type === 'IN'" class="row">
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
    .container { max-width: 700px; margin: 24px auto; padding: 0 16px; }
    .card { display: grid; gap: 10px; padding: 16px; border: 1px solid #ddd; border-radius: 10px; }
    input, select, textarea { padding: 9px; border: 1px solid #ccc; border-radius: 6px; }
    button { padding: 10px 12px; border: 0; border-radius: 6px; cursor: pointer; }
    .hint { margin: 0; color: #555; font-size: 13px; }
    .row { display: grid; gap: 8px; padding: 10px; border: 1px dashed #eee; border-radius: 10px; }
  `]
})
export class TransactionsPage {
  api = inject(ApiService);
  sync = inject(SyncService);
  offline = inject(OfflineService);

  items: Item[] = [];
  locations: Location[] = [];

  type: 'IN' | 'OUT' | 'MOVE' = 'IN';
  barcode = '';
  itemId = '';
  qty = 1;

  srcLocationId = '';
  dstLocationId = '';

  // receiving info
  isFree = false;
  unitPrice: number | null = null;

  note = '';
  message = '';

  ngOnInit() {
    this.api.listItems().subscribe({ next: (x) => (this.items = x) });
    this.api.listLocations().subscribe({ next: (x) => (this.locations = x) });
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


  async submit() {
    this.message = '';

    if (!this.itemId) {
      this.message = 'Please select an item.';
      return;
    }

    const body: any = {
      type: this.type,
      itemId: this.itemId,
      qty: Number(this.qty),
      srcLocationId: this.srcLocationId || null,
      dstLocationId: this.dstLocationId || null,
      note: this.note || null,
    };

    if (this.type === 'IN') {
      body.isFree = !!this.isFree;
      body.unitPrice = this.isFree ? null : (this.unitPrice ?? null);
    }

    // Online: do it now. Offline: enqueue.
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
