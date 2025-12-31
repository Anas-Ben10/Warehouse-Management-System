import { Routes } from '@angular/router';
import { LoginPage } from './pages/login.page';
import { SignupPage } from './pages/signup.page';
import { SetPasswordPage } from './pages/set-password.page';
import { InventoryPage } from './pages/inventory.page';
import { TransactionsPage } from './pages/transactions.page';
import { SyncPage } from './pages/sync.page';
import { AdminUsersPage } from './pages/admin-users.page';
import { ManagerDashboardPage } from './pages/manager-dashboard.page';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inventory' },
  { path: 'login', component: LoginPage },
  { path: 'signup', component: SignupPage },
  { path: 'set-password', component: SetPasswordPage },

  { path: 'inventory', component: InventoryPage, canActivate: [authGuard] },
  { path: 'transactions', component: TransactionsPage, canActivate: [authGuard] },
  { path: 'sync', component: SyncPage, canActivate: [authGuard] },

  { path: 'admin/users', component: AdminUsersPage, canActivate: [authGuard] },
  { path: 'manager/dashboard', component: ManagerDashboardPage, canActivate: [authGuard] },

  { path: '**', redirectTo: 'inventory' }
];
