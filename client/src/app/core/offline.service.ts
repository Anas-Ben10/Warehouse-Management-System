import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OfflineService {
  private offlineSig = signal(!navigator.onLine);

  constructor(){
    window.addEventListener('online', () => this.offlineSig.set(false));
    window.addEventListener('offline', () => this.offlineSig.set(true));
  }

  isOffline(){ return this.offlineSig(); }
}
