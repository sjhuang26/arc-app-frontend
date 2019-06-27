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
        container('<div class="card m-3"></div>')(
            container('<div class="card-header"></div>')(actionBarContent),
            container('<div class="card-body"></div>')(content)
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
