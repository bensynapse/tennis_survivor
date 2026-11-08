import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { cleanText, decodeHtml } from '../lib/live-tennis-current-station.mjs';

test('decodeHtml decodes each entity exactly once', () => {
  // CodeQL js/double-escaping: `&amp;` decoded first fed `&quot;` into the next replace.
  assert.equal(decodeHtml('&amp;quot;'), '&quot;');
  assert.equal(decodeHtml('&amp;#39;'), '&#39;');
  assert.equal(decodeHtml('&#38;amp;'), '&amp;');
  assert.equal(decodeHtml('&amp;amp;'), '&amp;');
});

test('decodeHtml still decodes everything the scrapers relied on', () => {
  assert.equal(decodeHtml('Tom &amp; Jerry'), 'Tom & Jerry');
  assert.equal(decodeHtml('&quot;a&quot; &#39;b&#39; &#x27;c&#x27; &apos;d&apos;'), '"a" \'b\' \'c\' \'d\'');
  assert.equal(decodeHtml('a&nbsp;b'), 'a b');
  assert.equal(decodeHtml('&#128512;&#x1F3BE;'), '\u{1F600}\u{1F3BE}');
  assert.equal(decodeHtml('O&#39;Connell'), "O'Connell");
  assert.equal(decodeHtml(''), '');
  assert.equal(decodeHtml(undefined), '');
  assert.equal(decodeHtml(42), '42');
});

test('decodeHtml leaves unknown entities and invalid code points alone', () => {
  assert.equal(decodeHtml('&lt;b&gt;'), '&lt;b&gt;');
  assert.equal(decodeHtml('&bogus;'), '&bogus;');
  assert.equal(decodeHtml('&#99999999;'), '&#99999999;');
  assert.equal(decodeHtml('AT&T'), 'AT&T');
});

test('cleanText removes script and style blocks whatever the end tag looks like', () => {
  // CodeQL js/bad-tag-filter: `</script >` did not match, so the body stayed in the text.
  assert.equal(cleanText('<script >alert(1)</script >name'), 'name');
  assert.equal(cleanText('<SCRIPT type="text/javascript">x</SCRIPT\n>name'), 'name');
  assert.equal(cleanText('<script>alert(1)</script\t\n bar>name'), 'name');
  assert.equal(cleanText('<script>alert(1)</script/>name'), 'name');
  assert.equal(cleanText('<script>x</scripts>y</script>name'), 'name');
  assert.equal(cleanText('<style>.a{}</style >name'), 'name');
  assert.equal(cleanText('<style>.a{}</style\tmedia=all>name'), 'name');
  assert.equal(cleanText('<b>Novak</b> <i>Djokovic</i>'), 'Novak Djokovic');
  assert.equal(cleanText('  a  <br/>  b  '), 'a b');
});

test('the manager scripts decode entities through the shared lib only', () => {
  const files = [
    'scripts/manager/build-prices.mjs',
    'scripts/manager/prepare-canada-2026-preview.mjs',
    'scripts/manager/import-tennis-abstract-elo.mjs',
    'scripts/manager/refresh-player-photos.mjs',
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /from '\.\/lib\/live-tennis-current-station\.mjs';/, file);
    assert.doesNotMatch(source, /\.replace\(\/&amp;\/g/, `${file} still has its own &amp; replace`);
  }
});
