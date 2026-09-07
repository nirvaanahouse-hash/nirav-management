import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:'./modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
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
    if (!this.dismissOnEsc()) return;
    event.preventDefault();
    event.stopPropagation();
    this.close.emit();
  }
}
