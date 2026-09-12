import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { EmployeeService, EmployeeActionResponse } from "../../core/services/employee.service";
import { HasPermissionDirective } from "../../shared/directives/has-permission.directive";
import { PermissionService } from "../../core/services/permission.service";
import { User } from "../../core/models/user.model";
import { ToastService } from "../../features/toast/toast.service";
import { ConfirmDialogService } from "../../features/dialog/confirm-dialog/confirm-dialog.service";
import { AmountService } from "../../core/services/amount.service";
import { LocationService, UserLocationView } from "../../core/services/location.service";
import { AmountEntry, AmountEntryDraft } from "../../core/models/amountEntry.model";
import { ButtonComponent } from "../../shared/components/button/button";
import { SelectComponent } from "../../shared/components/select/select.component";
import { SelectItem } from "../../shared/components/select/select.model";
import { CheckboxComponent } from "../../shared/components/checkbox/checkbox.component";
import { MapComponent } from "../../shared/components/map/map.component";
import { IconButtonComponent } from "../../shared/components/icon-button/icon-button.component";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { FormFieldComponent } from "../../shared/components/form-field/form-field.component";
import { ModalComponent } from "../../features/dialog/modal.component";

@Component({
  selector: "app-users",
  standalone: true,
  imports: [
    SelectComponent,
    CheckboxComponent,
    MapComponent,
    MapComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ButtonComponent,
    IconButtonComponent,
    PageHeaderComponent,
    FormFieldComponent,
    ModalComponent,
    HasPermissionDirective,
  ],
  templateUrl: "./users.component.html",
  styleUrls: ["./users.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent {
  private readonly employeeService = inject(EmployeeService);
  private readonly toastService = inject(ToastService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly amountService = inject(AmountService);
  private readonly locationService = inject(LocationService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly permissions = inject(PermissionService);

  can(key: string): boolean {
    return this.permissions.can(key);
  }

  openPermissions(user: User): void {
    this.router.navigate(["/sa/permissions"], { queryParams: { user: user._id } });
  }

  // --- Live location ----------------------------------------------------
  readonly showLocationFor = signal<User | null>(null);
  readonly locationLoading = signal(false);
  readonly locationData = signal<UserLocationView | null>(null);
  openLocation(user: User): void {
    this.showLocationFor.set(user);
    this.loadLocation(user._id);
  }

  closeLocation(): void {
    this.showLocationFor.set(null);
    this.locationData.set(null);
  }

  refreshLocation(): void {
    const u = this.showLocationFor();
    if (u) this.loadLocation(u._id);
  }

  private loadLocation(userId: string): void {
    this.locationLoading.set(true);
    this.locationData.set(null);
    this.locationService.getUserLocation(userId).subscribe({
      next: (res) => {
        this.locationLoading.set(false);
        const d = res.data;
        this.locationData.set(d);
      },
      error: () => {
        this.locationLoading.set(false);
        this.locationData.set(null);
      },
    });
  }

  gmapsLink(d: UserLocationView): string {
    return `https://www.google.com/maps/search/?api=1&query=${d.lat}%2C${d.lng}`;
  }

  locationAgo(iso: string | null): string {
    if (!iso) return "";
    const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 45) return "just now";
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.round(hrs / 24)} d ago`;
  }

  readonly loading = signal(true);
  searchTerm = "";
  showInactive = false;

  readonly visibilityOptions: SelectItem[] = [
    { value: "active", label: "Active only" },
    { value: "all", label: "All" },
  ];

  readonly entryTypeOptions: SelectItem[] = [
    { value: "sent", label: "Sent (to user)" },
    { value: "received", label: "Received (from user)" },
  ];

  readonly employees = this.employeeService.employees;
  readonly stats = signal({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
  });

  showAmountEntry = signal<User | null>(null);
  amountEntryAmount = 0;
  amountEntryType = "sent";
  amountEntryRemark = "";
  amountSaving = signal(false);

  // Set / reset a user's password (passwords are hashed and cannot be shown).
  showPasswordFor = signal<User | null>(null);
  newPassword = signal("");
  passwordVisible = signal(false);
  passwordSaving = signal(false);

  // Per-row password reveal on the Users table
  revealed = signal<Record<string, boolean>>({});
  toggleReveal(id: string): void {
    this.revealed.update((m) => ({ ...m, [id]: !m[id] }));
  }

  // Set a user's profit-share %
  showPctFor = signal<User | null>(null);
  newPct = 0;
  pctSaving = signal(false);

  money(v: number | undefined): string {
    return `₹${Math.round(Number(v || 0)).toLocaleString()}`;
  }

  openPct(user: User): void {
    this.showPctFor.set(user);
    this.newPct = Number(user.percentage || 0);
  }

  closePct(): void {
    this.showPctFor.set(null);
  }

  submitPct(): void {
    const user = this.showPctFor();
    if (!user) return;
    const pct = Number(this.newPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      this.toastService.error("Invalid percentage", "Enter a value between 0 and 100.");
      return;
    }
    this.pctSaving.set(true);
    this.employeeService.setPercentage(user._id, pct).subscribe({
      next: () => {
        this.pctSaving.set(false);
        this.toastService.success("Percentage updated", `${user.firstName} → ${pct}%`);
        this.closePct();
      },
      error: (err: Error) => {
        this.pctSaving.set(false);
        this.toastService.error("Could not update", err.message);
      },
    });
  }

  // --- Edit user details -------------------------------------------------
  openEdit(user: User): void {
    this.editingUser.set(user);
    this.editLoading.set(true);
    this.editForm.reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      userName: user.userName || "",
      email: user.email || "",
      mobileNumber: user.mobileNumber || "",
      role: user.role || "U",
      homeAddress: "",
      gender: "",
      dob: "",
      percentage: Number(user.percentage || 0),
    });
    // Pull the full record (incl. address / gender / dob) to pre-fill.
    this.employeeService.getById(user._id).subscribe({
      next: (res) => {
        const d = res.data || ({} as User);
        this.editForm.patchValue({
          firstName: d.firstName ?? this.editForm.controls.firstName.value,
          lastName: d.lastName ?? this.editForm.controls.lastName.value,
          userName: d.userName ?? this.editForm.controls.userName.value,
          email: d.email ?? this.editForm.controls.email.value,
          mobileNumber: d.mobileNumber ?? this.editForm.controls.mobileNumber.value,
          role: d.role ?? this.editForm.controls.role.value,
          homeAddress: d.homeAddress ?? "",
          gender: d.gender ?? "",
          dob: d.dob ?? "",
          percentage: Number(d.percentage ?? this.editForm.controls.percentage.value),
        });
        this.editLoading.set(false);
      },
      error: () => {
        this.editLoading.set(false);
        this.toastService.error("Could not load details", "Some fields may be blank.");
      },
    });
  }

  closeEdit(): void {
    this.editingUser.set(null);
  }

  submitEdit(): void {
    const user = this.editingUser();
    if (!user) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.toastService.error("Please complete every field", "All details are required.");
      return;
    }
    this.editSaving.set(true);
    this.employeeService.updateDetails(user._id, this.editForm.getRawValue()).subscribe({
      next: (res) => {
        this.editSaving.set(false);
        this.toastService.success("User updated", res.message || `${this.editForm.controls.firstName.value} saved.`);
        this.closeEdit();
      },
      error: (err: { error?: { message?: string; errors?: { field: string; message: string }[] } }) => {
        this.editSaving.set(false);
        const apiErrors = err?.error?.errors;
        if (apiErrors?.length) {
          for (const e of apiErrors) {
            const control = (this.editForm.controls as Record<string, { setErrors: (v: unknown) => void }>)[e.field];
            control?.setErrors({ server: e.message });
          }
        }
        this.toastService.error("Could not update user", err?.error?.message || "Please check the fields.");
      },
    });
  }

  // Amount history (mirrors the client payment history)
  showHistoryFor = signal<User | null>(null);
  historyEntries = signal<AmountEntry[]>([]);
  historyLoading = signal(false);
  editingEntry = signal<AmountEntry | null>(null);
  editAmount = 0;
  editRemark = "";

  // --- SA: edit a user's full details ------------------------------------
  editingUser = signal<User | null>(null);
  editLoading = signal(false);
  editSaving = signal(false);

  readonly roleOptions = [
    { value: "U", label: "User" },
    { value: "A", label: "Admin" },
    { value: "SA", label: "Super Admin" },
  ];
  readonly genderOptions = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ];

  // Every field is required — including profit share.
  readonly editForm = this.fb.nonNullable.group({
    firstName: ["", [Validators.required, Validators.minLength(2)]],
    lastName: ["", [Validators.required, Validators.minLength(1)]],
    userName: ["", [Validators.required, Validators.minLength(3), Validators.maxLength(20)]],
    email: ["", [Validators.required, Validators.email]],
    mobileNumber: ["", [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    role: ["U", [Validators.required]],
    homeAddress: ["", [Validators.required, Validators.minLength(5)]],
    gender: ["", [Validators.required]],
    dob: ["", [Validators.required]],
    percentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  constructor() {
    this.loadEmployees();
    this.employeeService.getStats().subscribe((res) => {
      if (res.success) this.stats.set(res.data);
    });
  }

  loadEmployees(silent = false): void {
    if (!silent) this.loading.set(true);
    this.employeeService
      .list({ search: this.searchTerm || undefined, isActive: this.showInactive ? undefined : true })
      .subscribe({
        next: () => { this.loading.set(false); },
        error: () => {
          if (!silent) this.toastService.error("Could not load users", "Please try again.");
          this.loading.set(false);
        },
      });
  }

  private searchTimeout: any;
  debouncedSearch(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadEmployees(), 300);
  }

  activate(employee: User): void {
    this.confirmDialogService.ask({
      title: "Activate Employee",
      message: `${employee.firstName} ${employee.lastName} will be able to log in and receive new work. Proceed?`,
      confirmLabel: "Activate",
      cancelLabel: "Cancel",
    }).then((confirmed: boolean) => {
      if (confirmed) {
        this.employeeService.activate(employee._id).subscribe({
          next: (response: EmployeeActionResponse) => {
            this.toastService.success(response.message || "Employee activated", employee.firstName);
            this.employeeService.refreshStats();
          },
          error: (err: Error) => {
            this.toastService.error("Activation failed", err.message);
          },
        });
      }
    });
  }

  deactivate(employee: User): void {
    this.confirmDialogService.ask({
      title: "Deactivate Employee",
      message: `${employee.firstName} ${employee.lastName} will no longer be able to log in or receive new work. Existing ticket history will be preserved. Proceed?`,
      confirmLabel: "Deactivate",
      cancelLabel: "Cancel",
      danger: true,
    }).then((confirmed: boolean) => {
      if (confirmed) {
        this.employeeService.deactivate(employee._id).subscribe({
          next: (response: EmployeeActionResponse) => {
            this.toastService.success(response.message || "Employee deactivated", employee.firstName);
            this.employeeService.refreshStats();
          },
          error: (err: Error) => {
            this.toastService.error("Deactivation failed", err.message);
          },
        });
      }
    });
  }

  trackById(index: number, item: User): string {
    return item._id;
  }

  openAmountEntry(employee: User): void {
    this.showAmountEntry.set(employee);
    this.amountEntryAmount = 0;
    this.amountEntryType = "sent";
    this.amountEntryRemark = "";
  }

  closeAmountEntry(): void {
    this.showAmountEntry.set(null);
  }

  onAmountEntrySubmit(): void {
    const employee = this.showAmountEntry();
    if (!employee || this.amountEntryAmount <= 0) return;

    const draft: AmountEntryDraft = {
      recipient: employee._id,
      recipientType: "employee",
      type: this.amountEntryType as "sent" | "received",
      amount: this.amountEntryAmount,
      description: this.amountEntryRemark.trim() || undefined,
    };

    this.amountService.create(draft).subscribe({
      next: () => {
        this.toastService.success("Amount entry recorded", employee.firstName);
        this.closeAmountEntry();
        this.loadEmployees(true); // refresh Balance Due (no spinner)
        const h = this.showHistoryFor();
        if (h && h._id === employee._id) this.loadHistory(employee._id);
      },
      error: () => this.toastService.error("Entry failed", "Please try again."),
    });
  }

  // ---- Amount history --------------------------------------------------------
  openHistory(user: User): void {
    this.showHistoryFor.set(user);
    this.loadHistory(user._id);
  }

  closeHistory(): void {
    this.showHistoryFor.set(null);
    this.historyEntries.set([]);
  }

  loadHistory(userId: string): void {
    this.historyLoading.set(true);
    this.amountService.listFor(userId, "employee").subscribe({
      next: (res) => {
        this.historyEntries.set(res.data || []);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyEntries.set([]);
        this.historyLoading.set(false);
      },
    });
  }

  openEditEntry(entry: AmountEntry): void {
    this.editingEntry.set(entry);
    this.editAmount = entry.amount;
    this.editRemark = entry.description || "";
  }

  closeEditEntry(): void {
    this.editingEntry.set(null);
    this.editAmount = 0;
    this.editRemark = "";
  }

  submitEditEntry(): void {
    const entry = this.editingEntry();
    const user = this.showHistoryFor();
    if (!entry || !user) return;
    if (!this.editAmount || this.editAmount <= 0) {
      this.toastService.error("Invalid amount", "Amount must be greater than 0.");
      return;
    }
    this.amountService.update(entry._id, { amount: this.editAmount, description: this.editRemark.trim() }).subscribe({
      next: () => {
        this.toastService.success("Entry updated", user.firstName);
        this.closeEditEntry();
        this.loadHistory(user._id);
        this.loadEmployees(true); // refresh Balance Due (no spinner)
      },
      error: () => this.toastService.error("Update failed", "Please try again."),
    });
  }

  async deleteEntry(entry: AmountEntry): Promise<void> {
    const user = this.showHistoryFor();
    if (!user) return;
    const confirmed = await this.confirmDialogService.ask({
      title: "Delete entry",
      message: `Delete this ${entry.type} entry of ₹${Number(entry.amount).toLocaleString()}?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!confirmed) return;
    this.amountService.delete(entry._id).subscribe({
      next: () => {
        this.toastService.success("Entry deleted", user.firstName);
        this.loadHistory(user._id);
        this.loadEmployees(true); // refresh Balance Due (no spinner)
      },
      error: () => this.toastService.error("Delete failed", "Please try again."),
    });
  }

  openPassword(user: User): void {
    this.showPasswordFor.set(user);
    this.newPassword.set("");
    this.passwordVisible.set(false);
  }

  closePassword(): void {
    this.showPasswordFor.set(null);
  }

  submitPassword(): void {
    const user = this.showPasswordFor();
    const pwd = this.newPassword().trim();
    if (!user) return;
    if (pwd.length < 6) {
      this.toastService.error("Password too short", "Use at least 6 characters.");
      return;
    }
    this.passwordSaving.set(true);
    this.employeeService.setPassword(user._id, pwd).subscribe({
      next: () => {
        this.passwordSaving.set(false);
        this.toastService.success("Password updated", `${user.firstName}'s password was changed.`);
        this.closePassword();
      },
      error: (err: Error) => {
        this.passwordSaving.set(false);
        this.toastService.error("Could not update password", err.message);
      },
    });
  }

  /** The visibility filter is a string select; the flag behind it stays boolean. */
  onVisibilityChange(value: string): void {
    this.showInactive = value === "all";
    this.loadEmployees();
  }
}
