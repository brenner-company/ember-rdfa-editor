import Model from "@lblod/ember-rdfa-editor/model/model";

/**
 * Commands are the only things that are allowed to modify the model.
 * TODO: Currently this restriction is not enforced yet.
 * They need to be registered with {@link RawEditor.registerCommand()} before they
 * can be executed with {@link RawEditor.executeCommand()}.
 */
export default abstract class Command {
  abstract name: string;
  protected model: Model;
  protected constructor(model: Model) {
    this.model = model;
  }
  abstract execute(...args: any[]): void;
}