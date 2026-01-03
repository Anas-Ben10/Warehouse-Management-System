import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  selector: 'app-forgot-password-page',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <h2>Forgot password</h2>

      <div class="card">
        <label>Email</label>
        <input [(ngModel)]="email" type="email" placeholder="you@example.com" />

        <button (click)="submit()" [disabled]="loading">
          {{ loading ? 'Sending...' : 'Send reset link' }}
        </button>

        <p class="hint" *ngIf="message">{{ message }}</p>

        <div class="hint" *ngIf="resetLink">
          <b>Dev reset link:</b>
          <div class="mono">{{ resetLink }}</div>
        </div>

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
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; white-space: pre-wrap; }
  `]
})
export class ForgotPasswordPage {
  private api = inject(ApiService);

  email = '';
  loading = false;
  message = '';
  resetLink = '';

  submit() {
    this.message = '';
    this.resetLink = '';
    const e = (this.email || '').trim();
    if (!e) {
      this.message = 'Please enter your email.';
      return;
    }
    this.loading = true;

    this.api.forgotPassword(e).subscribe({
      next: (res) => {
        this.message = res?.message || 'If the account exists, a reset email has been sent.';
        this.resetLink = res?.resetLink || '';
      },
      error: (err) => {
        this.message = err?.error?.error || 'Failed to send reset email';
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }
}
