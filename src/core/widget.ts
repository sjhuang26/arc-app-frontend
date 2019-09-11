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

function showStep3Messager(bookingId: number) {
    const b = bookings.state.getRecordOrFail(bookingId);
    const r = requests.state.getRecordOrFail(b.request);
    const t = tutors.state.getRecordOrFail(b.tutor);
    const l = learners.state.getRecordOrFail(r.learner);

    const dom = $('<div></div>');

    dom.append($('<p>Contact the tutor:</p>'));
    dom.append(
        MessageTemplateWidget(
            `This is to confirm that starting now, you will be tutoring ${
                l.friendlyFullName
            } in subject ${r.subject} during mod ${stringifyMod(b.mod)}.`
        ).dom
    );

    dom.append($('<p>Contact the learner:</p>'));
    dom.append(
        MessageTemplateWidget(
            `This is to confirm that starting now, you will be tutored by ${
                t.friendlyFullName
            } in subject ${r.subject} during mod ${stringifyMod(b.mod)}.`
        ).dom
    );

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

function showStep1Messager(bookingId: number) {
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

async function requestChangeToStep4(requestId: number, onFinish: () => void) {
    const { closeModal } = showModal('Saving...', '', bb => [], true);
    try {
        const r = requests.state.getRecordOrFail(requestId);
        const b = bookings.state.getRecordOrFail(r.chosenBooking);
        // ADD MATCHING
        await matchings.state.createRecord({
            learner: r.learner,
            tutor: b.tutor,
            subject: r.subject,
            mod: b.mod,
            specialRoom: r.specialRoom,
            id: -1,
            date: -1
        });
        // DELETE ALL BOOKINGS ASSOCIATED WITH REQUEST
        for (const booking of Object.values(
            bookings.state.getRecordCollectionOrFail()
        )) {
            if (booking.request === r.id) {
                await bookings.state.deleteRecord(booking.id);
            }
        }
        // DELETE THE REFERENCE TO THE BOOKING & ADVANCE THE STEP
        r.step = 4;
        r.chosenBooking = -1;
        await requests.state.updateRecord(r);
    } catch (err) {
        alertError(err);
    } finally {
        closeModal();
        onFinish();
    }
}

async function requestChangeToStep3(requestId: number, onFinish: () => void) {
    const { closeModal } = showModal('Saving...', '', bb => [], true);
    try {
        const r = requests.state.getRecordOrFail(requestId);
        r.step = 3;
        await requests.state.updateRecord(r);
    } catch (err) {
        alertError(err);
    } finally {
        closeModal();
        onFinish();
    }
}

async function requestChangeToStep2(
    requestId: number,
    bookingId: number,
    onFinish: () => void
): Promise<boolean> {
    if (
        await isOperationConfirmedByUser(
            'Are you sure you want to match these students?'
        )
    ) {
        const { closeModal } = showModal('Saving...', '', bb => [], true);
        try {
            const r = requests.state.getRecordOrFail(requestId);
            // "choose" the booking
            r.chosenBooking = bookingId;
            // go to step 2
            r.step = 2;
            // update record
            requests.state.updateRecord(r);
        } catch (err) {
            alertError(err);
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
    // TYPES AND UTILITIES
    type BookingsInfo = { tutorId: number; mod: number }[];
    type RequestIndex = {
        [id: number]: { id: number; hasBookings: boolean; uiStep: number };
    };
    type TutorIndex = {
        [id: string]: {
            id: number;
            matchedMods: number[];
            bookedMods: number[];
        };
    };
    function stepToName(step: number) {
        if (step === 0) return 'not started';
        if (step === 1) return 'booking';
        if (step === 2) return 'pass';
        if (step === 3) return 'confirmation';
        return '???';
    }

    // MAJOR FUNCTIONS
    function generatePotentialTable({
        bookingsInfo,
        tutorIndex,
        request
    }: {
        bookingsInfo: BookingsInfo;
        tutorIndex: TutorIndex;
        request: Record;
    }): JQuery {
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
                    const w = FormToggleWidget(modLabel, 'Unbook ' + modLabel);
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
        const potentialTableValues: PotentialTableRowArgs[] = [];
        for (const tutor of Object.values(tutorIndex)) {
            const modResults: PotentialTableRowModArgs[] = [];
            for (const mod of request.mods) {
                if (!tutor.matchedMods.includes(mod)) {
                    const tutorRecord = tutors.state.getRecordOrFail(tutor.id);
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
                potentialTableValues.push({
                    tutorId: tutor.id,
                    mods: modResults
                });
            }
        }
        potentialTable.setAllValues(potentialTableValues);
        return potentialTable.dom;
    }
    async function attemptRequestSubmissionConversion(
        record: Record
    ): Promise<void> {
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
                    homeroom: record.homeroom,
                    homeroomTeacher: record.homeroomTeacher,
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
                specialRoom: record.specialRoom,
                step: 1
            })
        );

        // MARK REQUEST SUBMISSION AS CHECKED
        // NOTE: this is only done if the above steps worked
        // so if there's an error, the request submission won't be obliterated
        record.status = 'checked';
        getResultOrFail(await requestSubmissions.state.updateRecord(record));
    }
    function generateRequestsTable(): JQuery {
        const requestsTable = TableWidget(
            ['Request', 'Step #', 'Open'],
            (i: Record) => {
                return [
                    requests.createDataEditorMarker(i.id, x =>
                        learners.createLabel(x.learner, y => y.friendlyFullName)
                    ),
                    String(requestIndex[i.id].uiStep),
                    ButtonWidget('Open', () => {
                        renavigate(['requests', i.id], false);
                    }).dom
                ];
            }
        );
        requestsTable.setAllValues(Object.values(requestRecords));
        return requestsTable.dom;
    }
    function buildRequestIndex(): RequestIndex {
        const index: RequestIndex = {};
        for (const request of Object.values(requestRecords)) {
            index[request.id] = {
                id: request.id,
                hasBookings: false,
                uiStep: -1
            };
        }
        for (const booking of Object.values(bookingRecords)) {
            index[booking.request].hasBookings = true;
        }
        for (const i of Object.values(index)) {
            if (!index[i.id].hasBookings && requestRecords[i.id].step === 1) {
                index[i.id].uiStep = 0;
            } else {
                index[i.id].uiStep = requestRecords[i.id].step;
            }
        }
        return index;
    }
    function buildRSButton(): JQuery {
        return ButtonWidget('Convert new request submissions', async () => {
            const { closeModal } = showModal(
                'Converting...',
                '',
                bb => [],
                true
            );
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
        }).dom;
    }
    function buildTutorIndex(): TutorIndex {
        const index: TutorIndex = {};
        for (const x of Object.values(tutorRecords)) {
            index[String(x.id)] = {
                id: x.id,
                matchedMods: [],
                bookedMods: []
            };
        }
        for (const x of Object.values(matchingRecords)) {
            index[String(x.tutor)].matchedMods.push(x.mod);
        }
        for (const x of Object.values(bookingRecords)) {
            index[String(x.tutor)].bookedMods.push(x.mod);
        }
        return index;
    }
    function generateBookerTable(requestId: number): JQuery {
        const bookerTable = TableWidget(
            ['Booking', 'Status', 'Todo', 'Match'],
            (booking: Record) => {
                const formSelectWidget = FormSelectWidget(
                    ['ignore', 'unsent', 'waitingForTutor', 'rejected'],
                    ['Ignore', 'Unsent', 'Waiting', 'Rejected']
                );
                formSelectWidget.setValue(booking.status);
                formSelectWidget.onChange(async newVal => {
                    booking.status = newVal;
                    const response = await bookings.state.updateRecord(booking);
                    if (response.status === AskStatus.ERROR) {
                        alertError(response.message);
                    }
                });
                return [
                    bookings.createFriendlyMarker(
                        booking.id,
                        b =>
                            tutors.createLabel(
                                booking.tutor,
                                x => x.friendlyFullName
                            ) +
                            ' <> ' +
                            learners.createLabel(
                                requests.state.getRecordOrFail(booking.request)
                                    .learner,
                                x => x.friendlyFullName
                            )
                    ),
                    formSelectWidget.dom,
                    ButtonWidget('Todo', () => showStep1Messager(booking.id))
                        .dom,
                    ButtonWidget('Match', () => {
                        requestChangeToStep2(requestId, booking.id, () =>
                            renavigate(['requests'], false)
                        );
                    }).dom
                ];
            }
        );
        bookerTable.setAllValues(
            Object.values(bookings.state.getRecordCollectionOrFail())
                .filter(x => x.request === requestId)
                .map(x => bookings.state.getRecordOrFail(x.id))
        );
        return bookerTable.dom;
    }
    function generateEditBookingsButton({
        bookingsInfo,
        tutorIndex,
        request
    }: {
        bookingsInfo: BookingsInfo;
        tutorIndex: TutorIndex;
        request: Record;
    }): JQuery {
        return ButtonWidget('Edit bookings', () => {
            showModal(
                'Edit bookings',
                generatePotentialTable({
                    bookingsInfo,
                    tutorIndex,
                    request
                }),
                bb => [
                    bb('Save', 'primary', async () => {
                        try {
                            const { closeModal } = showModal(
                                'Saving...',
                                '',
                                bb => []
                            );
                            for (const { tutorId, mod } of bookingsInfo) {
                                await bookings.state.createRecord({
                                    id: -1,
                                    date: -1,
                                    tutor: tutorId,
                                    mod,
                                    request: request.id,
                                    status: 'unsent'
                                });
                            }
                            closeModal();
                            renavigate(['requests', request.id], false);
                        } catch (err) {
                            alertError(err);
                        }
                    }),
                    bb('Cancel', 'secondary')
                ]
            );
        }).dom;
    }

    // LOAD RESOURCES
    const learnerRecords = learners.state.getRecordCollectionOrFail();
    const bookingRecords = bookings.state.getRecordCollectionOrFail();
    const matchingRecords = matchings.state.getRecordCollectionOrFail();
    const requestRecords = requests.state.getRecordCollectionOrFail();
    const tutorRecords = tutors.state.getRecordCollectionOrFail();
    const requestSubmissionRecords = requestSubmissions.state.getRecordCollectionOrFail();

    // FILTER FOR UNCHECKED REQUEST SUBMISSIONS
    const uncheckedRequestSubmissions = Object.values(
        requestSubmissionRecords
    ).filter(x => x.status === 'unchecked');

    // BUILD VARIABLES
    const requestIndex = buildRequestIndex();

    return {
        generateMainContentPanel(navigationState: any[]) {
            // RELEVANT TO ALL STEPS
            const requestId: number = navigationState[0];
            if (requestId === undefined) {
                return null;
            }
            const request = requests.state.getRecordOrFail(requestId);

            const header = container('<h1>')(
                requests.createFriendlyMarker(requestId, () => 'Request'),
                ': ',
                learners.createFriendlyMarker(
                    requests.state.getRecordOrFail(requestId).learner,
                    x => x.friendlyFullName
                ),
                container('<span class="badge badge-secondary">')(
                    `Step ${requestIndex[requestId].uiStep} (${stepToName(
                        requestIndex[requestId].uiStep
                    )})`
                )
            );

            // LOGIC: We use a toggle structure where:
            // - There is a row of mod buttons
            // - There is add functionality, but not delete functionality (bookings can be individually deleted)
            // - Toggling the button toggles entries in a temporary array of all added bookings [[tutor, mod]] via. filters
            // - Clicking "Save bookings and close" will write to the database
            let bookingsInfo: BookingsInfo = [];
            // LOGIC: calculating which tutors work for this request
            // - tutor must not be matched at the target mod
            // - tutor may be matched to another mod
            // - for each tutor, keep track of which mods they've been matched to
            // - SENDS TO TABLE: [ tutorId, [ mod, isPref: boolean ] ]
            const tutorIndex: TutorIndex = buildTutorIndex();

            if (requestIndex[requestId].uiStep < 2) {
                const uiStep01 = container('<div></div>')(
                    header,
                    generateBookerTable(requestId),
                    generateEditBookingsButton({
                        bookingsInfo,
                        tutorIndex,
                        request
                    })
                );
                return uiStep01;
            }
            if (requestIndex[requestId].uiStep === 2) {
                const uiStep2 = container('<div class="jumbotron">')(
                    container('<h1>')('Write a pass for the learner'),
                    container('<p class="lead">')('Here is the information:'),
                    container('<p>')(
                        'Homeroom = ' + requestRecords[requestId].homeroom
                    ),
                    container('<p>')(
                        'Homeroom teacher = ' +
                            requestRecords[requestId].homeroomTeacher
                    ),
                    ButtonWidget("OK, I've written the pass", () =>
                        requestChangeToStep3(requestId, () =>
                            renavigate(['requests', requestId], false)
                        )
                    ).dom
                );
                return uiStep2;
            }
            if (requestIndex[requestId].uiStep === 3) {
                const uiStep3 = container('<div class="jumbotron">')(
                    container('<h1>')('Send a confirmation to the learner'),
                    ButtonWidget('Send confirmation', () =>
                        showStep3Messager(request.chosenBooking)
                    ).dom,
                    container('<p class="lead">')(
                        'After that, click the button below, and the tutor will be assigned for real.'
                    ),
                    ButtonWidget("OK, let's assign the tutor for real", () =>
                        requestChangeToStep4(requestId, () =>
                            renavigate(['requests', requestId], false)
                        )
                    ).dom
                );
                return uiStep3;
            }
            if (requestIndex[requestId].uiStep === 4) {
                const uiStep4 = container('<div class="jumbotron">')(
                    container('<h1>')('This request appears to be done'),
                    requests.createFriendlyMarker(
                        requestId,
                        () => 'Open advanced request editor confirmation'
                    )
                );
                return uiStep4;
            }
        },
        sidebar: container('<div>')(
            container('<h1>')('Requests'),
            uncheckedRequestSubmissions.length > 0
                ? buildRSButton()
                : undefined,
            generateRequestsTable()
        )
    };
}

function scheduleEditNavigationScope(
    renavigate: (newNavigationState: any[], keepScope: boolean) => void
): NavigationScope {
    // LOAD RECORD COLLECTIONS
    const bookingRecords = bookings.state.getRecordCollectionOrFail();
    const matchingRecords = matchings.state.getRecordCollectionOrFail();
    const tutorRecords = tutors.state.getRecordCollectionOrFail();

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
        const { closeModal } = showModal('Saving...', '', bb => [], true);
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

    // INIT DOM
    const availableDomA = container('<div>')();
    const availableDomB = container('<div>')();
    for (let i = 0; i < 10; ++i) {
        availableDomA.append(
            container('<div>')(
                $('<p class="lead"><strong></strong></p>').text(`Mod ${i + 1}`),
                container('<ul class="list-group">')()
            )
        );
    }
    for (let i = 0; i < 10; ++i) {
        availableDomB.append(
            container('<div>')(
                $('<p class="lead"><strong></strong></p>').text(
                    `Mod ${i + 11}`
                ),
                container('<ul class="list-group">')()
            )
        );
    }
    const scheduleDomA = container('<div>')();
    const scheduleDomB = container('<div>')();
    for (let i = 0; i < 10; ++i) {
        scheduleDomA.append(
            container('<div>')(
                $('<p class="lead"><strong></strong></p>').text(`Mod ${i + 1}`),
                container('<ul class="list-group">')()
            )
        );
    }
    for (let i = 0; i < 10; ++i) {
        scheduleDomB.append(
            container('<div>')(
                $('<p class="lead"><strong></strong></p>').text(
                    `Mod ${i + 11}`
                ),
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
            tutorModStatusIndex[tutor.id].modStatus[mod - 1] = 'available';
        }
        // mod status: drop-in
        for (const mod of tutor.dropInMods) {
            if (
                tutorModStatusIndex[tutor.id].modStatus[mod - 1] === 'available'
            ) {
                tutorModStatusIndex[tutor.id].modStatus[mod - 1] = 'dropIn';
            }
        }
        // preferred mods
        for (const mod of tutor.modsPref) {
            tutorModStatusIndex[tutor.id].modStatus[mod - 1] += 'Pref';
        }
    }
    for (const booking of Object.values(bookingRecords)) {
        if (booking.status !== 'ignore' && booking.status !== 'rejected') {
            tutorModStatusIndex[booking.tutor].modStatus[booking.mod - 1] = [
                'booked',
                booking.id
            ];
        }
    }
    for (const matching of Object.values(matchingRecords)) {
        tutorModStatusIndex[matching.tutor].modStatus[matching.mod - 1] = [
            'matched',
            matching.id
        ];
    }
    function generatePopupAvailable(id: number, mod: number) {
        const initialStatus = tutorModStatusIndex[id].modStatus[mod - 1];
        if (typeof initialStatus !== 'string') {
            throw new Error('typecheck failed in generatePopupSchedule');
        }
        const element = container(
            '<li class="list-group-item list-group-item-action">'
        )(
            tutors.createLabel(id, x => x.friendlyFullName),
            initialStatus.endsWith('Pref') ? '*' : ''
        );
        if (initialStatus.endsWith('Pref')) {
            element.addClass('text-primary');
        }
        if (mod < 10) {
            availableDomA
                .children()
                .eq(mod - 1)
                .children()
                .eq(1)
                .append(element);
        } else {
            availableDomB
                .children()
                .eq(mod - 11)
                .children()
                .eq(1)
                .append(element);
        }
        const buttons = container('<div class="btn-group m-2">')();
        for (let i = 0; i < 20; ++i) {
            const status = tutorModStatusIndex[id].modStatus[i];
            if (typeof status !== 'string' || !status.startsWith('available'))
                continue;
            buttons.append(
                ButtonWidget(
                    String(i + 1) + (status === 'availablePref' ? '*' : ''),
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
            content: buttons[0],
            placement: 'auto',
            html: true,
            trigger: 'click'
        });
    }
    function generatePopupSchedule(id: number, mod: number) {
        console.log(tutorModStatusIndex);
        const initialStatus = tutorModStatusIndex[id].modStatus[mod - 1];
        if (typeof initialStatus !== 'string') {
            throw new Error('typecheck failed in generatePopupSchedule');
        }
        const element = container(
            '<li class="list-group-item list-group-item-action">'
        )(
            tutors.createLabel(id, x => x.friendlyFullName),
            initialStatus.endsWith('Pref') ? '*' : ''
        );
        if (initialStatus.endsWith('Pref')) {
            element.addClass('text-primary');
        }
        if (mod < 10) {
            scheduleDomA
                .children()
                .eq(mod - 1)
                .children()
                .eq(1)
                .append(element);
        } else {
            scheduleDomB
                .children()
                .eq(mod - 11)
                .children()
                .eq(1)
                .append(element);
        }

        const buttons = container('<div class="btn-group m-2">')();
        for (let i = 0; i < 20; ++i) {
            const status = tutorModStatusIndex[id].modStatus[i];
            if (typeof status !== 'string' || !status.startsWith('available'))
                continue;
            buttons.append(
                ButtonWidget(
                    String(i + 1) + (status === 'availablePref' ? '*' : ''),
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
                            tutorModStatusIndex[id].modStatus[mod - 1] ===
                            'dropInPref'
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
        buttons.append(
            ButtonWidget('X', () => {
                // remove the mod entirely
                const arr = editedDropInModsIndex[id];
                arr.splice(arr.indexOf(mod), 1);
                // sort
                arr.sort();
                // edit status index
                tutorModStatusIndex[id].modStatus[mod - 1] =
                    tutorModStatusIndex[id].modStatus[mod - 1] === 'dropInPref'
                        ? 'availablePref'
                        : 'available';
                // detach element
                element.detach();
                // dispose popover
                element.popover('dispose');
            }).dom
        );
        element.popover({
            content: buttons[0],
            placement: 'auto',
            html: true,
            trigger: 'click'
        });
    }
    function generatePopupScheduleMatch(id: number, mod: number) {
        const initialStatus = tutorModStatusIndex[id].modStatus[mod - 1];
        if (!Array.isArray(initialStatus)) {
            throw new Error('typecheck failed in generatePopupScheduleMatch');
        }
        const matchingId = initialStatus[1] as number;
        const element = container('<li class="text-danger list-group-item">')(
            matchings.createLabel(
                matchingId,
                x =>
                    tutors.createLabel(x.tutor, y => y.friendlyFullName) +
                    ' (matched)'
            )
        );
        if (mod < 10) {
            scheduleDomA
                .children()
                .eq(mod - 1)
                .children()
                .eq(1)
                .append(element);
        } else {
            scheduleDomB
                .children()
                .eq(mod - 11)
                .children()
                .eq(1)
                .append(element);
        }
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
    function generatePopupScheduleBook(
        id: number,
        mod: number,
        bookingId: number
    ) {
        const initialStatus = tutorModStatusIndex[id].modStatus[mod - 1];
        if (!Array.isArray(initialStatus)) {
            throw new Error('typecheck failed in generatePopupScheduleBook');
        }
        const element = container(
            '<li class="text-danger list-group-item list-group-item-action">'
        )(tutors.createLabel(id, x => x.friendlyFullName), ' (booked)');
        if (mod < 10) {
            scheduleDomA
                .children()
                .eq(mod - 1)
                .children()
                .eq(1)
                .append(element);
        } else {
            scheduleDomB
                .children()
                .eq(mod - 11)
                .children()
                .eq(1)
                .append(element);
        }
        const contentDom = container('<span>')('Details:');
        contentDom.append(
            bookings.createDomLabel(bookingId, x =>
                container('<span>')(
                    tutors.createFriendlyMarker(
                        x.tutor,
                        y => y.friendlyFullName
                    ),
                    ' <> ',
                    requests.createFriendlyMarker(
                        x.request,
                        y => 'link to request',
                        () => renavigate(['requests', x.request], false)
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

    for (const { id, modStatus } of Object.values(tutorModStatusIndex)) {
        for (let i = 0; i < 20; ++i) {
            const status = modStatus[i];
            if (Array.isArray(status)) {
                if (status[0] === 'matched') {
                    generatePopupScheduleMatch(id, i + 1);
                }
                if (status[0] === 'booked') {
                    generatePopupScheduleBook(id, i + 1, status[1] as number);
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

    function generateMainContentPanel(newNavigationState: any[]) {
        const day: string = newNavigationState[0] as string;
        return container('<div class="layout-h">')(
            container('<div class="layout-v">')(
                container('<h1 class="text-center layout-item-fit">')(
                    'Available'
                ),
                container('<div class="overflow-auto p-2">')(
                    availableDomA
                        .addClass('overflow-auto')
                        .toggleClass('d-none', !day.includes('A')),
                    availableDomB
                        .addClass('overflow-auto')
                        .toggleClass('d-none', !day.includes('B'))
                )
            ),
            container('<div class="layout-v">')(
                container('<h1 class="text-center layout-item-fit">')(
                    'Schedule',
                    ButtonWidget('Save', () => onSave()).dom,
                    ButtonWidget('A days', () =>
                        renavigate(['scheduleEdit', 'A'], true)
                    ).dom,
                    ButtonWidget('B days', () =>
                        renavigate(['scheduleEdit', 'B'], true)
                    ).dom,
                    ButtonWidget('Both days', () =>
                        renavigate(['scheduleEdit', 'AB'], true)
                    ).dom
                ),
                container('<div class="overflow-auto p-2">')(
                    scheduleDomA.toggleClass('d-none', !day.includes('A')),
                    scheduleDomB.toggleClass('d-none', !day.includes('B'))
                )
            )
        );
    }
    return {
        generateMainContentPanel
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
                if (navigationState[0] === 'scheduleEdit') {
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
                    currentNavigationScope = scheduleEditNavigationScope(
                        renavigate
                    );
                }
                if (navigationState[0] === 'scheduleView') {
                    currentNavigationScope = scheduleViewNavigationScope();
                }
                if (navigationState[0] === 'attendance') {
                    currentNavigationScope = attendanceNavigationScope(
                        renavigate
                    );
                }
                generateSidebar(currentNavigationScope.sidebar, keepScope);
            }
            generateMainContentPanel(
                currentNavigationScope.generateMainContentPanel(
                    navigationState.slice(1)
                ),
                keepScope
            );
        } catch (e) {
            alertError(e); // TODO
        }
    }
    function generateSidebar(content: JQuery, keepScope: boolean): void {
        if (!keepScope) {
            // deal with popovers
            $('.popover').popover('dispose');
        } else {
            $('.popover').popover('hide');
        }

        sidebarDom.empty();
        sidebarDom.removeClass('col-4 overflow-auto app-sidebar d-none');
        if (content) {
            sidebarDom.addClass('col-4 overflow-auto app-sidebar');
            sidebarDom.append(content);
        } else {
            sidebarDom.addClass('d-none');
        }
    }
    function generateMainContentPanel(
        content: JQuery,
        keepScope: boolean
    ): void {
        if (!keepScope) {
            // deal with popovers
            $('.popover').popover('dispose');
        } else {
            $('.popover').popover('hide');
        }
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
                    renavigate(['scheduleEdit', 'A'], false);
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
                        renavigate(navigationState, false);
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
