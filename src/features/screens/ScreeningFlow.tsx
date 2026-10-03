// Safety questions one at a time (ONB-010, ONB-011), and the outcome screen (ONB-012 to ONB-023).
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { DATE_PROMPT, OUTCOME, SCREEN_FLOW, SCREENING_INTRO, SKIPPED_NOTE, cautionCardText, questionText } from '../../content/en/screening';
import { COMMON } from '../../content/en/strings';
import {
  MATERNITY_URGENT,
  URGENT,
  isVisible,
  questionsFor,
  questionsForChange,
  screenSizeFor,
  type Answers,
  type ChangeTopic,
  type QuestionKey,
  type ScreeningFacts,
  type ScreeningKind,
} from '../../domain/safety';
import type { Anatomy, SafetyMode } from '../../domain/types';
import { Banner, Button, Card, Field, H1, H2, P, Label } from '../../ui/kit';

export interface ScreeningAnswers {
  answers: Answers;
  surgeryDate: string | null;
  /** Dates given after a "yes" (planned surgery, due date, birth date). */
  dates: Partial<Record<QuestionKey, string>>;
  startedAt: string;
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

export function ScreeningFlow({
  kind,
  anatomy,
  onDone,
  busy,
  topics,
  facts,
}: {
  kind: ScreeningKind;
  anatomy: Anatomy;
  /** "Something changed?" only: what changed, to ask only the related questions (UX audit M10). */
  topics?: readonly ChangeTopic[];
  onDone: (a: ScreeningAnswers) => void;
  busy?: boolean;
  /** Earlier answers that decide follow-up questions (pregnancy, recent birth, prostate treatment). */
  facts?: ScreeningFacts;
}) {
  const [startedAt] = useState(() => new Date().toISOString());
  const all = useMemo(
    () => (kind === 'something_changed' && topics ? questionsForChange(topics, anatomy) : questionsFor(screenSizeFor(kind), anatomy, facts)),
    [kind, anatomy, topics, facts]
  );
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [dates, setDates] = useState<Partial<Record<QuestionKey, string>>>({});
  const [askDate, setAskDate] = useState<QuestionKey | null>(null);
  const shown = (k: QuestionKey, a: Answers) => isVisible(k, a, facts);

  const visible = all.filter((k) => shown(k, answers));
  const current: QuestionKey | undefined = visible[index];

  const answer = (a: 'yes' | 'no' | 'skipped') => {
    if (!current) return;
    const next = { ...answers, [current]: a };
    // A follow-up answered before its parent changed to "no" no longer applies.
    for (const k of Object.keys(next) as QuestionKey[]) if (k !== current && !shown(k, next)) delete next[k];
    setAnswers(next);
    if (a === 'yes' && DATE_PROMPT[current]) {
      setAskDate(current);
      return;
    }
    advance(next);
  };

  const advance = (next: Answers) => {
    const vis = all.filter((k) => shown(k, next));
    if (index + 1 >= vis.length) {
      const valid: Partial<Record<QuestionKey, string>> = {};
      for (const [k, v] of Object.entries(dates)) if (v && isDate(v) && next[k as QuestionKey] === 'yes') valid[k as QuestionKey] = v.trim();
      onDone({ answers: next, surgeryDate: valid['Q-S3'] ?? null, dates: valid, startedAt });
    } else setIndex(index + 1);
  };

  if (askDate) {
    return (
      <View style={{ gap: 16 }}>
        <H2>{questionText(askDate, anatomy)}</H2>
        <P muted>{DATE_PROMPT[askDate]}</P>
        <Field
          label={SCREEN_FLOW.dateLabel}
          value={dates[askDate] ?? ''}
          onChangeText={(v) => setDates({ ...dates, [askDate]: v })}
          placeholder={SCREEN_FLOW.datePlaceholder}
          keyboardType="numbers-and-punctuation"
        />
        <Button
          label={COMMON.continue}
          busy={busy}
          onPress={() => {
            setAskDate(null);
            advance(answers);
          }}
        />
      </View>
    );
  }

  if (!current) return null;
  return (
    <View style={{ gap: 16 }}>
      {index === 0 ? <P muted>{SCREENING_INTRO}</P> : null}
      <Label>
        {SCREEN_FLOW.questionOf(index + 1, visible.length)}
      </Label>
      <H2>{questionText(current, anatomy)}</H2>
      <View style={{ gap: 8 }}>
        <Button label={COMMON.yes} kind="secondary" onPress={() => answer('yes')} busy={busy} />
        <Button label={COMMON.no} kind="secondary" onPress={() => answer('no')} busy={busy} />
        <Button label={COMMON.skipQuestion} kind="quiet" onPress={() => answer('skipped')} disabled={busy} />
      </View>
      {index > 0 ? <Button label={COMMON.back} kind="quiet" onPress={() => setIndex(index - 1)} /> : null}
    </View>
  );
}

export function outcomeCopy(mode: SafetyMode, reasons: readonly QuestionKey[]): { title: string; body: string; reason?: string } {
  if (mode === 'blocked_urgent') {
    // Only maternity reasons: contact the maternity unit (SX-A.15). Any other urgent reason keeps the general text.
    const urgent = reasons.filter((r) => URGENT.includes(r));
    return urgent.length && urgent.every((r) => MATERNITY_URGENT.includes(r)) ? OUTCOME.maternity_urgent : OUTCOME.blocked_urgent;
  }
  if (mode === 'blocked_until_cleared') {
    if (reasons.includes('Q-S1')) return OUTCOME.catheter;
    if (reasons.includes('Q-S2')) return OUTCOME.surgery;
    return OUTCOME.maternity_wait;
  }
  if (mode === 'relax_only') return OUTCOME.relax_only;
  if (mode === 'caution') return OUTCOME.caution;
  return OUTCOME.normal;
}

export function ScreeningOutcome({
  mode,
  reasons,
  cautions,
  skipped = [],
  anatomy = 'other_unspecified',
}: {
  mode: SafetyMode;
  reasons: readonly QuestionKey[];
  cautions: readonly QuestionKey[];
  skipped?: readonly QuestionKey[];
  anatomy?: Anatomy;
}) {
  const o = outcomeCopy(mode, reasons);
  return (
    <View style={{ gap: 16 }}>
      <H1>{o.title}</H1>
      <P>{o.body}</P>
      {o.reason ? <P muted>{o.reason}</P> : null}
      {mode === 'normal' || mode === 'caution'
        ? cautions.map((k) => (
            <Card key={k} tone="warn">
              <P>{cautionCardText(k, anatomy)}</P>
            </Card>
          ))
        : null}
      {skipped.length && (mode === 'normal' || mode === 'caution') ? (
        <Card tone="warn">
          <P>{SKIPPED_NOTE}</P>
          {skipped.map((k) => (
            <P key={k} small>
              {`• ${questionText(k, anatomy)}`}
            </P>
          ))}
        </Card>
      ) : null}
      {mode === 'blocked_urgent' ? <Banner tone="critical" text={SCREEN_FLOW.emergency} /> : null}
    </View>
  );
}
