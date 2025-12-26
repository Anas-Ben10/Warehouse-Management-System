import { Injectable, signal } from '@angular/core';
import { OutboxDB, OutboxOp } from './outbox.db';
import { ApiService } from './api.service';
import { OfflineService } from './offline.service';

function uid(){
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private db = new OutboxDB();
  private pending = signal(0);
  pendingCount(){ return this.pending(); }

  constructor(private api: ApiService, private offline: OfflineService){
    this.refreshCount();
    window.addEventListener('online', () => this.pushPending());
  }

  private async refreshCount(){
    const n = await this.db.outbox.where('status').equals('pending').count();
    this.pending.set(n);
  }

  async enqueue(kind: OutboxOp['kind'], payload: any){
    await this.db.outbox.put({ id: uid(), kind, payload, createdAt: Date.now(), status: 'pending' });
    await this.refreshCount();
  }

  async pushPending(){
    if (this.offline.isOffline()) return;
    const ops = await this.db.outbox.where('status').equals('pending').sortBy('createdAt');
    if (ops.length === 0) { await this.refreshCount(); return; }

    try{
      const res = await this.api.syncPush(ops.map(o => ({ id: o.id, kind: o.kind, payload: o.payload }))).toPromise();
      const ids = new Set((res?.results || []).map((r: any) => r.id));
      for (const o of ops){
        if (ids.has(o.id)) await this.db.outbox.update(o.id, { status: 'sent' });
      }
    } catch {
      // keep pending
    } finally {
      await this.refreshCount();
    }
  }

  async pullLatest(){
    if (this.offline.isOffline()) return null;
    const meta = await this.db.meta.get('lastPull');
    const since = meta?.value ?? 0;
    const res = await this.api.syncPull(since).toPromise();
    await this.db.meta.put({ key:'lastPull', value: res.now });
    return res;
  }
}
