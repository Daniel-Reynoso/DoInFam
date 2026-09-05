import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '@/hooks';
import { playSound } from '@/services/sound';
import { colors, radius, spacing, typography } from '@/theme';

const confetti = Array.from({ length: 16 }, (_, index) => ({
  id: index,
  left: 32 + ((index * 37) % 232),
  drift: -42 + ((index * 23) % 84),
  delay: (index % 6) * 35,
  color: [colors.primary, colors.success, colors.warning, colors.danger][index % 4],
}));

export function PointsFeedback({
  visible,
  points,
  taskName,
  celebrationMessage,
  onClose,
}: {
  visible: boolean;
  points: number;
  taskName: string;
  celebrationMessage?: string;
  onClose: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const celebration = useRef(new Animated.Value(0)).current;
  const playedCelebrationSound = useRef(false);
  const isCelebration = Boolean(celebrationMessage);

  useEffect(() => {
    if (!visible) {
      progress.setValue(0);
      celebration.setValue(0);
      playedCelebrationSound.current = false;
      return;
    }

    if (isCelebration && !playedCelebrationSound.current) {
      playedCelebrationSound.current = true;
      void playSound('goalReached');
    }

    if (reducedMotion) {
      progress.setValue(1);
      celebration.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(celebration, {
        toValue: 1,
        duration: isCelebration ? 620 : 1,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [celebration, isCelebration, progress, reducedMotion, visible]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {isCelebration && !reducedMotion ? confetti.map((piece) => {
          const translateY = celebration.interpolate({ inputRange: [0, 1], outputRange: [-36 - piece.delay / 8, 96] });
          const translateX = celebration.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] });
          const rotate = celebration.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.drift * 3}deg`] });
          const opacity = celebration.interpolate({ inputRange: [0, 0.14, 0.84, 1], outputRange: [0, 1, 1, 0] });
          return <Animated.View key={piece.id} pointerEvents="none" style={[styles.confetti, { left: piece.left, backgroundColor: piece.color, opacity, transform: [{ translateX }, { translateY }, { rotate }] }]} />;
        }) : null}
        <Animated.View style={[styles.card, { opacity: progress, transform: [{ translateY }, { scale }] }]}>
          <View style={[styles.icon, isCelebration && styles.celebrationIcon]}><MaterialCommunityIcons name={isCelebration ? 'star' : 'check'} size={28} color={colors.surface} /></View>
          <Text style={styles.points}>+{points} pts</Text>
          <Text style={styles.title}>{isCelebration ? '¡Meta cumplida!' : '¡Tarea completada!'}</Text>
          <Text style={styles.message}>{taskName}</Text>
          {celebrationMessage ? <Text style={styles.celebrationMessage}>{celebrationMessage}</Text> : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay, padding: spacing.xl },
  card: { width: '100%', maxWidth: 320, alignItems: 'center', gap: spacing.xs, padding: spacing.xxl, borderRadius: radius.xl, backgroundColor: colors.surface },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.success, marginBottom: spacing.xs },
  celebrationIcon: { backgroundColor: colors.warning },
  points: { ...typography.display, color: colors.primary },
  title: { ...typography.subtitle, color: colors.text },
  message: { ...typography.body, color: colors.textSecondary },
  celebrationMessage: { ...typography.bodyMedium, color: colors.text, textAlign: 'center', marginTop: spacing.xs },
  confetti: { position: 'absolute', top: '42%', width: 8, height: 14, borderRadius: 3 },
});
