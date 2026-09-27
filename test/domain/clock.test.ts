// Reminder time stepper on phones (UX audit M2).
import { HHMM, shiftTime, stepMinutes } from '../../src/domain/clock';

describe('clock times', () => {
  it('moves by hours and minutes', () => {
    expect(shiftTime('07:45', 1, 0)).toBe('08:45');
    expect(shiftTime('07:45', 0, 5)).toBe('07:50');
    expect(shiftTime('07:55', 0, 5)).toBe('08:00');
  });
  it('wraps at midnight', () => {
    expect(shiftTime('23:30', 1, 0)).toBe('00:30');
    expect(shiftTime('00:00', 0, -5)).toBe('23:55');
    expect(shiftTime('00:15', -1, 0)).toBe('23:15');
  });
  it('steps minutes on a 5-minute grid', () => {
    expect(stepMinutes('07:45', 5, 1)).toBe('07:50');
    expect(stepMinutes('07:47', 5, 1)).toBe('07:50');
    expect(stepMinutes('07:47', 5, -1)).toBe('07:45');
    expect(stepMinutes('23:55', 5, 1)).toBe('00:00');
  });
  it('accepts only whole 24-hour times', () => {
    expect(HHMM.test('07:45')).toBe(true);
    expect(HHMM.test('24:00')).toBe(false);
    expect(HHMM.test('7:45')).toBe(false);
  });
});
