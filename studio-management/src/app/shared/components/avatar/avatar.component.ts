import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Small round photo with an initials fallback. Used for client photos in the
 * clients and tickets lists (table cells and phone cards alike).
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (src()) {
      <img [src]="src()" [alt]="name()" loading="lazy" (error)="onError()" />
    } @else {
      <span class="avatar__initials" aria-hidden="true">{{ initials() }}</span>
    }
  `,
  styleUrl: './avatar.component.scss',
  host: {
    class: 'avatar',
    '[class.avatar--sm]': 'size() === "sm"',
    '[attr.title]': 'name() || null',
  },
})
export class AvatarComponent {
  /** Ready-to-use image URL, or empty for the initials fallback. */
  photo = input<string | null | undefined>('');
  name = input<string>('');
  size = input<'sm' | 'md'>('md');

  /** A file missing on disk falls back to initials rather than a broken image. */
  private readonly brokenSrc = signal('');

  readonly src = computed(() => {
    const value = (this.photo() || '').trim();
    return value && value !== this.brokenSrc() ? value : '';
  });

  readonly initials = computed(() => {
    const parts = (this.name() || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '—';
    return parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  });

  onError(): void {
    this.brokenSrc.set((this.photo() || '').trim());
  }
}
