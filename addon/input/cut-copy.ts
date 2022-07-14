import { Editor } from '../core/editor';
import ModelNode from '../model/model-node';
import GenTreeWalker from '../model/util/gen-tree-walker';
import { toFilterSkipFalse } from '../model/util/model-tree-walker';
import HTMLExportWriter from '../model/writers/html-export-writer';

export default function handleCutCopy(
  editor: Editor,
  event: ClipboardEvent,
  deleteSelection: boolean
) {
  const htmlExportWriter = new HTMLExportWriter();
  const command = deleteSelection ? 'delete-selection' : 'read-selection';
  const selectedNodes = editor.executeCommand(command, {});
  let modelNodes: ModelNode[];
  if (selectedNodes) {
    modelNodes = selectedNodes;
  } else {
    console.warn(
      'Select command did not execute properly. Defaulting to empty node array.'
    );
    modelNodes = [];
  }

  // Filter out model nodes that are text related
  const filter = toFilterSkipFalse<ModelNode>((node) => {
    return (
      ModelNode.isModelText(node) ||
      (ModelNode.isModelElement(node) && node.type === 'br')
    );
  });

  let xmlString = '';
  let htmlString = '';
  let textString = '';
  for (const modelNode of modelNodes) {
    if (ModelNode.isModelElement(modelNode)) {
      modelNode.parent = null;
      const treeWalker = GenTreeWalker.fromSubTree({
        root: modelNode,
        filter,
      });

      for (const node of treeWalker.nodes()) {
        textString += ModelNode.isModelText(node) ? node.content : '\n';
      }
    } else if (ModelNode.isModelText(modelNode)) {
      textString += modelNode.content;
    }

    const node = htmlExportWriter.write(modelNode);
    if (node instanceof HTMLElement) {
      xmlString += node.outerHTML;
      htmlString += node.outerHTML;
    } else {
      if (node.textContent) {
        xmlString += `<text>${node.textContent}</text>`;
        htmlString += node.textContent;
      }
    }
  }

  const clipboardData = event.clipboardData || window.clipboardData;
  clipboardData.setData('text/html', htmlString);
  clipboardData.setData('text/plain', textString);
  clipboardData.setData('application/xml', xmlString);
}