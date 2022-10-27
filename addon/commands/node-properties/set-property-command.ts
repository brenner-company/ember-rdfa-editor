import Command, {
  CommandContext,
} from '@lblod/ember-rdfa-editor/commands/command';
import ModelElement from '@lblod/ember-rdfa-editor/core/model/nodes/model-element';
import { logExecute } from '@lblod/ember-rdfa-editor/utils/logging-utils';
import { modelPosToSimplePos } from '@lblod/ember-rdfa-editor/core/model/simple-position';
import ModelPosition from '@lblod/ember-rdfa-editor/core/model/model-position';

declare module '@lblod/ember-rdfa-editor' {
  export interface Commands {
    setProperty: SetPropertyCommand;
  }
}

export interface SetPropertyCommandArgs {
  property: string;
  value: string;
  element: ModelElement;
}

export default class SetPropertyCommand
  implements Command<SetPropertyCommandArgs, void>
{
  canExecute(): boolean {
    return true;
  }

  @logExecute
  execute(
    { transaction }: CommandContext,
    { property, value, element }: SetPropertyCommandArgs
  ) {
    const elementInLatestState = transaction.inWorkingCopy(element);
    transaction.setProperty(
      modelPosToSimplePos(
        ModelPosition.fromBeforeNode(
          transaction.apply().document,
          elementInLatestState
        )
      ),
      property,
      value
    );
  }
}
