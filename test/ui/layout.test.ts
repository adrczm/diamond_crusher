import { activeNav, BREAKPOINTS, contentClass, phoneTab, TABS, windowClass } from '../../src/ui/layout';

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

describe('design round 2 breakpoints (09, decision M1)', () => {
  it('uses 768, 1040 and 1440', () => {
    expect(BREAKPOINTS).toEqual({ md: 768, lg: 1040, xl: 1440 });
    expect(windowClass(767)).toBe('compact');
    expect(windowClass(768)).toBe('medium');
    expect(windowClass(1039)).toBe('medium');
    expect(windowClass(1040)).toBe('large');
    expect(windowClass(1440)).toBe('xlarge');
  });
  it('sizes content by its own width', () => {
    expect(contentClass(639)).toBe('c1');
    expect(contentClass(640)).toBe('c2');
    expect(contentClass(960)).toBe('c3');
    expect(contentClass(1280)).toBe('c4');
  });
});
