// Text in Inter, the Polaris typeface. A fontWeight in the style picks the matching Inter file.
import React from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { fontFor } from './theme';

export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  // An explicit weight wins; otherwise keep a family already set (from a type variant) or use Inter Regular.
  const weighted = flat.fontWeight != null && flat.fontWeight !== 'normal';
  const font = weighted || !flat.fontFamily ? fontFor(flat.fontWeight) : {};
  return <RNText {...rest} style={[style, font]} />;
}
