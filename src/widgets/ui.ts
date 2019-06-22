/*
TODO: badge, dropdown, and search
*/
import {
    container,
    Widget,
    FunctionalWidget,
    ObservableState
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

export type FormValueWidget = Widget & {
    getValue(): any;
};

export function FormStringInputWidget(type: string): FormValueWidget {
    const dom = $(`<input type="text" class="form-control" type="${type}">`);
    return {
        dom,
        getValue(): string {
            return String(dom.val());
        }
    };
}

export function FormNumberInputWidget(type: string): FormValueWidget {
    const dom = $(`<input type="text" class="form-control" type="${type}">`);
    return {
        dom,
        getValue(): number {
            if (type == 'datetime-local')
                return new Date(String(dom.val())).getTime();
            return Number(dom.val());
        }
    };
}

export function FormSubmitWidget(text: string): Widget {
    return FunctionalWidget(
        $(
            '<button class="btn btn-outline-success type="submit"></button>'
        ).text(text)
    );
}
export function FormSelectWidget(options: string[]): FormValueWidget {
    const dom = container('<select class="form-control"></select>')(
        options.map(o => container('<option></option>')(o))
    );
    return {
        dom,
        getValue(): string {
            return dom.val() as string;
        }
    };
}
export function SearchItemWidget(onSubmit: () => void): Widget {
    return FunctionalWidget(
        $('<form class="form-inline"></form>')
            .append(FormStringInputWidget('search').dom)
            .append(FormSubmitWidget('Search').dom)
            .submit(ev => {
                ev.preventDefault();
                onSubmit.call(null);
            })
    );
}
