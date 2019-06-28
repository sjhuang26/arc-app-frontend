import { onReady, onMount, initializeResources } from './core/shared';
import { rootWidget } from './core/widget';

$(document).ready(onReady.chain);

onReady.listen(async () => {
    // TODO: replace with proper loading widget
    $('#app').replaceWith($('<h1 id="app">Loading...</h1>'));
    await initializeResources();
    $('#app').replaceWith(rootWidget().dom);
    onMount.trigger();
});
