import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/theme';

type PinInputProps = { value: string; onChangeText: (value: string) => void; length?: number; autoFocus?: boolean; showKeyboard?: boolean };

export function PinInput({ value, onChangeText, length = 4, autoFocus, showKeyboard = true }: PinInputProps) {
  const inputRef = useRef<TextInput>(null);
  const update = (next: string) => onChangeText(next.replace(/\D/g, '').slice(0, length));

  return (
    <Pressable accessibilityLabel="PIN de cuatro dígitos" disabled={!showKeyboard} onPress={() => inputRef.current?.focus()}>
      <View style={styles.row}>
        {Array.from({ length }).map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index < value.length && styles.dotFilled]}
          />
        ))}
      </View>
      <TextInput ref={inputRef} autoFocus={autoFocus} editable={showKeyboard} caretHidden keyboardType="number-pad" value={value} onChangeText={update} maxLength={length} style={styles.hidden} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border },
  dotFilled: { borderColor: colors.primary, backgroundColor: colors.primary },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
