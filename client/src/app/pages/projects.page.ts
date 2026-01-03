import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Division, Project } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  selector: 'app-projects-page',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h2>Projects</h2>

      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div class="muted">Projects have their own virtual location to track issued items.</div>
          <button (click)="reload()">Reload</button>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <h3>All projects</h3>

          <div class="list">
            <button class="row" *ngFor="let p of projects" (click)="select(p)" [class.active]="selected?.id===p.id">
              <div style="font-weight:700">{{ p.code }}</div>
              <div class="muted">{{ p.name }}</div>
              <div class="muted" *ngIf="p.division">{{ p.division.name }}</div>
            </button>
          </div>

          <p class="muted" *ngIf="!projects.length">No projects yet.</p>
        </div>

        <div class="panel">
          <h3>Details</h3>

          <div *ngIf="selected; else pick">
            <div><b>{{ selected.code }}</b> — {{ selected.name }}</div>
            <div class="muted" *ngIf="selected.division">Division: {{ selected.division.name }}</div>
            <div class="muted" *ngIf="selected.location">Project location: {{ selected.location.code }}</div>

            <div style="margin-top:12px">
              <button (click)="loadStock(selected.id)">View project stock</button>
            </div>

            <table class="table" *ngIf="stockRows.length">
              <thead>
                <tr><th>SKU</th><th>Item</th><th>Qty</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let r of stockRows">
                  <td>{{ r.item.sku }}</td>
                  <td>{{ r.item.name }}</td>
                  <td>{{ r.qty }}</td>
                </tr>
              </tbody>
            </table>
            <p class="muted" *ngIf="selected && !stockRows.length && stockLoaded">No stock in this project.</p>

            <p class="muted" *ngIf="message">{{ message }}</p>
          </div>

          <ng-template #pick>
            <p class="muted">Pick a project to view details.</p>
          </ng-template>

          <div class="panel" style="margin-top:14px" *ngIf="canCreate()">
            <h3>Create project</h3>

            <div class="form">
              <input [(ngModel)]="newName" placeholder="Project name" />
              <input [(ngModel)]="newCode" placeholder="Code (optional)" />

              <select *ngIf="auth.isAdmin()" [(ngModel)]="newDivisionId">
                <option value="">Select division</option>
                <option *ngFor="let d of divisions" [value]="d.id">{{ d.name }}</option>
              </select>
            </div>

            <button (click)="create()">Create</button>
            <p class="muted" *ngIf="createMsg">{{ createMsg }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 1100px; margin: 24px auto; padding: 0 16px; }
    .grid { display:grid; grid-template-columns: 1fr 1.4fr; gap: 12px; }
    .panel { border: 1px solid #ddd; border-radius: 10px; padding: 14px; margin-bottom: 12px; }
    .muted { margin: 0; color: #555; font-size: 13px; }
    .list { display:grid; gap:8px; max-height: 520px; overflow:auto; padding-right: 4px; }
    .row { text-align:left; border: 1px solid #eee; background: #fff; border-radius: 10px; padding: 10px; cursor: pointer; }
    .row.active { border-color: #cfd3ff; background: #f7f7ff; }
    button { padding: 9px 12px; border: 0; border-radius: 8px; cursor: pointer; }
    .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .table th, .table td { border-bottom: 1px solid #eee; padding: 10px; text-align: left; }
    .form { display:grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; margin-top: 10px; align-items:center; }
    input, select { padding: 9px; border: 1px solid #ccc; border-radius: 8px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } .form { grid-template-columns: 1fr; } }
  `]
})
export class ProjectsPage {
  api = inject(ApiService);
  auth = inject(AuthService);

  divisions: Division[] = [];
  projects: Project[] = [];
  selected: Project | null = null;

  stockRows: any[] = [];
  stockLoaded = false;
  message = '';

  newName = '';
  newCode = '';
  newDivisionId = '';
  createMsg = '';

  ngOnInit() {
    this.reload();
  }

  canCreate() {
    const role = this.auth.user?.role;
    return role === 'ADMIN' || role === 'MANAGER';
  }

  reload() {
    this.message = '';
    this.stockRows = [];
    this.stockLoaded = false;

    if (this.auth.isAdmin()) {
      this.api.listDivisions().subscribe({ next: (d) => this.divisions = d });
    }
    this.api.listProjects().subscribe({
      next: (p) => {
        this.projects = p || [];
        if (this.selected) {
          const refreshed = this.projects.find(x => x.id === this.selected!.id) || null;
          this.selected = refreshed;
        }
      },
      error: (e) => this.message = e?.error?.error || 'Failed to load projects'
    });
  }

  select(p: Project) {
    this.selected = p;
    this.stockRows = [];
    this.stockLoaded = false;
    this.message = '';
  }

  loadStock(projectId: string) {
    this.stockLoaded = false;
    this.stockRows = [];
    this.api.projectStock(projectId).subscribe({
      next: (rows) => { this.stockRows = rows || []; this.stockLoaded = true; },
      error: (e) => { this.message = e?.error?.error || 'Failed to load project stock'; this.stockLoaded = true; }
    });
  }

  create() {
    this.createMsg = '';
    const name = (this.newName || '').trim();
    if (!name) {
      this.createMsg = 'Name is required.';
      return;
    }

    const body: any = { name };
    if (this.newCode.trim()) body.code = this.newCode.trim();

    if (this.auth.isAdmin()) {
      if (!this.newDivisionId) { this.createMsg = 'Division is required for admin.'; return; }
      body.divisionId = this.newDivisionId;
    }

    this.api.createProject(body).subscribe({
      next: (p) => {
        this.createMsg = `Created project: ${p.code}`;
        this.newName = '';
        this.newCode = '';
        this.newDivisionId = '';
        this.reload();
      },
      error: (e) => this.createMsg = e?.error?.error || 'Failed to create project'
    });
  }
}
