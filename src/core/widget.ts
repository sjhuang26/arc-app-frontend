import {
    container,
    state,
    Widget,
    tutors,
    learners,
    requests,
    requestSubmissions,
    matchings,
    bookings,
    stringifyError,
    Record,
    stringifyMod,
    alertError,
    arrayEqual
} from './shared';
import {
    ButtonWidget,
    showModal,
    ErrorWidget,
    FormSelectWidget,
    FormToggleWidget,
    MessageTemplateWidget,
    ListGroupNavigationWidget
} from '../widgets/ui';
import { TableWidget } from '../widgets/Table';
import { AskStatus, getResultOrFail, askServer } from './server';

/*

BASIC UTILITIES

*/

async function isOperationConfirmedByUser(args: {}): Promise<boolean> {
    return new Promise(async res => {
        await showModal('Are you sure?', '', bb => [
            bb('No', 'outline-secondary'),
            bb('Yes', 'primary', () => res(true))
        ]);
        res(false);
    });
}

const navigationBarString = `
<ul class="nav nav-pills">
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Commands</a>
        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item">Sync data from forms</a>
            <a class="dropdown-item">Generate schedule</a>
            <a class="dropdown-item">Recalculate attendance</a>
        </div>
    </li>
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Advanced data editor</a>
        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item">Tutors</a>
            <a class="dropdown-item">Learners</a>
            <a class="dropdown-item">Requests</a>
            <a class="dropdown-item">Request submissions</a>
            <a class="dropdown-item">Bookings</a>
            <a class="dropdown-item">Matchings</a>
        </div>
    </li>
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Scheduling steps</a>
        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item">Handle requests</a>
            <a class="dropdown-item">Edit schedule</a>
            <a class="dropdown-item">View schedule</a>
        </div>
    </li>
    <li class="nav-item">
        <a class="nav-link">Attendance</a>
    </li>
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Other</a>
        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item">About</a>
            <a class="dropdown-item">Force refresh</a>
            <a class="dropdown-item">Testing mode</a>
        </div>
    </li>
</ul>`;

function showTestingModeWarning() {
    showModal(
        'Testing mode loaded',
        'The app has been disconnected from the actual database/forms and replaced with a database with test data.',
        bb => [bb('OK', 'primary')]
    );
}

/*

LOTS OF FUNCTIONS!!!!!

IF YOU WANT ANY HOPE OF UNDERSTANDING THIS CODE, READ THE BOTTOM FIRST.

*/

type RequestIndexEntry = {
    id: number;
    bookings: number[];
    matchings: number[];
    currentStatus: string;
};

function showBookingMessagerStep(bookingId: number) {
    const b = bookings.state.getRecordOrFail(bookingId);
    const r = requests.state.getRecordOrFail(b.request);
    const t = tutors.state.getRecordOrFail(b.tutor);
    const l = learners.state.getRecordOrFail(r.learner);

    const dom = $('<div></div>');

    if (b.status === 'unsent') {
        dom.append($('<p>Contact the tutor:</p>'));
        dom.append(
            MessageTemplateWidget(
                `Hi! Can you tutor a student in ${
                    r.subject
                } on mod ${stringifyMod(b.mod)}?`
            ).dom
        );
    }
    if (b.status === 'waitingForTutor') {
        dom.append($('<p>You are waiting for the tutor.</p>'));
    }

    showModal(
        'Messager',
        container('<div>')(
            container('<h1>')(
                'Messager for ',
                learners.createDataEditorMarker(
                    r.learner,
                    x => x.friendlyFullName
                ),
                ' <> ',
                tutors.createDataEditorMarker(b.tutor, x => x.friendlyFullName)
            ),
            dom
        ),
        bb => [bb('OK', 'primary')]
    );
}

async function finalizeBookingsStep(
    bookingId: number,
    onFinish: () => void
): Promise<boolean> {
    if (
        await isOperationConfirmedByUser(
            'Are you sure you want to match these students?'
        )
    ) {
        const { closeModal } = showModal('Saving...', '', bb => []);
        try {
            const b = bookings.state.getRecordOrFail(bookingId);
            const r = requests.state.getRecordOrFail(b.request);
            // ADD MATCHING
            const ask = await matchings.state.createRecord({
                learner: r.learner,
                tutor: b.tutor,
                subject: r.subject,
                mod: b.mod,
                status: 'finalized',
                specialRoom: r.specialRoom,
                id: -1,
                date: -1
            });
            if (ask.status === AskStatus.ERROR) {
                throw ask.message;
            }
            // DELETE ALL BOOKINGS FOR REQUEST
            // (TODO: THIS WILL BE MOVED TO A SEPARATE COMMAND)
            for (const booking of Object.values(
                bookings.state.getRecordCollectionOrFail()
            )) {
                if (booking.request === r.id) {
                    const ask2 = await bookings.state.deleteRecord(booking.id);
                    if (ask2.status === AskStatus.ERROR) {
                        throw ask2.message;
                    }
                }
            }
        } catch (err) {
            alert(stringifyError(err));
        } finally {
            closeModal();
            onFinish();
        }
        return true;
    } else {
        return false;
    }
}

