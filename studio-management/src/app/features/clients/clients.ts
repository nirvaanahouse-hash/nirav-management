import { Component, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { TableComponent } from "../../shared/components/table/table";
import {
  ClientService,
  ClientListResponse,
  BillingMode,
  BillingRow,
  BillingSummary,
} from "../../core/services/client.service";
import { ToastService } from "../../features/toast/toast.service";
import { ConfirmDialogService } from "../../features/dialog/confirm-dialog/confirm-dialog.service";
import {
  Client,
  CLIENT_STATUS_OPTIONS,
  ClientDraft,
  ClientStatus,
} from "../../core/models/client.model";
import { TableColumn } from "../../shared/components/table/table.model";
import { ButtonComponent } from "../../shared/components/button/button";
import { IconButtonComponent } from "../../shared/components/icon-button/icon-button.component";
import { ModalComponent } from "../../features/dialog/modal.component";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { HasPermissionDirective } from "../../shared/directives/has-permission.directive";
import { FormsModule } from "@angular/forms";
import { ClientFormComponent } from "./client-form/client-form.component";
import { TaskService } from "../../core/services/task.service";
import { TicketRecord } from "../../core/models/task.model";
import {
  TICKET_STATUS_OPTIONS,
  TICKET_STATUS_VARIANT,
} from "../../core/constants/app.constants";
import { AuthService } from "../../core/services/auth.service";
import { UserService } from "../../core/services/user.service";
import { User } from "../../core/models/user.model";
import { AmountService } from "../../core/services/amount.service";
import { AmountEntry, AmountEntryDraft } from "../../core/models/amountEntry.model";

type StatusFilter = "all" | ClientStatus;

@Component({
  selector: "app-clients",
  imports: [
    CommonModule,
    TableComponent,
    ButtonComponent,
    IconButtonComponent,
    FormsModule,
    ModalComponent,
    PageHeaderComponent,
    ClientFormComponent,
    HasPermissionDirective,
  ],
  standalone: true,
  templateUrl: "./clients.html",
  styleUrl: "./clients.scss",
})
export class ClientsComponent {
  private clientService = inject(ClientService);
  private taskService = inject(TaskService);
  private toast = inject(ToastService);
  private confirmDialog = inject(ConfirmDialogService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private amountService = inject(AmountService);

   showPaymentEntry = signal<Client | null>(null);
  paymentAmount = 0;
  editingPaymentEntry = signal<any | null>(null);
  showPaymentHistory = signal<Client | null>(null);
  paymentEntries = signal<any[]>([]);
  paymentLoading = signal(false);

  statusOptions = CLIENT_STATUS_OPTIONS;
  ticketStatusOptions = TICKET_STATUS_OPTIONS;

  searchTerm = signal("");
  statusFilter = signal<StatusFilter>("all");
  showInactive = signal(false);

  loading = signal(true);
  saving = signal(false);
  dialogMode = signal<"create" | "edit" | null>(null);
  editingClient = signal<Client | null>(null);

  // Billing / invoice modal state
  showBilling = signal<Client | null>(null);
  billingMode = signal<BillingMode>("current");
  billingFrom = signal("");
  billingTo = signal("");
  billingRows = signal<BillingRow[]>([]);
  billingSummary = signal<BillingSummary | null>(null);
  billingLoading = signal(false);
  billingDownloading = signal(false);
  readonly billingModeOptions: {
    value: BillingMode;
    label: string;
    desc: string;
  }[] = [
    { value: "current", label: "Current", desc: "Unbilled completed work" },
    { value: "all", label: "All", desc: "Every completed & finalised ticket" },
    { value: "custom", label: "Custom", desc: "By delivery date range" },
  ];

  // Work view modal state
  workDialogOpen = signal(false);
  workDialogClient = signal<Client | null>(null);
  clientTickets = signal<TicketRecord[]>([]);
  workLoading = signal(false);
  workTypeFilter = signal("");
  workEmployeeFilter = signal("");

  /** Live list straight from the service signal. */
  private readonly _clients = this.clientService.clients;
  employeeOptions = signal<{ value: string; label: string }[]>([]);

  filteredClients = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const showInactive = this.showInactive();
    return this._clients().filter((c) => {
      const matchesTerm =
        !term ||
        c.name.toLowerCase().includes(term) ||
        (c.sortName || "").toLowerCase().includes(term) ||
        (c.company || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term) ||
        (c.mobileNumber || "").toLowerCase().includes(term);
      const matchesStatus = status === "all" || c.status === status;
      const matchesActive = showInactive || c.isActive;
      return matchesTerm && matchesStatus && matchesActive;
    });
  });

  filteredTickets = computed(() => {
    const term = this.workTypeFilter().trim().toLowerCase();
    const empFilter = this.workEmployeeFilter();
    return this.clientTickets().filter((t) => {
      const matchesType =
        !term ||
        t.ticketType.toLowerCase().includes(term) ||
        t.coupleName?.toLowerCase().includes(term);
      const matchesEmp = !empFilter || String(t.assignedEmployee) === empFilter;
      return matchesType && matchesEmp;
    });
  });

  isAdmin = this.authService.isSuperAdmin;

  columns: TableColumn<Client>[] = [
    { key: "name", label: "Name", sortable: true },
    { key: "sortName", label: "Sort Name", sortable: true },
    { key: "company", label: "Company", sortable: true },
    { key: "mobileNumber", label: "Mobile", sortable: true },
    {
      key: "status",
      label: "Status",
      sortable: true,
      format: (r) => r.status[0].toUpperCase() + r.status.slice(1),
    },
    {
      key: "balanceDue",
      label: "Balance Due",
      sortable: true,
      align: "right",
      format: (r) => `₹${Number(r.balanceDue || 0).toLocaleString()}`,
    },
    {
      key: "paidAmount",
      label: "Paid",
      sortable: true,
      align: "right",
      format: (r) => `₹${Number(r.paidAmount || 0).toLocaleString()}`,
    },
    {
      key: "isActive",
      label: "Active",
      sortable: true,
      format: (r) => (r.isActive ? "Yes" : "No"),
    },
  ];

  constructor() {
    this.fetchClients();
    this.loadEmployees();
  }

  private fetchClients(): void {
    this.loading.set(true);
    this.clientService.list().subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.toast.error("Could not load clients", "Please try again.");
        this.loading.set(false);
      },
    });
  }

  private loadEmployees(): void {
    this.userService.list({ role: "U" }).subscribe({
      next: (response) => {
        const options = (response.data || []).map((u: User) => ({
          value: u._id,
          label: `${u.firstName} ${u.lastName} (@${u.userName})`,
        }));
        this.employeeOptions.set(options);
      },
      error: () => {
        this.employeeOptions.set([]);
      },
    });
  }

  openCreate(): void {
    this.editingClient.set(null);
    this.dialogMode.set("create");
  }

  openEdit(client: Client): void {
    this.editingClient.set(client);
    this.dialogMode.set("edit");
  }

  closeDialog(): void {
    this.dialogMode.set(null);
    this.editingClient.set(null);
  }

  onFormSubmit(draft: ClientDraft): void {
    this.saving.set(true);
    const editing = this.editingClient();
    const request = editing
      ? this.clientService.update(editing._id, draft)
      : this.clientService.create(draft);

    request.subscribe({
      next: (response) => {
        this.saving.set(false);
          this.toast.success(editing ? "Client updated" : "Client created", editing?.name || "");
          this.closeDialog();
          this.fetchClients();
        },
        error: () => {
          this.saving.set(false);
        },
    });
  }

  async confirmDelete(client: Client): Promise<void> {
    if (client.isActive) {
      const confirmed = await this.confirmDialog.ask({
        title: "Deactivate Client",
        message: `Are you sure you want to deactivate ${client.name}? Existing tickets referencing this client will be preserved. Proceed?`,
        confirmLabel: "Deactivate",
        cancelLabel: "Cancel",
        danger: true,
      });
      if (!confirmed) return;

      this.clientService.deactivate(client._id).subscribe({
        next: () => {
          this.toast.success("Client deactivated", client.name);
          this.fetchClients();
        },
        error: () => this.fetchClients(),
      });
    } else {
      const confirmed = await this.confirmDialog.ask({
        title: "Reactivate Client",
        message: `${client.name} is currently deactivated. Reactivate them?`,
        confirmLabel: "Reactivate",
        cancelLabel: "Cancel",
      });
      if (!confirmed) return;

      this.clientService.reactivate(client._id).subscribe({
        next: () => {
          this.toast.success("Client reactivated", client.name);
          this.fetchClients();
        },
        error: () => this.fetchClients(),
      });
    }
  }

  openPaymentEntry(client: Client): void {
    this.showPaymentEntry.set(client);
  }

  closePaymentEntry(): void {
    this.showPaymentEntry.set(null);
  }

  onPaymentSubmit(amount: number): void {
    const client = this.showPaymentEntry();
    if (!client) return;
    if (!amount || amount <= 0) {
      this.toast.error("Please fix the highlighted fields", "Amount must be greater than 0.");
      return;
    }

    const draft: AmountEntryDraft = {
      recipient: client._id,
      recipientType: "client",
      type: "received",
      amount,
    };

    this.amountService.create(draft).subscribe({
      next: () => {
        this.toast.success("Payment recorded", client.name);
        this.closePaymentEntry();
        this.fetchClients();
      },
      error: () => {},
    });
  }

  openEditPaymentEntry(entry: any, client: Client): void {
    this.editingPaymentEntry.set(entry);
    this.paymentAmount = entry.amount;
  }

  closeEditPaymentEntry(): void {
    this.editingPaymentEntry.set(null);
    this.paymentAmount = 0;
  }

  onEditPaymentSubmit(amount: number): void {
    const entry = this.editingPaymentEntry();
    const client = this.showPaymentHistory();
    if (!entry || !client) return;
    if (!amount || amount <= 0) {
      this.toast.error("Please fix the highlighted fields", "Amount must be greater than 0.");
      return;
    }

    this.amountService.update(entry._id, { amount }).subscribe({
      next: () => {
        this.toast.success("Payment updated", client.name);
        this.closeEditPaymentEntry();
        this.loadClientPayments(client._id);
        this.fetchClients();
      },
      error: () => {},
    });
  }

  async onDeletePaymentEntry(entry: any): Promise<void> {
    const client = this.showPaymentHistory();
    if (!client) return Promise.resolve();

    const confirmed = await this.confirmDialog.ask({
      title: "Delete Payment",
      message: `Delete this payment entry of ₹${Number(entry.amount).toLocaleString()}?`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
    });

    if (!confirmed) return Promise.resolve();

    this.amountService.delete(entry._id).subscribe({
      next: () => {
        this.toast.success("Payment deleted", client.name);
        this.loadClientPayments(client._id);
        this.fetchClients();
      },
      error: () => {},
    });
  }

  openPaymentHistory(client: Client): void {
    this.showPaymentHistory.set(client);
    this.loadClientPayments(client._id);
  }

  closePaymentHistory(): void {
    this.showPaymentHistory.set(null);
    this.paymentEntries.set([]);
  }

  loadClientPayments(clientId: string): void {
    this.paymentLoading.set(true);
    this.clientService.getPayments(clientId).subscribe({
      next: (response) => {
        this.paymentEntries.set(response.data || []);
        this.paymentLoading.set(false);
      },
      error: () => {
        this.paymentEntries.set([]);
        this.paymentLoading.set(false);
      },
    });
  }

  viewWork(client: Client): void {
    this.workDialogClient.set(client);
    this.workDialogOpen.set(true);
    this.workTypeFilter.set("");
    this.workEmployeeFilter.set("");
    this.workLoading.set(true);

    this.taskService.list().subscribe({
      next: (response) => {
        const tickets = response.data.filter(
          (t: TicketRecord) => String(t.client) === String(client._id)
        );
        this.clientTickets.set(tickets);
        this.workLoading.set(false);
      },
      error: () => {
        this.clientTickets.set([]);
        this.workLoading.set(false);
      },
    });
  }

  closeWorkDialog(): void {
    this.workDialogOpen.set(false);
    this.workDialogClient.set(null);
    this.clientTickets.set([]);
  }

  // ---- Billing / invoice PDF ----------------------------------------------
  openBilling(client: Client): void {
    this.showBilling.set(client);
    this.billingMode.set("current");
    this.billingFrom.set("");
    this.billingTo.set("");
    this.billingRows.set([]);
    this.billingSummary.set(null);
    this.loadBilling();
  }

  closeBilling(): void {
    this.showBilling.set(null);
    this.billingRows.set([]);
    this.billingSummary.set(null);
  }

  setBillingMode(mode: BillingMode): void {
    this.billingMode.set(mode);
    this.loadBilling();
  }

  onBillingDateChange(): void {
    if (this.billingMode() === "custom") this.loadBilling();
  }

  loadBilling(): void {
    const client = this.showBilling();
    if (!client) return;
    this.billingLoading.set(true);
    this.clientService
      .getBilling(client._id, this.billingMode(), this.billingFrom(), this.billingTo())
      .subscribe({
        next: (res) => {
          this.billingRows.set(res.data.tickets || []);
          this.billingSummary.set(res.data.summary);
          this.billingLoading.set(false);
        },
        error: () => {
          this.billingRows.set([]);
          this.billingSummary.set(null);
          this.billingLoading.set(false);
          this.toast.error("Could not load billing", "Please try again.");
        },
      });
  }

  downloadBilling(): void {
    const client = this.showBilling();
    if (!client || this.billingRows().length === 0) return;
    const mode = this.billingMode();
    this.billingDownloading.set(true);
    this.clientService
      .downloadBillingPdf(client._id, mode, this.billingFrom(), this.billingTo())
      .subscribe({
        next: (blob) => {
          const safe = client.name.replace(/[^a-z0-9]+/gi, "-");
          const stamp = new Date().toISOString().slice(0, 10);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `NirvanaHouse-${safe}-${mode}-${stamp}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          this.billingDownloading.set(false);
          this.toast.success("Invoice downloaded", client.name);
          if (mode === "current") {
            // Those tickets are now flagged billed — refresh preview + list.
            this.loadBilling();
            this.fetchClients();
          }
        },
        error: () => {
          this.billingDownloading.set(false);
          this.toast.error("Could not generate PDF", "Please try again.");
        },
      });
  }

  billingRangeInvalid = computed(() => {
    if (this.billingMode() !== "custom") return false;
    const f = this.billingFrom();
    const t = this.billingTo();
    return !!f && !!t && f > t;
  });

  formatTicketType(type: string): string {
    const map: Record<string, string> = {
      weddingJob: "Wedding JOB",
      preweddingJob: "Prewedding JOB",
      babyShowerJob: "Baby Shower JOB",
      weddingHighlight: "Wedding HighLight",
      preweddingHighlight: "Prewedding HighLight",
      babyShowerHighlight: "Baby Shower HighLight",
      reels: "Reels",
      shortFilm: "Short Film",
    };
    return map[type] || type;
  }

  formatStatus(s: string): string {
    const map: Record<string, string> = {
      pending: "Pending",
      inProgress: "In Progress",
      completed: "Completed",
      hold: "Hold",
    };
    return map[s] || s;
  }

  statusVariant(s: string): string {
    return TICKET_STATUS_VARIANT[s as keyof typeof TICKET_STATUS_VARIANT] ?? "neutral";
  }

  trackById(index: number, item: Client): string {
    return item._id;
  }

  toNumber(value: string | number | undefined): number {
    return Number(value || 0);
  }
}
