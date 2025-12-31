import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  selector: 'app-set-password-page',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <h2>Set your password</h2>

      <div class="card">
        <p class="hint">Email: <b>{{ email || '-' }}</b></p>

        <label>New password</label>
        <input [(ngModel)]="password" type="password" placeholder="At least 6 characters" />

        <button (click)="submit()" [disabled]="loading || !email || !token">
          {{ loading ? 'Saving...' : 'Set password' }}
        </button>

        <p class="hint" *ngIf="message">{{ message }}</p>

        <p class="hint">
          After setting a password, go to <a routerLink="/login">Login</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 420px; margin: 40px auto; padding: 0 16px; }
    .card { display: grid; gap: 10px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
    input { padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
    button { padding: 10px; border: 0; border-radius: 6px; cursor: pointer; }
    .hint { margin: 0; color: #555; font-size: 13px; }
  `]
})
export class SetPasswordPage {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private router = inject(Router);

  email = '';
  token = '';
  password = '';
  loading = false;
  message = '';

  constructor() {
    this.route.queryParamMap.subscribe((p) => {
      this.email = p.get('email') || '';
      this.token = p.get('token') || '';
    });
  }

  submit() {
    this.message = '';
    this.loading = true;

    this.api.setPassword(this.email, this.token, this.password).subscribe({
      next: (res) => {
        this.message = res?.message || 'Password set. You can now login.';
        // optional auto-redirect
        setTimeout(() => this.router.navigateByUrl('/login'), 800);
      },
      error: (err) => {
        this.message = err?.error?.error || 'Failed to set password (token may be invalid/expired).';
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }
}
