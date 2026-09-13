import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:'./modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  // Every open modal binds its own `document:keydown.escape` listener, and
  // stopPropagation() doesn't stop sibling listeners on the same `document`
  // target from also firing — so pressing Escape while a confirm dialog sits
  // on top of another open modal (e.g. "Save changes?" over an Edit dialog)
  // used to close both at once. Track open order here so only the top-most
  // modal actually responds.
  private static readonly stack: ModalComponent[] = [];

  constructor() {
    ModalComponent.stack.push(this);
    /**
     * Dialogs are declared deep inside `.main-layout__outlet`, which carries
     * `view-transition-name: page` for the route animation — and that forms a
     * stacking context. Any z-index in here is therefore scoped to that
     * subtree, so the fixed bottom tab bar (z-index 50, at the root) painted
     * straight over the sheet and hid its Save / Cancel row on phones.
     *
     * Moving the host to <body> puts the dialog back in the root stacking
     * context, where its z-index actually means something.
     */
    // afterNextRender, not the constructor: Angular inserts the host element
    // into its declared position after the component is built, which would
    // undo an earlier move.
    afterNextRender(() => document.body.appendChild(this.host.nativeElement));
  }

  ngOnDestroy(): void {
    const idx = ModalComponent.stack.indexOf(this);
    if (idx !== -1) ModalComponent.stack.splice(idx, 1);
    // Angular would look for this element under its original parent, so take
    // it out ourselves now that it lives on <body>.
    this.host.nativeElement.remove();
  }

  title = input<string>('');
  maxWidth = input<number>(560);
  hasFooter = input<boolean>(true);
  dismissOnBackdrop = input<boolean>(true);
  /** Close when the Escape key is pressed. */
  dismissOnEsc = input<boolean>(true);
  close = output<void>();

  onBackdropClick(): void {
    if (this.dismissOnBackdrop()) this.close.emit();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    // Ignore entirely if a different (more recently opened) modal is on top.
    if (ModalComponent.stack[ModalComponent.stack.length - 1] !== this) return;
    if (!this.dismissOnEsc()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.close.emit();
  }
}
