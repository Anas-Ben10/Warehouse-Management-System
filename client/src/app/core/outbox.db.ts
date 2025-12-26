import Dexie, { Table } from 'dexie';

export type OutboxOp = {
  id: string;
  kind: 'TXN_CREATE'|'ITEM_UPSERT'|'ITEM_DELETE'|'LOC_UPSERT'|'LOC_DELETE';
  payload: any;
  createdAt: number;
  status: 'pending'|'sent'|'error';
  error?: string;
};

export type LocalMeta = { key: string; value: any };

export class OutboxDB extends Dexie {
  outbox!: Table<OutboxOp, string>;
  meta!: Table<LocalMeta, string>;

  constructor(){
    super('wms_outbox_db');
    this.version(1).stores({
      outbox: 'id, kind, createdAt, status',
      meta: 'key'
    });
  }
}
