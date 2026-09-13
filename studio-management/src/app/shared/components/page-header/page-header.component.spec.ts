import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  it('renders the title and, when set, the subtitle', () => {
    const fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Dashboard');
    fixture.componentRef.setInput('subtitle', 'Studio overview');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Dashboard');
    expect(text).toContain('Studio overview');
  });

  it('omits the subtitle element when no subtitle is given', () => {
    const fixture = TestBed.createComponent(PageHeaderComponent);
    fixture.componentRef.setInput('title', 'Clients');
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.page-header__subtitle'),
    ).toBeNull();
  });
});
