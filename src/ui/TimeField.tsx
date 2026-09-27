// Reminder time on phones (UX audit M2): hour and minute steppers instead of typed HH:MM. The platform time picker
// (@react-native-community/datetimepicker) is not a dependency, so the app draws its own. The web build uses
// TimeField.web.tsx, a native <input type="time">.
import { Pressable, View } from 'react-native';
import { PLAN } from '../content/en/strings';
import { shiftTime, stepMinutes } from '../domain/clock';
import { Text } from './text';
import { radius, space, type, useColors } from './theme';

const TOUCH = 48;
const MINUTE_STEP = 5;

function StepButton({ sign, label, onPress }: { sign: string; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(st) => ({
        width: TOUCH,
        height: TOUCH,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.inputBorder,
        backgroundColor: c.card,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: st.pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 22, lineHeight: 26, color: c.text, fontWeight: '600' }}>{sign}</Text>
    </Pressable>
  );
}

function Part({ name, value, less, more }: { name: string; value: string; less: [string, () => void]; more: [string, () => void] }) {
  const c = useColors();
  return (
    <View style={{ gap: space(0.5), alignItems: 'center' }}>
      <Text style={[type('body-sm'), { color: c.muted }]}>{name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
        <StepButton sign="−" label={less[0]} onPress={less[1]} />
        <Text accessibilityLabel={`${name} ${value}`} style={[type('heading-lg'), { color: c.text, minWidth: 36, textAlign: 'center' }]}>
          {value}
        </Text>
        <StepButton sign="+" label={more[0]} onPress={more[1]} />
      </View>
    </View>
  );
}

export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const c = useColors();
  const [h, m] = value.split(':');
  return (
    <View style={{ gap: space(0.5) }}>
      <Text style={[type('body-md'), { color: c.text }]}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(3) }}>
        <Part
          name={PLAN.hour}
          value={h ?? '00'}
          less={[PLAN.hourEarlier, () => onChange(shiftTime(value, -1, 0))]}
          more={[PLAN.hourLater, () => onChange(shiftTime(value, 1, 0))]}
        />
        <Part
          name={PLAN.minutes}
          value={m ?? '00'}
          less={[PLAN.minutesEarlier, () => onChange(stepMinutes(value, MINUTE_STEP, -1))]}
          more={[PLAN.minutesLater, () => onChange(stepMinutes(value, MINUTE_STEP, 1))]}
        />
      </View>
    </View>
  );
}
