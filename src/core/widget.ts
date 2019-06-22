import { container, state, Widget } from './shared';
import { SpinnerWidget, ButtonWidget } from '../widgets/ui';

const pillsString = `
<ul class="nav nav-pills">
  <li class="nav-item">
    <a class="nav-link">Active</a>
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
        function changePage(newPageKey: string) {
            state.page.changeTo(newPageKey);
            console.log('change page', newPageKey);
        }
        const dom = $(pillsString);
        dom.find('a')
            .css('cursor', 'pointer')
            .click(ev => {
                const text = $(ev.target).text();
                if (text == 'Active') changePage('a');
                if (text == 'Action') changePage('b');
                if (text == 'Another action') changePage('c');
                if (text == 'Link') changePage('d');
                ev.preventDefault();
            });

        return { dom };
    }

    setTimeout(() => state.testLoad.changeTo(true), 1000);

    const dom = container('<div class="container-fluid"></div>')(
        container('<nav class="navbar navbar-light bg-light">')(
            PillsWidget().dom
        ),
        container('<div class="row"></div>')(
            container('<div class="col"></div>')()
        ),
        SpinnerWidget(
            state.testLoad,
            ButtonWidget(
                'Clicky clicky!',
                () => console.log('Hi!'),
                'outline-danger'
            ).dom
        ).dom
    );
    return { dom };
}
