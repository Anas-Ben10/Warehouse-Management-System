import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/auth.service';
import { ApiService } from './core/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="topbar">
      <div class="brand" (click)="goHome()">WMS</div>

      <nav class="nav" *ngIf="auth.user as u; else guest">
        <a routerLink="/inventory" routerLinkActive="active">Inventory</a>
        <a routerLink="/transactions" routerLinkActive="active">Transactions</a>
        <a routerLink="/sync" routerLinkActive="active">Sync</a>

        <a *ngIf="u.role === 'ADMIN'" routerLink="/admin/users" routerLinkActive="active">Admin</a>
        <a *ngIf="u.role === 'MANAGER'" routerLink="/manager/dashboard" routerLinkActive="active">Manager</a>

        <span class="spacer"></span>
        <span class="user">{{ u.name }} • {{ u.role }}</span>
        <button class="logout" (click)="logout()">Logout</button>
      </nav>

      <ng-template #guest>
        <nav class="nav">
          <a routerLink="/login" routerLinkActive="active">Login</a>
          <a routerLink="/signup" routerLinkActive="active">Sign up</a>
        </nav>
      </ng-template>
    </header>

    <main class="main">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .topbar { display:flex; align-items:center; gap:14px; padding: 12px 16px; border-bottom: 1px solid #eee; position: sticky; top: 0; background: #fff; z-index: 10; }
    .brand { font-weight: 800; cursor: pointer; }
    .nav { display:flex; align-items:center; gap: 12px; width: 100%; }
    .nav a { text-decoration: none; color: #222; padding: 6px 8px; border-radius: 8px; }
    .nav a.active { background: #f3f3f3; }
    .spacer { flex: 1; }
    .user { font-size: 13px; color: #555; }
    .logout { padding: 7px 10px; border: 0; border-radius: 8px; cursor: pointer; }
    .main { padding: 6px 0 24px; }
  `]
})
export class AppComponent {
  auth = inject(AuthService);
  api = inject(ApiService);
  router = inject(Router);

  goHome() {
    this.router.navigateByUrl('/inventory');
  }

  logout() {
    this.api.logout().subscribe({ complete: () => {} });
    this.auth.clear();
    this.router.navigateByUrl('/login');
  }
}
