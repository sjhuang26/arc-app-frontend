/*
TODO: badge, dropdown, and search
*/
import {
    container,
    Widget,
    FunctionalWidget,
    ObservableState,
    onMount
} from '../core/shared';

export function SpinnerWidget(
    isLoaded: ObservableState<boolean>,
    child: JQuery
): Widget {
    isLoaded.change.listen(() => {
        if (isLoaded.val) {
            spinner.hide();
            child.show();
        } else {
            spinner.show();
            child.hide();
        }
    });

    const spinner = container('<div></div>')(
        $('<strong>Loading...</strong>'),
        $('<div class="spinner-border"></div>')
    );

    return FunctionalWidget(container('<div></div>')(spinner, child));
}

export function ButtonWidget(
    text: string,
    onClick: () => void,
    variant: string = 'primary'
): Widget {
    // to create an outline button, add "outline" to the variant
    if (variant === 'outline') variant = 'outline-primary';
    return FunctionalWidget(
        $('<button></button>')
            .text(text)
            .addClass('btn btn-' + variant)
            .click(onClick)
    );
}

/*export type NavValue = {
    key: any;
    name: string;
    children?: NavLeaf[];
};
export type NavLeaf = {
    key: any;
    name: string;
};
export function PillsWidget(
    state: ObservableState<any>,
    values: NavValue[]
): Widget {
    state.change.listen(() => {
        dom.children()
            .find('a')
            .removeClass('active');
        dom.children()
            .eq(state.val)
            .find('a')
            .addClass('active');
    });

    function NavItemWidget(value: NavValue): Widget {
        if (value.children) {
            const dropdown = $(
                '<a class="nav-link dropdown-toggle data-toggle="dropdown"></a>'
            ).text(value.name);
            onMount.listen(() => dropdown.dropdown());

            return FunctionalWidget(
                container('<li class="nav-item dropdown"></li>')(
                    dropdown,
                    container('<div class="dropdown-menu"></div>')(
                        ...value.children.map(leaf =>
                            $('<a class="dropdown-item"></a>')
                                .text(leaf.name)
                                .click(() => {
                                    state.val = leaf.key;
                                    state.change.trigger();
                                })
                        )
                    )
                )
            );
        } else {
            return FunctionalWidget(
                container('<li class="nav-item"></li>')(
                    $('<a class="nav-link"></a>').text(value.name)
                ).click(() => {
                    state.val = value.key;
                    state.change.trigger();
                })
            );
        }
    }

    const dom = container('<ul class="nav nav-pills"></ul>')(
        values.map(value => NavItemWidget(value).dom)
    );
    return { dom };
}*/

export function FormItemWidget(type: string): Widget {
    if (type == 'search') {
        return FunctionalWidget(
            $('<input class="form-control" type="search">')
        );
    }
    if (type == 'submit') {
        return FunctionalWidget(
            $(
                '<button class="btn btn-outline-success type="submit">Search</button>'
            )
        );
    }
    throw new Error('unknown form item widget type');
}
export function SearchItemWidget(onSubmit: () => void): Widget {
    return FunctionalWidget(
        $('<form class="form-inline"></form>')
            .append(FormItemWidget('search').dom)
            .append(FormItemWidget('submit').dom)
            .submit(ev => {
                ev.preventDefault();
                onSubmit.call(null);
            })
    );
}
