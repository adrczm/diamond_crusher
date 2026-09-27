import { activeNav, phoneTab, TABS } from '../../src/ui/layout';

describe('phone tab bar (UX audit H4)', () => {
  it('has Today, Progress, Log, Library and More', () => {
    expect(TABS.map((t) => t.key)).toEqual(['home', 'progress', 'log', 'library', 'more']);
  });

  it('lights the tab of each top-level section, and More for the sections without a tab', () => {
    expect(phoneTab('/')).toBe('home');
    expect(phoneTab('/progress')).toBe('progress');
    expect(phoneTab('/log')).toBe('log');
    expect(phoneTab('/library')).toBe('library');
    for (const p of ['/settings', '/check', '/reminders', '/data']) expect(phoneTab(p)).toBe('more');
  });

  it('hides in guided flows, the sync steps and sub-pages', () => {
    for (const p of ['/onboarding', '/session', '/learn', '/selfcheck', '/questionnaire', '/screening', '/sync', '/about', '/summary']) {
      expect(phoneTab(p)).toBeNull();
    }
    expect(activeNav('/sync')).toBe('data');
  });
});
