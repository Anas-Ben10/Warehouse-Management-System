import { Routes } from '@angular/router';
import { LoginPage } from './pages/login.page';
import { SignupPage } from './pages/signup.page';
import { SetPasswordPage } from './pages/set-password.page';
import { ForgotPasswordPage } from './pages/forgot-password.page';
import { ResetPasswordPage } from './pages/reset-password.page';

import { InventoryPage } from './pages/inventory.page';
import { TransactionsPage } from './pages/transactions.page';
import { ProjectsPage } from './pages/projects.page';
import { MapsPage } from './pages/maps.page';
import { SyncPage } from './pages/sync.page';

import { AdminUsersPage } from './pages/admin-users.page';
import { ManagerDashboardPage } from './pages/manager-dashboard.page';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inventory' },

  { path: 'login', component: LoginPage },
  { path: 'signup', component: SignupPage },

  // Invite flow (admin created user -> user sets password)
  { path: 'set-password', component: SetPasswordPage },

  // Forgot password flow
  { path: 'forgot-password', component: ForgotPasswordPage },
  { path: 'reset-password', component: ResetPasswordPage },

  // App
  { path: 'inventory', component: InventoryPage, canActivate: [authGuard] },
  { path: 'transactions', component: TransactionsPage, canActivate: [authGuard] },
  { path: 'projects', component: ProjectsPage, canActivate: [authGuard] },
  { path: 'maps', component: MapsPage, canActivate: [authGuard] },
  { path: 'sync', component: SyncPage, canActivate: [authGuard] },

  { path: 'admin/users', component: AdminUsersPage, canActivate: [authGuard] },
  { path: 'manager/dashboard', component: ManagerDashboardPage, canActivate: [authGuard] },

  { path: '**', redirectTo: 'inventory' }
];
