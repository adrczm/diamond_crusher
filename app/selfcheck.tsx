// Monthly self-check (06a SC-001 to SC-033): six short steps, your own record, no verdict words.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../src/ui/text';
import { APP_QUESTION_LABEL, SELF_CHECK } from '../src/content/en/items';
import { COMMON, MAINTENANCE, MESSAGES } from '../src/content/en/strings';
import { PAIN_CHOICE, RELAX_ONLY_HOME } from '../src/content/en/screening';
import { listSelfChecks } from '../src/data/repositories/checks';
import { getProfile } from '../src/data/repositories/profile';
import { getProgramme } from '../src/data/repositories/programme';
import { getSafetyState } from '../src/data/repositories/safety';
import { getSettings } from '../src/data/repositories/settings';
import { strengthAllowed } from '../src/domain/safety';
import { LONGEST_HOLD_CAP_S, QUICK_CAP, REPEATED_CAP, repeatedHoldLength, techniqueFlag, type Tri } from '../src/domain/selfcheck';
import type { Pain3 } from '../src/domain/types';
import { useApp, useLoad } from '../src/features/app';
import { acceptTopUp, markPart, saveSelfCheck, type BundlePart, type SelfCheckOutcome } from '../src/features/checkService';
import { reconcileReminders } from '../src/features/reminderService';
import { feedback } from '../src/platform/feedback';
import { Banner, Button, Card, Choice, H1, H2, Label, Loading, P, Screen, Segments } from '../src/ui/kit';
import { useColors } from '../src/ui/theme';

const mono = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

type Step = 'conditions' | 'sign' | 'longest' | 'repeated' | 'quick' | 'technique' | 'pain' | 'result';

function TapArea({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 220, borderRadius: 24, backgroundColor: pressed ? c.primary : c.soft, alignItems: 'center', justifyContent: 'center' })}
    >
      <Text style={{ fontSize: 32, fontWeight: '700', color: c.text }}>{label}</Text>
    </Pressable>
  );
}

