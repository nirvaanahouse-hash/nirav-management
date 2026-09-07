import { ChangeDetectionStrategy, Component, computed, input, output, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { Client, CLIENT_STATUS_OPTIONS, ClientDraft, ClientStatus } from '../../../core/models/client.model';
import { ToastService } from '../../../features/toast/toast.service';
import { toastIfInvalid } from '../../../core/utils/form-toast';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent],
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
