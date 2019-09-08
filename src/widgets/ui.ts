import { container, Widget, DomWidget, ObservableState } from '../core/shared';
import { AskStatus } from '../core/server';

/*

THIS IS LITERALLY JUST A BIG UTILITIES FILE FOR WIDGETS.

*/

/*export function LoaderWidget() {
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
}*/

function wrapAsControl(e: JQuery): JQuery {
    return container('<div class="control"></div>')(e);
}

export function ErrorWidget(message: string): Widget {
    const dom = container('<div class="notification is-danger"></div>')(
        container('<h1></h1>')('Error'),
        $(
            '<p><strong>An error occurred. You can try closing the window and opening again.</strong></p>'
        ),
        container('<span></span>')(message)
    );
    return DomWidget(dom);
}

export function ButtonWidget(
    content: string | JQuery,
    onClick: () => void,
    style: string = 'is-primary'
): Widget {
    if (typeof content === 'string') {
        return DomWidget(
            $('<button></button>')
                .text(content)
                .addClass('button ' + style)
                .click(onClick)
        );
    } else {
        return DomWidget(
            $('<button></button>')
                .append(content)
                .addClass('button ' + style)
                .click(onClick)
        );
    }
}

export function ButtonAddonWidget(...buttons: JQuery[]): Widget {
    return DomWidget(
        container('<div class="field has-addons">')(
            buttons.map(e => container('<div class="control">')(e))
        )
    );
}

export function ButtonGroupWidget(...buttons: JQuery[]): Widget {
    return DomWidget(
        container('<div class="field is-grouped">')(
            buttons.map(e => container('<div class="control">')(e))
        )
    );
}

const modalHtmlString = `<div class="modal">
<div class="modal-background"></div>
<div class="modal-card">
  <header class="modal-card-head">
    <p class="modal-card-title"></p>
    <button class="delete" aria-label="close"></button>
  </header>
  <section class="modal-card-body">
    <div class="content"></div>
  </section>
  <footer class="modal-card-foot">
  </footer>
</div>`;

export async function showModal(
    title: string,
    content: string | JQuery,
    buildButtons: (
        buildButton: (
            text: string,
            style: string,
            onClick?: () => void
        ) => JQuery
    ) => JQuery[]
): Promise<void> {
    const dom = $(modalHtmlString);
    dom.find('.modal-card-title').text(title);
    dom.find('.content').append(
        typeof content === 'string' ? container('<p></p>')(content) : content
    );
    dom.find('.modal-card-foot').append(
        buildButtons.call(
            null,
            (text: string, style: string, onClick?: () => void) =>
                $('<button type="button" class="button">')
                    .addClass(style)
                    .click(onClick)
                    .text(text)
        )
    );
    return new Promise(res => {
        dom.on('hidden.bs.modal', () => res());
    });
}

export type FormValueWidget<T> = Widget & {
    getValue(): any;
    setValue(newVal: T): JQuery;
    onChange(doThis: (newVal: T) => void): void;
};

export function FormStringInputWidget(type: string): FormValueWidget<string> {
    const dom = wrapAsControl($(`<input class="input" type="${type}">`));
    return {
        dom,
        getValue(): string {
            return String(dom.val());
        },
        setValue(newVal: string): JQuery {
            return dom.val(newVal);
        },
        onChange(doThis: (newVal: string) => void): void {
            dom.val(() => doThis.call(null, dom.val() as string));
        }
    };
}

export function FormJsonInputWidget(defaultValue: any): FormValueWidget<any> {
    const dom = wrapAsControl($(`<input class="input" type="text">`));
    dom.val(JSON.stringify(defaultValue));
    return {
        dom,
        getValue(): any {
            return JSON.parse(dom.val() as string);
        },
        setValue(newVal: any): JQuery {
            return dom.val(JSON.stringify(newVal));
        },
        onChange(doThis: (newVal: any) => void): void {
            dom.val(() => doThis.call(null, JSON.parse(dom.val() as string)));
        }
    };
}

export function FormNumberInputWidget(type: string): FormValueWidget<number> {
    let dom: JQuery = null;
    if (type === 'number') {
        dom = wrapAsControl($(`<input class="input" type="number">`));
    }
    if (type === 'datetime-local') {
        dom = wrapAsControl($(`<input class="input" type="datetime-local">`));
    }
    if (type === 'id') {
        // TODO: create a resource selection dropdown, or at least a name search
        dom = wrapAsControl($(`<input class="input" type="number">`));
    }
    function getVal(): number {
        if (type == 'datetime-local') {
            // a hack to get around Typescript types
            const htmlEl: any = dom.get(0);
            const date = htmlEl.valueAsNumber as number;
            return date ? date : 0;
        }
        return Number(dom.val());
    }
    return {
        dom,
        getValue(): number {
            return getVal();
        },
        setValue(val: number): JQuery {
            if (type == 'datetime-local') {
                // a hack to get around Typescript types
                const htmlEl: any = dom.get(0);
                htmlEl.valueAsNumber = val;
                return dom;
            }
            return dom.val(val);
        },
        onChange(doThis) {
            dom.val(doThis.call(null, getVal()));
        }
    };
}

