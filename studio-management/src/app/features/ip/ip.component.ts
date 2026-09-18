import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { IpService } from '../../core/services/ip.service';
import {
  IpRule,
  IpRuleMode,
  IpSettings,
  IpStats,
  LoginEvent,
  RequestLog,
} from '../../core/models/ip.model';
import { IP_RULE_MODE_OPTIONS, IP_RULE_MODE_VARIANT } from '../../core/constants/app.constants';
import { ToastService } from '../../features/toast/toast.service';
import { ConfirmDialogService } from '../../features/dialog/confirm-dialog/confirm-dialog.service';
import { PermissionService } from '../../core/services/permission.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ModalComponent } from '../../features/dialog/modal.component';
import { ButtonComponent } from '../../shared/components/button/button';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { RowActionsComponent } from '../../shared/components/row-actions/row-actions.component';
import { FormFieldComponent } from '../../shared/components/form-field/form-field.component';
import { SelectComponent } from '../../shared/components/select/select.component';
import { CheckboxComponent } from '../../shared/components/checkbox/checkbox.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';

type TabKey = 'rules' | 'limits' | 'logins' | 'requests';

const PAGE_SIZE = 25;

@Component({
  selector: 'app-ip',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    ModalComponent,
    ButtonComponent,
    IconButtonComponent,
    RowActionsComponent,
    FormFieldComponent,
    SelectComponent,
    CheckboxComponent,
    ToggleComponent,
  ],
  templateUrl: './ip.component.html',
  styleUrls: ['./ip.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IpComponent {
  private readonly ipService = inject(IpService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly canManageRules = computed(() => this.permissions.can('security.rules.manage'));
  readonly canManageSettings = computed(() => this.permissions.can('security.settings.manage'));

  readonly modeOptions = IP_RULE_MODE_OPTIONS;
  readonly ipErrorMessages = {
    required: 'IP address is required.',
    server: 'Enter a valid IPv4 / IPv6 address or an IPv4 CIDR block (e.g. 192.168.1.0/24).',
  };
  readonly pageSize = PAGE_SIZE;

  readonly activeTab = signal<TabKey>('rules');
  readonly loading = signal(true);

  readonly stats = signal<IpStats | null>(null);
  readonly settings = signal<IpSettings | null>(null);
  readonly myIp = signal<string>('');

  readonly guardEnabled = computed(() => this.settings()?.guardEnabled ?? false);

  // --- Rules ---------------------------------------------------------------
  readonly rules = signal<IpRule[]>([]);
  readonly rulesLoading = signal(false);
  readonly showRuleModal = signal(false);
  readonly editingRule = signal<IpRule | null>(null);
  readonly savingRule = signal(false);

  readonly ruleForm = this.fb.nonNullable.group({
    ip: ['', [Validators.required, Validators.maxLength(60)]],
    mode: ['block' as IpRuleMode, [Validators.required]],
    note: ['', [Validators.maxLength(160)]],
  });

  // --- Rate limiting -----------------------------------------------------
  readonly savingLimits = signal(false);
  readonly limitsForm = this.fb.nonNullable.group({
    rateLimitEnabled: [true],
    logRequests: [true],
    rateLimitWindowMs: [60000, [Validators.required, Validators.min(1000), Validators.max(3600000)]],
    rateLimitMax: [240, [Validators.required, Validators.min(0), Validators.max(100000)]],
    authRateLimitMax: [10, [Validators.required, Validators.min(0), Validators.max(100000)]],
  });

  // --- Login activity --------------------------------------------------
  readonly logins = signal<LoginEvent[]>([]);
  readonly loginsLoading = signal(false);
  readonly loginsTotal = signal(0);
  readonly loginsHasMore = signal(false);
  loginFilter = { ip: '', success: '' };
  private loginSkip = 0;

  // --- Request log ------------------------------------------------------
  readonly requests = signal<RequestLog[]>([]);
  readonly requestsLoading = signal(false);
  readonly requestsTotal = signal(0);
  readonly requestsHasMore = signal(false);
  requestFilter = { ip: '', method: '', statusClass: '', path: '' };
  private requestSkip = 0;

  readonly methodOptions = [
    { value: '', label: 'Any method' },
    { value: 'GET', label: 'GET' },
    { value: 'POST', label: 'POST' },
    { value: 'PUT', label: 'PUT' },
    { value: 'PATCH', label: 'PATCH' },
    { value: 'DELETE', label: 'DELETE' },
  ];
  readonly statusOptions = [
    { value: '', label: 'Any status' },
    { value: '2', label: '2xx success' },
    { value: '3', label: '3xx redirect' },
    { value: '4', label: '4xx client error' },
    { value: '5', label: '5xx server error' },
  ];
  readonly successOptions = [
    { value: '', label: 'All outcomes' },
    { value: 'true', label: 'Successful only' },
    { value: 'false', label: 'Failed only' },
  ];

  constructor() {
    this.loadOverview();
    this.loadRules();
  }

  // --- Overview ---------------------------------------------------------
  loadOverview(): void {
    this.loading.set(true);
    forkJoin({
      stats: this.ipService.stats(),
      settings: this.ipService.getSettings(),
      who: this.ipService.whoami(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ stats, settings, who }) => {
        this.stats.set(stats.data);
        this.settings.set(settings.data);
        this.myIp.set(who.data.ip);
        this.patchLimitsForm(settings.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load security overview', 'Please try again.');
      },
    });
  }

  private refreshStats(): void {
    this.ipService.stats().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (r) => this.stats.set(r.data), error: () => {} });
  }

  private patchLimitsForm(s: IpSettings): void {
    this.limitsForm.reset({
      rateLimitEnabled: s.rateLimitEnabled,
      logRequests: s.logRequests,
      rateLimitWindowMs: s.rateLimitWindowMs,
      rateLimitMax: s.rateLimitMax,
      authRateLimitMax: s.authRateLimitMax,
    });
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    if (tab === 'logins' && !this.logins().length && !this.loginsLoading()) this.loadLogins();
    if (tab === 'requests' && !this.requests().length && !this.requestsLoading()) this.loadRequests();
  }

  // --- Guard toggle ---------------------------------------------------
  async toggleGuard(next: boolean): Promise<void> {
    if (next) {
      const ok = await this.confirm.ask({
        title: 'Enable IP guard?',
        message: `Once enabled, only permitted IPs can reach the API. Your current IP is ${
          this.myIp() || 'unknown'
        }. Requests from the server machine itself (localhost) are always allowed. Add an "allow" rule for your IP first if you are on another device.`,
        confirmLabel: 'Enable guard',
        cancelLabel: 'Cancel',
        danger: true,
      });
      if (!ok) return;
    }
    this.ipService.updateSettings({ guardEnabled: next }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.settings.set(res.data);
        this.toast.success(next ? 'IP guard enabled' : 'IP guard disabled');
        this.refreshStats();
      },
      error: () => this.toast.error('Could not update IP guard'),
    });
  }

  // --- Rules --------------------------------------------------------
  loadRules(): void {
    this.rulesLoading.set(true);
    this.ipService.listRules().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.rules.set(res.data);
        this.rulesLoading.set(false);
      },
      error: () => {
        this.rulesLoading.set(false);
        this.toast.error('Could not load IP rules');
      },
    });
  }

  openCreateRule(): void {
    this.editingRule.set(null);
    this.ruleForm.reset({ ip: '', mode: 'block', note: '' });
    this.showRuleModal.set(true);
  }

  addMyIp(): void {
    this.editingRule.set(null);
    this.ruleForm.reset({ ip: this.myIp(), mode: 'allow', note: 'My device' });
    this.showRuleModal.set(true);
  }

  openEditRule(rule: IpRule): void {
    this.editingRule.set(rule);
    this.ruleForm.reset({ ip: rule.ip, mode: rule.mode, note: rule.note || '' });
    this.showRuleModal.set(true);
  }

  closeRuleModal(): void {
    this.showRuleModal.set(false);
    this.editingRule.set(null);
  }

  submitRule(): void {
    if (this.ruleForm.invalid) {
      this.ruleForm.markAllAsTouched();
      return;
    }
    const raw = this.ruleForm.getRawValue();
    const payload = { ip: raw.ip.trim(), mode: raw.mode, note: raw.note.trim() };
    const editing = this.editingRule();
    this.savingRule.set(true);

    const req = editing
      ? this.ipService.updateRule(editing._id, payload)
      : this.ipService.createRule(payload);

    req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.savingRule.set(false);
        this.toast.success(editing ? 'Rule updated' : 'Rule added');
        this.closeRuleModal();
        this.rules.update((list) =>
          editing
            ? list.map((r) => (r._id === res.data._id ? res.data : r))
            : [res.data, ...list],
        );
        this.refreshStats();
      },
      error: (err: { error?: { message?: string; errors?: { field: string; message: string }[] } }) => {
        this.savingRule.set(false);
        const apiErrors = err?.error?.errors;
        if (apiErrors?.length) {
          for (const e of apiErrors) {
            const control = (this.ruleForm.controls as Record<string, { setErrors: (v: unknown) => void }>)[e.field];
            control?.setErrors({ server: e.message });
          }
        }
        this.toast.error('Could not save rule', err?.error?.message || 'Please check the address.');
      },
    });
  }

  toggleRuleActive(rule: IpRule): void {
    this.ipService.updateRule(rule._id, { isActive: !rule.isActive }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.rules.update((list) => list.map((r) => (r._id === res.data._id ? res.data : r)));
        this.toast.success(res.data.isActive ? 'Rule enabled' : 'Rule disabled');
        this.refreshStats();
      },
      error: () => this.toast.error('Could not update rule'),
    });
  }

  async deleteRule(rule: IpRule): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Delete IP rule',
      message: `Remove the ${rule.mode} rule for ${rule.ip}?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    this.ipService.deleteRule(rule._id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.rules.update((list) => list.filter((r) => r._id !== rule._id));
        this.toast.success('Rule deleted');
        this.refreshStats();
      },
      error: () => this.toast.error('Could not delete rule'),
    });
  }

  // --- Rate limiting ------------------------------------------------
  saveLimits(): void {
    if (this.limitsForm.invalid) {
      this.limitsForm.markAllAsTouched();
      this.toast.error('Check the rate-limit values');
      return;
    }
    this.savingLimits.set(true);
    this.ipService.updateSettings(this.limitsForm.getRawValue()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.settings.set(res.data);
        this.patchLimitsForm(res.data);
        this.savingLimits.set(false);
        this.toast.success('Rate-limit settings saved');
        this.refreshStats();
      },
      error: () => {
        this.savingLimits.set(false);
        this.toast.error('Could not save settings');
      },
    });
  }

  // --- Login activity ---------------------------------------------
  loadLogins(reset = true): void {
    if (reset) {
      this.loginSkip = 0;
      this.logins.set([]);
    }
    this.loginsLoading.set(true);
    this.ipService
      .listLogins({
        ip: this.loginFilter.ip.trim() || undefined,
        success: (this.loginFilter.success as 'true' | 'false') || undefined,
        limit: this.pageSize,
        skip: this.loginSkip,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.logins.update((cur) => (reset ? res.data : [...cur, ...res.data]));
          this.loginsTotal.set(res.total);
          this.loginsHasMore.set(res.hasMore);
          this.loginsLoading.set(false);
        },
        error: () => {
          this.loginsLoading.set(false);
          this.toast.error('Could not load login activity');
        },
      });
  }

  loadMoreLogins(): void {
    this.loginSkip += this.pageSize;
    this.loadLogins(false);
  }

  // --- Request log ----------------------------------------------
  loadRequests(reset = true): void {
    if (reset) {
      this.requestSkip = 0;
      this.requests.set([]);
    }
    this.requestsLoading.set(true);
    this.ipService
      .listRequests({
        ip: this.requestFilter.ip.trim() || undefined,
        method: this.requestFilter.method || undefined,
        statusClass: (this.requestFilter.statusClass as '2' | '3' | '4' | '5') || undefined,
        path: this.requestFilter.path.trim() || undefined,
        limit: this.pageSize,
        skip: this.requestSkip,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.requests.update((cur) => (reset ? res.data : [...cur, ...res.data]));
          this.requestsTotal.set(res.total);
          this.requestsHasMore.set(res.hasMore);
          this.requestsLoading.set(false);
        },
        error: () => {
          this.requestsLoading.set(false);
          this.toast.error('Could not load request log');
        },
      });
  }

  loadMoreRequests(): void {
    this.requestSkip += this.pageSize;
    this.loadRequests(false);
  }

  // --- View helpers -------------------------------------------
  modeVariant(mode: IpRuleMode): string {
    return IP_RULE_MODE_VARIANT[mode] ?? 'neutral';
  }

  statusVariant(code?: number): string {
    if (!code) return 'neutral';
    if (code >= 500) return 'danger';
    if (code >= 400) return 'warning';
    if (code >= 300) return 'info';
    if (code >= 200) return 'success';
    return 'neutral';
  }

  windowLabel(ms?: number): string {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    return s % 60 === 0 ? `${s / 60} min` : `${s}s`;
  }

  trackById(_i: number, item: { _id: string }): string {
    return item._id;
  }
}
