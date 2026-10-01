export type AppTheme = 'remnus' | 'dracula' | 'tokyo-night' | 'nord' | 'catppuccin';

export const APP_THEMES: {
  value: AppTheme;
  label: string;
  dark: boolean;
  swatches: [string, string, string];
}[] = [
  { value: 'remnus',      label: 'Remnus',      dark: true,  swatches: ['#111316', '#191b1f', '#f0b43c'] },
  { value: 'dracula',     label: 'Dracula',     dark: true,  swatches: ['#191a21', '#21222c', '#f1fa8c'] },
  { value: 'tokyo-night', label: 'Tokyo Night', dark: true,  swatches: ['#121319', '#1a1b26', '#e0af68'] },
  { value: 'nord',        label: 'Nord',        dark: true,  swatches: ['#20242c', '#2e3440', '#ebcb8b'] },
  { value: 'catppuccin',  label: 'Catppuccin',  dark: false, swatches: ['#eceef1', '#ffffff', '#f5b300'] },
];
