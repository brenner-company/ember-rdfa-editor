import Model from "@lblod/ember-rdfa-editor/model/model";
import ModelNode from "@lblod/ember-rdfa-editor/model/model-node";
import ModelSelection from "@lblod/ember-rdfa-editor/model/model-selection";
import Command from "@lblod/ember-rdfa-editor/commands/command";
import HtmlReader from "@lblod/ember-rdfa-editor/model/readers/html-reader";

export default class InsertHtmlCommand extends Command {
  name = "insert-html";

  constructor(model: Model) {
    super(model);
  }

  execute(htmlString: string, selection: ModelSelection = this.model.selection) {
    const range = selection.lastRange;
    if (!range) {
      return;
    }
    const parser = new DOMParser();
    const html = parser.parseFromString(htmlString, "text/html");
    const bodyContent = html.body.childNodes;
    const reader = new HtmlReader(this.model);
    this.model.change(mutator => {
      // dom NodeList doesnt have a map method
      const modelNodes: ModelNode[] = [];
      bodyContent.forEach(node => modelNodes.push(reader.read(node)));
      mutator.insertNodes(range, ...modelNodes);
    });
  }
}