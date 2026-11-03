const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(new URL('../docs/comments.js', `file://${__filename}`), 'utf8');

function mountComments(scriptUrl) {
  const attributes = {};
  const script = { setAttribute: (name, value) => { attributes[name] = value; } };
  const container = { appendChild() {} };
  const location = new URL('./blog-issue-45.html', scriptUrl);
  const context = {
    URL, location,
    window: { BLOG_COMMENTS: { repo: 'zwhu/zwhu.github.io', repoId: 'repo', category: 'category', categoryId: 'category-id' } },
    document: {
      currentScript: { src: scriptUrl },
      querySelector: selector => selector === '.giscus' ? container : {},
      createElement: () => script
    }
  };
  vm.runInNewContext(source, context);
  return attributes;
}

for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
  test(`local preview at ${host} uses the publicly reachable HTTPS theme`, () => {
    const attributes = mountComments(`http://${host}:8768/comments.js`);
    assert.equal(attributes['data-theme'], 'https://zwhu.github.io/giscus-theme.css?v=2');
    assert.equal(attributes['data-term'], 'blog/blog-issue-45.html');
  });
}

test('an HTTPS localhost still cannot supply CSS to the remote iframe', () => {
  const attributes = mountComments('https://localhost:8768/comments.js');
  assert.equal(attributes['data-theme'], 'https://zwhu.github.io/giscus-theme.css?v=2');
});

test('public HTTPS sites keep their own relative theme and article mapping', () => {
  const attributes = mountComments('https://example.com/blog/comments.js');
  assert.equal(attributes['data-theme'], 'https://example.com/blog/giscus-theme.css?v=2');
  assert.equal(attributes['data-term'], 'blog/blog-issue-45.html');
});

test('comments wait for the section to approach the viewport and load exactly once', () => {
  const appended = [], attributes = {}, section = { id: 'comments' };
  let observer, disconnected = false;
  const container = { closest: () => section, appendChild: script => appended.push(script) };
  const document = {
    currentScript: { src: 'https://example.com/blog/comments.js?v=6' },
    querySelector: selector => selector === '.giscus' ? container : {},
    createElement: () => ({ setAttribute: (name, value) => { attributes[name] = value; } })
  };
  class IntersectionObserver {
    constructor(callback, options) { observer = { callback, options }; }
    observe(target) { assert.equal(target, section); }
    disconnect() { disconnected = true; }
  }
  vm.runInNewContext(source, {
    URL, document, location: new URL('https://example.com/blog/stable-article.html'),
    window: { IntersectionObserver, BLOG_COMMENTS: { repo: 'owner/repo', repoId: 'repo', category: 'category', categoryId: 'category-id' } }
  });
  assert.equal(appended.length, 0, 'initial reading must not request the comment client');
  assert.equal(observer.options.rootMargin, '300px 0px');
  document.currentScript = null; // The deferred callback must retain the original script URL.
  observer.callback([{ isIntersecting: false }]);
  assert.equal(appended.length, 0);
  observer.callback([{ isIntersecting: true }]);
  observer.callback([{ isIntersecting: true }]);
  assert.equal(appended.length, 1);
  assert.equal(disconnected, true);
  assert.equal(appended[0].src, 'https://giscus.app/client.js');
  assert.equal(attributes['data-theme'], 'https://example.com/blog/giscus-theme.css?v=2');
  assert.equal(attributes['data-term'], 'blog/stable-article.html');
});
