import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { AuthService } from "../../core/services/auth.service";
import { AmountService } from "../../core/services/amount.service";
import { AmountEntry, AmountEntryDraft } from "../../core/models/amountEntry.model";
import { ToastService } from "../../features/toast/toast.service";
import { ConfirmDialogService } from "../../features/dialog/confirm-dialog/confirm-dialog.service";
import { ButtonComponent } from "../../shared/components/button/button";
import { IconButtonComponent } from "../../shared/components/icon-button/icon-button.component";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { SelectComponent } from "../../shared/components/select/select.component";
import { SelectItem } from "../../shared/components/select/select.model";
import { ModalComponent } from "../../features/dialog/modal.component";

/** "sent" = studio owes / will pay the user; "received" = user owes / will pay the studio. */
type Direction = "sent" | "received";

@Component({
  selector: "app-account",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    IconButtonComponent,
    PageHeaderComponent,
    ModalComponent,
    SelectComponent,
  ],
  templateUrl: "./account.component.html",
  styleUrls: ["./account.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly amountService = inject(AmountService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);

  readonly loading = signal(true);
  // AmountService keeps this in sync from each create/update/delete response
  // directly — no need to re-fetch the whole list after a mutation.
  readonly entries = this.amountService.entries;

  readonly myId = computed(() => this.auth.currentUser()?._id ?? "");

  // --- Derived totals -------------------------------------------------------
  private sumBy(fn: (e: AmountEntry) => boolean): number {
    return this.entries()
      .filter(fn)
      .reduce((total, e) => total + Number(e.amount || 0), 0);
  }

  readonly toReceive = computed(() => this.sumBy((e) => e.type === "sent"));
  readonly toPay = computed(() => this.sumBy((e) => e.type === "received"));
  readonly net = computed(() => this.toReceive() - this.toPay());

  readonly adminTotal = computed(() => this.sumBy((e) => e.recordedByRole !== "U"));
  readonly adminCount = computed(
    () => this.entries().filter((e) => e.recordedByRole !== "U").length,
  );
  readonly myTotal = computed(() => this.sumBy((e) => e.recordedByRole === "U"));
  readonly myCount = computed(
    () => this.entries().filter((e) => e.recordedByRole === "U").length,
  );

  readonly netLabel = computed(() => {
    const n = this.net();
    if (n > 0) return "Studio owes you";
    if (n < 0) return "You owe the studio";
    return "All settled up";
  });

  // --- Add / edit modal state -------------------------------------------------
  readonly showForm = signal(false);
  direction: Direction = "sent";

  readonly directionOptions: SelectItem[] = [
    { value: "sent", label: "Money to receive (studio → me)" },
    { value: "received", label: "Money to pay (me → studio)" },
  ];
  amount = 0;
  remark = "";
  readonly saving = signal(false);

  readonly editing = signal<AmountEntry | null>(null);
  editAmount = 0;
  editRemark = "";

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.amountService.list().subscribe({
      next: () => {
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("Could not load entries", "Please try again.");
      },
    });
  }

  money(v: number | undefined): string {
    return `₹${Math.round(Number(v || 0)).toLocaleString()}`;
  }

  recordedBySelf(entry: AmountEntry): boolean {
    return entry.recordedByRole === "U" && String(entry.recordedBy) === this.myId();
  }

  // --- Add -----------------------------------------------------------------
  openForm(): void {
    this.direction = "sent";
    this.amount = 0;
    this.remark = "";
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  submitForm(): void {
    const amount = Number(this.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.toast.error("Invalid amount", "Enter an amount greater than 0.");
      return;
    }
    const draft: AmountEntryDraft = {
      recipient: this.myId(),
      recipientType: "employee",
      type: this.direction,
      amount,
      description: this.remark.trim() || undefined,
    };
    this.saving.set(true);
    this.amountService.create(draft).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success("Entry added", "Your admin can now see it.");
        this.closeForm();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving.set(false);
        this.toast.error("Could not add entry", err?.error?.message || "Please try again.");
      },
    });
  }

  // --- Edit (only entries the user recorded) -------------------------------
  openEdit(entry: AmountEntry): void {
    this.editing.set(entry);
    this.editAmount = entry.amount;
    this.editRemark = entry.description || "";
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  submitEdit(): void {
    const entry = this.editing();
    if (!entry) return;
    const amount = Number(this.editAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      this.toast.error("Invalid amount", "Enter an amount greater than 0.");
      return;
    }
    this.saving.set(true);
    this.amountService
      .update(entry._id, { amount, description: this.editRemark.trim() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success("Entry updated", "");
          this.closeEdit();
        },
        error: (err: { error?: { message?: string } }) => {
          this.saving.set(false);
          this.toast.error("Could not update", err?.error?.message || "Please try again.");
        },
      });
  }

  async remove(entry: AmountEntry): Promise<void> {
    const ok = await this.confirm.ask({
      title: "Delete entry",
      message: `Delete this entry of ${this.money(entry.amount)}?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });
    if (!ok) return;
    this.amountService.delete(entry._id).subscribe({
      next: () => {
        this.toast.success("Entry deleted", "");
      },
      error: (err: { error?: { message?: string } }) => {
        this.toast.error("Could not delete", err?.error?.message || "Please try again.");
      },
    });
  }
}
