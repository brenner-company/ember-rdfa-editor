import SetTextPropertyCommand from '@lblod/ember-rdfa-editor/commands/text-properties/set-text-property-command';
import { logExecute } from '@lblod/ember-rdfa-editor/utils/logging-utils';

export default class MakeStrikethroughCommand extends SetTextPropertyCommand {
  name = 'make-strikethrough';
  @logExecute
  execute() {
    super.setTextProperty('strikethrough', true);
  }
}
