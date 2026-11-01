import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizedHost, planGroups } from '../extension/grouping.mjs';

test('normalizes www and excludes internal or malformed urls', () => {
  assert.equal(normalizedHost('https://www.Example.com/a'), 'example.com');
  assert.equal(normalizedHost('http://example.com'), 'example.com');
  assert.equal(normalizedHost('dia://settings'), null);
  assert.equal(normalizedHost('not a url'), null);
  assert.equal(normalizedHost(undefined), null);
});

test('only groups two or more ungrouped, non-pinned matching tabs', () => {
  const tabs = [
    {id:1,groupId:-1,pinned:false,url:'https://a.com'},
    {id:2,groupId:-1,pinned:false,url:'https://www.a.com/2'},
    {id:3,groupId:-1,pinned:true,url:'https://a.com/3'},
    {id:4,groupId:-1,pinned:false,url:'https://b.com'},
    {id:5,groupId:-1,pinned:false,url:'dia://settings'}
  ];
  assert.deepEqual(planGroups(tabs, []), [{host:'a.com',tabIds:[1,2]}]);
});

test('joins previously created correctly labeled domain group', () => {
  const tabs = [
    {id:1,groupId:8,pinned:false,url:'https://a.com'},
    {id:2,groupId:-1,pinned:false,url:'https://a.com/new'}
  ];
  assert.deepEqual(planGroups(tabs,[{id:8,title:'a.com'}]),[{host:'a.com',tabIds:[2],groupId:8}]);
});

test('never alters mismatched or mixed-domain manual groups', () => {
  const tabs = [
    {id:1,groupId:8,pinned:false,url:'https://a.com'},
    {id:2,groupId:8,pinned:false,url:'https://b.com'},
    {id:3,groupId:-1,pinned:false,url:'https://a.com'}
  ];
  assert.deepEqual(planGroups(tabs,[{id:8,title:'a.com'}]),[]);
});
