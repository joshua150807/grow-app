const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, './HabitItem.jsx'), 'utf8');
const checkboxControl = source.match(/<PressableScale[\s\S]*?accessibilityState=\{\{ checked: !!done \}\}[\s\S]*?>/)?.[0] ?? '';
const cardControl = source.match(/<Pressable\s+style=\{StyleSheet\.absoluteFill\}[\s\S]*?\/>/)?.[0] ?? '';

test('check control toggles on finger contact through onPressIn', () => {
  assert.match(checkboxControl, /onPressIn=\{handleToggle\}/);
  assert.doesNotMatch(checkboxControl, /\bonPress=/);
  assert.doesNotMatch(checkboxControl, /\bonPressOut=/);
});

test('check and card controls are non-nested sibling touch targets', () => {
  const cardIndex = source.indexOf(cardControl);
  const checkIndex = source.indexOf(checkboxControl);
  assert.ok(cardIndex >= 0 && checkIndex > cardIndex);
  assert.match(source.slice(0, cardIndex), /<View[\s\S]*styles\.habitCard/);
  assert.match(cardControl, /\/>$/);
  assert.doesNotMatch(cardControl, /PressableScale/);
});

test('whole card body toggles through normal onPress only', () => {
  assert.match(cardControl, /StyleSheet\.absoluteFill/);
  assert.match(cardControl, /onPress=\{handleToggle\}/);
  assert.doesNotMatch(cardControl, /onPressIn=|onPressOut=/);
  assert.equal((cardControl.match(/onPress=\{handleToggle\}/g) ?? []).length, 1);
});

test('habit name is inside the card touch body without a separate toggle handler', () => {
  const title = source.match(/<View pointerEvents="none" style=\{styles\.habitTitlePressable\}>[\s\S]*?<\/View>/)?.[0] ?? '';
  assert.match(title, /habit\.name/);
  assert.doesNotMatch(title, /onPress/);
});

test('right-side and vertical free card areas belong to the root card Pressable', () => {
  assert.match(cardControl, /StyleSheet\.absoluteFill/);
  assert.match(source, /pointerEvents="box-none"[\s\S]*styles\.habitMainRow/);
  assert.match(source, /pointerEvents="box-none" style=\{styles\.habitRight\}/);
  assert.match(source, /pointerEvents="none" style=\{styles\.habitDayDots\}/);
});

test('linked tool, edit and delete remain independent foreground controls', () => {
  assert.match(source, /onOpenLinkedTool\?\.\(habit\)/);
  assert.match(source, /onEdit\?\.\(habit\)/);
  assert.match(source, /onDelete\(habit\.id\)/);
});

test('check control retains ten-point hitSlop', () => {
  assert.match(checkboxControl, /hitSlop=\{\{ top: s\(10\), bottom: s\(10\), left: s\(10\), right: s\(10\) \}\}/);
});

test('visible checkbox and card geometry remain unchanged', () => {
  assert.match(source, /checkboxTapArea:\s*\{[\s\S]*?width: s\(44\),[\s\S]*?height: s\(44\)/);
  assert.match(source, /checkbox:\s*\{[\s\S]*?width: s\(24\),[\s\S]*?height: s\(24\)/);
  assert.match(source, /habitCard:\s*\{[\s\S]*?minHeight: sv\(70\),[\s\S]*?paddingHorizontal: s\(14\),[\s\S]*?paddingVertical: sv\(12\)/);
});

test('existing check pressed feedback and accessibility remain unchanged', () => {
  assert.match(checkboxControl, /activeScale=\{0\.92\}/);
  assert.match(checkboxControl, /activeOpacity=\{0\.86\}/);
  assert.match(checkboxControl, /accessibilityRole="checkbox"/);
  assert.match(checkboxControl, /accessibilityState=\{\{ checked: !!done \}\}/);
});

test('card scrolling does not toggle at finger contact', () => {
  assert.doesNotMatch(cardControl, /onPressIn=/);
  assert.match(cardControl, /onPress=\{handleToggle\}/);
});

test('one card press and one check press each call the shared handler once', () => {
  const handler = source.match(/const handleToggle = \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  assert.equal((handler.match(/onToggle\(habit\.id\)/g) ?? []).length, 1);
  assert.equal((cardControl.match(/onPress=\{handleToggle\}/g) ?? []).length, 1);
  assert.equal((checkboxControl.match(/onPressIn=\{handleToggle\}/g) ?? []).length, 1);
});

test('touch component contains no disabled, debounce or timeout behavior', () => {
  assert.doesNotMatch(source, /disabled=|setTimeout|debounce/);
});

test('collection detail can hide edit and delete controls without changing the default', () => {
  assert.match(source, /showActions = true/);
  assert.match(source, /\{showActions && <View pointerEvents="box-none" style=\{styles\.actionRow\}>/);
});
