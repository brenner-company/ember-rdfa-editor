import { redo, undo } from 'prosemirror-history';
import {
  liftListItem,
  sinkListItem,
  splitListItem,
} from 'prosemirror-schema-list';
import { canSplit } from 'prosemirror-transform';
import {
  AllSelection,
  Command,
  EditorState,
  NodeSelection,
  TextSelection,
  Transaction,
} from 'prosemirror-state';
import {
  Node,
  ContentMatch,
  Schema,
  NodeType,
  Attrs,
  Fragment,
  Slice,
} from 'prosemirror-model';
import { toggleMarkAddFirst } from '@lblod/ember-rdfa-editor/commands/toggle-mark-add-first';
import {
  chainCommands,
  createParagraphNear,
  deleteSelection,
  exitCode,
  joinBackward,
  joinForward,
  newlineInCode,
  selectAll,
  selectNodeBackward,
  selectNodeForward,
  selectTextblockEnd,
  selectTextblockStart,
  splitBlock,
} from 'prosemirror-commands';
import {
  insertHardBreak,
  reduceIndent,
  liftEmptyBlockChecked,
  selectBlockRdfaNode,
} from '@lblod/ember-rdfa-editor/commands';
import selectParentNodeOfType from '../commands/select-parent-node-of-type';
import { hasParentNodeOfType } from '@curvenote/prosemirror-utils';
import { undoInputRule } from 'prosemirror-inputrules';

export type KeymapOptions = {
  backspace?: {
    /**
     * Enables alternative behaviour for backspace.
     * Instead of deleting into the preceding block_rdfa node, it will select the preceding block_rdfa node.
     *
     * `block_rdfa` node has to enhanced with `isolating: true, selectable: true` in the schema.
     */
    selectBlockRdfaNode: boolean;
  };
};

export type Keymap = (
  schema: Schema,
  options?: KeymapOptions
) => Record<string, Command>;

const backspaceBase: Command[] = [
  undoInputRule,
  reduceIndent,
  deleteSelection,
  (state, dispatch, view) => {
    const isInTable = hasParentNodeOfType(state.schema.nodes.table)(
      state.selection
    );
    if (joinBackward(state, dispatch) && dispatch && view) {
      const { state } = view;
      if (!isInTable) {
        selectParentNodeOfType(state.schema.nodes.table)(state, dispatch, view);
      }
      return true;
    }
    return false;
  },
  selectNodeBackward,
];

const getBackspaceCommand = (options?: KeymapOptions) => {
  if (options?.backspace?.selectBlockRdfaNode) {
    return chainCommands(selectBlockRdfaNode, ...backspaceBase);
  }

  return chainCommands(...backspaceBase);
};

const del = chainCommands(
  deleteSelection,
  (state, dispatch, view) => {
    const isInTable = hasParentNodeOfType(state.schema.nodes.table)(
      state.selection
    );
    if (joinForward(state, dispatch) && dispatch && view) {
      const { state } = view;
      if (!isInTable) {
        selectParentNodeOfType(state.schema.nodes.table)(state, dispatch, view);
      }
      return true;
    }
    return false;
  },
  selectNodeForward
);

function defaultBlockAt(match: ContentMatch) {
  for (let i = 0; i < match.edgeCount; i++) {
    const { type } = match.edge(i);
    if (type.isTextblock && !type.hasRequiredAttrs()) return type;
  }
  return null;
}

