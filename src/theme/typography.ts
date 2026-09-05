import type { TextStyle } from 'react-native';

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fontFamilies.bold, fontSize: 28, lineHeight: 34 } satisfies TextStyle,
  title: { fontFamily: fontFamilies.bold, fontSize: 22, lineHeight: 28 } satisfies TextStyle,
  subtitle: { fontFamily: fontFamilies.semibold, fontSize: 17, lineHeight: 22 } satisfies TextStyle,
  body: { fontFamily: fontFamilies.regular, fontSize: 14, lineHeight: 20 } satisfies TextStyle,
  bodyMedium: { fontFamily: fontFamilies.medium, fontSize: 14, lineHeight: 20 } satisfies TextStyle,
  label: { fontFamily: fontFamilies.semibold, fontSize: 13, lineHeight: 18 } satisfies TextStyle,
  caption: { fontFamily: fontFamilies.regular, fontSize: 12, lineHeight: 16 } satisfies TextStyle,
  metadata: { fontFamily: fontFamilies.medium, fontSize: 11, lineHeight: 15 } satisfies TextStyle,
} as const;
