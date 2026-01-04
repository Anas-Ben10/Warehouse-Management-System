import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { BrowserMultiFormatReader } from '@zxing/browser';

type VideoDevice = { deviceId: string; label: string };

@Component({
  standalone: true,
  selector: 'app-barcode-scanner',
  imports: [CommonModule],
  template: `
    <div class="overlay" *ngIf="active">
      <div class="sheet">
        <div class="top">
          <div class="title">Scan barcode / QR</div>
          <button class="btn" (click)="close()">Close</button>
        </div>

        <div class="controls">
          <label>
            Camera
            <select class="select" [value]="selectedDeviceId" (change)="onDeviceChange($event)">
              <option *ngFor="let d of devices" [value]="d.deviceId">{{ d.label || ('Camera ' + d.deviceId.slice(-4)) }}</option>
            </select>
          </label>

          <div class="hint" *ngIf="error">{{ error }}</div>
          <div class="hint" *ngIf="!error">Tip: hold the code steady and fill the frame.</div>
        </div>

        <div class="videoWrap">
          <video #video autoplay playsinline></video>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay{
      position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.65);
      display:flex; align-items:center; justify-content:center;
      padding:16px;
    }
    .sheet{
      width:min(720px, 100%);
      background:#0c1220;
      border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;
      box-shadow:0 10px 30px rgba(0,0,0,0.5);
      overflow:hidden;
      color:#fff;
    }
    .top{
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 14px;
      border-bottom:1px solid rgba(255,255,255,0.12);
    }
    .title{ font-weight:800; }
    .btn{
      background:rgba(255,255,255,0.12);
      border:1px solid rgba(255,255,255,0.18);
      color:#fff;
      padding:8px 10px;
      border-radius:10px;
      cursor:pointer;
    }
    .controls{
      padding:12px 14px;
      display:flex;
      gap:12px;
      align-items:flex-end;
      justify-content:space-between;
      flex-wrap:wrap;
    }
    label{ display:flex; flex-direction:column; gap:6px; font-size:13px; opacity:0.95; }
    .select{
      padding:8px 10px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,0.18);
      background:rgba(255,255,255,0.08);
      color:#fff;
      min-width:240px;
      outline:none;
    }
    .hint{ font-size:12px; opacity:0.85; }
    .videoWrap{
      padding:0 14px 14px;
    }
    video{
      width:100%;
      height: min(60vh, 420px);
      background:#000;
      border-radius:14px;
      object-fit:cover;
    }
  `]
})
export class BarcodeScannerComponent implements OnChanges, OnDestroy {
  @Input() active = false;
  @Output() scanned = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('video', { static: false }) videoRef?: ElementRef<HTMLVideoElement>;

  devices: VideoDevice[] = [];
  selectedDeviceId = '';
  error = '';

  private reader = new BrowserMultiFormatReader();
  private isRunning = false;
  private controls: any = null;

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['active']) {
      if (this.active) {
        await this.start();
      } else {
        this.stop();
      }
    }
  }

  ngOnDestroy() {
    this.stop();
  }

  close() {
    this.stop();
    this.active = false;
    this.closed.emit();
  }

  async onDeviceChange(ev: Event) {
    const target = ev.target as HTMLSelectElement;
    this.selectedDeviceId = target.value;
    if (this.active) {
      await this.start(true);
    }
  }

  private async start(forceRestart = false) {
    if (this.isRunning && !forceRestart) return;
    this.error = '';

    // Wait a tick for the video element to exist
    await new Promise((r) => setTimeout(r, 0));

    const video = this.videoRef?.nativeElement;
    if (!video) return;

    try {
      // Enumerate cameras (requires https + user permission)
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      this.devices = devices.map((d) => ({ deviceId: d.deviceId, label: d.label }));

      // Pick a sensible default (prefer "back" camera on phones)
      if (!this.selectedDeviceId) {
        const preferred = this.devices.find(d => /back|rear|environment/i.test(d.label));
        this.selectedDeviceId = (preferred?.deviceId || this.devices[0]?.deviceId || '');
      }

      if (!this.selectedDeviceId) {
        this.error = 'No camera device found.';
        return;
      }

      this.stop(); // ensure clean
      this.isRunning = true;

      this.controls = await (this.reader as any).decodeFromVideoDevice(this.selectedDeviceId, video, (result: any, err: any) => {
        if (result) {
          const text = (result.getText?.() || '').trim();
          if (text) {
            this.scanned.emit(text);
            this.close();
          }
          return;
        }
        // "NotFoundException" is normal when no code is in frame
        if (err) {
          const name = (err as any)?.name;
          const msg = (err as any)?.message;
          const isNotFound = name === 'NotFoundException' || (typeof msg === 'string' && msg.includes('NotFoundException'));
          if (!isNotFound) this.error = String(msg || err);
        }
      });
    } catch (e: any) {
      this.error =
        e?.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera access and try again.' :
        e?.name === 'NotFoundError' ? 'No camera found on this device.' :
        (e?.message || 'Could not start camera.');
      this.stop();
    }
  }

  private stop() {
    if (!this.isRunning) return;

    // Stop ZXing decode loop (different versions expose different stop methods)
    const r: any = this.reader as any;
    try { this.controls?.stop?.(); } catch {}
    this.controls = null;
    try { typeof r.reset === 'function' && r.reset(); } catch {}
    try { typeof r.stopContinuousDecode === 'function' && r.stopContinuousDecode(); } catch {}
    try { typeof r.stopAsyncDecode === 'function' && r.stopAsyncDecode(); } catch {}

    this.isRunning = false;

    // Stop camera tracks
    const video = this.videoRef?.nativeElement;
    const stream = video?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    }
  }
}
