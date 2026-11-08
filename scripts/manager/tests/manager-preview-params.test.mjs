import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');

/** The real helper from index.html, run against a fake query string. */
function previewParamFor(search) {
  const start = html.indexOf('function managerPreviewParam(');
  const source = html.slice(start, html.indexOf('\n', start));
  assert.ok(start > 0, 'managerPreviewParam is defined in index.html');
  return new Function('MANAGER_LOCAL_PREVIEW_PARAMS', `${source}; return managerPreviewParam;`)(new URLSearchParams(search));
}

const VIEWS = ['market', 'calculator', 'mine', 'hall', 'boards', 'shop', 'prediction'];

test('a preview view name is taken from the allow-list, never from the URL', () => {
  // CodeQL js/xss: location.search reached innerHTML through MANAGER_VIEW.
  const allowed = [...VIEWS];
  const hall = previewParamFor('?manager-view=hall')('manager-view', allowed, 'market');
  assert.equal(hall, 'hall');
  assert.ok(allowed.includes(hall) && hall === allowed[allowed.indexOf('hall')]);
});

test('anything outside the allow-list falls back, including markup and lookalikes', () => {
  const cases = [
    '?manager-view=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E',
    '?manager-view=hall%20',
    '?manager-view=HALL',
    '?manager-view=__proto__',
    '?manager-view=constructor',
    '?manager-view=',
    '?other=hall',
  ];
  for (const search of cases) {
    assert.equal(previewParamFor(search)('manager-view', VIEWS, 'market'), 'market', search);
  }
  assert.equal(previewParamFor('?manager-my-view=badges')('manager-my-view', ['lineup', 'badges'], 'lineup'), 'badges');
  assert.equal(previewParamFor('?manager-my-view=<b>')('manager-my-view', ['lineup', 'badges'], 'lineup'), 'lineup');
});

test('both preview views are resolved through the helper and the view class is escaped', () => {
  assert.match(html, /let MANAGER_VIEW=managerLocalPreviewEnabled\(\)\?managerPreviewParam\('manager-view',\[/);
  assert.match(html, /let MANAGER_MY_VIEW=managerLocalPreviewEnabled\(\)\?managerPreviewParam\('manager-my-view',\[/);
  assert.doesNotMatch(html, /MANAGER_LOCAL_PREVIEW_PARAMS\.get\('manager-(?:my-)?view'\)\)\?MANAGER_LOCAL_PREVIEW_PARAMS/);
  assert.match(html, /class="manager-grid view-'\+esc\(MANAGER_VIEW\)\+' '/);
});
