import type { ImageSourcePropType } from 'react-native';
import { colors } from './colors';

export const colorAvatarKeys = ['teal', 'blue', 'green', 'orange', 'coral', 'violet'] as const;
export const imageAvatarKeys = ['explorer', 'console', 'penguin', 'teal_pet', 'orange_cat', 'gray_cat', 'golden_dog'] as const;
export const avatarKeys = [...colorAvatarKeys, ...imageAvatarKeys] as const;

export type ColorAvatarKey = typeof colorAvatarKeys[number];
export type ImageAvatarKey = typeof imageAvatarKeys[number];
export type AvatarKey = typeof avatarKeys[number];

export const avatarImageSources: Record<ImageAvatarKey, ImageSourcePropType> = {
  explorer: require('../../assets/avatars/explorer.png'),
  console: require('../../assets/avatars/console.png'),
  penguin: require('../../assets/avatars/penguin.png'),
  teal_pet: require('../../assets/avatars/teal_pet.png'),
  orange_cat: require('../../assets/avatars/orange_cat.png'),
  gray_cat: require('../../assets/avatars/gray_cat.png'),
  golden_dog: require('../../assets/avatars/golden_dog.png'),
};

export const avatarAccentColors: Record<AvatarKey, string> = {
  teal: colors.primary,
  blue: '#3B7FFF',
  green: colors.success,
  orange: '#ED9435',
  coral: '#E66D70',
  violet: '#9875D1',
  explorer: '#ED9435',
  console: colors.primary,
  penguin: '#293047',
  teal_pet: colors.primary,
  orange_cat: '#E89A35',
  gray_cat: '#7D7670',
  golden_dog: '#D9903D',
};

export function isAvatarKey(value: string | null | undefined): value is AvatarKey {
  return avatarKeys.includes(value as AvatarKey);
}

export function isImageAvatarKey(value: string | null | undefined): value is ImageAvatarKey {
  return imageAvatarKeys.includes(value as ImageAvatarKey);
}

export function normalizeAvatarKey(value: string | null | undefined): AvatarKey {
  return isAvatarKey(value) ? value : 'teal';
}
