import {
    container,
    state,
    Widget,
    tutors,
    learners,
    requests,
    requestSubmissions,
    matchings,
    bookings
} from './shared';
import { ButtonWidget, showSimpleModal } from '../widgets/ui';
import { TilingWindowManagerWidget } from '../widgets/TilingWindowManager';
import { WindowsBarWidget } from '../widgets/WindowsBar';

const pillsString = `
<ul class="nav nav-pills">
    <li class="nav-item">
        <a class="nav-link">Tutors</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Learners</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Requests</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Request submissions</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Bookings</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Matchings</a>
    </li>
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Other</a>
        <div class="dropdown-menu">
            <a class="dropdown-item">About</a>
            <a class="dropdown-item">Force refresh</a>
        </div>
    </li>
</ul>`;

export function rootWidget(): Widget {
    function PillsWidget(): Widget {
        const dom = $(pillsString);
        dom.find('a')
            .css('cursor', 'pointer')
            .click(ev => {
                const text = $(ev.target).text();
                if (text == 'Tutors') tutors.makeTiledViewAllWindow();
                if (text == 'Learners') learners.makeTiledViewAllWindow();
                if (text == 'Bookings') bookings.makeTiledViewAllWindow();
                if (text == 'Matchings') matchings.makeTiledViewAllWindow();
                if (text == 'Request submissions')
                    requestSubmissions.makeTiledViewAllWindow();
                if (text == 'Requests') requests.makeTiledViewAllWindow();
                ev.preventDefault();
                if (text == 'About')
                    showSimpleModal('About', 'Made by Suhao Jeffrey Huang');
                if (text == 'Force refresh') {
                    tutors.state.forceRefresh();
                    learners.state.forceRefresh();
                    bookings.state.forceRefresh();
                    matchings.state.forceRefresh();
                    requests.state.forceRefresh();
                    requestSubmissions.state.forceRefresh();
                    for (const window of state.tiledWindows.val) {
                        window.onLoad.trigger();
                    }
                }
            });

        return { dom };
    }

    const dom = container('<div id="app" class="layout-v"></div>')(
        container('<nav class="navbar layout-item-fit">')(PillsWidget().dom),
        container('<nav class="navbar layout-item-fit layout-v"></div>')(
            WindowsBarWidget().dom
        ),
        container('<div class="layout-item-scroll"></div>')(
            TilingWindowManagerWidget().dom
        )
    );
    return { dom };
}
