import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { TicketTypeService } from '../../core/services/ticket-type.service';
import { TicketMetaService } from '../../core/services/ticket-meta.service';
import { TicketTypeRecord } from '../../core/models/ticketType.model';
import { BADGE_VARIANT_OPTIONS, BadgeVariant } from '../../core/constants/app.constants';
import { ToastService } from '../../features/toast/toast.service';
import { ConfirmDialogService } from '../../features/dialog/confirm-dialog/confirm-dialog.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ModalComponent } from '../../features/dialog/modal.component';
import { ButtonComponent } from '../../shared/components/button/button';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { RowActionsComponent } from '../../shared/components/row-actions/row-actions.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';

/**
 * SA screen for the ticket type registry — add a type, rename or recolour it,
 * switch it off, or delete one nothing uses yet.
 */
@Component({
  selector: 'app-ticket-types',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    ModalComponent,
    ButtonComponent,
    IconButtonComponent,
    RowActionsComponent,
    CheckboxComponent,
    FormFieldComponent,
  ],
  templateUrl: './ticket-types.component.html',
  styleUrls: ['./ticket-types.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketTypesComponent {
  private readonly service = inject(TicketTypeService);
  private readonly ticketMeta = inject(TicketMetaService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly variantOptions = BADGE_VARIANT_OPTIONS;

  readonly types = this.service.types;
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly showModal = signal(false);
  readonly editing = signal<TicketTypeRecord | null>(null);

  readonly activeCount = computed(() => this.types().filter((t) => t.isActive).length);

  readonly form = this.fb.nonNullable.group({
    label: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
    variant: ['neutral' as BadgeVariant, [Validators.required]],
    isJob: [false],
    isActive: [true],
    showCount: [false],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load ticket types', 'Please try again.');
      },
    });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      label: '',
      variant: 'neutral',
      isJob: false,
      isActive: true,
      showCount: false,
    });
    this.form.controls.isJob.enable();
    this.showModal.set(true);
  }

  openEdit(type: TicketTypeRecord): void {
    this.editing.set(type);
    this.form.reset({
      label: type.label,
      variant: type.variant,
      isJob: type.isJob,
      isActive: type.isActive,
      showCount: type.showCount,
    });
    // Pricing is baked into the stored key, so it cannot change afterwards.
    this.form.controls.isJob.disable();
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editing.set(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const editing = this.editing();
    this.saving.set(true);

    const request = editing
      ? this.service.update(editing._id, {
          label: raw.label.trim(),
          variant: raw.variant,
          isActive: raw.isActive,
          showCount: raw.showCount,
        })
      : this.service.create({
          label: raw.label.trim(),
          variant: raw.variant,
          isJob: raw.isJob,
          isActive: raw.isActive,
          showCount: raw.showCount,
        });

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(editing ? 'Ticket type updated' : 'Ticket type added');
        this.closeModal();
        this.afterChange();
      },
      error: (err: {
        error?: { message?: string; errors?: { field: string; message: string }[] };
      }) => {
        this.saving.set(false);
        const apiErrors = err?.error?.errors;
        if (apiErrors?.length) {
          for (const e of apiErrors) {
            const control = (
              this.form.controls as Record<string, { setErrors: (v: unknown) => void }>
            )[e.field];
            control?.setErrors({ server: e.message });
          }
        }
        this.toast.error(
          editing ? 'Could not update ticket type' : 'Could not add ticket type',
          err?.error?.message || 'Please try again.',
        );
      },
    });
  }

  toggleActive(type: TicketTypeRecord): void {
    this.service.update(type._id, { isActive: !type.isActive }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.toast.success(
          res.data.isActive
            ? `"${res.data.label}" is back on the ticket form`
            : `"${res.data.label}" is hidden from the ticket form`,
        );
        this.afterChange();
      },
      error: () => this.toast.error('Could not update ticket type'),
    });
  }

  async remove(type: TicketTypeRecord): Promise<void> {
    if (type.usageCount > 0) {
      this.toast.error(
        `"${type.label}" is in use`,
        `${type.usageCount} ticket${type.usageCount === 1 ? '' : 's'} still ${type.usageCount === 1 ? 'uses' : 'use'} it. Turn it off instead — it stays readable on those tickets.`,
      );
      return;
    }

    const ok = await this.confirm.ask({
      title: 'Delete ticket type',
      message: `Remove "${type.label}" from the ticket form? No ticket uses it, so nothing else changes.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;

    this.service.delete(type._id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.toast.success('Ticket type deleted');
        this.afterChange();
      },
      error: (err: { error?: { message?: string } }) => {
        this.toast.error('Could not delete ticket type', err?.error?.message || 'Please try again.');
        this.load();
      },
    });
  }

  /**
   * TicketTypeService already folds each mutation's response into `types` —
   * only the SA-registry-derived form-meta cache (a separate service/signal)
   * still needs an explicit refresh.
   */
  private afterChange(): void {
    this.ticketMeta.refresh();
  }

  trackById(_i: number, item: TicketTypeRecord): string {
    return item._id;
  }
}
