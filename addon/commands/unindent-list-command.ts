import Command, {
  CommandContext,
} from '@lblod/ember-rdfa-editor/commands/command';
import ModelElement from '@lblod/ember-rdfa-editor/model/model-element';
import ModelNode from '@lblod/ember-rdfa-editor/model/model-node';
import ModelRange from '@lblod/ember-rdfa-editor/model/model-range';
import ModelNodeUtils from '@lblod/ember-rdfa-editor/model/util/model-node-utils';
import ModelRangeUtils from '@lblod/ember-rdfa-editor/model/util/model-range-utils';
import {
  IllegalExecutionStateError,
  MisbehavedSelectionError,
  SelectionError,
  TypeAssertionError,
} from '@lblod/ember-rdfa-editor/utils/errors';
import { logExecute } from '@lblod/ember-rdfa-editor/utils/logging-utils';
import State from '../core/state';
import ModelPosition from '../model/model-position';
declare module '@lblod/ember-rdfa-editor' {
  export interface Commands {
    unindentList: UnindentListCommand;
  }
}
export interface UnindentListCommandArgs {
  range?: ModelRange | null;
}

export default class UnindentListCommand
  implements Command<UnindentListCommandArgs, void>
{
  canExecute(state: State, { range = state.selection.lastRange }): boolean {
    if (!range) {
      return false;
    }
    const predicate = (node: ModelNode) => {
      // Set `includeSelf` to true, because this predicate will be used in `findModelNodes`, where we start
      // searching from the parent of the current node. If we set it to false, the first parent will always be skipped.
      const firstAncestorLi = ModelNodeUtils.findAncestor(
        node,
        ModelNodeUtils.isListElement,
        true
      );
      const secondAncestorLi = ModelNodeUtils.findAncestor(
        firstAncestorLi,
        ModelNodeUtils.isListElement
      );
      return !!firstAncestorLi && !!secondAncestorLi;
    };

    const treeWalker = ModelRangeUtils.findModelNodes(
      range,
      predicate,
      true,
      false
    );
    return !![...treeWalker].length;
  }

  @logExecute
  execute(
    { transaction }: CommandContext,
    {
      range = transaction.workingCopy.selection.lastRange,
    }: UnindentListCommandArgs
  ): void {
    if (!range) {
      throw new MisbehavedSelectionError();
    }
    const cloneRange = transaction.cloneRange(range);

    const treeWalker = ModelRangeUtils.findModelNodes(
      cloneRange,
      ModelNodeUtils.isListElement
    );
    const elements: ModelElement[] = [];

    for (const node of treeWalker) {
      if (!ModelNode.isModelElement(node)) {
        throw new TypeAssertionError('Current node is not an element');
      }

      elements.push(node);
    }

    if (elements.length === 0) {
      throw new SelectionError('The selection is not inside a list');
    }

    // Get the shallowest common ancestors.
    const lisToShift = this.relatedChunks(elements);
    if (lisToShift) {
      // Iterate over all found li elements.
      for (const li of lisToShift) {
        const parent = ModelNodeUtils.findAncestor(
          li,
          ModelNodeUtils.isListContainer
        );
        const grandParent = ModelNodeUtils.findAncestor(
          parent,
          ModelNodeUtils.isListElement
        );
        const greatGrandParent = ModelNodeUtils.findAncestor(
          grandParent,
          ModelNodeUtils.isListContainer
        );

        if (
          li &&
          ModelElement.isModelElement(li) &&
          parent &&
          ModelElement.isModelElement(parent) &&
          grandParent &&
          ModelElement.isModelElement(grandParent) &&
          greatGrandParent &&
          ModelElement.isModelElement(greatGrandParent)
        ) {
          // Remove node.
          const liIndex = li.index;

          if (grandParent.index === null) {
            throw new IllegalExecutionStateError(
              "Couldn't find index of grandparent li"
            );
          }

          if (parent.length === 1) {
            // Remove parent ul/ol if node is only child.
            transaction.deleteNode(li);
            const positionToInsert = ModelPosition.fromInElement(
              greatGrandParent,
              grandParent.index + 1
            );
            transaction.insertAtPosition(positionToInsert, li);
            transaction.deleteNode(parent);
          } else {
            if (liIndex === null) {
              throw new IllegalExecutionStateError(
                "Couldn't find index of current li"
              );
            }
            const split = parent.split(liIndex);

            // Remove empty uls.
            if (split.left.length === 0) {
              transaction.deleteNode(split.left);
            }

            if (split.right.length >= 1) {
              //Select li's AFTER the li that is unindenting
              const otherLis = split.right.children.slice(1);
              //Remove unindenting li and all next ones, they are relocating
              transaction.deleteNode(split.right);

              //Add a new sublist to the li of the elements that previously followed that li as a child element
              const sublist = new ModelElement(parent.type);
              sublist.appendChildren(...otherLis);
              li.addChild(sublist);

              //After the parent li, add the unindenting li (and its sublist at once)
              transaction.insertAtPosition(
                ModelPosition.fromAfterNode(grandParent),
                li
              );
            }
          }
        }
      }
    }
  }

  private relatedChunks(
    elementArray: ModelElement[],
    result: ModelElement[] = []
  ): ModelElement[] {
    // Check if the li is nested.
    elementArray = elementArray.filter((element) =>
      ModelNodeUtils.findAncestor(element, ModelNodeUtils.isListElement)
    );

    // Sort array, by depth, shallowest first.
    elementArray = elementArray.sort((a, b) => {
      return b.getOffsetPath().length - a.getOffsetPath().length;
    });

    // Use shallowest as base.
    const base = elementArray[0];
    result.push(base);

    // Compare all paths to see if base is parent. Remove those that are related.
    // Loop backwards since we are deleting from list during loop.
    for (let i = elementArray.length - 1; i >= 0; i--) {
      if (UnindentListCommand.areRelated(base, elementArray[i])) {
        elementArray.splice(i, 1);
      }
    }

    if (elementArray.length === 0) {
      // If empty, return result with the elements that need to be shifted.
      return result;
    } else {
      // Otherwise some hot recursive action.
      this.relatedChunks(elementArray, result);
    }

    return result;
  }

  private static areRelated(
    base: ModelElement,
    compare: ModelElement
  ): boolean {
    const basePath = base.getOffsetPath();
    const comparePath = compare.getOffsetPath();

    for (let i = 0; i < basePath.length; i++) {
      if (basePath[i] !== comparePath[i]) {
        return false;
      }
    }

    return true;
  }
}
