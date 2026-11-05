'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../apps-script/hall-pass-template/SetupWizard.html'), 'utf8');
const elements = {}, pending = [];
for (const match of html.matchAll(/id="([^"]+)"([^>]*)>/g)) {
  elements[match[1]] = {hidden: /\bhidden\b/.test(match[2]), disabled: /\bdisabled\b/.test(match[2]),
    value: '', textContent: '', children: [], handlers: {},
    addEventListener(event, handler) {this.handlers[event] = handler;},
    select() {}, appendChild(child) {this.children.push(child);}};
}
elements.steps.children = Array.from({length: 4}, () => ({className: ''}));
function runner(success, failure) {
  return new Proxy({}, {get(_, name) {
    if (name === 'withSuccessHandler') return fn => runner(fn, failure);
    if (name === 'withFailureHandler') return fn => runner(success, fn);
    return (...args) => pending.push({name, args, success, failure});
  }});
}
vm.runInNewContext(html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)[1], {
  document: {getElementById(id) {assert.ok(elements[id], id); return elements[id];}, querySelectorAll() {return [];}},
  window: {scrollTo() {}}, google: {script: {get run() {return runner();}, host: {close() {}}}},
}, {timeout: 1000});
const click = id => elements[id].handlers.click();
assert.equal(pending.length, 1);
assert.equal(pending[0].name, 'setupWizardLoad');
assert.equal(elements['about-next'].disabled, true);
pending.shift().failure({message: 'reading from storage. Error code PERMISSION_DENIED.'});
assert.equal(elements['screen-recovery'].hidden, false);
assert.equal(elements['screen-about'].hidden, true);
assert.equal(elements.steps.hidden, true);
assert.match(elements['recovery-message'].textContent, /More than one/);
assert.match(elements['recovery-details'].textContent, /PERMISSION_DENIED/);
for (const id of ['about-next', 'bells-save', 'link-save']) click(id);
assert.equal(pending.length, 0, 'No navigation or writes before valid settings');
click('recovery-retry');
assert.equal(elements['screen-loading'].hidden, false);
pending.shift().failure({message: 'Synthetic connection failure'});
assert.equal(elements['screen-recovery'].hidden, false);
assert.match(elements['recovery-message'].textContent, /could not be loaded/);
click('recovery-retry'); pending.shift().success({});
assert.match(elements['recovery-details'].textContent, /incomplete/);
assert.equal(elements['about-next'].disabled, true);
click('recovery-retry');
const ready = {ok: true, appTitle: 'Synthetic Hall Pass', studentEmailDomain: 'students.example.org', periods: []};
pending.shift().success(ready);
assert.equal(elements['screen-about'].hidden, false);
assert.equal(elements['about-next'].disabled, false);
assert.equal(elements.steps.children.filter(bar => bar.className === 'done').length, 1);
click('about-next');
assert.equal(elements['screen-bells'].hidden, false);
elements['app-title'].value = 'Keep my edited answer';
click('bells-save'); pending.shift().failure({message: 'Synthetic save error'});
assert.equal(elements['screen-bells'].hidden, false);
assert.equal(elements['app-title'].value, 'Keep my edited answer');
assert.equal(elements['bells-save'].disabled, false);
assert.equal(elements['bells-message'].textContent, 'Synthetic save error');
console.log('PASS: actual setup handlers stop on storage failure, block writes/navigation, retry safely, reject incomplete settings, recover and retain failed-save answers.');
