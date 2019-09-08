import {
    Widget,
    state,
    hideWindow,
    showWindow,
    DomWidget,
    container,
    removeWindow
} from '../core/shared';
import { ButtonWidget, ButtonAddonWidget, ButtonGroupWidget } from './ui';

export function WindowsBarWidget(): Widget {
    const s = state.tiledWindows;
    const dom = $('<div></div>');
    function makeButton({ key, title, visible }): JQuery {
        const closeButton = ButtonWidget(
            '(X)',
            () => removeWindow(key),
            visible ? 'is-outlined is-primary' : 'is-outlined is-secondary'
        ).dom;
        const mainButton = ButtonWidget(
            container(
                '<span style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;"></span>'
            )('Window: ' + title, closeButton),
            () => (visible ? hideWindow(key) : showWindow(key)),
            visible ? 'is-primary' : 'is-outlined is-secondary'
        ).dom;

        return ButtonAddonWidget(mainButton, closeButton).dom;
    }
    s.change.listen(() => {
        dom.empty();
        dom.append(ButtonGroupWidget(...s.val.map(makeButton)).dom);
    });
    return DomWidget(dom);
}
