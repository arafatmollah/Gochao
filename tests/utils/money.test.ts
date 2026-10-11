import { minorToInputText, normalizeDigitInput, parseAmountToMinor } from '@/utils/money';

describe('parseAmountToMinor', () => {
  it('parses whole takas into minor units', () => {
    expect(parseAmountToMinor('1250')).toBe(125000);
    expect(parseAmountToMinor('1')).toBe(100);
  });

  it('parses one and two decimal places without float error', () => {
    expect(parseAmountToMinor('1250.5')).toBe(125050);
    expect(parseAmountToMinor('1250.50')).toBe(125050);
    expect(parseAmountToMinor('0.01')).toBe(1);
    expect(parseAmountToMinor('19.99')).toBe(1999);
  });

  it('accepts grouping commas and surrounding whitespace', () => {
    expect(parseAmountToMinor(' 1,250.50 ')).toBe(125050);
    expect(parseAmountToMinor('1,00,000')).toBe(10000000);
  });

  it('accepts Bangla digits', () => {
    expect(parseAmountToMinor('১২৫০.৫০')).toBe(125050);
    expect(parseAmountToMinor('১,২৫০')).toBe(125000);
  });

  it('rejects malformed text', () => {
    expect(parseAmountToMinor('')).toBeNull();
    expect(parseAmountToMinor('abc')).toBeNull();
    expect(parseAmountToMinor('12.345')).toBeNull();
    expect(parseAmountToMinor('12.')).toBeNull();
    expect(parseAmountToMinor('-5')).toBeNull();
    expect(parseAmountToMinor('1 250 50')).toBeNull();
  });

  it('rejects zero, negative, and out-of-range amounts', () => {
    expect(parseAmountToMinor('0')).toBeNull();
    expect(parseAmountToMinor('0.00')).toBeNull();
    expect(parseAmountToMinor('999999999999.99')).toBeNull();
  });
});

describe('minorToInputText', () => {
  it('renders whole amounts without decimals and others with two', () => {
    expect(minorToInputText(125000)).toBe('1250');
    expect(minorToInputText(125050)).toBe('1250.50');
    expect(minorToInputText(125005)).toBe('1250.05');
    expect(minorToInputText(1)).toBe('0.01');
  });

  it('round-trips through parseAmountToMinor', () => {
    for (const minor of [1, 99, 100, 125050, 999999999999]) {
      expect(parseAmountToMinor(minorToInputText(minor))).toBe(minor);
    }
  });
});

describe('normalizeDigitInput', () => {
  it('maps Bangla digits to ASCII and leaves other characters alone', () => {
    expect(normalizeDigitInput('০১২৩৪৫৬৭৮৯')).toBe('0123456789');
    expect(normalizeDigitInput('১২.৫ টাকা')).toBe('12.5 টাকা');
  });
});
