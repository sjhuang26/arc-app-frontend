import { container, Widget, Record } from '../core/shared';
import { NumberField, FieldType, StringField } from './ui';

export type FormFieldConfig = {
    title: string;
    name: string;
    type: FieldType;
};
export type UnprocessedFormConfig = {
    fields: [string, FieldType][];
    nameToTitle: { [name: string]: string };
};

export function FormWidget(fields: FormFieldConfig[]): Widget {
    const widgets = {};
    const dom = container('<form></form>')(
        fields.map(({ title, type, name }) => {
            const widget = type();
            widgets[name] = widget;
            return container('<div class="form-group row"></div>')(
                container('<label class="col-2 col-form-label"></label>')(
                    title
                ),
                container('<div class="col-10"')(widget.dom)
            );
        })
    );
    return {
        dom,
        getAllValues(): object {
            const result = {};
            for (const { name } of fields) {
                result[name] = widgets[name].getValue();
            }
            return result;
        },
        setAllValues(values: Record) {
            for (const [name, value] of Object.entries(values)) {
                $(widgets[name]).val(value);
            }
        }
    };
}

export function preprocessFormConfig(conf: UnprocessedFormConfig) {
    const processed = [];
    for (const [name, type] of conf.fields) {
        processed.push({
            title: conf.nameToTitle[name],
            name,
            type
        });
    }
    processed.concat([
        {
            title: 'id',
            name: 'ID',
            type: NumberField('number')
        },
        {
            title: 'date',
            name: 'Date',
            type: StringField('date')
        }
    ]);
    return processed;
}

export function makeBasicStudentConfig(): [string, FieldType][] {
    return [
        ['firstName', StringField('text')],
        ['lastName', StringField('text')],
        ['friendlyName', StringField('text')],
        ['friendlyFullName', StringField('text')],
        ['grade', NumberField('number')]
    ];
}
