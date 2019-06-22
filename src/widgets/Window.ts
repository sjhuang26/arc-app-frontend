import { container } from '../core/shared';
import { ButtonWidget } from './ui';

export function WindowWidget(
    titleBarContent: JQuery,
    content: JQuery,
    actionBarContent: JQuery,
    minimizeWindow: () => void,
    closeWindow: () => void
) {
    const dom = container('<div class="card"></div>')(
        container('<div class="card-header"></div>')(
            container('<div></div>')(titleBarContent),
            container('<div></div>')(
                ButtonWidget('Minimize', minimizeWindow, 'outline'),
                ButtonWidget('Close', closeWindow, 'outline')
            )
        ),
        container('<div class="card-body"></div>')(content),
        container('<div class="card-footer"></div>')(actionBarContent)
    );
    return {
        dom,
        closeWindow() {}
    };
}
