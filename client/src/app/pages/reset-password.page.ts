import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  selector: 'app-reset-password-page',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <h2>Reset password</h2>

      <div class="card">
        <p class="hint">Email: <b>{{ email || '-' }}</b></p>

        <label>New password</label>
        <input [(ngModel)]="password" type="password" placeholder="At least 8 characters" />

        <label>Confirm password</label>
        <input [(ngModel)]="confirm" type="password" placeholder="Repeat password" />

        <button (click)="submit()" [disabled]="loading || !email || !token">
          {{ loading ? 'Saving...' : 'Reset password' }}
        </button>

        <p class="hint" *ngIf="message">{{ message }}</p>

        <p class="hint">
          Back to <a routerLink="/login">Login</a>
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
export class ResetPasswordPage {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private router = inject(Router);

  email = '';
  token = '';
  password = '';
  confirm = '';
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
    if (!this.password || this.password.length < 8) {
      this.message = 'Password must be at least 8 characters.';
      return;
    }
    if (this.password !== this.confirm) {
      this.message = 'Passwords do not match.';
      return;
    }

    this.loading = true;
    this.api.resetPassword(this.email, this.token, this.password).subscribe({
      next: () => {
        this.message = 'Password reset successfully. Redirecting to login...';
        setTimeout(() => this.router.navigateByUrl('/login'), 800);
      },
      error: (err) => {
        this.message = err?.error?.error || 'Failed to reset password (token may be invalid/expired).';
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }
}
