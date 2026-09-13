import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/** Above this many buttons, a row's actions collapse into a dropdown menu. */
const MENU_THRESHOLD = 3;
const MOBILE_QUERY = '(max-width: 768px)';

/**
 * Wraps a row's `<app-icon-button>` actions. Three or fewer render exactly
 * as before (this component gets out of the way) — more than that collapse
 * into a single "more actions" button that opens a labelled dropdown menu,
 * so a row with many actions doesn't turn into a wall of unlabelled icons.
 *
 * The count is read live off the projected buttons via ContentChildren, so
 * it reacts correctly to whatever `@if`/`*appCan` conditions the caller
 * already has on them — nothing about those conditions needs to change.
 *
 * The projected content lives in one `<ng-content>` that is never behind an
 * `@if` — Angular's content projection cannot reliably move projected nodes
 * into an `<ng-content>` that only starts existing after the button count
 * resolves (confirmed by hand: the menu renders empty otherwise), so instead
 * this component moves that one stable node to <body> itself, imperatively,
 * the first time useMenu() turns true.
 *
 *   <app-row-actions>
 *     <app-icon-button *appCan="'x.edit'" label="Edit" (clicked)="edit(row)">…</app-icon-button>
 *     ...
 *   </app-row-actions>
 */
@Component({
  selector: 'app-row-actions',
  standalone: true,
  imports: [],
  templateUrl: './row-actions.component.html',
  styleUrl: './row-actions.component.scss',
  host: { class: 'row-actions-host' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RowActionsComponent implements AfterContentInit, OnDestroy {
  @ContentChildren(IconButtonComponent, { descendants: true })
  private buttons!: QueryList<IconButtonComponent>;

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly triggerRef = viewChild<ElementRef<HTMLElement>>('trigger');
  private readonly scrimRef = viewChild<ElementRef<HTMLElement>>('scrim');
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  private readonly count = signal(0);
  private changesSub?: Subscription;
  private movedToBody = false;
  private readonly reposition = () => this.position();

  readonly useMenu = computed(() => this.count() > MENU_THRESHOLD);
  readonly open = signal(false);

  constructor() {
    effect(() => {
      if (!this.useMenu() || this.movedToBody) return;
      const panel = this.panelRef()?.nativeElement;
      const scrim = this.scrimRef()?.nativeElement;
      if (!panel || !scrim) return;
      this.movedToBody = true;
      document.body.appendChild(scrim);
      document.body.appendChild(panel);
    });
  }

  ngAfterContentInit(): void {
    this.count.set(this.buttons.length);
    this.changesSub = this.buttons.changes.subscribe((list: QueryList<IconButtonComponent>) => {
      this.count.set(list.length);
    });
  }

  ngOnDestroy(): void {
    this.changesSub?.unsubscribe();
    window.removeEventListener('resize', this.reposition);
    this.panelRef()?.nativeElement.remove();
    this.scrimRef()?.nativeElement.remove();
  }

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) {
      // A microtask can still run before Angular has applied the --open
      // class to the DOM (its own CD is scheduled independently), so the
      // panel would measure as display:none (0×0) and position wrong — a
      // macrotask guarantees the class change has painted first.
      setTimeout(this.reposition, 0);
      window.addEventListener('resize', this.reposition, { passive: true });
    } else {
      window.removeEventListener('resize', this.reposition);
    }
  }

  close(): void {
    this.open.set(false);
    window.removeEventListener('resize', this.reposition);
  }

  /** Clicking a real action inside the menu should also close it. */
  onMenuClick(event: Event): void {
    if ((event.target as HTMLElement).closest('button')) {
      queueMicrotask(() => this.close());
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentDown(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as HTMLElement;
    const insidePanel = !!this.panelRef()?.nativeElement.contains(target);
    const insideHost = this.elementRef.nativeElement.contains(target);
    if (!insidePanel && !insideHost) this.close();
  }

  private position(): void {
    const trigger = this.triggerRef()?.nativeElement;
    const panel = this.panelRef()?.nativeElement;
    if (!trigger || !panel) return;

    if (window.matchMedia(MOBILE_QUERY).matches) {
      // The sheet is positioned entirely by CSS.
      panel.style.removeProperty('top');
      panel.style.removeProperty('left');
      return;
    }

    const anchor = trigger.getBoundingClientRect();
    const gap = 6;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;

    const below = window.innerHeight - anchor.bottom;
    const top =
      below < height + gap && anchor.top > height + gap ? anchor.top - height - gap : anchor.bottom + gap;

    const left = Math.min(
      Math.max(gap, anchor.right - width),
      Math.max(gap, window.innerWidth - width - gap),
    );

    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
  }
}
