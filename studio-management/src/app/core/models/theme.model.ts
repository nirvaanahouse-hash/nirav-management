export type ThemeId =
  | 'modern-white'
  | 'premium-dark'
  | 'premium-blue'
  | 'glassmorphism'
  | 'modern-gradient';

export interface ThemeOption {
  id: ThemeId;
  label: string;
  description: string;
  swatch: [string, string, string]; // three representative colors for the picker
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'modern-white',
    label: 'Modern White',
    description: 'Clean neutral surfaces with a deep teal accent.',
    swatch: ['#F6F7F9', '#0F766E', '#171A21']
  },
  {
    id: 'premium-dark',
    label: 'Premium Dark',
    description: 'Charcoal canvas with a warm gold accent.',
    swatch: ['#171A21', '#E8B75B', '#F1F2F5']
  },
  {
    id: 'premium-blue',
    label: 'Premium Blue',
    description: 'Royal navy chrome with a coral accent.',
    swatch: ['#0F1E4D', '#FF6A4D', '#EEF2FA']
  },
  {
    id: 'glassmorphism',
    label: 'Glassmorphism',
    description: 'Frosted translucent panels over a violet mesh backdrop.',
    swatch: ['#1B1533', '#B69CFF', '#F6F5FF']
  },
  {
    id: 'modern-gradient',
    label: 'Modern Gradient',
    description: 'Bold brand gradient chrome on a bright canvas.',
    swatch: ['#7B5CFF', '#FF6FB0', '#FF9A5A']
  }
];

export const DEFAULT_THEME: ThemeId = 'modern-white';
export const THEME_STORAGE_KEY = 'sms.theme';