interface NavigationScope {
    generateMainContentPanel(navigationState: any[]): JQuery | null;
    sidebar?: JQuery;
}

function requestsNavigationScope(
    renavigate: (newNavigationState: any[], keepScope: boolean) => void
): NavigationScope {
    async function attemptRequestSubmissionConversion(record: Record) {
        // CREATE LEARNER
        // try to dig up a learner with matching student ID, which would mean
        // that the learner already exists in the database
        const matches: Record[] = Object.values(learnerRecords).filter(
            x => x.studentId === record.studentId
        );
        let learnerRecord: Record;
        if (matches.length > 1) {
            // duplicate learner student IDs??
            // this should be validated in the database
            throw new Error(`duplicate student id: "${record.studentId}"`);
        } else if (matches.length == 0) {
            // create new learner
            learnerRecord = getResultOrFail(
                await learners.state.createRecord({
                    firstName: record.firstName,
                    lastName: record.lastName,
                    friendlyName: record.friendlyName,
                    friendlyFullName: record.friendlyFullName,
                    grade: record.grade,
                    id: -1,
                    date: -1,
                    studentId: record.studentId,
                    email: record.email,
                    phone: record.phone,
                    contactPref: record.contactPref,
                    attendance: {}
                })
            );
        } else {
            // learner already exists
            learnerRecord = matches[0];
        }

        // CREATE REQUEST
        getResultOrFail(
            await requests.state.createRecord({
                learner: learnerRecord.id,
                id: -1,
                date: -1,
                mods: record.mods,
                subject: record.subject,
                specialRoom: record.specialRoom
            })
        );

        // MARK REQUEST SUBMISSION AS CHECKED
        // NOTE: this is only done if the above steps worked
        // so if there's an error, the request submission won't be obliterated
        record.status = 'checked';
        getResultOrFail(await requestSubmissions.state.updateRecord(record));
    }

    const learnerRecords = learners.state.getRecordCollectionOrFail();
    const bookingRecords = bookings.state.getRecordCollectionOrFail();
    const matchingRecords = matchings.state.getRecordCollectionOrFail();
    const requestRecords = requests.state.getRecordCollectionOrFail();
    const tutorRecords = tutors.state.getRecordCollectionOrFail();
    const requestSubmissionRecords = requestSubmissions.state.getRecordCollectionOrFail();

    const table = TableWidget(
        ['Request', 'Current status', 'Open'],
        (i: RequestIndexEntry) => {
            return [
                requests.createDataEditorMarker(i.id, x =>
                    learners.createLabel(x.learner, y => y.friendlyFullName)
                ),
                i.currentStatus,
                ButtonWidget('Open', () => {
                    renavigate(['requests', i.id], false);
                }).dom
            ];
        }
    );

    // FILTER FOR UNCHECKED REQUEST SUBMISSIONS
    const uncheckedRequestSubmissions = Object.values(
        requestSubmissionRecords
    ).filter(x => x.status === 'unchecked');

    // INDEX: learners --> { requests, isMatched }

    const learnersIndex: { [id: string]: { isMatched: boolean } } = {};
    for (const x of Object.values(learnerRecords)) {
        learnersIndex[x.id] = {
            isMatched: false
        };
    }
    for (const x of Object.values(matchingRecords)) {
        learnersIndex[String(x.learner)].isMatched = true;
    }

    // INDEX: requests --> { bookings, matchings, shouldBeOnPage }

    const requestsIndex: {
        [id: string]: RequestIndexEntry;
    } = {};
    for (const x of Object.values(requestRecords)) {
        requestsIndex[String(x.id)] = {
            id: x.id,
            bookings: [],
            matchings: [],
            // "Current status" isn't actually a status directly from the database: it's just holds the string that is put on the UI
            currentStatus: 'Unbooked'
        };
    }

    // ALL INDEXES ARE FULLY BUILT BY THIS POINT

    // Don't show requests with an already-matched learner.
    for (const x of Object.values(requestRecords)) {
        if (learnersIndex[String(x.learner)].isMatched) {
            requestsIndex[String(x.id)].currentStatus = 'Matched';
        }
    }

    // If a request has more than one booking, mark it as either status "Waiting" or "Unsent"
    for (const x of Object.values(bookingRecords)) {
        const y = requestsIndex[String(x.request)];
        if (y.currentStatus == 'Matched') continue;
        if (x.status.startsWith('waiting')) {
            y.currentStatus = 'Waiting';
        }
        if (y.currentStatus == 'Waiting') continue;
        if (x.status == 'unsent') {
            y.currentStatus = 'Unsent';
        }
    }

    table.setAllValues(
        Object.values(requestsIndex).filter(x => x.currentStatus !== 'Matched')
    );

    const convertRequestSubmissionsButton = ButtonWidget(
        'Convert new request submissions',
        async () => {
            const { closeModal } = showModal('Converting...', '', bb => []);
            try {
                for (const record of uncheckedRequestSubmissions) {
                    await attemptRequestSubmissionConversion(record);
                }
            } catch (e) {
                alertError(e);
            } finally {
                closeModal();
                showModal('Conversion successful', '', bb => [
                    bb('OK', 'primary')
                ]);
            }
            renavigate(['requests'], false);
        }
    ).dom;

    return {
        generateMainContentPanel(navigationState: any[]) {
            const requestId: number = navigationState[0];
            if (requestId === undefined) {
                return null;
            }
            type PotentialTableRowArgs = {
                tutorId: number;
                mods: PotentialTableRowModArgs[];
            };
            type PotentialTableRowModArgs = {
                mod: number;
                isPref: boolean;
                isAlreadyBooked: boolean;
                isAlreadyDropIn: boolean;
            };
            const header = container('<h1>')(
                'Request: ',
                learners.createFriendlyMarker(
                    requests.state.getRecordOrFail(requestId).learner,
                    x => x.friendlyFullName
                )
            );

            const table = TableWidget(
                ['Booking', 'Status', 'Todo', 'Match'],
                (booking: Record) => {
                    const formSelectWidget = FormSelectWidget(
                        ['unsent', 'waitingForTutor', 'rejected'],
                        ['Unsent', 'Waiting', 'Rejected']
                    );
                    formSelectWidget.setValue(booking.status);
                    formSelectWidget.onChange(async newVal => {
                        booking.status = newVal;
                        const response = await bookings.state.updateRecord(
                            booking
                        );
                        if (response.status === AskStatus.ERROR) {
                            alertError(response.message);
                        }
                    });
                    return [
                        tutors.createLabel(
                            booking.tutor,
                            x => x.friendlyFullName
                        ) +
                            ' <> ' +
                            learners.createLabel(
                                requests.state.getRecordOrFail(booking.request)
                                    .learner,
                                x => x.friendlyFullName
                            ),
                        formSelectWidget.dom,
                        ButtonWidget('Todo', () =>
                            showBookingMessagerStep(booking.id)
                        ).dom,
                        ButtonWidget('Match', () => {
                            finalizeBookingsStep(booking.id, () =>
                                renavigate(['requests'], false)
                            );
                        }).dom
                    ];
                }
            );

            // LOGIC: We use a toggle structure where:
            // - There is a row of mod buttons
            // - There is add functionality, but not delete functionality (bookings can be individually deleted)
            // - Toggling the button toggles entries in a temporary array of all added bookings [[tutor, mod]] via. filters
            // - Clicking "Save bookings and close" will write to the database
            let bookingsInfo: { tutorId: number; mod: number }[] = [];
            const potentialTable = TableWidget(
                ['Tutor', 'Book for mods...'],
                ({ tutorId, mods }: PotentialTableRowArgs) => {
                    const buttonsDom = $('<div></div>');
                    for (const {
                        mod,
                        isPref,
                        isAlreadyBooked,
                        isAlreadyDropIn
                    } of mods) {
                        const modLabel =
                            mod +
                            (isPref ? '*' : '') +
                            (isAlreadyDropIn ? ' (drop-in)' : '');
                        if (isAlreadyBooked) {
                            buttonsDom.append(
                                ButtonWidget(
                                    modLabel + ' (already booked)',
                                    () => {}
                                ).dom
                            );
                            continue;
                        }
                        const w = FormToggleWidget(
                            modLabel,
                            'Unbook ' + modLabel
                        );
                        w.setValue(false);
                        w.onChange((newVal: boolean) => {
                            if (newVal) {
                                bookingsInfo.push({
                                    tutorId,
                                    mod
                                });
                            } else {
                                bookingsInfo = bookingsInfo.filter(
                                    x => x.tutorId !== tutorId || x.mod !== mod
                                );
                            }
                        });
                        buttonsDom.append(w.dom);
                    }
                    return [
                        tutors.createDataEditorMarker(
                            tutorId,
                            x => x.friendlyFullName
                        ),
                        buttonsDom
                    ];
                }
            );

            table.setAllValues(
                Object.values(bookings.state.getRecordCollectionOrFail())
                    .filter(x => x.request === requestId)
                    .map(x => bookings.state.getRecordOrFail(x.id))
            );
            // LOGIC: calculating which tutors work for this request
            // - tutor must not be matched at the target mod
            // - tutor may be matched to another mod
            // - for each tutor, keep track of which mods they've been matched to
            // - SENDS TO TABLE: [ tutorId, [ mod, isPref: boolean ] ]
            const requestRecord = requests.state.getRecordOrFail(requestId);
            const tutorIndex: {
                [id: string]: {
                    id: number;
                    matchedMods: number[];
                    bookedMods: number[];
                };
            } = {};
            for (const x of Object.values(tutorRecords)) {
                tutorIndex[String(x.id)] = {
                    id: x.id,
                    matchedMods: [],
                    bookedMods: []
                };
            }
            for (const x of Object.values(matchingRecords)) {
                tutorIndex[String(x.tutor)].matchedMods.push(x.mod);
            }
            for (const x of Object.values(bookingRecords)) {
                tutorIndex[String(x.tutor)].bookedMods.push(x.mod);
            }

            const tableValues: PotentialTableRowArgs[] = [];
            for (const tutor of Object.values(tutorIndex)) {
                const modResults: PotentialTableRowModArgs[] = [];
                for (const mod of requestRecord.mods) {
                    if (!tutor.matchedMods.includes(mod)) {
                        const tutorRecord = tutors.state.getRecordOrFail(
                            tutor.id
                        );
                        if (tutorRecord.mods.includes(mod)) {
                            modResults.push({
                                mod,
                                isPref: tutorRecord.modsPref.includes(mod),
                                isAlreadyBooked: tutor.bookedMods.includes(mod),
                                isAlreadyDropIn: tutorRecord.dropInMods.includes(
                                    mod
                                )
                            });
                        }
                    }
                }
                if (modResults.length > 0 && tutor.bookedMods.length === 0) {
                    tableValues.push({
                        tutorId: tutor.id,
                        mods: modResults
                    });
                }
            }
            potentialTable.setAllValues(tableValues);
            return container('<div></div>')(
                header,
                table.dom,
                ButtonWidget('Edit bookings', () =>
                    showModal('Edit bookings', potentialTable.dom, bb => [
                        bb('Save', 'primary', async () => {
                            try {
                                const { closeModal } = showModal(
                                    'Saving...',
                                    '',
                                    bb => []
                                );
                                for (const { tutorId, mod } of bookingsInfo) {
                                    const ask = await bookings.state.createRecord(
                                        {
                                            id: -1,
                                            date: -1,
                                            tutor: tutorId,
                                            mod,
                                            request: requestId,
                                            status: 'unsent'
                                        }
                                    );
                                    if (ask.status === AskStatus.ERROR) {
                                        throw ask.message;
                                    }
                                }
                                closeModal();
                                renavigate(['requests', requestId], false);
                            } catch (err) {
                                alertError(err);
                            }
                        }),
                        bb('Cancel', 'secondary')
                    ])
                ).dom
            );
        },
        sidebar: container('<div>')(
            container('<h1>')('Requests'),
            uncheckedRequestSubmissions.length > 0
                ? convertRequestSubmissionsButton
                : undefined,
            table.dom
        )
    };
}

