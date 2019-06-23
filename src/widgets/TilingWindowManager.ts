import { Widget, state, DomWidget } from '../core/shared';

export function TilingWindowManagerWidget(): Widget {
    const tiledWindows = state.tiledWindows;
    const dom = $('<div></div>');
    const domWindowKeys = [];

    tiledWindows.change.listen(() => {
        // STEP A: REMOVE/ADD WINDOWS
        const val = tiledWindows.val;
        const usedKeys = {};
        for (const { key } of val) usedKeys[key] = true;

        let childIndex = 0;
        while (childIndex < dom.children().length) {
            if (!usedKeys[domWindowKeys[childIndex]]) {
                // remove this child, because it's not in usedKeys
                // we do NOT increment childIndex
                // because the next child will take the place of the
                // current one
                dom.children()[childIndex].remove();

                // this resyncs domWindowKeys with the DOM
                domWindowKeys.splice(childIndex, 1);
            } else {
                // take a look at the next child
                ++childIndex;
            }
        }

        // we assume there might be ONE new window at the end of tiledWindows
        if (!usedKeys[val[val.length - 1].key]) {
            // add it in to the end!
            dom.append(val[val.length - 1].window.dom);

            // this resyncs domWindowKeys with the DOM
            domWindowKeys.push(val[val.length - 1].key);
        }

        // STEP B: SET VISIBILITIES
        // By now, we assume that domWindowKeys and tiledWindows are in sync
        for (let i = 0; i < val.length; ++i) {
            if (val[i].visible) {
                $(dom.children()[i]).show();
            } else {
                $(dom.children()[i]).hide();
            }
        }
    });

    return DomWidget(dom);
}
