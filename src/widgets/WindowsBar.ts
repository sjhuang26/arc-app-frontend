import {
    Widget,
    state,
    hideWindow,
    showWindow,
    DomWidget,
    container,
    removeWindow
} from '../core/shared';
import { ButtonWidget } from './ui';

export function WindowsBarWidget(): Widget {
    const s = state.tiledWindows;
    const dom = $('<div></div>');
    function makeButton({ key, title, visible }): JQuery {
        const closeButton = ButtonWidget(
            '(X)',
            () => removeWindow(key),
            visible ? 'outline-primary' : 'outline-secondary'
        ).dom;
        const mainButton = ButtonWidget(
            container(
                '<span style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;"></span>'
            )('Window: ' + title, closeButton),
            () => (visible ? hideWindow(key) : showWindow(key)),
            visible ? 'primary' : 'outline-secondary'
        ).dom;

        return container('<div class="btn-group d-inline-block mr-3"></div>')(
            mainButton,
            closeButton
        );
    }
    s.change.listen(() => {
        dom.empty();
        dom.append(s.val.map(makeButton));
    });
    return DomWidget(dom);
}
