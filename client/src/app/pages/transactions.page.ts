import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Item, Location } from '../core/api.service';
import { OfflineService } from '../core/offline.service';
import { SyncService } from '../core/sync.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="row">
    <div class="col">
      <div class="card">
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Create Transaction</div>
        <div class="muted">Works offline (queued) and syncs when back online.</div>

        <label>Type</label>
        <select [(ngModel)]="type">
          <option value="RECEIVE">Receive</option>
          <option value="SHIP">Ship</option>
          <option value="TRANSFER">Transfer</option>
        </select>

        <label>Item</label>
        <select [(ngModel)]="itemId">
          <option [ngValue]="''">-- select item --</option>
          <option *ngFor="let i of items" [ngValue]="i.id">{{i.sku}} — {{i.name}}</option>
        </select>

        <label>Qty</label>
        <input class="input" type="number" [(ngModel)]="qty">

        <div *ngIf="type!=='RECEIVE'">
          <label>Source location</label>
          <select [(ngModel)]="srcLocationId">
            <option [ngValue]="''">-- select --</option>
            <option *ngFor="let l of locations" [ngValue]="l.id">{{l.code}} — {{l.name}}</option>
          </select>
        </div>

        <div *ngIf="type!=='SHIP'">
          <label>Destination location</label>
          <select [(ngModel)]="dstLocationId">
            <option [ngValue]="''">-- select --</option>
            <option *ngFor="let l of locations" [ngValue]="l.id">{{l.code}} — {{l.name}}</option>
          </select>
        </div>

        <label>Note</label>
        <input class="input" [(ngModel)]="note" placeholder="optional">

        <div style="height:10px"></div>
        <button class="btn primary" style="width:100%" (click)="submit()">Submit</button>

        <div *ngIf="msg" style="margin-top:10px" class="muted">{{msg}}</div>
        <div *ngIf="error" style="margin-top:10px;color:var(--danger)">{{error}}</div>
      </div>
    </div>

    <div class="col">
      <div class="card">
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">Notes</div>
        <ul class="muted">
          <li>If you are offline, transactions are saved locally.</li>
          <li>When you get back online, press <b>Sync now</b> (top bar).</li>
          <li>Barcode scanning UI can be added next (camera + ZXing).</li>
        </ul>
      </div>
    </div>
  </div>
  `
})
export class TransactionsPage {
  api = inject(ApiService);
  offline = inject(OfflineService);
  sync = inject(SyncService);

  items: Item[] = [];
  locations: Location[] = [];

  type: 'RECEIVE'|'SHIP'|'TRANSFER' = 'TRANSFER';
  itemId = '';
  qty = 1;
  srcLocationId = '';
  dstLocationId = '';
  note = '';

  msg = '';
  error = '';

  ngOnInit(){
    this.api.listItems().subscribe({ next: (r)=> this.items=r });
    this.api.listLocations().subscribe({ next: (r)=> this.locations=r });
  }

  async submit(){
    this.msg=''; this.error='';
    const offlineOpId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

    const body:any = { offlineOpId, type: this.type, itemId: this.itemId, qty: Number(this.qty), note: this.note || null };

    if (this.type === 'RECEIVE') body.dstLocationId = this.dstLocationId || null;
    if (this.type === 'SHIP') body.srcLocationId = this.srcLocationId || null;
    if (this.type === 'TRANSFER') { body.srcLocationId = this.srcLocationId || null; body.dstLocationId = this.dstLocationId || null; }

    if (!body.itemId) { this.error='Select item'; return; }
    if (body.qty <= 0) { this.error='Qty must be positive'; return; }
    if (this.type !== 'RECEIVE' && !body.srcLocationId) { this.error='Select source location'; return; }
    if (this.type !== 'SHIP' && !body.dstLocationId) { this.error='Select destination location'; return; }

    if (this.offline.isOffline()){
      await this.sync.enqueue('TXN_CREATE', body);
      this.msg = 'Saved offline. Will sync when online.';
      return;
    }

    this.api.createTxn(body).subscribe({
      next: async () => {
        this.msg = 'Transaction created.';
        await this.sync.enqueue('TXN_CREATE', body);
        await this.sync.pushPending();
      },
      error: () => this.error='Failed to create transaction'
    });
  }
}