function scheduleEditNavigationScope(): NavigationScope {
    const learnerRecords = learners.state.getRecordCollectionOrFail();
    const bookingRecords = bookings.state.getRecordCollectionOrFail();
    const matchingRecords = matchings.state.getRecordCollectionOrFail();
    const requestRecords = requests.state.getRecordCollectionOrFail();
    const tutorRecords = tutors.state.getRecordCollectionOrFail();
    const requestSubmissionRecords = requestSubmissions.state.getRecordCollectionOrFail();

    // CREATE AN INDEX OF OLD DROP-IN MODS
    const oldDropInModsIndex: { [id: number]: number[] } = {};
    for (const tutor of Object.values(tutorRecords)) {
        oldDropInModsIndex[tutor.id] = tutor.dropInMods;
    }

    // CREATE AN INDEX OF EDITED DROP-IN MODS (DEEP COPY)
    const editedDropInModsIndex: { [id: number]: number[] } = JSON.parse(
        JSON.stringify(oldDropInModsIndex)
    );

    // ON SAVE, COMPARE THE TWO INDEXES
    async function onSave() {
        const { closeModal } = showModal('Saving...', '', bb => []);
        try {
            let wereChanges = false;
            for (const [idString, oldDropInMods] of Object.entries(
                oldDropInModsIndex
            )) {
                oldDropInMods.sort();
                const editedDropInMods = editedDropInModsIndex[idString];
                editedDropInMods.sort();
                if (!arrayEqual(oldDropInMods, editedDropInMods)) {
                    wereChanges = true;

                    // this gets rid of duplicates as well
                    tutorRecords[idString].dropInMods = [
                        ...new Set(editedDropInMods)
                    ];
                    getResultOrFail(
                        await tutors.state.updateRecord(tutorRecords[idString])
                    );
                }
            }
            if (!wereChanges) {
                // no changes
                showModal(
                    'No changes were detected in the schedule, so nothing was saved.',
                    '',
                    bb => [bb('OK', 'primary')]
                );
            }
        } catch (e) {
            alertError(e);
        } finally {
            closeModal();
        }
    }
    return {
        generateMainContentPanel(): JQuery {
            // INIT DOM
            const availableDom = container('<div>')();
            for (let i = 0; i < 20; ++i) {
                availableDom.append(
                    container('<div>')(
                        $('<p><strong></strong></p>').text(`Mod ${i + 1}`),
                        container('<ul class="list-group">')()
                    )
                );
            }
            const scheduleDom = container('<div>')();
            for (let i = 0; i < 20; ++i) {
                scheduleDom.append(
                    container('<div>')(
                        $('<p><strong></strong></p>').text(`Mod ${i + 1}`),
                        container('<ul class="list-group">')()
                    )
                );
            }

            // CREATE INDEX OF TUTORS --> [ STATUS, STATUS, STATUS ... ] for each mod
            const tutorModStatusIndex: {
                [id: number]: {
                    id: number;
                    modStatus: (string | (string | number)[])[];
                };
            } = {};
            for (const tutor of Object.values(tutorRecords)) {
                tutorModStatusIndex[tutor.id] = {
                    id: tutor.id,
                    modStatus: []
                };
                for (let i = 0; i < 20; ++i) {
                    tutorModStatusIndex[tutor.id].modStatus.push('none');
                }
                // mod status: available
                for (const mod of tutor.mods) {
                    tutorModStatusIndex[tutor.id].modStatus[mod - 1] =
                        'available';
                }
                // mod status: drop-in
                for (const mod of tutor.dropInMods) {
                    if (
                        tutorModStatusIndex[tutor.id].modStatus[mod - 1] ===
                        'available'
                    ) {
                        tutorModStatusIndex[tutor.id].modStatus[mod - 1] =
                            'dropIn';
                    }
                }
                // preferred mods
                for (const mod of tutor.modsPref) {
                    tutorModStatusIndex[tutor.id].modStatus[mod - 1] += 'Pref';
                }
            }
            for (const booking of Object.values(bookingRecords)) {
                tutorModStatusIndex[booking.tutor].modStatus[
                    booking.mod - 1
                ] = ['booked', booking.id];
            }
            for (const matching of Object.values(matchingRecords)) {
                tutorModStatusIndex[matching.tutor].modStatus[
                    matching.mod - 1
                ] = ['matched', matching.id];
            }
            function generatePopupAvailable(id: number, mod: number) {
                const initialStatus =
                    tutorModStatusIndex[id].modStatus[mod - 1];
                if (typeof initialStatus !== 'string') {
                    throw new Error(
                        'typecheck failed in generatePopupSchedule'
                    );
                }
                const element = container(
                    '<li class="list-group-item list-group-item-action">'
                )(
                    tutors.createLabel(id, x => x.friendlyFullName),
                    initialStatus.endsWith('Pref') ? ' (preferred)' : ''
                );
                availableDom
                    .children()
                    .eq(mod - 1)
                    .children()
                    .eq(1)
                    .append(element);
                const contentDom = container('<span>')('Actions:');
                for (let i = 0; i < 20; ++i) {
                    // if (i + 1 === mod) continue;
                    const status = tutorModStatusIndex[id].modStatus[i];
                    if (
                        typeof status !== 'string' ||
                        !status.startsWith('available')
                    )
                        continue;
                    contentDom.append(
                        ButtonWidget(
                            String(i + 1) +
                                (status === 'availablePref' ? '*' : ''),
                            () => {
                                const arr = editedDropInModsIndex[id];
                                // add the new mod
                                arr.push(i + 1);
                                // sort
                                arr.sort();
                                // edit status index
                                tutorModStatusIndex[id].modStatus[i] =
                                    tutorModStatusIndex[id].modStatus[i] ===
                                    'availablePref'
                                        ? 'dropInPref'
                                        : 'dropIn';
                                // hide popover
                                element.popover('hide');
                                // rebind data handler
                                generatePopupSchedule(id, i + 1);
                            }
                        ).dom
                    );
                }
                element.popover({
                    content: contentDom[0],
                    placement: 'auto',
                    html: true,
                    trigger: 'click'
                });
            }
            function generatePopupSchedule(id: number, mod: number) {
                console.log(tutorModStatusIndex);
                const initialStatus =
                    tutorModStatusIndex[id].modStatus[mod - 1];
                if (typeof initialStatus !== 'string') {
                    throw new Error(
                        'typecheck failed in generatePopupSchedule'
                    );
                }
                const element = container(
                    '<li class="list-group-item list-group-item-action">'
                )(
                    tutors.createLabel(id, x => x.friendlyFullName),
                    ' (drop-in)',
                    initialStatus.endsWith('Pref') ? ' (preferred)' : ''
                );
                scheduleDom
                    .children()
                    .eq(mod - 1)
                    .children()
                    .eq(1)
                    .append(element);

                const contentDom = container('<span>')('Actions:');
                for (let i = 0; i < 20; ++i) {
                    if (i + 1 === mod) continue;
                    const status = tutorModStatusIndex[id].modStatus[i];
                    if (
                        typeof status !== 'string' ||
                        !status.startsWith('available')
                    )
                        continue;
                    contentDom.append(
                        ButtonWidget(
                            String(i + 1) +
                                (status === 'availablePref' ? '*' : ''),
                            () => {
                                // remove the mod
                                const arr = editedDropInModsIndex[id];
                                arr.splice(arr.indexOf(mod), 1);
                                // add the mod
                                arr.push(i + 1);
                                // sort
                                arr.sort();
                                // edit status index
                                tutorModStatusIndex[id].modStatus[mod - 1] =
                                    tutorModStatusIndex[id].modStatus[
                                        mod - 1
                                    ] === 'dropInPref'
                                        ? 'availablePref'
                                        : 'available';
                                tutorModStatusIndex[id].modStatus[i] =
                                    tutorModStatusIndex[id].modStatus[i] ===
                                    'availablePref'
                                        ? 'dropInPref'
                                        : 'dropIn';
                                // dispose popover
                                element.popover('dispose');
                                // destroy element
                                element.remove();
                                // recreate popup
                                generatePopupSchedule(id, i + 1);
                            }
                        ).dom
                    );
                }
                contentDom.append(
                    ButtonWidget('X', () => {
                        // remove the mod entirely
                        const arr = editedDropInModsIndex[id];
                        arr.splice(arr.indexOf(mod), 1);
                        // sort
                        arr.sort();
                        // edit status index
                        tutorModStatusIndex[id].modStatus[mod - 1] =
                            tutorModStatusIndex[id].modStatus[mod - 1] ===
                            'dropInPref'
                                ? 'availablePref'
                                : 'available';
                        // detach element
                        element.detach();
                        // dispose popover
                        element.popover('dispose');
                    }).dom
                );
                element.popover({
                    content: contentDom[0],
                    placement: 'auto',
                    html: true,
                    trigger: 'click'
                });
            }
            function generatePopupScheduleMatch(id: number, mod: number) {
                const initialStatus =
                    tutorModStatusIndex[id].modStatus[mod - 1];
                if (!Array.isArray(initialStatus)) {
                    throw new Error(
                        'typecheck failed in generatePopupScheduleMatch'
                    );
                }
                const matchingId = initialStatus[1] as number;
                const element = container(
                    '<li class="text-danger list-group-item">'
                )(
                    matchings.createLabel(
                        matchingId,
                        x =>
                            tutors.createLabel(
                                x.tutor,
                                y => y.friendlyFullName
                            ) + ' (matched)'
                    )
                );
                scheduleDom
                    .children()
                    .eq(mod - 1)
                    .children()
                    .eq(1)
                    .append(element);
                const contentDom = container('<span>')('Details:');
                contentDom.append(
                    matchings.createDomLabel(matchingId, x =>
                        container('<span>')(
                            tutors.createFriendlyMarker(
                                x.tutor,
                                y => y.friendlyFullName
                            ),
                            ' <> ',
                            learners.createFriendlyMarker(
                                x.learner,
                                y => y.friendlyFullName
                            )
                        )
                    )
                );
                element.popover({
                    content: contentDom[0],
                    placement: 'auto',
                    html: true,
                    trigger: 'click'
                });
            }
            function generatePopupScheduleBook(id: number, mod: number) {
                const initialStatus =
                    tutorModStatusIndex[id].modStatus[mod - 1];
                if (!Array.isArray(initialStatus)) {
                    throw new Error(
                        'typecheck failed in generatePopupScheduleBook'
                    );
                }
                const element = container(
                    '<li class="text-danger list-group-item">'
                )(tutors.createLabel(id, x => x.friendlyFullName), ' (booked)');
                scheduleDom
                    .children()
                    .eq(mod - 1)
                    .children()
                    .eq(1)
                    .append(element);
            }

            for (const { id, modStatus } of Object.values(
                tutorModStatusIndex
            )) {
                for (let i = 0; i < 20; ++i) {
                    const status = modStatus[i];
                    if (Array.isArray(status)) {
                        if (status[0] === 'matched') {
                            generatePopupScheduleMatch(id, i + 1);
                        }
                        if (status[0] === 'booked') {
                            generatePopupScheduleBook(id, i + 1);
                        }
                    }
                    if (typeof status === 'string') {
                        if (status.startsWith('dropIn')) {
                            generatePopupAvailable(id, i + 1);
                            generatePopupSchedule(id, i + 1);
                        }
                        if (status.startsWith('available')) {
                            generatePopupAvailable(id, i + 1);
                        }
                    }
                }
            }
            return container('<div class="layout-h">')(
                container('<div class="overflow-auto">')(
                    container('<h1>')('Available'),
                    availableDom
                ),
                container('<div class="overflow-auto">')(
                    container('<h1>')('Schedule'),
                    ButtonWidget('Save', () => onSave()).dom,
                    scheduleDom
                )
            );
        }
    };
}

