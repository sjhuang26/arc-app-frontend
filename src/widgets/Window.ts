import {
    container,
    DomWidget,
    KeyMaker,
    hideWindow,
    removeWindow,
    addWindow,
    Widget
} from '../core/shared';
import { ButtonWidget } from './ui';

const windowKeyMaker = new KeyMaker();

// Assume that all windows are tiled. So all WindowWidgets will be made from makeTiledWindow().

function WindowWidget(
    titleBarContent: JQuery,
    content: JQuery,
    actionBarContent: JQuery,
    minimizeWindow: () => void,
    closeWindow: () => void
): Widget {
    return DomWidget(
        container('<div class="card"></div>')(
            container('<div class="card-header"></div>')(
                container('<div></div>')(titleBarContent),
                container('<div></div>')(
                    ButtonWidget('Minimize', minimizeWindow, 'outline'),
                    ButtonWidget('Close', closeWindow, 'outline')
                )
            ),
            container('<div class="card-body"></div>')(content),
            container('<div class="card-footer"></div>')(actionBarContent)
        )
    );
}

export function useTiledWindow(
    titleBarContent: JQuery,
    content: JQuery,
    actionBarContent: JQuery,
    title: string
): {
    minimizeWindow: () => void;
    closeWindow: () => void;
    windowWidget: Widget;
} {
    const key = windowKeyMaker.makeKey();
    const windowWidget = WindowWidget(
        titleBarContent,
        content,
        actionBarContent,
        () => hideWindow(key),
        () => removeWindow(key)
    );
    addWindow(windowWidget, key, title);
    return {
        windowWidget,
        minimizeWindow: () => removeWindow(key),
        closeWindow: () => hideWindow(key)
    };
}
