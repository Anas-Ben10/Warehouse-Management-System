import { Routes } from '@angular/router';
import { LoginPage } from './pages/login.page';
import { InventoryPage } from './pages/inventory.page';
import { TransactionsPage } from './pages/transactions.page';
import { SyncPage } from './pages/sync.page';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inventory' },
  { path: 'login', component: LoginPage },
  { path: 'inventory', component: InventoryPage, canActivate: [authGuard] },
  { path: 'transactions', component: TransactionsPage, canActivate: [authGuard] },
  { path: 'sync', component: SyncPage, canActivate: [authGuard] },
  { path: '**', redirectTo: 'inventory' }
];
