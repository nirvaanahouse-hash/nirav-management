import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NavIcon } from './nav-items';

/** The nav icon set, shared by the desktop sidebar and the mobile tab bar. */
@Component({
  selector: 'app-nav-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (name()) {
      @case ('grid') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <rect x="2.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6" />
          <rect x="11.5" y="2.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6" />
          <rect x="2.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6" />
          <rect x="11.5" y="11.5" width="6" height="6" rx="1.4" stroke="currentColor" stroke-width="1.6" />
        </svg>
      }
      @case ('tasks') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <path d="M4 6h12M4 10h12M4 14h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="16" cy="14" r="1.6" stroke="currentColor" stroke-width="1.4" />
        </svg>
      }
      @case ('clients') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <circle cx="7" cy="6.5" r="2.6" stroke="currentColor" stroke-width="1.6" />
          <path d="M2.5 16c0-3 2-4.8 4.5-4.8s4.5 1.8 4.5 4.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          <circle cx="14.5" cy="7" r="2" stroke="currentColor" stroke-width="1.4" />
          <path d="M12.8 11.6c2.2.2 3.7 1.8 3.7 4.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      }
      @case ('profile') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <circle cx="10" cy="6.5" r="3" stroke="currentColor" stroke-width="1.6" />
          <path d="M3.5 17c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      }
      @case ('wallet') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" stroke-width="1.6" />
          <path d="M2.5 8h15" stroke="currentColor" stroke-width="1.6" />
          <circle cx="14" cy="11.5" r="1.1" fill="currentColor" />
        </svg>
      }
      @case ('shield') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <path d="M10 2.5l6 2.2v4.5c0 3.6-2.5 6.4-6 8-3.5-1.6-6-4.4-6-8V4.7l6-2.2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <path d="M7.4 10l1.8 1.8 3.4-3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      }
      @case ('key') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <circle cx="7" cy="13" r="3.4" stroke="currentColor" stroke-width="1.6" />
          <path d="M9.4 10.6 16 4m-2.2 2.2 1.8 1.8M15 4l1.8 1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      }
      @case ('versus') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <rect x="2.5" y="7" width="6" height="10.5" rx="1.2" stroke="currentColor" stroke-width="1.6" />
          <rect x="11.5" y="2.5" width="6" height="15" rx="1.2" stroke="currentColor" stroke-width="1.6" />
        </svg>
      }
      @case ('tags') {
        <svg viewBox="0 0 20 20" [attr.width]="size()" [attr.height]="size()" fill="none">
          <path d="M3 3.5h6.2L17 11.3a1.6 1.6 0 0 1 0 2.3l-3.4 3.4a1.6 1.6 0 0 1-2.3 0L3.5 9.2V3.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          <circle cx="6.8" cy="6.8" r="1.2" fill="currentColor" />
        </svg>
      }
    }
  `,
  styles: [':host { display: inline-flex; }'],
})
export class NavIconComponent {
  name = input.required<NavIcon>();
  size = input(18);
}
