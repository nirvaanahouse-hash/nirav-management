import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  Input,
  inject,
  OnInit,
  effect,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldComponent } from '../../../shared/components/form-field/form-field.component';
import { PRIORITY_OPTIONS, TicketStatus } from '../../../core/constants/app.constants';
import { TicketDraft, TicketRecord } from '../../../core/models/task.model';
import { AuthService } from '../../../core/services/auth.service';
import { TicketMetaService } from '../../../core/services/ticket-meta.service';
import { ToastService } from '../../../features/toast/toast.service';
import { toastIfInvalid } from '../../../core/utils/form-toast';
import { CheckboxComponent } from '../../../shared/components/checkbox/checkbox.component';

@Component({
  selector: 'app-ticket-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormFieldComponent, CheckboxComponent],
  templateUrl: './ticket-form.component.html',
  styleUrl: './ticket-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TicketFormComponent implements OnInit {
  @Output() submitted = new EventEmitter<TicketDraft>();
  @Input() ticket: TicketRecord | null = null;

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly ticketMeta = inject(TicketMetaService);
  private readonly toast = inject(ToastService);

  private readonly meta = this.ticketMeta.meta;
  readonly ticketTypeOptions = computed(() => this.meta().ticketTypes);
  readonly priorityOptions = computed(() => this.meta().priorities);
  readonly statusOptions = computed(() => this.meta().statuses);

  /**
   * getTicketFormMeta only returns ACTIVE clients/employees. If this ticket's
   * client or assignee was since deactivated, that id is genuinely absent
   * from the option list — the form control's value is still correct, but
   * <app-select> can only show a label for a value it has an option for, so
   * it fell back to the placeholder ("nothing selected") for a value that
   * really is selected. Layer in a synthetic option using the name already
   * denormalized onto the ticket so it still renders correctly.
   */
  readonly clientOptions = computed(() => {
    const base = this.meta().clients;
    const id = this.ticket?.client;
    if (!id || base.some((c) => c.value === id)) return base;
    return [...base, { value: id, label: `${this.ticket?.clientName || 'Unknown client'} (inactive)` }];
  });
  readonly employeeOptions = computed(() => {
    const base = this.meta().employees;
    const id = this.ticket?.assignedEmployee;
    if (!id || base.some((e) => e.value === id)) return base;
    return [
      ...base,
      { value: id, label: `${this.ticket?.assignedEmployeeName || 'Unknown employee'} (inactive)` },
    ];
  });

  isSA = this.authService.isSuperAdmin;
  isEmployee = this.authService.isEmployee;

  readonly form = this.fb.nonNullable.group({
    coupleName: ['', [Validators.required]],
    ticketType: ['', [Validators.required]],
    priorety: [PRIORITY_OPTIONS[1]?.value ?? 'medium', [Validators.required]],
    HR: [''],
    mainHr: [''],
    hrPrice: [0],
    mainHrPrice: [0],
    deleveryDate: ['', [Validators.required]],
    amount: ['', this.isSA() ? [Validators.required, Validators.min(0)] : []],
    mainAmount: ['', this.isSA() ? [Validators.required, Validators.min(0)] : []],
    userPersentage: ['', this.isSA() ? [Validators.required, Validators.min(0), Validators.max(100)] : []],
    assignedEmployee: ['', this.isSA() ? [Validators.required] : []],
    client: ['', [Validators.required]],
    remark: [''],
    status: ['pending' as TicketStatus],
    isFinalized: [false],
  });

  // Reactive mirror of the reactive-form value (form controls are not signals).
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Job-type tickets are priced hour-wise; highlights / reels are priced directly. */
  readonly isJobType = computed(() =>
    this.ticketMeta.isJobType(this.value().ticketType ?? ''),
  );
  readonly isStatusCompleted = computed(() => this.value().status === 'completed');
  /** While a job ticket is still pending, hours aren't known yet. */
  readonly isPending = computed(() => (this.value().status ?? 'pending') === 'pending');
  /** HR / Main HR / HR Price are only relevant for job-type tickets. */
  readonly showHourFields = this.isJobType;

  private ticketEffect = effect(() => {
    const t = this.ticket;
    if (t) this.patchTicket(t);
  });

  /**
   * New tickets start on the first type the SA configured. Runs once the
   * form meta arrives, and never overwrites a type already in the form.
   */
  private defaultTypeEffect = effect(() => {
    const options = this.ticketTypeOptions();
    if (!options.length || this.ticket || this.form.controls.ticketType.value) return;
    this.form.patchValue({ ticketType: options[0].value });
  });

  /**
   * Suggests "Finalize" once per completed session (fresh open, or a status
   * change into "completed") but never fights a manual uncheck afterwards —
   * without this guard, unchecking the box just triggered the effect again
   * and silently re-checked it, so SA could never un-finalize from the form.
   */
  private hasSuggestedFinalize = false;
  private statusEffect = effect(() => {
    const completed = this.isStatusCompleted();
    if (!completed) {
      this.hasSuggestedFinalize = false;
      return;
    }
    if (!this.isSA() || this.hasSuggestedFinalize) return;
    this.hasSuggestedFinalize = true;
    if (!this.value().isFinalized) {
      this.form.patchValue({ isFinalized: true }, { emitEvent: false });
    }
  });

  /**
   * User Percentage is the assigned user's SA-set profit share. It auto-fills
   * only when the assignee is newly picked (on create, or switched to a
   * different employee on an existing ticket) — never on an existing ticket's
   * own already-saved percentage, which must stick regardless of what the
   * employee's current default happens to be. `lastFilledEmpId` is seeded
   * from the ticket in patchTicket() so opening an edit doesn't re-trigger
   * this for the assignee it already has.
   */
  private lastFilledEmpId = '';
  private percentageAutoFillEffect = effect(() => {
    // Read both signals up-front so the effect also re-runs once the form-meta
    // finishes loading (it may resolve after the ticket has been patched in).
    const options = this.employeeOptions();
    const v = this.value();
    if (!this.isSA()) return;

    const empId = v.assignedEmployee ?? '';
    if (!empId || empId === this.lastFilledEmpId) return;

    const opt = options.find((e) => e.value === empId);
    const pct = opt?.percentage;
    if (pct === undefined || pct === null) return; // meta not loaded yet — wait

    this.lastFilledEmpId = empId;
    if (String(v.userPersentage ?? '') !== String(pct)) {
      this.form.patchValue({ userPersentage: String(pct) }, { emitEvent: false });
    }
  });

  /**
   * Hour-field validators. Job type only, and only once work has started —
   * a still-pending job ticket can be saved without hours; they become
   * required as soon as it moves off "pending" (i.e. before it can complete).
   * Employees only enter Work Hours — Main Hours / HR Price / Main HR Price
   * are SA-only.
   */
  private hourValidatorEffect = effect(() => {
    const job = this.isJobType();
    const sa = this.isSA();
    const started = !this.isPending();
    const setReq = (name: 'HR' | 'mainHr' | 'hrPrice' | 'mainHrPrice', required: boolean) => {
      const c = this.form.controls[name];
      c.setValidators(required ? [Validators.required, Validators.min(0)] : []);
      c.updateValueAndValidity({ emitEvent: false });
    };
    setReq('HR', job && started);
    setReq('mainHr', job && sa && started);
    setReq('hrPrice', job && sa);
    setReq('mainHrPrice', job && sa);
  });

  /**
   * Auto-fill User / Main Amount from hours × price — User Amount from
   * HR × HR Price, Main Amount from Main HR × its own Main HR Price (the two
   * are priced independently) — but only when one of the inputs actually
   * changes, so an admin's manual override on an existing ticket is
   * preserved when the edit dialog opens.
   */
  private lastHourKey = "";
  private calculateAmountEffect = effect(() => {
    if (!this.isSA() || !this.isJobType()) return;
    const v = this.value();
    const key = `${v.HR}|${v.mainHr}|${v.hrPrice}|${v.mainHrPrice}`;
    if (key === this.lastHourKey) return;
    this.lastHourKey = key;
    const hr = Number(v.HR) || 0;
    const hrPrice = Number(v.hrPrice) || 0;
    const mainHr = Number(v.mainHr) || 0;
    const mainHrPrice = Number(v.mainHrPrice) || 0;
    this.form.patchValue(
      { amount: String(hr * hrPrice), mainAmount: String(mainHr * mainHrPrice) },
      { emitEvent: false },
    );
  });

  ngOnInit(): void {
    this.ticketMeta.loadFormMeta().subscribe({
      next: (meta) => {
        if (this.isSA() && meta.employees.length === 0) {
          this.toast.error('Employee data unavailable', 'No active employees found. Add an employee first.');
        }
        if (this.isSA() && meta.clients.length === 0) {
          this.toast.error('Client data unavailable', 'No active clients found. Add a client first.');
        }
      },
      error: () => {
        this.toast.error('Form data unavailable', 'Could not load ticket options. Please try again.');
      },
    });
  }

  patchTicket(ticket: TicketRecord): void {
    this.form.patchValue({
      coupleName: ticket.coupleName,
      ticketType: ticket.ticketType,
      priorety: ticket.priorety,
      HR: ticket.HR,
      mainHr: ticket.mainHr,
      hrPrice: ticket.hrPrice || 0,
      mainHrPrice: ticket.mainHrPrice || 0,
      deleveryDate: ticket.deleveryDate,
      amount: ticket.amount,
      mainAmount: ticket.mainAmount,
      userPersentage: ticket.userPersentage,
      assignedEmployee: ticket.assignedEmployee ?? '',
      client: ticket.client ?? '',
      remark: ticket.remark ?? '',
      status: ticket.status ?? 'pending',
      isFinalized: ticket.isFinalized ?? false,
    });
    // Seed the guard so opening an edited ticket doesn't clobber a manual amount.
    this.lastHourKey = `${ticket.HR}|${ticket.mainHr}|${ticket.hrPrice || 0}|${ticket.mainHrPrice || 0}`;
    // Seed the guard so opening an edited ticket doesn't clobber its own saved
    // percentage with the assignee's current default — only switching to a
    // *different* employee should suggest a new default from here on.
    this.lastFilledEmpId = ticket.assignedEmployee ?? '';
  }

  requestSubmit(): void {
    const isSA = this.authService.isSuperAdmin();

    if (
      toastIfInvalid(this.form, this.toast, {
        coupleName: 'Couple name',
        ticketType: 'Ticket type',
        priorety: 'Priority',
        HR: 'Work hours',
        mainHr: 'Main hours',
        hrPrice: 'HR price',
        mainHrPrice: 'Main HR price',
        deleveryDate: 'Delivery date',
        amount: 'User amount',
        mainAmount: 'Main amount',
        userPersentage: 'User percentage',
        assignedEmployee: 'Assigned employee',
        client: 'Client',
        status: 'Status',
      })
    ) {
      return;
    }

    const raw = this.form.getRawValue();
    const draft: TicketDraft = isSA
      ? {
          ...raw,
          hrPrice: Number(raw.hrPrice) || 0,
          mainHrPrice: Number(raw.mainHrPrice) || 0,
          // Amounts are whatever is in the fields — auto-filled or hand-edited by the admin.
          amount: raw.amount,
          mainAmount: raw.mainAmount,
        }
      : {
          coupleName: raw.coupleName,
          ticketType: raw.ticketType,
          HR: raw.HR,
          remark: raw.remark,
          priorety: raw.priorety,
          deleveryDate: raw.deleveryDate,
          status: raw.status as TicketStatus,
          client: raw.client || undefined,
        };

    this.submitted.emit(draft);
  }

  onSubmit(): void {
    this.requestSubmit();
  }
}
