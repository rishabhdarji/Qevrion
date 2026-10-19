import { isPartifulLink, webLink } from './links';

describe('webLink', () => {
  it('keeps a plain web link as it is', () => {
    for (const link of [
      'https://partiful.com/e/EXAMPLE123',
      'HTTP://example.com',
      'https://example.com:8443/path?q=1#top',
      'https://www.example.com/a/b?c=d&e=f',
    ]) {
      expect(webLink(link)).toBe(link);
    }
  });

  it('refuses anything that is not a web link', () => {
    for (const value of [null, undefined, 42, '', 'example.com/a', 'mailto:maya@example.com', 'javascript:alert(1)', 'ftp://example.com/']) {
      expect(webLink(value)).toBeNull();
    }
  });

  it('refuses a link with no place to go', () => {
    for (const link of ['https://', 'https:///path', 'https://:443/', 'https://?q=1', 'https://#top']) {
      expect(webLink(link)).toBeNull();
    }
  });

  it('refuses a link that hides where it goes', () => {
    for (const link of [
      'https://partiful.com@evil.example/e',
      'https://user:pw@example.com/',
      'https://example.com/a b',
      'https://example.com/a\nb',
      'https://example.com/\u0000',
      'https://example.com\\@partiful.com/',
      // Text turned round: it reads as one link and opens another.
      'https://example.com/\u202Emoc.lufitrap',
      'https://example.com/\u2066x\u2069',
      'https://example.com/\u200F',
    ]) {
      expect(webLink(link)).toBeNull();
    }
  });

  it('refuses a link longer than 2,000 characters', () => {
    const link = `https://example.com/${'a'.repeat(1980)}`;
    expect(webLink(link)).toBe(link);
    expect(webLink(`${link}aa`)).toBeNull();
  });
});

describe('isPartifulLink', () => {
  it('is true for Partiful and its own addresses', () => {
    for (const link of ['https://partiful.com/e/EXAMPLE123', 'https://www.partiful.com/e/x', 'HTTPS://PARTIFUL.COM', 'https://partiful.com?x=1']) {
      expect(isPartifulLink(link)).toBe(true);
    }
  });

  it('is false for a link that only mentions Partiful', () => {
    for (const link of [
      'https://evil.example/?partiful.com',
      'https://partiful.com.evil.example/',
      'https://evilpartiful.com/',
      'https://partiful.com@evil.example/e',
      'https://evil.example/partiful.com',
      'https://evil.example#partiful.com',
      'https://evil.example\\@partiful.com/',
      'partiful.com/e/x',
    ]) {
      expect(isPartifulLink(link)).toBe(false);
    }
  });
});
