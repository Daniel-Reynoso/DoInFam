import { Image, StyleSheet, Text, View } from 'react-native';
import { avatarImageSources, colors, fontFamilies, isImageAvatarKey, sizing, type AvatarKey } from '@/theme';

const tones = {
  coral: '#FCE3E6',
  teal: '#E3F2E9',
  blue: '#DCEBFF',
  green: '#E4F2DD',
  violet: '#F0E4FF',
  orange: '#FF9F1C',
} as const;

type AvatarProps = {
  initial: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'selector';
  tone?: AvatarKey;
};

export function Avatar({ initial, size = 'md', tone = 'teal' }: AvatarProps) {
  const dimension =
    size === 'sm'
      ? sizing.avatarSm
      : size === 'lg'
        ? sizing.avatarLg
        : size === 'xl'
          ? sizing.avatarXl
          : size === 'selector'
            ? sizing.avatarSelector
            : sizing.avatarMd;
  const imageSource = isImageAvatarKey(tone) ? avatarImageSources[tone] : null;
  const backgroundColor = imageSource ? colors.primarySoft : tones[tone as keyof typeof tones] ?? tones.teal;
  return (
    <View style={[styles.avatar, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor }]}>
      {imageSource ? (
        <Image source={imageSource} resizeMode="contain" style={styles.image} />
      ) : (
        <Text style={[styles.initial, { fontSize: dimension * 0.32 }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  initial: { color: colors.text, fontFamily: fontFamilies.semibold },
});
