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
      <p class="js-text">Modal body text goes here.</p>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" data-dismiss="modal">OK</button>
    </div>
  </div>
</div>
</div>`;

export function showSimpleModal(title: string, text: string): void {
    const dom = $(modalHtmlString);
    dom.modal();
    dom.find('.modal-title').text(title);
    dom.find('.js-text').text(text);
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
