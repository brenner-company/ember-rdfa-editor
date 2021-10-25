import Application from '@ember/application';
import { EditorPlugin } from '@lblod/ember-rdfa-editor/core/editor-plugin';
import SayCodexCitationPlugin from 'say-codex-citation-plugin/say-codex-citation-plugin';

function pluginFactory(plugin: new () => EditorPlugin): { create: (initializers: unknown) => EditorPlugin } {
  const pluginInstance = new plugin();
  return {
    create: (initializers => {
      Object.assign(pluginInstance, initializers);
      return pluginInstance;
    })
  };
}

export function initialize(application: Application): void {
  application.register('plugin:say-codex-citation', pluginFactory(SayCodexCitationPlugin))
}

export default {
  initialize
};
