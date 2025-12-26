import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SyncService } from '../core/sync.service';
import { OfflineService } from '../core/offline.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="card">
    <div style="font-size:18px;font-weight:700">Sync</div>
    <div class="muted">Push queued offline operations to the server and pull updates.</div>

    <div style="height:12px"></div>

    <div class="row">
      <div class="col">
        <div class="card">
          <div class="muted">Pending operations</div>
          <div style="font-size:28px;font-weight:800">{{sync.pendingCount()}}</div>
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="muted">Status</div>
          <div style="font-size:16px;font-weight:700">{{offline.isOffline() ? 'Offline' : 'Online'}}</div>
        </div>
      </div>
    </div>

    <div style="height:12px"></div>

    <button class="btn primary" (click)="push()" [disabled]="offline.isOffline() || sync.pendingCount()===0">Push pending</button>
    <button class="btn" style="margin-left:8px" (click)="pull()" [disabled]="offline.isOffline()">Pull updates</button>

    <div *ngIf="msg" style="margin-top:10px" class="muted">{{msg}}</div>
  </div>
  `
})
export class SyncPage {
  sync = inject(SyncService);
  offline = inject(OfflineService);
  msg = '';

  async push(){ this.msg='Syncing…'; await this.sync.pushPending(); this.msg='Done.'; }
  async pull(){ this.msg='Pulling…'; await this.sync.pullLatest(); this.msg='Done.'; }
}