function splitBlockAsBis(
  splitNode?: (
    node: Node,
    atEnd: boolean
  ) => { type: NodeType; attrs?: Attrs } | null
): Command {
  return (state, dispatch) => {
    const { $from, $to } = state.selection;
    console.log('splitBlockAsBis');
    if (
      state.selection instanceof NodeSelection &&
      state.selection.node.isBlock
    ) {
      if (!$from.parentOffset || !canSplit(state.doc, $from.pos)) return false;
      if (dispatch) dispatch(state.tr.split($from.pos).scrollIntoView());
      return true;
    }

    if (!$from.parent.isBlock) return false;

    if (dispatch) {
      const atEnd = $to.parentOffset == $to.parent.content.size;
      const tr = state.tr;
      if (
        state.selection instanceof TextSelection ||
        state.selection instanceof AllSelection
      )
        tr.deleteSelection();
      const deflt =
        $from.depth == 0
          ? null
          : defaultBlockAt($from.node(-1).contentMatchAt($from.indexAfter(-1)));
      const splitType = splitNode && splitNode($to.parent, atEnd);
      let types = splitType
        ? [splitType]
        : atEnd && deflt
        ? [{ type: deflt }]
        : undefined;
      let can = canSplit(tr.doc, tr.mapping.map($from.pos), 1, types);
      if (
        !types &&
        !can &&
        canSplit(
          tr.doc,
          tr.mapping.map($from.pos),
          1,
          deflt ? [{ type: deflt }] : undefined
        )
      ) {
        if (deflt) types = [{ type: deflt }];
        can = true;
      }
      if (can) {
        tr.split(tr.mapping.map($from.pos), 1, types);
        if (!atEnd && !$from.parentOffset && $from.parent.type != deflt) {
          const first = tr.mapping.map($from.before()),
            $first = tr.doc.resolve(first);
          if (
            deflt &&
            $from
              .node(-1)
              .canReplaceWith($first.index(), $first.index() + 1, deflt)
          )
            tr.setNodeMarkup(tr.mapping.map($from.before()), deflt);
        }
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/// Build a command that splits a non-empty textblock at the top level
/// of a list item by also splitting that list item.
export function splitListItemBis(
  itemType: NodeType,
  itemAttrs?: Attrs
): Command {
  return function (state: EditorState, dispatch?: (tr: Transaction) => void) {
    console.log('splitListItemBis');
    const { $from, $to, node } = state.selection as NodeSelection;
    if ((node && node.isBlock) || $from.depth < 2 || !$from.sameParent($to))
      return false;
    const grandParent = $from.node(-1);
    if (grandParent.type != itemType) return false;
    if (
      $from.parent.content.size == 0 &&
      $from.node(-1).childCount == $from.indexAfter(-1)
    ) {
      // In an empty block. If this is a nested list, the wrapping
      // list item should be split. Otherwise, bail out and let next
      // command handle lifting.
      if (
        $from.depth == 3 ||
        $from.node(-3).type != itemType ||
        $from.index(-2) != $from.node(-2).childCount - 1
      ) {
        console.log('return false');
        return false;
      }
      if (dispatch) {
        console.log('dispatch');
        let wrap = Fragment.empty;
        const depthBefore = $from.index(-1) ? 1 : $from.index(-2) ? 2 : 3;
        // Build a fragment containing empty versions of the structure
        // from the outer list item to the parent node of the cursor
        for (let d = $from.depth - depthBefore; d >= $from.depth - 3; d--)
          wrap = Fragment.from($from.node(d).copy(wrap));
        const depthAfter =
          $from.indexAfter(-1) < $from.node(-2).childCount
            ? 1
            : $from.indexAfter(-2) < $from.node(-3).childCount
            ? 2
            : 3;
        // Add a second list item with an empty default start node
        wrap = wrap.append(Fragment.from(itemType.createAndFill()));
        const start = $from.before($from.depth - (depthBefore - 1));
        const tr = state.tr.replace(
          start,
          $from.after(-depthAfter),
          new Slice(wrap, 4 - depthBefore, 0)
        );
        let sel = -1;
        tr.doc.nodesBetween(start, tr.doc.content.size, (node, pos) => {
          if (sel > -1) return false;
          if (node.isTextblock && node.content.size == 0) sel = pos + 1;
        });
        if (sel > -1)
          dispatch(
            tr.setSelection(NodeSelection.create(tr.doc, sel)).scrollIntoView()
          );
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    const nextType =
      $to.pos == $from.end() ? grandParent.contentMatchAt(0).defaultType : null;
    console.log(nextType);
    const tr = state.tr.delete($from.pos, $to.pos);
    const types = nextType
      ? [
          itemAttrs ? { type: itemType, attrs: itemAttrs } : null,
          { type: nextType },
        ]
      : undefined;
    if (!canSplit(tr.doc, $from.pos, 2, types)) return false;
    if (dispatch) dispatch(tr.split($from.pos, 2, types).scrollIntoView());
    return true;
  };
}

/// If a block node is selected, create an empty paragraph before (if
/// it is its parent's first child) or after it.
export const createParagraphNearBis: Command = (state, dispatch) => {
  const sel = state.selection,
    { $from, $to } = sel;
  console.log('createParagraphNearBis');
  if (
    sel instanceof AllSelection ||
    $from.parent.inlineContent ||
    $to.parent.inlineContent
  ) {
    console.log('return false');
    return false;
  }
  const type = defaultBlockAt($to.parent.contentMatchAt($to.indexAfter()));
  if (!type || !type.isTextblock) return false;
  if (dispatch) {
    const side = (
      !$from.parentOffset && $to.index() < $to.parent.childCount ? $from : $to
    ).pos;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tr = state.tr.insert(side, type.createAndFill()!);
    tr.setSelection(TextSelection.create(tr.doc, side + 1));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/// A basic keymap containing bindings not specific to any schema.
/// Binds the following keys (when multiple commands are listed, they
/// are chained with [`chainCommands`](#commands.chainCommands)):
///
/// * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
/// * **Mod-Enter** to `exitCode`
/// * **Backspace** and **Mod-Backspace** to `deleteSelection`, `joinBackward`, `selectNodeBackward`
/// * **Delete** and **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
/// * **Mod-Delete** to `deleteSelection`, `joinForward`, `selectNodeForward`
/// * **Mod-a** to `selectAll`
export const pcBaseKeymap: Keymap = (schema, options) => ({
  'Mod-z': undo,
  'Mod-Z': undo,
  'Mod-y': redo,
  'Mod-Y': redo,
  'Mod-b': toggleMarkAddFirst(schema.marks['strong']),
  'Mod-B': toggleMarkAddFirst(schema.marks['strong']),
  'Mod-i': toggleMarkAddFirst(schema.marks['em']),
  'Mod-I': toggleMarkAddFirst(schema.marks['em']),
  'Mod-u': toggleMarkAddFirst(schema.marks['underline']),
  'Mod-U': toggleMarkAddFirst(schema.marks['underline']),
  Enter: chainCommands(
    splitListItemBis(schema.nodes.list_item),
    newlineInCode,
    createParagraphNearBis,
    liftEmptyBlockChecked,
    splitBlockAsBis(),
    insertHardBreak
  ),
  'Shift-Enter': chainCommands(exitCode, insertHardBreak),
  'Mod-Enter': exitCode,
  Backspace: getBackspaceCommand(options),
  'Mod-Backspace': getBackspaceCommand(options),
  'Shift-Backspace': getBackspaceCommand(options),
  Delete: del,
  'Mod-Delete': del,
  'Mod-a': selectAll,
  Tab: sinkListItem(schema.nodes.list_item),
  'Shift-Tab': liftListItem(schema.nodes.list_item),
});

/// A copy of `pcBaseKeymap` that also binds **Ctrl-h** like Backspace,
/// **Ctrl-d** like Delete, **Alt-Backspace** like Ctrl-Backspace, and
/// **Ctrl-Alt-Backspace**, **Alt-Delete**, and **Alt-d** like
/// Ctrl-Delete.
export const macBaseKeymap: Keymap = (schema, options) => {
  const pcmap = pcBaseKeymap(schema, options);
  return {
    ...pcmap,
    'Ctrl-h': pcmap['Backspace'],
    'Alt-Backspace': pcmap['Mod-Backspace'],
    'Ctrl-d': pcmap['Delete'],
    'Ctrl-Alt-Backspace': pcmap['Mod-Delete'],
    'Alt-Delete': pcmap['Mod-Delete'],
    'Alt-d': pcmap['Mod-Delete'],
    'Ctrl-a': selectTextblockStart,
    'Ctrl-e': selectTextblockEnd,
  };
};

declare const os: { platform?(): string } | undefined;
let mac: boolean;
if (typeof navigator !== 'undefined') {
  mac = /Mac|iP(hone|[oa]d)/.test(navigator.platform);
} else {
  if (typeof os !== 'undefined' && os.platform) {
    mac = os.platform() === 'darwin';
  } else {
    mac = false;
  }
}
export const baseKeymap: Keymap = mac ? macBaseKeymap : pcBaseKeymap;
