import {
    container,
    DomWidget,
    hideWindow,
    removeWindow,
    addWindow,
    Widget,
    state,
    Event
} from '../core/shared';
import { ButtonWidget } from './ui';

// Generates keys which are used for IDs.

class KeyMaker {
    private nextKey: number = 0;
    makeKey(): number {
        const result = this.nextKey;
        this.nextKey += 1;
        return result;
    }
}

const windowKeyMaker = new KeyMaker();

// Assume that all windows are tiled. So all WindowWidgets will be made from makeTiledWindow().

function WindowWidget(content: JQuery, actionBarContent: JQuery): Widget {
    return DomWidget(
        container('<div class="card"></div>')(
            container('<header class="card-header"></header>')(
                $('<p class="card-header-title">ASDF</p>'),
                actionBarContent
            ),
            container('<div class="card-content"></div>')(
                container('<div class="content">')(content)
            )
        )
    );
}

export function useTiledWindow(
    content: JQuery,
    actionBarContent: JQuery,
    title: string,
    onLoad: Event = new Event()
): {
    minimizeWindow: () => void;
    closeWindow: () => void;
    windowWidget: Widget;
    onLoad: Event;
} {
    const key = windowKeyMaker.makeKey();
    const windowWidget = WindowWidget(content, actionBarContent);
    addWindow(windowWidget, key, title, onLoad);
    return {
        windowWidget,
        minimizeWindow: () => hideWindow(key),
        closeWindow: () => removeWindow(key),
        onLoad
    };
}
