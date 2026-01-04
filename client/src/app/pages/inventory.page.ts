import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, StockRow } from '../core/api.service';
import { OfflineService } from '../core/offline.service';
import { SyncService } from '../core/sync.service';
import { BarcodeScannerComponent } from '../shared/barcode-scanner.component';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeScannerComponent],
  template: `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:18px;font-weight:700">Inventory</div>
        <div class="muted">Live view when online. When offline, sync will update after reconnection.</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" (click)="refresh()" [disabled]="offline.isOffline()">Refresh</button>
        <button class="btn primary" (click)="pull()" [disabled]="offline.isOffline()">Pull updates</button>
      </div>
    </div>

    <div style="height:12px"></div>

<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
  <input class="input" style="flex:1;min-width:220px" [(ngModel)]="query" placeholder="Search by SKU / name / barcode" />
  <button class="btn" type="button" (click)="openScanner()">Scan</button>
  <button class="btn" type="button" (click)="query=''">Clear</button>
</div>

<app-barcode-scanner
  [active]="showScanner"
  (scanned)="onScanned($event)"
  (closed)="showScanner=false">
</app-barcode-scanner>

<div style="height:12px"></div>

<table class="table">
      <thead>
        <tr>
          <th>SKU</th><th>Item</th><th>Location</th><th>Qty</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let r of visibleRows()">
          <td>{{r.item.sku}}</td>
          <td>{{r.item.name}}</td>
          <td>{{r.location.code}}</td>
          <td>{{r.qty}}</td>
        </tr>
      </tbody>
    </table>

    <div *ngIf="error" style="margin-top:12px;color:var(--danger)">{{error}}</div>
  </div>
  `
})
export class InventoryPage {
  api = inject(ApiService);
  offline = inject(OfflineService);
  sync = inject(SyncService);

  rows: StockRow[] = [];
  query = '';
  showScanner = false;

  openScanner(){ this.showScanner = true; }

  onScanned(code: string){
    this.showScanner = false;
    this.query = code;
  }

  visibleRows(){
    const q = (this.query || '').trim().toLowerCase();
    if(!q) return this.rows;
    return (this.rows || []).filter(r =>
      (r.item?.sku || '').toLowerCase().includes(q) ||
      (r.item?.name || '').toLowerCase().includes(q) ||
      (r.item as any)?.barcode?.toLowerCase?.().includes?.(q) ||
      (r.location?.code || '').toLowerCase().includes(q)
    );
  }

  error = '';

  ngOnInit(){ this.refresh(); }

  refresh(){
    this.error='';
    this.api.listInventory().subscribe({
      next: (r) => this.rows = r,
      error: (e) => this.error = e?.error?.error || 'Failed to load inventory'
    });
  }

  async pull(){
    try{
      await this.sync.pullLatest();
      this.refresh();
    }catch{
      this.error='Pull failed';
    }
  }
}
