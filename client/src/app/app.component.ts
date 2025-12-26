import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { OfflineService } from './core/offline.service';
import { SyncService } from './core/sync.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
  <div class="container">
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-weight:700;font-size:18px">WMS</div>
        <span class="badge" *ngIf="offline.isOffline()">Offline</span>
        <span class="badge" *ngIf="!offline.isOffline()">Online</span>
        <span class="badge" *ngIf="pending()>0">Queue: {{pending()}}</span>
      </div>

      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn" (click)="syncNow()" [disabled]="offline.isOffline() || pending()===0">Sync now</button>
        <button class="btn" *ngIf="auth.isAuthed()" (click)="logout()">Logout</button>
      </div>
    </div>

    <div class="nav" *ngIf="auth.isAuthed()">
      <a routerLink="/inventory" class="badge">Inventory</a>
      <a routerLink="/transactions" class="badge">Transactions</a>
      <a routerLink="/sync" class="badge">Sync</a>
    </div>

    <router-outlet></router-outlet>
  </div>
  `
})
export class AppComponent {
  auth = inject(AuthService);
  offline = inject(OfflineService);
  sync = inject(SyncService);
  router = inject(Router);

  pending = computed(() => this.sync.pendingCount());

  async syncNow(){
    await this.sync.pushPending();
  }

  logout(){
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
