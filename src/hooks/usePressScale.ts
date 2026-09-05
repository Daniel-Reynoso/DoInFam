import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export function usePressScale(enabled = true, pressedScale = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback((toValue: number, duration: number) => {
    if (!enabled) return;
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enabled, scale]);

  const pressIn = useCallback(() => animateTo(pressedScale, 110), [animateTo, pressedScale]);
  const pressOut = useCallback(() => animateTo(1, 140), [animateTo]);

  return { scale, pressIn, pressOut };
}