export function FormNumberArrayInputWidget(
    type: string
): FormValueWidget<number[]> {
    let dom: JQuery = null;
    if (type === 'number') {
        // arrays are entered as comma-separated values
        dom = wrapAsControl($(`<input class="input" type="text">`));
    } else {
        throw new Error('unsupported type');
    }
    function getVal(): number[] {
        return String(dom.val())
            .split(',')
            .map(x => x.trim())
            .filter(x => x !== '')
            .map(x => Number(x));
    }
    return {
        dom,
        getValue(): number[] {
            return getVal();
        },
        setValue(val: number[]): JQuery {
            return dom.val(val.map(x => String(x)).join(', '));
        },
        onChange(doThis) {
            dom.val(doThis.call(null, getVal()));
        }
    };
}

export function StringField(type: string) {
    return () => FormStringInputWidget(type);
}
export function NumberField(type: string) {
    return () => FormNumberInputWidget(type);
}
export function IdField() {
    return () => FormNumberInputWidget('number');
}
export function SelectField(options: string[], optionTitles: string[]) {
    return () => FormSelectWidget(options, optionTitles);
}
export function NumberArrayField(type: string) {
    return () => FormNumberArrayInputWidget(type);
}
export function JsonField(defaultValue: any) {
    return () => FormJsonInputWidget(defaultValue);
}

export type FormFieldType = () => FormValueWidget<any>;

export function FormSubmitWidget(text: string): Widget {
    return DomWidget(
        $(
            '<button class="button is-outlined is-success" type="submit"></button>'
        ).text(text)
    );
}
export function FormSelectWidget(
    options: string[],
    optionTitles: string[]
): FormValueWidget<string> {
    const dom = container('<div class="select"></div>')(
        container('<select></select>')(
            options.map((_o, i) =>
                container('<option></option>')(optionTitles[i]).val(options[i])
            )
        )
    );
    const k = {
        dom,
        getValue(): string {
            return dom.val() as string;
        },
        setValue(val: string): JQuery {
            return dom.val(val);
        },
        onChange(doThis: (newVal: string) => void): void {
            dom.change(() => doThis.call(null, dom.val() as string));
        }
    };
    return k;
}
export function FormToggleWidget(
    titleWhenFalse: string,
    titleWhenTrue: string,
    styleWhenFalse: string = 'is-secondary is-outline',
    styleWhenTrue: string = 'is-primary'
): FormValueWidget<boolean> {
    function setVal(newVal: boolean): JQuery {
        if (val === newVal) return;
        if (newVal) {
            val = true;
            dom.text(titleWhenTrue);
            dom.removeClass(styleWhenFalse);
            dom.addClass(styleWhenTrue);
            return dom;
        } else {
            val = false;
            dom.text(titleWhenFalse);
            dom.removeClass(styleWhenTrue);
            dom.addClass(styleWhenFalse);
            return dom;
        }
    }
    const dom = $('<button class="button"></button>').click(() => {
        if (val === null) {
            throw new Error('improper init of toggle button');
        }
        setVal(!val);
    });
    let val = null;

    const k = {
        dom,
        getValue(): boolean {
            if (val === null)
                throw new Error(
                    'attempt to read toggle button value before init'
                );
            return val;
        },
        setValue(val: boolean): JQuery {
            setVal(val);
            return dom;
        },
        onChange(doThis: (newVal: boolean) => void): void {
            dom.click(() => doThis.call(null, val));
        }
    };
    return k;
}
export function SearchItemWidget(onSubmit: () => void): Widget {
    return DomWidget(
        $('<div class="field is-grouped">')
            .append(FormStringInputWidget('search').dom)
            .append(FormSubmitWidget('Search').dom)
            .submit(ev => {
                ev.preventDefault();
                onSubmit.call(null);
            })
    );
}

export function createMarkerLink(text: string, onClick: () => void): JQuery {
    return $('<a style="cursor: pointer; text-decoration: underline"></a>')
        .text(text)
        .click(onClick);
}

export function MessageTemplateWidget(content: string): Widget {
    const textarea = $('<textarea class="textarea"></textarea>');
    textarea.val(content);

    const button = ButtonWidget('Copy to clipboard', () => {
        const htmlEl: any = textarea[0];
        htmlEl.select();
        document.execCommand('copy');
        button.val('Copied!');
        setTimeout(() => button.val('Copy to clipboard'), 1000);
    });
    return DomWidget(
        container('<div class="card"></div>')(
            container('<div class="card-content"></div>')(textarea, button)
        )
    );
}
