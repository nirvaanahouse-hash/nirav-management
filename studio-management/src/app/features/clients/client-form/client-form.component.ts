import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ButtonComponent } from '../../../shared/components/button/button';
import { Client, CLIENT_STATUS_OPTIONS, ClientDraft, ClientStatus } from '../../../core/models/client.model';
import { ClientService } from '../../../core/services/client.service';
import { ToastService } from '../../../features/toast/toast.service';
import { toastIfInvalid } from '../../../core/utils/form-toast';

/** Matches the server's per-file cap (BE/middleware/upload.middleware.js). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent, AvatarComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:'./client-form.component.html' ,
  styleUrls: ['./client-form.component.scss'],
})
export class ClientFormComponent implements OnInit {
  client = input<Client | null>(null);
  submitted = output<ClientDraft>();

  statusOptions = CLIENT_STATUS_OPTIONS;

  private fb = new FormBuilder();
  private toast = inject(ToastService);
  private clientService = inject(ClientService);

  /**
   * The photo is uploaded separately from the form values — a brand-new client
   * has no id to upload against yet. The parent reads `pendingPhoto()` /
   * `photoCleared()` once the client has been saved.
   */
  private readonly selectedFile = signal<File | null>(null);
  private readonly previewUrl = signal('');
  private readonly cleared = signal(false);

  readonly pendingPhoto = this.selectedFile.asReadonly();
  readonly photoCleared = this.cleared.asReadonly();

  /** Local preview while picking, otherwise whatever the client already has. */
  readonly photoUrl = computed(() => {
    if (this.previewUrl()) return this.previewUrl();
    if (this.cleared()) return '';
    return this.clientService.imageUrl(this.client()?.image);
  });

  readonly hasPhoto = computed(() => !!this.photoUrl());

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    sortName: ['', [Validators.required, Validators.minLength(1)]],
    company: [''],
    email: ['', [Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s]{7,15}$/)]],
    mobileNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    status: [ClientStatus.Active, [Validators.required]],
    isActive: ['true', [Validators.required]],
  });

  ngOnInit(): void {
    const c = this.client();
    if (c) {
      this.form.patchValue({
        name: c.name,
        sortName: c.sortName || '',
        company: c.company || '',
        email: c.email,
        phone: c.phone,
        mobileNumber: c.mobileNumber || '',
        status: c.status,
        isActive: c.isActive ? 'true' : 'false',
      });
    }
  }

  isValid = computed(() => true); // placeholder for future async-validity signals

  onPhotoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // let the same file be re-picked after a removal

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Unsupported file', 'Choose an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.toast.error('Image too large', 'Choose an image up to 5 MB.');
      return;
    }

    this.revokePreview();
    this.selectedFile.set(file);
    this.previewUrl.set(URL.createObjectURL(file));
    this.cleared.set(false);
  }

  removePhoto(): void {
    this.revokePreview();
    this.selectedFile.set(null);
    this.previewUrl.set('');
    // Only an already-saved photo needs clearing server-side.
    this.cleared.set(!!this.client()?.image);
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
  }

  onSubmit(): void {
    if (
      toastIfInvalid(this.form, this.toast, {
        name: 'Full name',
        sortName: 'Sort name',
        company: 'Company',
        email: 'Email',
        phone: 'Phone',
        mobileNumber: 'Mobile number',
        status: 'Status',
      })
    ) {
      return;
    }
    const raw = this.form.getRawValue();
    this.submitted.emit({
      ...raw,
      isActive: raw.isActive === 'true',
    });
  }

  requestSubmit(): void {
    this.onSubmit();
  }
}
