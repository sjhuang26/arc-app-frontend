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
        dom.empty();
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

export type FormValueWidget<T> = Widget & {
    getValue(): any;
    setValue(newVal: T): JQuery;
};

export function FormStringInputWidget(type: string): FormValueWidget<string> {
    const dom = $(`<input class="form-control" type="${type}">`);
    return {
        dom,
        getValue(): string {
            return String(dom.val());
        },
        setValue(newVal: string): JQuery {
            return dom.val(newVal);
        }
    };
}

export function FormNumberInputWidget(type: string): FormValueWidget<number> {
    let dom: JQuery = null;
    if (type === 'number') {
        dom = $(`<input class="form-control" type="number">`);
    }
    if (type === 'datetime-local') {
        dom = $(`<input class="form-control" type="datetime-local">`);
    }
    if (type === 'id') {
        // TODO: create a resource selection dropdown, or at least a name search
        dom = $(`<input class="form-control" type="number">`);
    }
    return {
        dom,
        getValue(): number {
            if (type == 'datetime-local') {
                // a hack to get around Typescript types
                const htmlEl: any = dom.get(0);
                const date = htmlEl.valueAsNumber as number;
                return date ? date : 0;
            }
            return Number(dom.val());
        },
        setValue(val: number): JQuery {
            if (type == 'datetime-local') {
                // a hack to get around Typescript types
                const htmlEl: any = dom.get(0);
                htmlEl.valueAsNumber = val;
                return dom;
            }
            return dom.val(val);
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
export type FormFieldType = () => FormValueWidget<any>;

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
): FormValueWidget<string> {
    const dom = container('<select class="form-control"></select>')(
        options.map((o, i) =>
            container('<option></option>')(o).val(optionTitles[i])
        )
    );
    return {
        dom,
        getValue(): string {
            return dom.val() as string;
        },
        setValue(val: string): JQuery {
            return dom.val(val);
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
