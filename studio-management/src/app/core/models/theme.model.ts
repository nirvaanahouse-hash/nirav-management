export type ThemeId = 'light' | 'dark';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  swatch: [string, string, string]; // three representative colors for the picker
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Clean neutral surfaces with a deep teal accent.',
    swatch: ['#F6F7F9', '#0F766E', '#171A21']
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Charcoal canvas with a warm gold accent.',
    swatch: ['#171A21', '#E8B75B', '#F1F2F5']
  }
];

export const DEFAULT_THEME: ThemeId = 'light';
export const THEME_STORAGE_KEY = 'sms.theme';
