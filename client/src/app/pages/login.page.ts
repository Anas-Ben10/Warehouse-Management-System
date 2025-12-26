import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="card" style="max-width:460px;margin:30px auto">
    <div style="font-size:20px;font-weight:700;margin-bottom:10px">Sign in</div>
    <div class="muted" style="margin-bottom:14px">Use your admin/staff account.</div>

    <label>Email</label>
    <input class="input" [(ngModel)]="email" placeholder="admin@local.test">

    <label>Password</label>
    <input class="input" [(ngModel)]="password" type="password" placeholder="••••••••">

    <div style="height:10px"></div>
    <button class="btn primary" style="width:100%" (click)="login()" [disabled]="loading">
      {{loading ? 'Signing in…' : 'Login'}}
    </button>

    <div *ngIf="error" style="margin-top:12px;color:var(--danger)">{{error}}</div>
  </div>
  `
})
export class LoginPage {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);

  email = 'admin@local.test';
  password = 'ChangeMe!12345';
  loading = false;
  error = '';

  login(){
    this.loading = true; this.error = '';
    this.api.login(this.email, this.password).subscribe({
      next: (res) => {
        this.auth.setSession(res.accessToken, res.user);
        this.router.navigateByUrl('/inventory');
      },
      error: (err) => {
        this.error = err?.error?.error || 'Login failed';
        this.loading = false;
      },
      complete: () => this.loading = false
    });
  }
}
