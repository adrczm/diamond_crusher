// Text in Inter, the Polaris typeface. A fontWeight in the style picks the matching Inter file; on the web, the chosen
// text size scales every size.
import React from 'react';
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';
import { textScale } from './textSize';
import { fontFor } from './theme';

export function Text({ style, ...rest }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  // An explicit weight wins; otherwise keep a family already set (from a type variant) or use Inter Regular.
  const weighted = flat.fontWeight != null && flat.fontWeight !== 'normal';
  const font = weighted || !flat.fontFamily ? fontFor(flat.fontWeight) : {};
  // The web's in-app text size (DS-A9). Phones scale with the system font size instead.
  const k = Math.min(textScale(), rest.maxFontSizeMultiplier ?? Infinity);
  const sized = k !== 1 && flat.fontSize ? { fontSize: flat.fontSize * k, lineHeight: flat.lineHeight ? flat.lineHeight * k : undefined } : null;
  return <RNText {...rest} style={[style, font, sized]} />;
}
