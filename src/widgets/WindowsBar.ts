import {
    Widget,
    state,
    hideWindow,
    showWindow,
    DomWidget
} from '../core/shared';
import { ButtonWidget } from './ui';

export function WindowsBarWidget(): Widget {
    const s = state.tiledWindows;
    const dom = $('<div></div>');
    function makeClickable({ key, title, visible }): JQuery {
        if (visible) {
            return ButtonWidget(title, () => hideWindow(key), 'primary').dom;
        } else {
            return ButtonWidget(title, () => showWindow(key), 'secondary').dom;
        }
    }
    s.change.listen(() => {
        dom.empty();
        dom.append(s.val.map(makeClickable));
    });
    return DomWidget(dom);
}
