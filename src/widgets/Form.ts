import { container, Widget, Record, ResourceFieldInfo } from "../core/shared"
import { FormValueWidget } from "./ui"

export type FormWidget = Widget & {
  getAllValues(): Record
  setAllValues(record: Record): void
}
export function FormWidget(fields: ResourceFieldInfo[]): FormWidget {
  const widgets: { [fieldName: string]: FormValueWidget<any> } = {}
  const dom = container("<form></form>")(
    fields.map(({ title, type, name, info }) => {
      const widget = type()
      widgets[name] = widget
      return container('<div class="form-group row"></div>')(
        container('<label class="col-5 col-form-label"></label>')(
          container("<b></b>")(title),
          info && container('<i class="ml-2"></i>')(info)
        ),
        container('<div class="col-7"></div>')(widget.dom)
      )
    })
  )
  return {
    dom,
    getAllValues(): Record {
      const result = {}
      for (const { name } of fields) {
        result[name] = widgets[name].getValue()
      }
      return result as Record
    },
    setAllValues(values: Record) {
      for (const [name, value] of Object.entries(values)) {
        if (widgets[name] === undefined) {
          throw new Error("name " + String(name) + " does not exist in form")
        }
        widgets[name].setValue(value)
      }
    }
  }
}
