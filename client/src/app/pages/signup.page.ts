import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  selector: 'app-signup-page',
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="container">
      <h2>Sign up</h2>

      <div class="card">
        <label>Name</label>
        <input [(ngModel)]="name" placeholder="Full name" />

        <label>Email</label>
        <input [(ngModel)]="email" type="email" placeholder="you@example.com" />

        <label>Password</label>
        <input [(ngModel)]="password" type="password" placeholder="At least 6 characters" />

        <button (click)="submit()" [disabled]="loading">
          {{ loading ? 'Creating...' : 'Create account' }}
        </button>

        <p class="hint" *ngIf="message">{{ message }}</p>

        <p class="hint">
          Already have an account? <a routerLink="/login">Login</a>
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
export class SignupPage {
  private api = inject(ApiService);

  name = '';
  email = '';
  password = '';
  loading = false;
  message = '';

  submit() {
    this.message = '';
    this.loading = true;
    this.api.register(this.email, this.name, this.password).subscribe({
      next: (res) => {
        this.message = res?.message || 'Registered. Waiting for admin approval.';
      },
      error: (err) => {
        this.message = err?.error?.error || 'Signup failed';
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }
}
