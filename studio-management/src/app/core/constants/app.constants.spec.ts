import { describe, expect, it } from 'vitest';
import {
  IP_RULE_MODE_OPTIONS,
  PRIORITY,
  PRIORITY_OPTIONS,
  ROLES,
  ROLE_OPTIONS,
  TICKET_STATUS,
  TICKET_STATUS_OPTIONS,
} from './app.constants';

const sortedValues = (opts: { value: string }[]) => opts.map((o) => o.value).sort();

describe('shared app constants', () => {
  it('ticket-status options cover exactly the TICKET_STATUS keys', () => {
    expect(sortedValues(TICKET_STATUS_OPTIONS)).toEqual(Object.values(TICKET_STATUS).sort());
  });

  it('priority options cover exactly the PRIORITY keys', () => {
    expect(sortedValues(PRIORITY_OPTIONS)).toEqual(Object.values(PRIORITY).sort());
  });

  it('role options cover exactly SA / A / U', () => {
    expect(sortedValues(ROLE_OPTIONS)).toEqual(Object.values(ROLES).sort());
  });

  it('IP rule modes are allow + block only', () => {
    expect(sortedValues(IP_RULE_MODE_OPTIONS)).toEqual(['allow', 'block']);
  });
});
