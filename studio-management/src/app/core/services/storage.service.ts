import { Injectable } from "@angular/core";

/**
 * Backed by sessionStorage, not localStorage — the auth session (the only
 * current consumer) is meant to end when the tab/browser closes, so the
 * user logs in again each time rather than staying signed in indefinitely.
 * This also sidesteps cross-browser cookie quirks entirely (Safari's ITP
 * and friends): nothing here is a cookie, so there's nothing for a browser's
 * tracking-prevention policy to block or expire early.
 */
@Injectable({
  providedIn: "root",
})
export class StorageService {
  set<T>(key: string, value: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Storage set error:", error);
    }
  }

  get<T>(key: string): T | null {
    try {
      const value = sessionStorage.getItem(key);

      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      console.error("Storage get error:", error);
      return null;
    }
  }

  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error("Storage remove error:", error);
    }
  }

  clear(): void {
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error("Storage clear error:", error);
    }
  }

  has(key: string): boolean {
    try {
      return sessionStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  }
}
