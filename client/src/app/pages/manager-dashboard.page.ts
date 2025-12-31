import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Kpis, UserRow } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-manager-dashboard-page',
  imports: [CommonModule],
  template: `
    <div class="container" *ngIf="auth.isManager(); else noAccess">
      <h2>Manager • Dashboard</h2>

      <div class="grid">
        <div class="card">
          <div class="k">Items</div>
          <div class="v">{{ kpis?.itemsCount ?? '-' }}</div>
        </div>
        <div class="card">
          <div class="k">Locations</div>
          <div class="v">{{ kpis?.locationsCount ?? '-' }}</div>
        </div>
        <div class="card">
          <div class="k">Total stock qty</div>
          <div class="v">{{ kpis?.totalStockQty ?? '-' }}</div>
        </div>
        <div class="card">
          <div class="k">Transactions (24h)</div>
          <div class="v">{{ kpis?.txCount24h ?? '-' }}</div>
        </div>
        <div class="card">
          <div class="k">Transactions (7d)</div>
          <div class="v">{{ kpis?.txCount7d ?? '-' }}</div>
        </div>
      </div>

      <div class="panel">
        <h3>Team (Staff in your division)</h3>
        <ul>
          <li *ngFor="let u of team">{{ u.name }} — {{ u.email }}</li>
        </ul>
        <p class="hint" *ngIf="!team.length">No staff found for your division (admin must assign you a division, and assign staff to it).</p>
      </div>

      <div class="panel" *ngIf="kpis?.topPerformers7d?.length">
        <h3>Top performers (7 days)</h3>
        <ol>
          <li *ngFor="let t of kpis!.topPerformers7d">
            {{ t.user.name }} — {{ t.txCount7d }} transactions
          </li>
        </ol>
      </div>

      <div class="panel">
        <h3>Recent activity</h3>
        <div class="mono" *ngFor="let a of activity">
          {{ a.createdAt | date:'short' }} • {{ a.createdBy?.name }} • {{ a.type }} • {{ a.qty }} • {{ a.item?.sku }} • {{ a.note || '' }}
        </div>
      </div>

      <p class="hint" *ngIf="message">{{ message }}</p>
    </div>

    <ng-template #noAccess>
      <div class="container">
        <h2>Forbidden</h2>
        <p class="hint">You need a Manager account to view this page.</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 12px; }
    .k { color: #555; font-size: 12px; }
    .v { font-size: 22px; font-weight: 700; }
    .panel { border: 1px solid #ddd; border-radius: 10px; padding: 16px; margin: 14px 0; }
    .hint { color: #555; font-size: 13px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; padding: 4px 0; border-bottom: 1px dashed #eee; }
    ul, ol { margin: 0; padding-left: 18px; }
  `]
})
export class ManagerDashboardPage {
  api = inject(ApiService);
  auth = inject(AuthService);

  kpis: Kpis | null = null;
  team: UserRow[] = [];
  activity: any[] = [];
  message = '';

  ngOnInit() {
    this.api.kpis().subscribe({
      next: (k) => (this.kpis = k),
      error: (e) => (this.message = e?.error?.error || 'Failed to load KPIs'),
    });

    this.api.team().subscribe({
      next: (t) => (this.team = t),
      error: () => {},
    });

    this.api.activity().subscribe({
      next: (a) => (this.activity = a),
      error: () => {},
    });
  }
}