function scheduleViewNavigationScope(): NavigationScope {}

function attendanceNavigationScope(
    renavigate: (newNavigationState: any[], keepScope: boolean) => void
): NavigationScope {
    const t = Object.values(tutors.state.getRecordCollectionOrFail());
    const l = Object.values(learners.state.getRecordCollectionOrFail());
    const sidebarTable = TableWidget(
        // Both learners and tutors are students.
        ['Student', 'Total minutes', 'Attendance level', 'Details'],
        ({ isLearner, student }: { isLearner: boolean; student: Record }) => {
            // calculate the attendance level & totals
            let numPresent = 0;
            let numAbsent = 0;
            let totalMinutes = 0;
            for (const x of Object.values<any>(student.attendance)) {
                for (const { minutes } of x) {
                    if (minutes > 0) {
                        ++numPresent;
                    } else {
                        ++numAbsent;
                    }
                    totalMinutes += minutes;
                }
            }
            return [
                (isLearner ? learners : tutors).createLabel(
                    student.id,
                    x => x.friendlyFullName
                ),
                String(totalMinutes),
                `${numPresent}P / ${numAbsent}A`,
                ButtonWidget('Details', () => {
                    renavigate(['attendance', student.id], true);
                }).dom
            ];
        }
    );
    const data = t
        .map(x => ({ isLearner: false, student: x }))
        .concat(l.map(x => ({ isLearner: true, student: x })));

    sidebarTable.setAllValues(data);

    return {
        generateMainContentPanel(navigationState: any[]) {
            const studentId: number = navigationState[0];
            if (studentId === undefined) {
                return null;
            }
            console.log(navigationState, data, studentId);
            const matchingStudents = data.filter(
                x => x.student.id === studentId
            );
            if (matchingStudents.length !== 1) {
                throw new Error('no matching students with ID');
            }
            const { isLearner, student } = matchingStudents[0];

            console.log(student);

            const header = container('<h1>')(
                (isLearner ? learners : tutors).createFriendlyMarker(
                    student.id,
                    x => x.friendlyFullName
                )
            );
            const table = TableWidget(
                // Both learners and tutors are students.
                ['Date', 'Mod', 'Present?'],
                (attendanceEntry: {
                    date: number;
                    mod: number;
                    minutes: number;
                }) => {
                    return [
                        new Date(attendanceEntry.date)
                            .toISOString()
                            .substring(0, 10),
                        String(attendanceEntry.mod),
                        attendanceEntry.minutes > 0
                            ? `P (${attendanceEntry.minutes} minutes)`
                            : $('<span style="color:red">ABSENT</span>')
                    ];
                }
            );
            const attendanceData = [];
            for (const x of Object.values<any>(student.attendance)) {
                for (const y of x) {
                    attendanceData.push(y);
                }
            }
            table.setAllValues(attendanceData);
            return container('<div>')(header, table.dom);
        },
        sidebar: container('<div>')($('<h1>Attendance</h1>'), sidebarTable.dom)
    };
}

