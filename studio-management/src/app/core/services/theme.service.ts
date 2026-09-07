import { Injectable, signal } from '@angular/core';
import { DEFAULT_THEME, THEME_OPTIONS, THEME_STORAGE_KEY, ThemeId, ThemeOption } from '../models/theme.model';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _activeTheme = signal<ThemeId>(this.readStoredTheme());
  readonly activeTheme = this._activeTheme.asReadonly();
  readonly options: ThemeOption[] = THEME_OPTIONS;

  constructor() {
    // Undo any accent override left by the old "Manual Color" feature.
    try {
      document.documentElement.style.removeProperty('--primary');
      document.documentElement.style.removeProperty('--accent');
      localStorage.removeItem('sms.themeColor');
    } catch {
      // ignore
    }
    this.applyTheme(this._activeTheme());
  }

  setTheme(themeId: ThemeId): void {
    this._activeTheme.set(themeId);
    this.applyTheme(themeId);
    this.persistTheme(themeId);
  }

  private applyTheme(themeId: ThemeId): void {
    document.documentElement.setAttribute('data-theme', themeId);
  }

  private persistTheme(themeId: ThemeId): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeId);
    } catch {
      // Storage unavailable (private browsing, etc.) — theme still applies for this session.
    }
  }

  private readStoredTheme(): ThemeId {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeId | null;
      if (stored && THEME_OPTIONS.some((option) => option.id === stored)) {
        return stored;
      }
    } catch {
      // Fall through to default.
    }
    return DEFAULT_THEME;
  }
}
