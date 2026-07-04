import {
  MoveMouseAction,
  TraceMouseAction,
  ClickMouseAction,
  PressMouseAction,
  DragMouseAction,
  ScrollAction,
  TypeKeysAction,
  PressKeysAction,
  TypeTextAction,
  PasteTextAction,
} from '@iagencia/shared';

export interface InputController {
  moveMouse(action: MoveMouseAction): Promise<void>;
  traceMouse(action: TraceMouseAction): Promise<void>;
  clickMouse(action: ClickMouseAction): Promise<void>;
  pressMouse(action: PressMouseAction): Promise<void>;
  dragMouse(action: DragMouseAction): Promise<void>;
  scroll(action: ScrollAction): Promise<void>;
  typeKeys(action: TypeKeysAction): Promise<void>;
  pressKeys(action: PressKeysAction): Promise<void>;
  typeText(action: TypeTextAction): Promise<void>;
  pasteText(action: PasteTextAction): Promise<void>;
}
