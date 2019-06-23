/*
TODO: badge, dropdown, and search
*/
import { container, Widget, DomWidget, ObservableState } from '../core/shared';
import { AskStatus } from '../core/server';

export function LoaderWidget() {
    const spinner = container('<div></div>')(
        $('<strong>Loading...</strong>'),
        $('<div class="spinner-border"></div>')
    );
    const dom = container('<div></div>')(spinner);
    const onLoaded = (child: JQuery) => {
        dom.append(child);
    };
    const onError = (message: string) => {
        const errorMessageDom = container(
            '<div class="alert alert-danger"></div>'
        )(container('<h1></h1>')('Error'), container('<span></span>')(message));
        dom.empty();
        dom.append(errorMessageDom);
    };

    return {
        dom,
        onLoaded,
        onError
    };
}

export function ButtonWidget(
    text: string,
    onClick: () => void,
    variant: string = 'primary'
): Widget {
    // to create an outline button, add "outline" to the variant
    if (variant === 'outline') variant = 'outline-primary';
    return DomWidget(
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

            return DomWidget(
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
            return DomWidget(
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
    const dom = $(`<input class="form-control" type="${type}">`);
    return {
        dom,
        getValue(): string {
            return String(dom.val());
        }
    };
}

export function FormNumberInputWidget(type: string): FormValueWidget {
    const dom = $(`<input class="form-control" type="${type}">`);
    return {
        dom,
        getValue(): number {
            if (type == 'datetime-local')
                return new Date(String(dom.val())).getTime();
            return Number(dom.val());
        }
    };
}

export function StringField(type: string) {
    return () => FormStringInputWidget(type);
}
export function NumberField(type: string) {
    return () => FormNumberInputWidget(type);
}
export function SelectField(options: string[], optionTitles: string[]) {
    return () => FormSelectWidget(options, optionTitles);
}
export type FieldType = () => FormValueWidget;

export function FormSubmitWidget(text: string): Widget {
    return DomWidget(
        $(
            '<button class="btn btn-outline-success type="submit"></button>'
        ).text(text)
    );
}
export function FormSelectWidget(
    options: string[],
    optionTitles: string[]
): FormValueWidget {
    const dom = container('<select class="form-control"></select>')(
        options.map((o, i) =>
            container('<option></option>')(o).val(optionTitles[i])
        )
    );
    return {
        dom,
        getValue(): string {
            return dom.val() as string;
        }
    };
}
export function SearchItemWidget(onSubmit: () => void): Widget {
    return DomWidget(
        $('<form class="form-inline"></form>')
            .append(FormStringInputWidget('search').dom)
            .append(FormSubmitWidget('Search').dom)
            .submit(ev => {
                ev.preventDefault();
                onSubmit.call(null);
            })
    );
}
