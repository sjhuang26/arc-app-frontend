import { Widget, state, DomWidget } from '../core/shared';

export function TilingWindowManagerWidget(): Widget {
    const tiledWindows = state.tiledWindows;
    const dom = $('<div></div>');
    const domWindowKeys = [];

    tiledWindows.change.listen(() => {
        // STEP A: REMOVE/ADD WINDOWS
        const state = tiledWindows.val;

        // The windows we want to keep are the ones in the state.
        const windowsToKeep = {};
        for (const { key } of state) windowsToKeep[key] = true;

        let childIndex = 0;
        while (childIndex < dom.children().length) {
            if (!windowsToKeep[domWindowKeys[childIndex]]) {
                // remove this child: we do NOT increment childIndex
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
        if (state.length > 0) {
            const windowsInDom = {};
            for (const key of domWindowKeys) windowsInDom[key] = true;

            if (!windowsInDom[state[state.length - 1].key]) {
                // add it in to the end!
                dom.append(state[state.length - 1].window.dom);

                // this resyncs domWindowKeys with the DOM
                domWindowKeys.push(state[state.length - 1].key);
            }
        }

        // STEP B: SET VISIBILITIES
        // By now, we assume that domWindowKeys and tiledWindows are in sync
        for (let i = 0; i < state.length; ++i) {
            if (state[i].visible) {
                $(dom.children()[i]).show();
            } else {
                $(dom.children()[i]).hide();
            }
        }
    });

    return DomWidget(dom);
}
