import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Division, UserRow } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-admin-users-page',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container" *ngIf="auth.isAdmin(); else noAccess">
      <h2>Admin • Users</h2>

      <div class="panel">
        <h3>Create / Invite user</h3>

        <div class="grid">
          <input [(ngModel)]="inviteName" placeholder="Name" />
          <input [(ngModel)]="inviteEmail" placeholder="Email" />
          <select [(ngModel)]="inviteRole">
            <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
          </select>
          <select [(ngModel)]="inviteDivisionId">
            <option [ngValue]="null">No division</option>
            <option *ngFor="let d of divisions" [ngValue]="d.id">{{ d.name }}</option>
          </select>
          <button (click)="invite()">Create invite</button>
        </div>

        <p class="hint">
          For security, the system never shows passwords. You can invite a user and send them a password-setup link.
        </p>

        <div class="hint" *ngIf="inviteLink">
          <b>Invite link:</b>
          <div class="mono">{{ inviteLink }}</div>
        </div>
      </div>

      <div class="panel">
        <h3>Divisions</h3>
        <div class="grid">
          <input [(ngModel)]="newDivisionName" placeholder="New division name" />
          <button (click)="createDivision()">Add division</button>
        </div>
      </div>

      <div class="panel">
        <h3>All users</h3>
        <button (click)="reload()">Reload</button>

        <table class="table" *ngIf="users.length">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Division</th>
              <th style="width: 240px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users">
              <td>{{ u.name }}</td>
              <td>{{ u.email }}</td>
              <td>
                <select [(ngModel)]="u.role">
                  <option *ngFor="let r of roles" [value]="r">{{ r }}</option>
                </select>
              </td>
              <td>
                <span [class.badge]="true" [class.pending]="!u.isActive" [class.active]="u.isActive">
                  {{ u.isActive ? 'Active' : 'Pending' }}
                </span>
              </td>
              <td>
                <select [ngModel]="u.division?.id ?? null" (ngModelChange)="setDivision(u, $event)">
                  <option [ngValue]="null">No division</option>
                  <option *ngFor="let d of divisions" [ngValue]="d.id">{{ d.name }}</option>
                </select>
              </td>
              <td>
                <button (click)="save(u)">Save</button>
                <button *ngIf="!u.isActive" (click)="approve(u)">Approve</button>
              </td>
            </tr>
          </tbody>
        </table>

        <p class="hint" *ngIf="!users.length">No users found.</p>
      </div>

      <p class="hint" *ngIf="message">{{ message }}</p>
    </div>

    <ng-template #noAccess>
      <div class="container">
        <h2>Forbidden</h2>
        <p class="hint">You need an Admin account to view this page.</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .panel { border: 1px solid #ddd; border-radius: 10px; padding: 16px; margin: 14px 0; }
    .grid { display: grid; grid-template-columns: 1.2fr 1.2fr 0.8fr 0.9fr auto; gap: 10px; align-items: center; }
    input, select { padding: 9px; border: 1px solid #ccc; border-radius: 6px; }
    button { padding: 9px 12px; border: 0; border-radius: 6px; cursor: pointer; }
    .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .table th, .table td { border-bottom: 1px solid #eee; padding: 10px; text-align: left; }
    .hint { margin: 8px 0 0; color: #555; font-size: 13px; }
    .badge { padding: 3px 8px; border-radius: 999px; font-size: 12px; border: 1px solid #ccc; }
    .pending { opacity: 0.7; }
    .active { }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; }
  `]
})
export class AdminUsersPage {
  api = inject(ApiService);
  auth = inject(AuthService);

  roles: Array<UserRow['role']> = ['STAFF', 'MANAGER', 'ADMIN'];
  users: UserRow[] = [];
  divisions: Division[] = [];
  message = '';

  newDivisionName = '';

  inviteName = '';
  inviteEmail = '';
  inviteRole: UserRow['role'] = 'STAFF';
  inviteDivisionId: string | null = null;
  inviteLink = '';

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.message = '';
    this.inviteLink = '';
    this.api.listDivisions().subscribe({ next: (d) => (this.divisions = d) });
    this.api.listUsers().subscribe({
      next: (u) => (this.users = u),
      error: (e) => (this.message = e?.error?.error || 'Failed to load users'),
    });
  }

  setDivision(u: UserRow, divisionId: string | null) {
    u.division = divisionId ? this.divisions.find((d) => d.id === divisionId) ?? null : null;
  }

  approve(u: UserRow) {
    this.api.updateUser(u.id, { isActive: true }).subscribe({
      next: (x) => {
        u.isActive = true;
        this.message = `Approved ${x.email}`;
      },
      error: (e) => (this.message = e?.error?.error || 'Failed to approve'),
    });
  }

  save(u: UserRow) {
    const divisionId = u.division?.id ?? null;
    this.api.updateUser(u.id, { role: u.role, divisionId }).subscribe({
      next: () => (this.message = `Saved ${u.email}`),
      error: (e) => (this.message = e?.error?.error || 'Failed to save'),
    });
  }

  createDivision() {
    const name = (this.newDivisionName || '').trim();
    if (!name) return;
    this.api.createDivision(name).subscribe({
      next: (d) => {
        this.divisions = [...this.divisions, d].sort((a, b) => a.name.localeCompare(b.name));
        this.newDivisionName = '';
        this.message = `Created division: ${d.name}`;
      },
      error: (e) => (this.message = e?.error?.error || 'Failed to create division'),
    });
  }

  invite() {
    this.inviteLink = '';
    this.message = '';
    this.api.inviteUser({
      email: this.inviteEmail,
      name: this.inviteName,
      role: this.inviteRole,
      divisionId: this.inviteDivisionId,
    }).subscribe({
      next: (res) => {
        this.inviteLink = res.inviteLink;
        this.message = 'Invite created.';
      },
      error: (e) => (this.message = e?.error?.error || 'Failed to create invite'),
    });
  }
}
