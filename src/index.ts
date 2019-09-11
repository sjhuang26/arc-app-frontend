import { initializeResources } from "./core/shared"
import { rootWidget } from "./core/widget"

console.log("hi there!")
window["appOnReady"] = async () => {
  // TODO: replace with proper loading widget
  $("body").append($('<h1 id="app">Loading...</h1>'))
  await initializeResources()
  $("body").empty()
  $("body").append(rootWidget().dom)
}

$(document).ready(window["appOnReady"])
