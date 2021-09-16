import {createLogger, Logger} from "@lblod/ember-rdfa-editor/utils/logging-utils";
import {debouncedAdjustable} from "@lblod/ember-rdfa-editor/utils/debounce";

export abstract class EditorEvent<P> {
  abstract _name: EditorEventName;

  protected constructor(private _payload: P) {
  }

  get payload(): P {
    return this._payload;
  }

  get name(): EditorEventName {
    return this._name;
  }
}

export abstract class VoidEvent extends EditorEvent<void> {
  constructor() {
    super(undefined);
  }
}

export class DummyEvent extends VoidEvent {
  _name: EditorEventName = "dummy";
}

export class ContentChangedEvent extends VoidEvent {
  _name: EditorEventName = "contentChanged";
}

export class SelectionChangedEvent extends VoidEvent {
  _name: EditorEventName = "selectionChanged";
}

export class ModelWrittenEvent extends VoidEvent {
  _name: EditorEventName = "modelWritten";
}

export type EDITOR_EVENT_MAP = {
  "dummy": DummyEvent,
  "contentChanged": ContentChangedEvent,
  "modelWritten": ModelWrittenEvent,
  "selectionChanged": SelectionChangedEvent
};
export type EditorEventName = keyof EDITOR_EVENT_MAP;

export type EditorEventListener<E extends EditorEventName> = (event: EDITOR_EVENT_MAP[E]) => void;

export type EventEmitter<E extends EditorEventName> = (event: EDITOR_EVENT_MAP[E]) => void;

export type DebouncedEmitter<E extends EditorEventName> = (delayMs: number, event: EDITOR_EVENT_MAP[E]) => void;

export default class EventBus {
  static instance: EventBus;

  private static getInstance() {
    if (!this.instance) {
      this.instance = new EventBus();
    }
    return this.instance;
  }

  static on<E extends EditorEventName>(eventName: E, callback: EditorEventListener<E>): void {
    this.getInstance().on(eventName, callback);
  }

  static off<E extends EditorEventName>(eventName: E, callback: EditorEventListener<E>): void {
    this.getInstance().off(eventName, callback);
  }

  static emit<E extends EditorEventName>(event: EDITOR_EVENT_MAP[E]): void {
    this.getInstance().emit(event);
  }

  static emitDebounced<E extends EditorEventName>(delayMs: number, event: EDITOR_EVENT_MAP[E]): void {
    this.getInstance().emitDebounced(delayMs, event);
  }

  private listeners: Map<EditorEventName, Array<EditorEventListener<EditorEventName>>> = new Map<EditorEventName, Array<EditorEventListener<EditorEventName>>>();
  private logger: Logger = createLogger("EventBus");
  private debouncedEmitters: Map<EditorEventName, DebouncedEmitter<EditorEventName>> = new Map();

  private on<E extends EditorEventName>(eventName: E, callback: EditorEventListener<E>): void {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.push(callback);
    } else {
      this.listeners.set(eventName, [callback]);
    }
  }

  private off<E extends EditorEventName>(eventName: E, callback: EditorEventListener<E>): void {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index !== -1) {
        eventListeners.splice(index, 1);
      }
    }

  }

  private emit = <E extends EditorEventName>(event: EDITOR_EVENT_MAP[E]): void => {
    const eventListeners = this.listeners.get(event.name);

    console.log(`Emitting event: ${event.name} with payload:`, event.payload);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(event));
    }
  };

  private emitDebounced = <E extends EditorEventName>(delayMs: number, event: EDITOR_EVENT_MAP[E]): void => {

    const emitter = this.debouncedEmitters.get(event.name);
    if (emitter) {
      emitter(delayMs, event);
    } else {
      const emitter = debouncedAdjustable(this.emit);
      this.debouncedEmitters.set(event.name, emitter);
      emitter(delayMs, event);
    }

  };
}
