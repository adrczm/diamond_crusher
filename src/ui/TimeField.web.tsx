// Reminder time on the web (UX audit M2): Safari's own time field, <input type="time">, styled like a Polaris TextField.
import { useId, useState } from 'react';
import { View } from 'react-native';
import { HHMM } from '../domain/clock';
import { Text } from './text';
import { FONTS, radius, space, type, useColors, useIsDark } from './theme';

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const c = useColors();
  const dark = useIsDark();
  const id = useId();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space(0.5) }}>
      <label htmlFor={id}>
        <Text style={[type('body-md'), { color: c.text }]}>{label}</Text>
      </label>
      <input
        id={id}
        type="time"
        step={300}
        value={value}
        onChange={(e) => {
          // Safari gives "" while a part is being typed: keep the last whole time.
          const v = e.currentTarget.value.slice(0, 5);
          if (HHMM.test(v)) onChange(v);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontFamily: FONTS.regular,
          fontSize: 16,
          minHeight: 48,
          maxWidth: 200,
          boxSizing: 'border-box',
          borderRadius: radius.md,
          border: `${focused ? 2 : 1}px solid ${focused ? c.focus : c.inputBorder}`,
          backgroundColor: c.inputBg,
          color: c.text,
          padding: `0 ${space(1.5) - (focused ? 1 : 0)}px`,
          outline: 'none',
          colorScheme: dark ? 'dark' : 'light',
        }}
      />
    </View>
  );
}
