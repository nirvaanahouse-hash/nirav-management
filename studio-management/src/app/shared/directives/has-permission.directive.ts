import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
} from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';

/**
 * Structural directive — renders its content only when the current user holds
 * the given permission (any-of when passed an array). SA always renders.
 *
 *   <button *appCan="'tickets.delete'">Delete</button>
 *   <a *appCan="['clients.edit','clients.delete']">Manage</a>
 */
@Directive({
  selector: '[appCan]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);

  private required: string[] = [];
  private shown = false;

  @Input()
  set appCan(value: string | string[] | null | undefined) {
    this.required = value == null ? [] : Array.isArray(value) ? value : [value];
    this.update();
  }

  constructor() {
    // Re-evaluate when the session / permission set changes.
    effect(() => {
      this.permissions.keys();
      this.permissions.isSuperAdmin();
      this.update();
    });
  }

  private update(): void {
    const allowed =
      this.required.length === 0 || this.permissions.canAny(this.required);
    if (allowed && !this.shown) {
      this.vcr.createEmbeddedView(this.tpl);
      this.shown = true;
    } else if (!allowed && this.shown) {
      this.vcr.clear();
      this.shown = false;
    }
  }
}
