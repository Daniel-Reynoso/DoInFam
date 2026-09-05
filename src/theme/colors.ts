export const colors = {
  background: '#F8F4EE',
  surface: '#FFFFFF',
  primary: '#0AADA0',
  primaryPressed: '#078C83',
  primarySoft: '#E4F7F5',
  success: '#30C770',
  successSoft: '#E8F8EF',
  warning: '#FFB038',
  warningSoft: '#FFF2DC',
  danger: '#F25555',
  dangerSoft: '#FDEAEA',
  text: '#1E1C1A',
  textSecondary: '#7D7670',
  border: '#DED8D0',
  divider: '#ECE7E1',
  disabled: '#C8C1BA',
  overlay: 'rgba(30, 28, 26, 0.46)',
  transparent: 'transparent',
} as const;

export type ColorName = keyof typeof colors;
