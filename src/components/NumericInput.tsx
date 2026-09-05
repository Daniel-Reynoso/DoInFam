import type { ComponentProps } from 'react';
import { TextInput } from './TextInput';

type NumericInputProps = Omit<ComponentProps<typeof TextInput>, 'keyboardType'>;

export function NumericInput(props: NumericInputProps) {
  return <TextInput keyboardType="number-pad" inputMode="numeric" {...props} />;
}
