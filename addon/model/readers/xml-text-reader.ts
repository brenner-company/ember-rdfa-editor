import Reader from '@lblod/ember-rdfa-editor/model/readers/reader';
import ModelText from '@lblod/ember-rdfa-editor/model/model-text';
import { XmlNodeRegistry } from '@lblod/ember-rdfa-editor/model/readers/xml-reader';
import { compatTextAttributeMap } from '@lblod/ember-rdfa-editor/model/util/constants';
import { Mark } from '@lblod/ember-rdfa-editor/model/mark';
import { TextAttribute } from '@lblod/ember-rdfa-editor/commands/text-properties/set-text-property-command';

export default class XmlTextReader implements Reader<Element, ModelText, void> {
  constructor(private registry: XmlNodeRegistry<ModelText>) {}

  read(from: Element): ModelText {
    const rslt = new ModelText(from.textContent || '');
    for (const attribute of from.attributes) {
      if (attribute.name === '__id') {
        this.registry[attribute.value] = rslt;
      } else if (attribute.name === '__marks') {
        const markNames = attribute.value.split(',');
        for (const markName of markNames) {
          const specAttribute = compatTextAttributeMap.get(
            markName as TextAttribute
          );
          if (specAttribute) {
            console.warn('ADDING MARK WITHOUT PASSING REGISTRY');
            rslt.addMark(
              new Mark(specAttribute.spec, specAttribute.attributes, rslt)
            );
          }
        }
      } else {
        rslt.setAttribute(attribute.name, attribute.value);
      }
    }
    return rslt;
  }
}
