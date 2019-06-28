/*
TODO: badge, dropdown, and search
*/
import { container, Widget, DomWidget, ObservableState } from '../core/shared';
import { AskStatus } from '../core/server';

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

export function ErrorWidget(message: string): Widget {
    const dom = container('<div class="alert alert-danger"></div>')(
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
    variant: string = 'primary'
): Widget {
    // to create an outline button, add "outline" to the variant
    if (variant === 'outline') variant = 'outline-primary';
    if (typeof content === 'string') {
        return DomWidget(
            $('<button></button>')
                .text(content)
                .addClass('btn btn-' + variant)
                .click(onClick)
        );
    } else {
        return DomWidget(
            $('<button></button>')
                .append(content)
                .addClass('btn btn-' + variant)
                .click(onClick)
        );
    }
}

const modalHtmlString = `<div class="modal" tabindex="-1" role="dialog">
<div class="modal-dialog" role="document">
  <div class="modal-content">
    <div class="modal-header">
      <h5 class="modal-title"></h5>
      <button type="button" class="close" data-dismiss="modal" aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
    <div class="modal-body">
    </div>
    <div class="modal-footer">
    </div>
  </div>
</div>
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
    dom.find('.modal-title').text(title);
    dom.find('.modal-body').append(
        typeof content === 'string' ? container('<p></p>')(content) : content
    );
    dom.find('.modal-footer').append(
        buildButtons.call(
            null,
            (text: string, style: string, onClick?: () => void) =>
                $('<button type="button" class="btn" data-dismiss="modal">')
                    .addClass('btn-' + style)
                    .click(onClick)
                    .text(text)
        )
    );
    dom.modal();
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
    const dom = $(`<input class="form-control" type="${type}">`);
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
        dom = $(`<input class="form-control" type="text">`);
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
export function SelectField(options: string[], optionTitles: string[]) {
    return () => FormSelectWidget(options, optionTitles);
}
export function NumberArrayField(type: string) {
    return () => FormNumberArrayInputWidget(type);
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
        options.map((_o, i) =>
            container('<option></option>')(optionTitles[i]).val(options[i])
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
    styleWhenFalse: string = 'outline-secondary',
    styleWhenTrue: string = 'primary'
): FormValueWidget<boolean> {
    function setVal(newVal: boolean): JQuery {
        if (val === newVal) return;
        if (newVal) {
            val = true;
            dom.text(titleWhenTrue);
            dom.removeClass('btn-' + styleWhenFalse);
            dom.addClass('btn-' + styleWhenTrue);
            return dom;
        } else {
            val = false;
            dom.text(titleWhenFalse);
            dom.removeClass('btn-' + styleWhenTrue);
            dom.addClass('btn-' + styleWhenFalse);
            return dom;
        }
    }
    const dom = $('<button class="btn"></button>').click(() => {
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
        $('<form class="form-inline"></form>')
            .append(FormStringInputWidget('search').dom)
            .append(FormSubmitWidget('Search').dom)
            .submit(ev => {
                ev.preventDefault();
                onSubmit.call(null);
            })
    );
}

export function createMarkerLink(text: string, onClick: () => void): JQuery {
    return $('<a style="cursor: pointer"></a>')
        .text(text)
        .click(onClick);
}

export function MessageTemplateWidget(content: string): Widget {
    const textarea = $('<textarea class="form-control"></textarea>');
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
            container('<div class="card-body"></div>')(textarea, button)
        )
    );
}
