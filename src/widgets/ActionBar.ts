import { DomWidget, container, Widget } from '../core/shared';
import { ButtonWidget } from './ui';

export type ActionBarConfig = [[string, () => void]];

export function ActionBarWidget(config: ActionBarConfig): Widget {
    function makeButton(name: string, handler: () => void) {
        if (name == 'delete')
            return ButtonWidget('Delete', handler, 'outline-danger');
        if (name == 'save') return ButtonWidget('Save', handler, 'outline');
        if (name == 'cancel')
            return ButtonWidget('Cancel', handler, 'outline-secondary');
        if (name == 'create') return ButtonWidget('Create', handler, 'outline');
    }
    return DomWidget(
        container('<div></div>')(
            config.map(([name, handler]) => makeButton(name, handler))
        )
    );
}
