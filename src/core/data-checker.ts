import {
  learners,
  bookings,
  matchings,
  requests,
  tutors,
  requestSubmissions,
  Record,
  RecordCollection
} from "./shared"

export type DataCheckerTag =
  | { resource: string; id: number; field: string; value: string; type: string }
  | { resource: string; idResource: string }
  | { resource: string; id: number; text: string; value: string; type: string }
  | { resource: string; id: number }
export type DataCheckerProblem = {
  text: string
  tags: DataCheckerTag[]
}
// Checks if everything in A is containd in B.
function dataCheckerUtilCheckSubset<T>(a: T[], b: T[]) {
  const bSet = new Set(b)
  for (const av of a) {
    if (!bSet.has(av)) {
      return false
    }
  }
  return true
}
function runDataCheckerSpecialCheck(
  tutorRecords: RecordCollection,
  matchingRecords: RecordCollection
) {
  let numValidFields = 0
  const problems: DataCheckerProblem[] = []
  type Index = {
    [tutorId: number]: Record[]
  }
  const ind: Index = {}
  for (const tutor of Object.values(tutorRecords)) {
    ind[tutor.id] = []
  }
  for (const matching of Object.values(matchingRecords)) {
    ind[matching.tutor].push(matching)
  }
  for (const tutor of Object.values(tutorRecords)) {
    const mods: number[] = tutor.mods
    const dropInMods: number[] = tutor.dropInMods
    const modsPref: number[] = tutor.modsPref
    const matchedMods: number[] = ind[tutor.id].map(matching => matching.mod)
    // is dropInMods a subset of mods?
    if (dataCheckerUtilCheckSubset(dropInMods, mods)) {
      ++numValidFields
    } else {
      problems.push({
        text: "tutor's dropInMods are not a subset of tutor's mods",
        tags: [
          {
            resource: "tutors",
            id: tutor.id,
            field: "dropInMods",
            value: String(dropInMods),
            type: typeof dropInMods
          },
          {
            resource: "tutors",
            id: tutor.id,
            field: "mods",
            value: String(mods),
            type: typeof mods
          }
        ]
      })
    }
    // is modsPref a subset of mods?
    if (dataCheckerUtilCheckSubset(dropInMods, mods)) {
      ++numValidFields
    } else {
      problems.push({
        text: "tutor's modsPref are not a subset of tutor's mods",
        tags: [
          {
            resource: "tutors",
            id: tutor.id,
            field: "modsPref",
            value: String(modsPref),
            type: typeof modsPref
          },
          {
            resource: "tutors",
            id: tutor.id,
            field: "mods",
            value: String(mods),
            type: typeof mods
          }
        ]
      })
    }
    // is matchedMods a subset of mods?
    if (dataCheckerUtilCheckSubset(dropInMods, mods)) {
      ++numValidFields
    } else {
      problems.push({
        text: "tutor has been matched to a mod that isn't one of tutor's mods",
        tags: [
          {
            resource: "tutors",
            id: tutor.id,
            text: "list of mods tutor has been matched to",
            value: String(matchedMods),
            type: typeof matchedMods
          },
          {
            resource: "tutors",
            id: tutor.id,
            field: "mods",
            value: String(mods),
            type: typeof mods
          },
          ...ind[tutor.id].map(matching => ({
            resource: "matchings",
            id: matching.id
          }))
        ]
      })
    }
  }
  return {
    numValidFields,
    problems
  }
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
              {
                resource: resourceName,
                id: record.id,
                field: field.name,
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
                {
                  resource: resourceName,
                  id: record.id,
                  field: field.name,
                  value: String(record[field.name]),
                  type: typeof record[field.name]
                },
                {
                  resource: resourceName,
                  idResource: validationResult.resource
                }
              ]
            })
          }
        }
      }
    }
  }
  const specialCheck = runDataCheckerSpecialCheck(
    tutors.state.getRecordCollectionOrFail(),
    matchings.state.getRecordCollectionOrFail()
  )
  return {
    numValidFields: numValidFields + specialCheck.numValidFields,
    problems: problems.concat(specialCheck.problems)
  }
}