function homepageNavigationScope(): NavigationScope {
    return {
        generateMainContentPanel: () => container('<h1>')('ARC App homepage')
    };
}
function aboutNavigationScope(): NavigationScope {
    return {
        generateMainContentPanel: () =>
            container('<div>')(
                container('<h1>')('About'),
                container('<p>')('Designed by Suhao Jeffrey Huang')
            )
    };
}

/*

ROOT WIDGET

(MAIN ENTRYPOINT)

*/

export function rootWidget(): Widget {
    let navigationState: any[] = [];
    let currentNavigationScope = homepageNavigationScope();
    function renavigate(newNavigationState: any[], keepScope: boolean) {
        console.log(newNavigationState, keepScope);
        try {
            navigationState = newNavigationState;
            if (keepScope) {
                if (navigationState[0] === 'requests') {
                    currentNavigationScope.generateMainContentPanel([
                        navigationState[1]
                    ]);
                }
                if (navigationState[0] === 'attendance') {
                    currentNavigationScope.generateMainContentPanel([
                        navigationState[1]
                    ]);
                }
            } else {
                if (newNavigationState[0] === undefined) {
                    currentNavigationScope = homepageNavigationScope();
                }
                if (navigationState[0] === 'about') {
                    currentNavigationScope = aboutNavigationScope();
                }
                if (navigationState[0] === 'requests') {
                    currentNavigationScope = requestsNavigationScope(
                        renavigate
                    );
                }
                if (navigationState[0] === 'scheduleEdit') {
                    currentNavigationScope = scheduleEditNavigationScope();
                }
                if (navigationState[0] === 'scheduleView') {
                    currentNavigationScope = scheduleViewNavigationScope();
                }
                if (navigationState[0] === 'attendance') {
                    currentNavigationScope = attendanceNavigationScope(
                        renavigate
                    );
                }
                generateSidebar(currentNavigationScope.sidebar);
            }
            generateMainContentPanel(
                currentNavigationScope.generateMainContentPanel(
                    navigationState.slice(1)
                )
            );
        } catch (e) {
            alertError(e); // TODO
        }
    }
    function generateSidebar(content?: JQuery): void {
        sidebarDom.empty();
        sidebarDom.removeClass('col-4 overflow-auto app-sidebar d-none');
        if (content) {
            sidebarDom.addClass('col-4 overflow-auto app-sidebar');
            sidebarDom.append(content);
        } else {
            sidebarDom.addClass('d-none');
        }
    }
    function generateMainContentPanel(content?: JQuery): void {
        mainContentPanelDom.empty();
        mainContentPanelDom.removeClass('col app-content-panel layout-v');
        if (content) {
            mainContentPanelDom.append(content);
            mainContentPanelDom.addClass('col app-content-panel layout-v');
        }
    }
    function generateNavigationBar(): HTMLElement {
        const dom = $(navigationBarString);
        dom.find('a')
            .css('cursor', 'pointer')
            .click(ev => {
                function command(
                    name: string,
                    textName: string,
                    loadingMessage: string,
                    finish: (result: any) => Promise<void>
                ) {
                    if (text == textName) {
                        (async () => {
                            const { closeModal } = showModal(
                                loadingMessage,
                                '',
                                bb => []
                            );
                            try {
                                const result = getResultOrFail(
                                    await askServer(['command', name])
                                );
                                await finish(result);
                            } catch (e) {
                                alertError(e);
                            } finally {
                                closeModal();
                            }
                        })();
                    }
                }
                ev.preventDefault();
                const text = $(ev.target).text();

                // DATA EDITOR
                // the data editor isn't considered a navigation state
                if (text == 'Tutors') tutors.makeTiledViewAllWindow();
                if (text == 'Learners') learners.makeTiledViewAllWindow();
                if (text == 'Bookings') bookings.makeTiledViewAllWindow();
                if (text == 'Matchings') matchings.makeTiledViewAllWindow();
                if (text == 'Request submissions')
                    requestSubmissions.makeTiledViewAllWindow();
                if (text == 'Requests') requests.makeTiledViewAllWindow();

                // SCHEDULER
                if (text == 'Handle requests') {
                    renavigate(['requests'], false);
                }
                if (text == 'Edit schedule') {
                    renavigate(['scheduleEdit'], false);
                }
                if (text == 'View schedule') {
                    renavigate(['scheduleView'], false);
                }

                // ATTENDANCE
                if (text == 'Attendance') {
                    renavigate(['attendance'], false);
                }

                // COMMANDS
                command(
                    'syncDataFromForms',
                    'Sync data from forms',
                    'Syncing data...',
                    async (result: any) => {
                        showModal(
                            'Sync successful',
                            `${result as number} new form submissions found`,
                            bb => [bb('OK', 'primary')]
                        );
                    }
                );

                command(
                    'generateSchedule',
                    'Generate schedule',
                    'Generating schedule...',
                    async (result: any) => {
                        showModal(
                            'Schedule successfully generated',
                            `The schedule in the spreadsheet has been updated`,
                            bb => [bb('OK', 'primary')]
                        );
                    }
                );

                command(
                    'recalculateAttendance',
                    'Recalculate attendance',
                    'Recalculating attendance...',
                    async (result: any) => {
                        showModal(
                            'Attendance successfully recalculated',
                            '',
                            bb => [bb('OK', 'primary')]
                        );
                    }
                );

                // MISC
                if (text == 'About') {
                    renavigate(['about'], false);
                }
                if (text == 'Force refresh') {
                    (async () => {
                        const { closeModal } = showModal(
                            'Loading force refresh...',
                            '',
                            bb => []
                        );
                        await tutors.state.forceRefresh();
                        await learners.state.forceRefresh();
                        await bookings.state.forceRefresh();
                        await matchings.state.forceRefresh();
                        await requests.state.forceRefresh();
                        await requestSubmissions.state.forceRefresh();
                        closeModal();
                    })();
                }
                if (text == 'Testing mode') {
                    window['APP_DEBUG_MOCK'] = 1;
                    tutors.state.forceRefresh();
                    learners.state.forceRefresh();
                    bookings.state.forceRefresh();
                    matchings.state.forceRefresh();
                    requests.state.forceRefresh();
                    requestSubmissions.state.forceRefresh();
                    for (const window of state.tiledWindows.val) {
                        window.onLoad.trigger();
                    }
                    showTestingModeWarning();
                }
            });

        return dom[0];
    }
    const sidebarDom = container('<div></div>')();
    const mainContentPanelDom = container('<div></div>')();
    const dom = container('<div id="app" class="layout-v"></div>')(
        container('<nav class="navbar layout-item-fit">')(
            $('<strong class="mr-4">ARC</strong>'),
            generateNavigationBar()
        ),
        container('<div class="row m-4 layout-h">')(
            sidebarDom,
            mainContentPanelDom
        )
    );
    if (window['APP_DEBUG_MOCK'] === 1) showTestingModeWarning();
    return { dom };
}
