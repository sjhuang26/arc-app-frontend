import { container, Widget } from '../core/shared';
import { FormValueWidget } from './ui';

export function FormWidget(
    fields: [{ title: string; name: string; formValueWidget: FormValueWidget }]
): Widget {
    const dom = container('<form></form>')(
        fields.map(({ title, formValueWidget }) => {
            return container('<div class="form-group row"></div>')(
                container('<label class="col-2 col-form-label"></label>')(
                    title
                ),
                container('<div class="col-10"')(formValueWidget)
            );
        })
    );
    return {
        dom,
        getAllValues(): object {
            const result = {};
            for (const { name, formValueWidget } of fields) {
                result[name] = formValueWidget.getValue();
            }
            return result;
        }
    };
}
