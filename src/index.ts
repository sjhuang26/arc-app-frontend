import { onReady, onMount } from './core/shared';
import { rootWidget } from './core/widget';

$(document).ready(onReady.chain);

onReady.listen(() => {
    $('#app').replaceWith(rootWidget().dom);
    onMount.trigger();
});
