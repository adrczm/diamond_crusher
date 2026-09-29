// Safety questions one at a time (ONB-010, ONB-011), and the outcome screen (ONB-012 to ONB-023).
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { CAUTION_CARD, OUTCOME, SCREEN_FLOW, SCREENING_INTRO, SKIPPED_NOTE, SURGERY_DATE_PROMPT, questionText } from '../../content/en/screening';
import { COMMON } from '../../content/en/strings';
import { isVisible, questionsFor, questionsForChange, screenSizeFor, type Answers, type ChangeTopic, type QuestionKey, type ScreeningKind } from '../../domain/safety';
import type { Anatomy, SafetyMode } from '../../domain/types';
import { Banner, Button, Card, Field, H1, H2, P, Label } from '../../ui/kit';

export interface ScreeningAnswers {
  answers: Answers;
  surgeryDate: string | null;
  startedAt: string;
}

export function ScreeningFlow({
  kind,
  anatomy,
  onDone,
  busy,
  topics,
}: {
  kind: ScreeningKind;
  anatomy: Anatomy;
  /** "Something changed?" only: what changed, to ask only the related questions (UX audit M10). */
  topics?: readonly ChangeTopic[];
  onDone: (a: ScreeningAnswers) => void;
  busy?: boolean;
}) {
  const [startedAt] = useState(() => new Date().toISOString());
  const all = useMemo(
    () => (kind === 'something_changed' && topics ? questionsForChange(topics, anatomy) : questionsFor(screenSizeFor(kind), anatomy)),
    [kind, anatomy, topics]
  );
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [surgeryDate, setSurgeryDate] = useState('');
  const [askDate, setAskDate] = useState(false);

  const visible = all.filter((k) => isVisible(k, answers));
  const current: QuestionKey | undefined = visible[index];

  const answer = (a: 'yes' | 'no' | 'skipped') => {
    if (!current) return;
    const next = { ...answers, [current]: a };
    if (current === 'Q-S2' && a !== 'yes') delete next['Q-S2b'];
    setAnswers(next);
    if (current === 'Q-S3' && a === 'yes') {
      setAskDate(true);
      return;
    }
    advance(next);
  };

  const advance = (next: Answers) => {
    const vis = all.filter((k) => isVisible(k, next));
    if (index + 1 >= vis.length) {
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(surgeryDate.trim()) ? surgeryDate.trim() : null;
      onDone({ answers: next, surgeryDate: valid, startedAt });
    } else setIndex(index + 1);
  };

  if (askDate) {
    return (
      <View style={{ gap: 16 }}>
        <H2>{questionText('Q-S3', anatomy)}</H2>
        <P muted>{SURGERY_DATE_PROMPT}</P>
        <Field label={SCREEN_FLOW.dateLabel} value={surgeryDate} onChangeText={setSurgeryDate} placeholder={SCREEN_FLOW.datePlaceholder} keyboardType="numbers-and-punctuation" />
        <Button
          label={COMMON.continue}
          busy={busy}
          onPress={() => {
            setAskDate(false);
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
  if (mode === 'blocked_urgent') return OUTCOME.blocked_urgent;
  if (mode === 'blocked_until_cleared') return reasons.includes('Q-S2') ? OUTCOME.catheter : OUTCOME.surgery;
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
              <P>{CAUTION_CARD[k]}</P>
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
