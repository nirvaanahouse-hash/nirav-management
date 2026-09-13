import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  input,
} from '@angular/core';

const MOBILE_QUERY = '(max-width: 768px)';

/**
 * Lifts a dropdown panel out to <body> and parks it against its anchor.
 *
 * Panels are declared inside the page, and `.main-layout__outlet` carries
 * `view-transition-name: page`, which forms a stacking context — so a panel
 * left in place is ranked inside that subtree and the fixed bottom tab bar
 * paints over it (the same trap the dialogs hit). Moving the panel to <body>
 * puts it back in the root stacking context.
 *
 * On a phone the panel is a bottom sheet and needs no coordinates. On a
 * desktop it is pinned under (or above) the anchor, and follows it on scroll
 * and resize.
 */
@Directive({
  selector: '[appPopover]',
  standalone: true,
  host: { 'data-popover': '' },
})
export class PopoverDirective implements AfterViewInit, OnDestroy {
  /** The trigger this panel belongs to. */
  appPopover = input.required<HTMLElement>();
  /** Match the anchor's width (selects do, the calendar does not). */
  matchWidth = input(false);
  /** false for the phone scrim, which only needs lifting, never placing. */
  positioned = input(true);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly reposition = () => this.place();
  private scrollers: EventTarget[] = [];

  ngAfterViewInit(): void {
    document.body.appendChild(this.host.nativeElement);
    this.place();

    // Listen on each scrollable ancestor of the anchor, not on window with
    // capture: the app scrolls an inner container (.main-layout__page), and a
    // window-level scroll listener never sees that.
    this.scrollers = [...this.scrollParents(this.appPopover()), window];
    this.scrollers.forEach((t) => t.addEventListener('scroll', this.reposition, { passive: true }));
    window.addEventListener('resize', this.reposition);
  }

  ngOnDestroy(): void {
    this.scrollers.forEach((t) => t.removeEventListener('scroll', this.reposition));
    window.removeEventListener('resize', this.reposition);
    this.host.nativeElement.remove();
  }

  private scrollParents(el: HTMLElement): HTMLElement[] {
    const found: HTMLElement[] = [];
    for (let node = el.parentElement; node; node = node.parentElement) {
      const { overflowX, overflowY } = getComputedStyle(node);
      if (/(auto|scroll|overlay)/.test(`${overflowY} ${overflowX}`)) found.push(node);
    }
    return found;
  }

  private place(): void {
    const panel = this.host.nativeElement;

    if (!this.positioned() || window.matchMedia(MOBILE_QUERY).matches) {
      // The sheet is positioned entirely by CSS.
      panel.style.removeProperty('top');
      panel.style.removeProperty('left');
      panel.style.removeProperty('width');
      return;
    }

    const anchor = this.appPopover().getBoundingClientRect();
    const gap = 6;
    const width = this.matchWidth() ? anchor.width : panel.offsetWidth;
    const height = panel.offsetHeight;

    // Flip above the anchor when there isn't room below.
    const below = window.innerHeight - anchor.bottom;
    const top = below < height + gap && anchor.top > height + gap
      ? anchor.top - height - gap
      : anchor.bottom + gap;

    const left = Math.min(
      Math.max(gap, anchor.left),
      Math.max(gap, window.innerWidth - width - gap),
    );

    panel.style.top = `${Math.round(top)}px`;
    panel.style.left = `${Math.round(left)}px`;
    if (this.matchWidth()) panel.style.width = `${Math.round(width)}px`;
  }
}
