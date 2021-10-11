import {module, test} from "qunit";
import {vdom} from "@lblod/ember-rdfa-editor/util/xml-utils";
import ModelRange from "@lblod/ember-rdfa-editor/core/model/model-range";
import ModelTestContext from "dummy/tests/utilities/model-test-context";
import ModelPosition from "@lblod/ember-rdfa-editor/core/model/model-position";
import {CORE_OWNER, NON_BREAKING_SPACE, SPACE} from "@lblod/ember-rdfa-editor/util/constants";
import InsertTextCommand from "typing-plugin/commands/insert-text-command";

module("Unit | commands | insert-text-command-test", hooks => {
  const ctx = new ModelTestContext();
  let command: InsertTextCommand;
  hooks.beforeEach(() => {
    ctx.reset();
    command = new InsertTextCommand(ctx.model);
  });


  test("inserts character into textnode", assert => {
    // language=XML
    const {root: initial, elements: {parent}} = vdom`
      <modelRoot>
        <div __id="parent">
          <text>abde</text>
        </div>
      </modelRoot>
    `;

    // language=XML
    const {root: expected} = vdom`
      <modelRoot>
        <div>
          <text>abcde</text>
        </div>
      </modelRoot>
    `;

    ctx.model.fillRoot(initial);
    const range = ModelRange.fromInElement(parent, 2, 2);
    command.execute(CORE_OWNER, "c", range);
    assert.true(ctx.model.rootModelNode.sameAs(expected));
  });
  test("overwrites complex range", assert => {
    // language=XML
    const {root: initial, textNodes: {rangeStart, rangeEnd}} = vdom`
      <modelRoot>
        <div>
          <text __id="rangeStart">abcd</text>
        </div>
        <div>
          <text>efgh</text>
          <div>
            <text __id="rangeEnd">ijkl</text>
          </div>
        </div>
      </modelRoot>
    `;

    // language=XML
    const {root: expected} = vdom`
      <modelRoot>
        <div>
          <text>abc</text>
        </div>
        <div>
          <div>
            <text>kl</text>
          </div>
        </div>
      </modelRoot>
    `;

    ctx.model.fillRoot(initial);
    const start = ModelPosition.fromInTextNode(rangeStart, 2);
    const end = ModelPosition.fromInTextNode(rangeEnd, 2);
    const range = new ModelRange(start, end);

    command.execute(CORE_OWNER, "c", range);
    assert.true(ctx.model.rootModelNode.sameAs(expected));
  });
  test("replaces spaces with nbsp when needed", assert => {
    // language=XML
    const {root: initial, elements: {parent}} = vdom`
      <modelRoot>
        <div __id="parent">
          <text>abcd${SPACE}</text>
        </div>
      </modelRoot>
    `;

    // language=XML
    const {root: expected} = vdom`
      <modelRoot>
        <div>
          <text>abcd${NON_BREAKING_SPACE}${SPACE}</text>
        </div>
      </modelRoot>
    `;

    ctx.model.fillRoot(initial);
    const range = ModelRange.fromInElement(parent, 5, 5);
    command.execute(CORE_OWNER, SPACE, range);
    assert.true(ctx.model.rootModelNode.sameAs(expected));
  });
  test("space does not eat the character before it", assert => {
    // language=XML
    const {root: initial, textNodes: {selectionFocus}} = vdom`
      <modelRoot>
        <h1>
          <text>Notulen van de/het</text>
          <span>
            <text __id="selectionFocus">Gemeenteraad Laarne</text>
          </span>
        </h1>
      </modelRoot>
    `;

    // language=XML
    const {root: expected} = vdom`
      <modelRoot>
        <h1>
          <text>Notulen van de/het</text>
          <span>
            <text __id="selectionFocus">G emeenteraad Laarne</text>
          </span>
        </h1>
      </modelRoot>
    `;
    ctx.model.fillRoot(initial);
    const range = ModelRange.fromInTextNode(selectionFocus, 1, 1);
    command.execute(CORE_OWNER, SPACE, range);
    const rslt = ctx.model.rootModelNode.sameAs(expected);
    if (!rslt) {
      console.log("space does not eat the character before it: ACTUAL:", ctx.model.toXml());
    }
    assert.true(rslt);
  });
});
