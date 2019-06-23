import { DomWidget, container, Widget } from '../core/shared';
import { ButtonWidget } from './ui';

export type ActionBarConfig = [string, () => void][];

export function ActionBarWidget(config: ActionBarConfig): Widget {
    function makeButton(name: string, handler: () => void) {
        if (name == 'Delete')
            return ButtonWidget('Delete', handler, 'outline-danger');
        if (name == 'Save') return ButtonWidget('Save', handler, 'outline');
        if (name == 'Cancel')
            return ButtonWidget('Cancel', handler, 'outline-secondary');
        if (name == 'Create') return ButtonWidget('Create', handler, 'outline');
    }
    return DomWidget(
        container('<div></div>')(
            config.map(([name, handler]) => makeButton(name, handler))
        )
    );
}
