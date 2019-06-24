import { container, state, Widget, tutors } from './shared';
import { LoaderWidget, ButtonWidget } from '../widgets/ui';
import { TilingWindowManagerWidget } from '../widgets/TilingWindowManager';
import { WindowsBarWidget } from '../widgets/WindowsBar';

const pillsString = `
<ul class="nav nav-pills">
    <li class="nav-item">
        <a class="nav-link">View first tutor</a>
    </li>
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Dropdown</a>
        <div class="dropdown-menu">
            <a class="dropdown-item">Action</a>
            <a class="dropdown-item">Another action</a>
        </div>
    </li>
    <li class="nav-item">
        <a class="nav-link">Link</a>
    </li>
</ul>`;

export function rootWidget(): Widget {
    function PillsWidget(): Widget {
        const dom = $(pillsString);
        dom.find('a')
            .css('cursor', 'pointer')
            .click(ev => {
                const text = $(ev.target).text();
                if (text == 'View first tutor') tutors.makeTiledViewWindow(1);
                ev.preventDefault();
            });

        return { dom };
    }

    const dom = container('<div class="container-fluid"></div>')(
        container('<nav class="navbar navbar-light bg-light">')(
            PillsWidget().dom,
            WindowsBarWidget().dom
        ),
        container('<div class="row"></div>')(
            container('<div class="col"></div>')(
                TilingWindowManagerWidget().dom
            )
        )
    );
    return { dom };
}
