import { rootWidget } from "./core/widget"
import { forceRefreshAllResources } from "./core/shared"

console.log("hi there!")

const spinnerHTML = `
<div style="display: flex;align-items: center;justify-content: center;flex-direction: column;">
<div class="top-ui-card" style="padding: 2rem; display: flex;align-items: center;justify-content: center;flex-direction: column;">
<p class="lead">ARC App</p>
<div class="spinner-border" style="width: 8rem; height: 8rem" role="status">
  <span class="sr-only">Loading...</span>
</div>
</div>
</div>
`

window["appOnReady"] = async () => {
  $("#app")
    .addClass("layout-v")
    .append(spinnerHTML)
  await forceRefreshAllResources()
  $("body").empty()
  $("body").append(rootWidget().dom)
}

$(document).ready(window["appOnReady"])
