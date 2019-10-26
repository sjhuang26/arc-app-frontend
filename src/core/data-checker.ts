import {
  learners,
  bookings,
  matchings,
  requests,
  tutors,
  requestSubmissions
} from "./shared"

export type DataCheckerTag =
  | { resource: string; id: number }
  | { resource: string; field: string }
  | { resource: string; value: string; type: string }
  | { resource: string; value: string; type: string }
  | { resource: string; idResource: string }
export type DataCheckerProblem = {
  text: string
  tags: DataCheckerTag[]
}
function runDataChecker() {
  let numValidFields = 0
  const problems: DataCheckerProblem[] = []
  const resourceList = {
    learners,
    bookings,
    matchings,
    requests,
    tutors,
    requestSubmissions
  }
  for (const [resourceName, resource] of Object.entries(resourceList)) {
    const records = resource.state.getRecordCollectionOrFail()
    for (const record of Object.values(records)) {
      for (const field of resource.info.fields) {
        const validationResult = field.type.validator(record[field.name])
        if (validationResult === true) {
          ++numValidFields
        } else if (typeof validationResult === "string") {
          problems.push({
            text: validationResult,
            tags: [
              { resource: resourceName, id: record.id },
              { resource: resourceName, field: field.name },
              {
                resource: resourceName,
                value: String(record[field.name]),
                type: typeof record[field.name]
              }
            ]
          })
        } else {
          // case: check IDs
          const records2 = resourceList[
            validationResult.resource
          ].getRecordCollectionOrFail()
          if (records2[record[field.name]] === undefined) {
            // invalid ID
            problems.push({
              text: "invalid ID",
              tags: [
                { resource: resourceName, id: record.id },
                { resource: resourceName, field: field.name },
                {
                  resource: resourceName,
                  idResource: validationResult.resource
                },
                {
                  resource: resourceName,
                  value: String(record[field.name]),
                  type: typeof record[field.name]
                }
              ]
            })
          }
        }
      }
    }
  }
  return {
    numValidFields,
    problems
  }
}
