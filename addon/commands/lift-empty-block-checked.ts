/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  canSplit,
  specCanSplit,
} from '@lblod/ember-rdfa-editor/commands/split-block-checked';
import { Command, TextSelection } from 'prosemirror-state';
import {
  ReplaceAroundStep,
  Transform,
  liftTarget,
} from 'prosemirror-transform';
import { isNone, unwrap } from '@lblod/ember-rdfa-editor/utils/_private/option';
import { Fragment, NodeRange, Slice } from 'prosemirror-model';

function liftBisBis(tr: Transform, range: NodeRange, target: number) {
  console.log('liftBisBis');
  const { $from, $to, depth } = range;

  const gapStart = $from.before(depth + 1),
    gapEnd = $to.after(depth + 1);
  let start = gapStart,
    end = gapEnd;

  let before = Fragment.empty,
    openStart = 0;
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $from.index(d) > 0) {
      splitting = true;
      before = Fragment.from($from.node(d).copy(before));
      openStart++;
    } else {
      start--;
    }
  let after = Fragment.empty,
    openEnd = 0;
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $to.after(d + 1) < $to.end(d)) {
      splitting = true;
      const node = $to.node(d).copy(after);
      console.log(node.attrs);
      // if node has attr style with value `decimal-extended` we need to remove it

      // if (node.attrs.style === 'decimal-extended') {
      //   node.attrs.style = null;
      // }
      after = Fragment.from($to.node(d).copy(after));
      openEnd++;
    } else {
      end++;
    }

  console.log('after:', after);

  tr.step(
    new ReplaceAroundStep(
      start,
      end,
      gapStart,
      gapEnd,
      new Slice(before.append(after), openStart, openEnd),
      before.size - openStart,
      true
    )
  );
}

function liftAdjusted(tr: Transform, range: NodeRange, target: number) {
  liftBisBis(tr, range, target);
  return tr;
}

export const liftEmptyBlockChecked: Command = (state, dispatch) => {
  const { $cursor } = state.selection as TextSelection;
  if (!$cursor || $cursor.parent.content.size) {
    return false;
  }
  if ($cursor.depth > 1 && $cursor.after() !== $cursor.end(-1)) {
    const before = $cursor.before();
    if (canSplit(state.doc, before)) {
      if (dispatch) dispatch(state.tr.split(before).scrollIntoView());
      return true;
    }
  }
  const range = $cursor.blockRange();
  if (!range) {
    return false;
  }
  const { $from, depth } = range;

  const target = liftTarget(range);
  if (isNone(target)) {
    return false;
  }
  for (let d = depth; d > target; d--) {
    if (!specCanSplit($from.node(d).type.spec)) {
      return false;
    }
  }
  if (dispatch) {
    dispatch(liftAdjusted(state.tr, unwrap(range), target).scrollIntoView());
  }
  return true;
};
