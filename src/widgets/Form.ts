import { container, Widget, Record, ResourceFieldInfo } from '../core/shared';
import { FormValueWidget } from './ui';

export type FormWidget = Widget & {
    getAllValues(): Record;
    setAllValues(record: Record): void;
};
export function FormWidget(fields: ResourceFieldInfo[]): FormWidget {
    const widgets: { [fieldName: string]: FormValueWidget<any> } = {};
    const dom = container('<form></form>')(
        fields.map(({ title, type, name, info }) => {
            const widget = type();
            widgets[name] = widget;
            return container('<div class="field is-horizontal"></div>')(
                container('<div class="field-label"></div>')(
                    container('<label class="label"></label>')(
                        title,
                        info &&
                            container(
                                '<i style="margin-left: 1rem; font-weight: normal"></i>'
                            )(info)
                    )
                ),
                container('<div class="field-body"></div>')(
                    container('<div class="field"></div>')(widget.dom)
                )
            );
        })
    );
    return {
        dom,
        getAllValues(): Record {
            const result = {};
            for (const { name } of fields) {
                result[name] = widgets[name].getValue();
            }
            return result as Record;
        },
        setAllValues(values: Record) {
            for (const [name, value] of Object.entries(values)) {
                if (widgets[name] === undefined) {
                    throw new Error(
                        'name ' + String(name) + ' does not exist in form'
                    );
                }
                widgets[name].setValue(value);
            }
        }
    };
}
