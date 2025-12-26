import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, StockRow } from '../core/api.service';
import { OfflineService } from '../core/offline.service';
import { SyncService } from '../core/sync.service';

@Component({
  standalone: true,
  imports: [CommonModule],
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

    <table class="table">
      <thead>
        <tr>
          <th>SKU</th><th>Item</th><th>Location</th><th>Qty</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let r of rows">
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