/** SC-011: counts up in whole seconds, with a tick each second, until Stop or the cap. */
function Stopwatch({ cap, onDone, cueOpts }: { cap: number; onDone: (s: number) => void; cueOpts: Parameters<typeof feedback.cue>[1] }) {
  const c = useColors();
  const [s, setS] = useState(0);
  const start = useRef(mono());
  const done = useRef(false);
  useEffect(() => {
    void feedback.cue('squeeze', cueOpts);
    let last = 0;
    const id = setInterval(() => {
      const secs = Math.min(cap, Math.floor((mono() - start.current) / 1000));
      if (secs !== last) {
        last = secs;
        setS(secs);
        if (secs < cap) void feedback.cue('tick', { ...cueOpts, audio: cueOpts.audio === 'voice' ? 'off' : cueOpts.audio });
      }
      if (secs >= cap && !done.current) {
        done.current = true;
        void feedback.cue('release', cueOpts);
        onDone(cap);
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 72, fontWeight: '700', color: c.primary, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {s}
      </Text>
      <TapArea
        label={SELF_CHECK.stop}
        onPress={() => {
          if (done.current) return;
          done.current = true;
          void feedback.cue('release', cueOpts);
          onDone(Math.min(cap, Math.floor((mono() - start.current) / 1000)));
        }}
      />
    </View>
  );
}

/** SC-012 / SC-013: paced squeeze and rest; counts squeezes completed before the tap. */
function Pacer({
  onS,
  offS,
  max,
  tapLabel,
  onDone,
  cueOpts,
}: {
  onS: number;
  offS: number;
  max: number;
  tapLabel: string;
  onDone: (count: number) => void;
  cueOpts: Parameters<typeof feedback.cue>[1];
}) {
  const c = useColors();
  const start = useRef(mono());
  const [view, setView] = useState({ rep: 1, on: true, left: onS });
  const done = useRef(false);
  const period = (onS + offS) * 1000;
  // Squeezes fully held before time t; a squeeze still running when the tap comes doesn't count.
  const completedAt = (t: number) => {
    const rep = Math.floor(t / period) + 1;
    const on = t - (rep - 1) * period < onS * 1000;
    return Math.min(max, on ? rep - 1 : rep);
  };
  useEffect(() => {
    let lastKey = '';
    const id = setInterval(() => {
      const t = mono() - start.current;
      const rep = Math.floor(t / period) + 1;
      const within = t - (rep - 1) * period;
      const on = within < onS * 1000;
      const left = Math.ceil(((on ? onS * 1000 : period) - within) / 1000);
      if (rep > max && !done.current) {
        done.current = true;
        onDone(max);
        return;
      }
      const key = `${rep}:${on}`;
      if (key !== lastKey) {
        lastKey = key;
        void feedback.cue(on ? 'squeeze' : 'release', cueOpts);
      }
      setView({ rep, on, left });
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: view.on ? c.squeeze : c.muted, textAlign: 'center' }} accessibilityLiveRegion="polite">
        {view.on ? 'Squeeze' : 'Let go'}
      </Text>
      <Text style={{ fontSize: 56, fontWeight: '700', color: c.primary, textAlign: 'center' }}>{view.left}</Text>
      <P center muted>{`${Math.min(view.rep, max)} of ${max}`}</P>
      <TapArea
        label={tapLabel}
        onPress={() => {
          if (done.current) return;
          done.current = true;
          onDone(completedAt(mono() - start.current));
        }}
      />
    </View>
  );
}

export default function SelfCheck() {
  const params = useLocalSearchParams<{ kind?: string; checkId?: string; parts?: string; position?: string }>();
  const kind = params.kind === 'baseline' ? 'baseline' : params.checkId ? 'monthly' : 'ad_hoc';
  const position: 'lying' | 'standing' = params.position === 'standing' ? 'standing' : 'lying';
  const { db, bump } = useApp();
  const { data } = useLoad(async (d) => ({
    profile: await getProfile(d),
    prog: await getProgramme(d),
    safety: await getSafetyState(d),
    settings: await getSettings(d),
    checks: await listSelfChecks(d),
  }));
  const [step, setStep] = useState<Step>('conditions');
  const [cond, setCond] = useState<{ bladder?: boolean; notAfter?: boolean; same?: boolean }>({});
  const [signMethod, setSignMethod] = useState<'mirror' | 'touch'>('mirror');
  const [sign, setSign] = useState<'yes' | 'unsure' | 'no' | undefined>();
  const [bulge, setBulge] = useState<Tri | undefined>();
  const [longest, setLongest] = useState<number | null>(null);
  const [retry, setRetry] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [repeated, setRepeated] = useState<number | null>(null);
  const [quick, setQuick] = useState<number | null>(null);
  const [tech, setTech] = useState<Record<string, Tri | undefined>>({});
  const [pain, setPain] = useState<Pain3 | undefined>();
  const [startedAt] = useState(() => new Date());
  const [out, setOut] = useState<SelfCheckOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [topUp, setTopUp] = useState<'offered' | 'accepted' | 'declined'>('offered');

  if (!data) return <Loading />;
  const anatomy = data.profile?.anatomy ?? 'other_unspecified';
  const cueOpts = { audio: data.settings.audio_mode, vibration: data.settings.vibration } as const;
  const title = kind === 'baseline' ? 'Starting self-check' : SELF_CHECK.title;
  if (!strengthAllowed(data.safety.mode)) {
    return (
      <Screen title={title}>
        <Banner text="The self-check isn't available while exercises are paused or set to relaxation only." />
      </Screen>
    );
  }

  const bestLongest = Math.max(longest ?? 0, retry ?? 0);
  const H = repeatedHoldLength(bestLongest);
  const yn = [
    { value: true, label: COMMON.yes },
    { value: false, label: COMMON.no },
  ];
  const triOpts = SELF_CHECK.techniqueOptions.map((o) => ({ value: o.value as Tri, label: o.label }));

  const save = async () => {
    setBusy(true);
    try {
      const prev = [...data.checks].reverse().find((c) => c.position === position);
      const shifted = prev ? Math.abs(new Date(prev.performed_at).getHours() - startedAt.getHours()) > 3 : false;
      const flag = techniqueFlag({
        signResult: sign ?? null,
        bulge: bulge ?? null,
        breathingOk: tech.breathing_ok ?? null,
        glutesBellyRelaxed: tech.glutes_belly_relaxed ?? null,
        fullRelease: tech.full_release ?? null,
      });
      const r = await saveSelfCheck(db, {
        kind,
        position,
        anatomy_at_check: anatomy,
        bladder_empty: cond.bladder ?? false,
        not_after_session: cond.notAfter ?? false,
        same_position: cond.same ?? false,
        time_of_day_shifted: shifted,
        sign_method: signMethod,
        sign_result: sign ?? 'not_done',
        bulge: bulge ?? null,
        longest_hold_s: longest,
        longest_hold_retry_s: retry,
        repeated_hold_len_s: H,
        repeated_holds: repeated,
        quick_flicks: quick,
        breathing_ok: tech.breathing_ok ?? null,
        glutes_belly_relaxed: tech.glutes_belly_relaxed ?? null,
        full_release: tech.full_release ?? null,
        pain: pain ?? null,
        technique_flag: flag,
        technique_unsure_at_baseline: kind === 'baseline' && sign === 'unsure',
        aborted_at_step: null,
        status: 'complete',
        scheduled_check_id: params.checkId ?? null,
      });
      const needStanding = position === 'lying' && data.prog.position_tier >= 2 && !r.relaxOnly;
      if (params.checkId && params.parts && !needStanding) await markPart(db, params.checkId, 'self_check', params.parts.split(',') as BundlePart[]);
      setOut(r);
      reconcileReminders(db);
      bump();
      setStep('result');
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;
  switch (step) {
    case 'conditions': {
      const q = (label: string, key: 'bladder' | 'notAfter' | 'same') => (
        <Card>
          <P>{label}</P>
          <Segments options={yn} value={cond[key]} onChange={(v) => setCond({ ...cond, [key]: v })} />
        </Card>
      );
      const all = cond.bladder !== undefined && cond.notAfter !== undefined && cond.same !== undefined;
      body = (
        <>
          <H1>{title}</H1>
          <P>{SELF_CHECK.intro}</P>
          <P small muted>
            {APP_QUESTION_LABEL}
          </P>
          <H2>{SELF_CHECK.conditionsTitle}</H2>
          {q(SELF_CHECK.conditions.bladder, 'bladder')}
          {q(SELF_CHECK.conditions.notAfterSession, 'notAfter')}
          {q(position === 'standing' ? SELF_CHECK.conditions.samePositionStanding : SELF_CHECK.conditions.samePosition, 'same')}
          {all && (!cond.bladder || !cond.notAfter || !cond.same) ? <Banner tone="soft" text={SELF_CHECK.proceedAnyway} /> : null}
        </>
      );
      footer = <Button label={COMMON.continue} disabled={!all} onPress={() => setStep('sign')} />;
      break;
    }
    case 'sign':
      body = (
        <>
          <Label>{SELF_CHECK.signTitle}</Label>
          <P>{SELF_CHECK.sign[anatomy]}</P>
          <P muted>{SELF_CHECK.signMethod}</P>
          <Segments options={SELF_CHECK.signMethods.map((o) => ({ value: o.value as 'mirror' | 'touch', label: o.label }))} value={signMethod} onChange={setSignMethod} />
          <Choice options={SELF_CHECK.signOptions.map((o) => ({ value: o.value as 'yes' | 'unsure' | 'no', label: o.label }))} value={sign} onChange={setSign} />
          <P>{SELF_CHECK.bulge}</P>
          <Segments options={SELF_CHECK.bulgeOptions.map((o) => ({ value: o.value as Tri, label: o.label }))} value={bulge} onChange={setBulge} />
        </>
      );
      footer = <Button label={COMMON.continue} disabled={!sign || !bulge} onPress={() => setStep('longest')} />;
      break;
    case 'longest':
      body = (
        <>
          <Label>{SELF_CHECK.longestTitle}</Label>
          <P>{SELF_CHECK.longest}</P>
          {running ? (
            <Stopwatch
              cap={LONGEST_HOLD_CAP_S}
              cueOpts={cueOpts}
              onDone={(s) => {
                setRunning(false);
                if (longest === null) setLongest(s);
                else setRetry(s);
              }}
            />
          ) : null}
          {!running && longest !== null ? (
            <Card>
              <H2>{`${bestLongest} s`}</H2>
              {bestLongest >= LONGEST_HOLD_CAP_S ? <P>{SELF_CHECK.longestCap}</P> : null}
              {longest <= 1 && retry === null ? <P>{SELF_CHECK.longestRetry}</P> : null}
            </Card>
          ) : null}
        </>
      );
      footer = running ? null : longest === null ? (
        <Button label={SELF_CHECK.start} onPress={() => setRunning(true)} />
      ) : (
        <>
          <Button label={COMMON.continue} onPress={() => setStep('repeated')} />
          {longest <= 1 && retry === null ? <Button label="Try again" kind="secondary" onPress={() => setRunning(true)} /> : null}
        </>
      );
      break;
    case 'repeated':
      body = (
        <>
          <Label>{SELF_CHECK.repeatedTitle}</Label>
          <P>{`Hold ${H} s, rest 4 s, up to ${REPEATED_CAP} times.`}</P>
          <P>{SELF_CHECK.repeated}</P>
          {running ? (
            <Pacer
              onS={H}
              offS={4}
              max={REPEATED_CAP}
              tapLabel={SELF_CHECK.faded}
              cueOpts={cueOpts}
              onDone={(n) => {
                setRunning(false);
                setRepeated(n);
              }}
            />
          ) : null}
          {!running && repeated !== null ? <H2>{`${repeated} of ${REPEATED_CAP}`}</H2> : null}
        </>
      );
      footer = running ? null : repeated === null ? (
        <Button label={SELF_CHECK.start} onPress={() => setRunning(true)} />
      ) : (
        <Button label={COMMON.continue} onPress={() => setStep('quick')} />
      );
      break;
    case 'quick':
      body = (
        <>
          <Label>{SELF_CHECK.quickTitle}</Label>
          <P>{SELF_CHECK.quick}</P>
          {running ? (
            <Pacer
              onS={1}
              offS={1}
              max={QUICK_CAP}
              tapLabel={SELF_CHECK.slowed}
              cueOpts={cueOpts}
              onDone={(n) => {
                setRunning(false);
                setQuick(n);
              }}
            />
          ) : null}
          {!running && quick !== null ? <H2>{`${quick} of ${QUICK_CAP}`}</H2> : null}
        </>
      );
      footer = running ? null : quick === null ? (
        <Button label={SELF_CHECK.start} onPress={() => setRunning(true)} />
      ) : (
        <Button label={COMMON.continue} onPress={() => setStep('technique')} />
      );
      break;
    case 'technique':
      body = (
        <>
          <Label>{SELF_CHECK.techniqueTitle}</Label>
          {SELF_CHECK.technique.map((q) => (
            <Card key={q.key}>
              <P>{q.text}</P>
              <Segments options={triOpts} value={tech[q.key]} onChange={(v) => setTech({ ...tech, [q.key]: v })} />
            </Card>
          ))}
        </>
      );
      footer = <Button label={COMMON.continue} disabled={SELF_CHECK.technique.some((q) => !tech[q.key])} onPress={() => setStep('pain')} />;
      break;
    case 'pain':
      body = (
        <>
          <Label>{SELF_CHECK.painTitle}</Label>
          <H2>{SELF_CHECK.pain}</H2>
          <Choice options={SELF_CHECK.painOptions.map((o) => ({ value: o.value as Pain3, label: o.label }))} value={pain} onChange={setPain} />
        </>
      );
      footer = <Button label={COMMON.save} disabled={!pain} busy={busy} onPress={save} />;
      break;
    case 'result': {
      if (!out) break;
      const prev = out.previous;
      const line = (label: string, v: number | null, last: number | null, best: number | null, unit = '') =>
        `${label}: ${v ?? '–'}${unit}${last != null ? ` (${SELF_CHECK.last} ${last}${unit}` : ''}${best != null ? `${last != null ? ', ' : ' ('}${SELF_CHECK.best} ${best}${unit})` : last != null ? ')' : ''}`;
      const needStanding = position === 'lying' && data.prog.position_tier >= 2 && !out.relaxOnly;
      body = (
        <>
          <H1>{SELF_CHECK.resultTitle}</H1>
          <Card>
            <P>{line(SELF_CHECK.longestResult, bestLongest, prev ? Math.max(prev.longest_hold_s ?? 0, prev.longest_hold_retry_s ?? 0) : null, out.best.longest_hold, ' s')}</P>
            <P>{line(`${SELF_CHECK.repeatedResult} (at ${H} s)`, repeated, prev?.repeated_holds ?? null, out.best.repeated_holds)}</P>
            <P>{line(SELF_CHECK.quickResult, quick, prev?.quick_flicks ?? null, out.best.quick_flicks)}</P>
          </Card>
          {out.personalBest ? <Banner tone="soft" text={MESSAGES['PFB-031-pb']} /> : null}
          {out.relaxOnly ? <Banner text={RELAX_ONLY_HOME} /> : pain === 'a_little' ? <P muted>{PAIN_CHOICE.aLittle}</P> : null}
          {techniqueFlag({ signResult: sign ?? null, bulge: bulge ?? null, breathingOk: tech.breathing_ok ?? null, glutesBellyRelaxed: tech.glutes_belly_relaxed ?? null, fullRelease: tech.full_release ?? null }) ? (
            <Card tone="soft" onPress={() => router.replace('/learn')}>
              <P>{SELF_CHECK.techniqueLink}</P>
            </Card>
          ) : null}
          {out.topUpOffer && topUp === 'offered' ? (
            <Card tone="soft">
              <H2>{MAINTENANCE.topUpTitle}</H2>
              <P>{MAINTENANCE.topUpBody}</P>
              <Button
                label={MAINTENANCE.topUpAccept}
                onPress={async () => {
                  await acceptTopUp(db);
                  bump();
                  setTopUp('accepted');
                }}
              />
              <Button label={MAINTENANCE.topUpDecline} kind="quiet" onPress={() => setTopUp('declined')} />
            </Card>
          ) : null}
          {needStanding ? <P>{SELF_CHECK.standingNext}</P> : null}
        </>
      );
      footer = needStanding ? (
        <>
          <Button
            label="Do the standing check"
            onPress={() => router.replace(`/selfcheck?position=standing${params.checkId ? `&checkId=${params.checkId}&parts=${params.parts ?? ''}` : ''}&kind=${params.kind ?? ''}`)}
          />
          <Button
            label={SELF_CHECK.stopEarly}
            kind="quiet"
            onPress={async () => {
              if (params.checkId && params.parts) await markPart(db, params.checkId, 'self_check', params.parts.split(',') as BundlePart[]);
              bump();
              router.back();
            }}
          />
        </>
      ) : (
        <Button label={COMMON.done} onPress={() => (kind === 'baseline' ? router.replace('/') : router.back())} />
      );
      break;
    }
  }
  return (
    <Screen title={title} footer={footer}>
      {body}
    </Screen>
  );
}
