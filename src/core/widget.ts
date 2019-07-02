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
    alertError
} from './shared';
import {
    ButtonWidget,
    showModal,
    ErrorWidget,
    FormSelectWidget,
    FormToggleWidget,
    MessageTemplateWidget
} from '../widgets/ui';
import { TilingWindowManagerWidget } from '../widgets/TilingWindowManager';
import { WindowsBarWidget } from '../widgets/WindowsBar';
import { useTiledWindow } from '../widgets/Window';
import { TableWidget } from '../widgets/Table';
import { ActionBarWidget } from '../widgets/ActionBar';
import { AskStatus, getResultOrFail } from './server';

/*

BASIC UTILITIES

*/

async function isOperationConfirmedByUser(args: {
    thisOpDoes: string[];
    makeSureThat: string[];
}): Promise<boolean> {
    return new Promise(async res => {
        const body = container('<div></div>')(
            $('<p><strong>This operation will do the following:</strong></p>'),
            container('<ul></ul>')(
                args.thisOpDoes.map(x => container('<li></li>')(x))
            ),
            $('<p><strong>Make sure that:</strong></p>'),
            container('<ul></ul>')(
                args.makeSureThat.map(x => container('<li></li>')(x))
            )
        );
        await showModal('Are you sure?', body, bb => [
            bb('Cancel', 'outline-secondary'),
            bb('Go ahead', 'primary', () => res(true))
        ]);
        res(false);
    });
}

const pillsString = `
<ul class="nav nav-pills">
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">View, edit, and add information</a>
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
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Scheduling workflow</a>
        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item">Check request submissions</a>
            <a class="dropdown-item">Handle requests and bookings</a>
            <a class="dropdown-item">Finalize matchings</a>
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

async function simpleStepWindow(
    defaultWindowLabel: JQuery | string,
    makeContent: (closeWindow: () => () => void) => JQuery
): Promise<void> {
    if (typeof defaultWindowLabel === 'string')
        defaultWindowLabel = container('<span></span>')(defaultWindowLabel);

    let errorMessage: string = '';
    try {
        const { closeWindow } = useTiledWindow(
            container('<div></div>')(
                container('<h1></h1>')(defaultWindowLabel),
                makeContent(() => closeWindow)
            ),
            ActionBarWidget([['Close', () => closeWindow()]]).dom,
            defaultWindowLabel.text()
        );
    } catch (err) {
        const windowLabel = 'ERROR in: ' + defaultWindowLabel.text();
        errorMessage = stringifyError(err);
        const { closeWindow } = useTiledWindow(
            ErrorWidget(errorMessage).dom,
            ActionBarWidget([['Close', () => closeWindow()]]).dom,
            windowLabel
        );
    }
}

/*

STEPS

*/

async function checkRequestSubmissionsStep() {
    await simpleStepWindow('New request submissions', closeWindow => {
        const recordCollection = requestSubmissions.state.getRecordCollectionOrFail();
        const table = TableWidget(
            ['Name', 'Convert into request'],
            (record: Record) => {
                async function attemptConversion() {
                    // CREATE LEARNER
                    // try to dig up a learner with matching student ID, which would mean
                    // that the learner already exists in the database
                    const matches: Record[] = Object.values(
                        learners.state.getRecordCollectionOrFail()
                    ).filter(
                        x =>
                            x.studentId === record.studentId
                    );
                    let learnerRecord: Record;
                    if (matches.length > 1) {
                        // duplicate learner student IDs??
                        // this should be validated in the database
                        throw new Error(
                            `duplicate student id: "${record.studentId}"`
                        );
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
                    getResultOrFail(
                        await requestSubmissions.state.updateRecord(record)
                    );
                }
                return [
                    requestSubmissions.createMarker(
                        record.id,
                        x => x.friendlyFullName
                    ),
                    ButtonWidget('Convert', async () => {
                        if (
                            await isOperationConfirmedByUser({
                                thisOpDoes: [
                                    `Creates a learner if he/she doesn't already exist in the app`,
                                    `Converts the "request submission" into a "request" and deletes the original`
                                ],
                                makeSureThat: [
                                    `Request submission information is accurate and correctly spelled`
                                ]
                            })
                        ) {
                            try {
                                closeWindow()();
                                await attemptConversion();
                            } catch (err) {
                                alertError(err);
                            }
                        }
                    }).dom
                ];
            }
        );
        table.setAllValues(Object.values(recordCollection).filter(x => x.status === 'unchecked'));
        return table.dom;
    });
}

type RequestIndexEntry = {
    id: number;
    bookings: number[];
    matchings: number[];
    currentStatus: string;
};

async function handleRequestsAndBookingsStep() {
    await simpleStepWindow('Requests & bookings', closeWindow => {
        const learnerRecords = learners.state.getRecordCollectionOrFail();
        const bookingRecords = bookings.state.getRecordCollectionOrFail();
        const matchingRecords = matchings.state.getRecordCollectionOrFail();
        const requestRecords = requests.state.getRecordCollectionOrFail();

        const table = TableWidget(
            ['Request', 'Current status', 'Open booker'],
            (i: RequestIndexEntry) => {
                return [
                    requests.createMarker(i.id, x =>
                        learners.createLabel(x.learner, y => y.friendlyFullName)
                    ),
                    i.currentStatus,
                    ButtonWidget('Open', () => {
                        closeWindow()();
                        showRequestBookerStep(i.id);
                    }).dom
                ];
            }
        );

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
            Object.values(requestsIndex).filter(
                x => x.currentStatus !== 'Matched'
            )
        );

        return table.dom;
    });
}

async function showRequestBookerStep(requestId: number) {
    type PotentialTableRowArgs = {
        tutorId: number;
        mods: PotentialTableRowModArgs[];
        numBookings: number;
    };
    type PotentialTableRowModArgs = {
        mod: number;
        isPref: boolean;
        isAlreadyBooked: boolean;
    };
    await simpleStepWindow(
        'Booker for ' +
        learners.createLabel(
            requests.state.getRecordOrFail(requestId).learner,
            x => x.friendlyFullName
        ),
        closeWindow => {
            const matchingRecords = matchings.state.getRecordCollectionOrFail();
            const bookingRecords = bookings.state.getRecordCollectionOrFail();
            const tutorRecords = tutors.state.getRecordCollectionOrFail();
            const table = TableWidget(
                ['Booking', 'Mark as...', 'Todo', 'Finalize'],
                (booking: Record) => {
                    const formSelectWidget = FormSelectWidget(
                        [
                            'unsent',
                            'waitingForTutor',
                            'waitingForLearner',
                            'rejectedByTutor',
                            'rejectedByLearner',
                            'rejected'
                        ],
                        [
                            'Unsent',
                            'Waiting for tutor',
                            'Waiting for learner',
                            'Rejected by tutor',
                            'Rejected by learner',
                            'Rejected for other reason'
                        ]
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
                        ButtonWidget('Finalize', () => {
                            finalizeBookingsStep(booking.id, () => closeWindow()());
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
                ['Tutor', '# times booked', 'Book for mods...'],
                ({ tutorId, mods, numBookings }: PotentialTableRowArgs) => {
                    const buttonsDom = $('<div></div>');
                    for (const { mod, isPref, isAlreadyBooked } of mods) {
                        const modLabel = mod + (isPref ? '*' : '');
                        if (isAlreadyBooked) {
                            buttonsDom.append(
                                ButtonWidget(
                                    modLabel + ' (already booked)',
                                    () => { }
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
                        tutors.createMarker(tutorId, x => x.friendlyFullName),
                        String(numBookings),
                        buttonsDom
                    ];
                }
            );
            const saveBookingsButton = ButtonWidget(
                'Save bookings and close',
                async () => {
                    closeWindow()();
                    try {
                        for (const { tutorId, mod } of bookingsInfo) {
                            const ask = await bookings.state.createRecord({
                                id: -1,
                                date: -1,
                                tutor: tutorId,
                                mod,
                                request: requestId,
                                status: 'unsent'
                            });
                            if (ask.status === AskStatus.ERROR) {
                                throw ask.message;
                            }
                        }
                    } catch (err) {
                        alertError(err);
                    }
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
                                isAlreadyBooked: tutor.bookedMods.includes(mod)
                            });
                        }
                    }
                }
                if (modResults.length > 0) {
                    tableValues.push({
                        tutorId: tutor.id,
                        mods: modResults,
                        numBookings: tutor.bookedMods.length
                    });
                }
            }
            potentialTable.setAllValues(tableValues);
            return container('<div></div>')(
                table.dom,
                potentialTable.dom,
                saveBookingsButton.dom
            );
        }
    );
}
async function showBookingMessagerStep(bookingId: number) {
    const b = bookings.state.getRecordOrFail(bookingId);
    const r = requests.state.getRecordOrFail(b.request);

    await simpleStepWindow(
        container('<span></span>')(
            'Messager for ',
            learners.createMarker(r.learner, x => x.friendlyFullName),
            ' <> ',
            tutors.createMarker(b.tutor, x => x.friendlyFullName)
        ),
        closeWindow => {
            const dom = $('<div></div>');

            if (b.status === 'unsent') {
                dom.append(
                    $(
                        '<p>Because status is "unsent", send the message to the tutor:</p>'
                    )
                );
                dom.append(
                    MessageTemplateWidget(
                        `Hi! Can you tutor a student in ${r.subject} on mod ${stringifyMod(b.mod)}?`
                    ).dom
                );
                dom.append(
                    $(
                        '<p>Once you send the message, go back and set the status to "waiting for tutor".</p>'
                    )
                );
            }
            if (b.status === 'waitingForTutor') {
                dom.append(
                    $(
                        '<p>You are waiting for the tutor. Once the tutor replies, send a message to the learner:</p>'
                    )
                );
                dom.append(
                    MessageTemplateWidget(
                        `Hi! We have a tutor for you on mod ${stringifyMod(b.mod)}. Can you come?`
                    ).dom
                );
                dom.append(
                    $(
                        '<p>Once you send the message, go back and set the status to "waiting for learner".</p>'
                    )
                );
            }
            if (b.status === 'waitingForLearner') {
                dom.append(
                    $(
                        '<p>You are waiting for the learner. Once the learner replies, if everything is good, go back and click "finalize".</p>'
                    )
                );
            }

            return dom;
        }
    );
}

async function finalizeBookingsStep(
    bookingId: number,
    onVerify: () => void
): Promise<boolean> {
    if (
        await isOperationConfirmedByUser({
            thisOpDoes: [
                'Assigns the tutor to the learner, replacing the booking with a matching (this can be undone by deleting the matching and rebooking)',
                'Deletes all other bookings associated with the learner'
            ],
            makeSureThat: ['The tutor and learner really should be matched']
        })
    ) {
        onVerify();
        try {
            const b = bookings.state.getRecordOrFail(bookingId);
            const r = requests.state.getRecordOrFail(b.request);
            // ADD MATCHING
            const ask = await matchings.state.createRecord({
                learner: r.learner,
                tutor: b.tutor,
                subject: r.subject,
                mod: b.mod,
                status: 'unwritten',
                specialRoom: r.specialRoom,
                id: -1,
                date: -1
            });
            if (ask.status === AskStatus.ERROR) {
                throw ask.message;
            }
            // DELETE ALL BOOKINGS FOR REQUEST
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
        }
        return true;
    } else {
        return false;
    }
}

async function finalizeMatchingsStep() {
    await simpleStepWindow('Finalize matchings', closeWindow => {
        const table = TableWidget(
            ['Matching', 'Status', 'Write', 'Finalize'],
            (record: Record) => {
                const formSelectWidget = FormSelectWidget(
                    ['unwritten', 'unsent', 'unfinalized'],
                    ['Unwritten', 'Unsent', 'Unfinalized']
                );
                formSelectWidget.setValue(record.status);
                formSelectWidget.onChange(async newVal => {
                    record.status = newVal;
                    const response = await matchings.state.updateRecord(record);
                    if (response.status === AskStatus.ERROR) {
                        alertError(response.message);
                    }
                });
                return [
                    learners.createLabel(
                        record.learner,
                        x => x.friendlyFullName
                    ) +
                    '<>' +
                    tutors.createLabel(
                        record.tutor,
                        x => x.friendlyFullName
                    ),
                    formSelectWidget.dom,
                    ButtonWidget('Send', () => {
                        showMatchingSender(record.id);
                    }).dom,
                    ButtonWidget('Finalize', () => {
                        finalizeMatching(record.id, closeWindow());
                    }).dom
                ];
            }
        );
        const records = Object.values(
            matchings.state.getRecordCollectionOrFail()
        );
        table.setAllValues(records.filter(x => x.status !== 'finalized'));

        return table.dom;
    });
}

async function showMatchingSender(matchingId: number) {
    const m = matchings.state.getRecordOrFail(matchingId);
    await simpleStepWindow(
        container('<span></span>')(
            'Send matching: ',
            learners.createMarker(m.learner, x => x.friendlyFullName),
            ' <> ',
            tutors.createMarker(m.tutor, x => x.friendlyFullName)
        ),
        closeWindow => {
            const t = tutors.state.getRecordOrFail(m.tutor);
            const l = learners.state.getRecordOrFail(m.learner);
            return container('<div></div>')(
                'Send this to the learner.',
                MessageTemplateWidget(
                    `You will be tutored by ${t.friendlyFullName} during mod ${stringifyMod(m.mod)}.`
                ).dom,
                'Then, send this to the tutor.',
                MessageTemplateWidget(
                    `You will be tutoring ${l.friendlyFullName} during mod ${stringifyMod(m.mod)}.`
                ).dom
            );
        }
    );
}

async function finalizeMatching(matchingId: number, onVerify: () => void) {
    if (
        await isOperationConfirmedByUser({
            thisOpDoes: [
                'Marks the matching as finalized, which posts it on the schedule page and attendance tracker'
            ],
            makeSureThat: ['Everyone is notified of the matching']
        })
    ) {
        onVerify();
        // MARK MATCHING AS FINALIZED
        const r = matchings.state.getRecordOrFail(matchingId);
        r.status = 'finalized';
        matchings.state.updateRecord(r);
    }
}

async function attendanceStep() {
    await simpleStepWindow('Attendance', _closeWindow => {
        const t = Object.values(tutors.state.getRecordCollectionOrFail());
        const l = Object.values(learners.state.getRecordCollectionOrFail());
        const table = TableWidget(
            // Both learners and tutors are students.
            ['Student', 'Total minutes', 'Attendance level', 'Details'],
            ({ isLearner, student }: { isLearner: boolean, student: Record }) => {
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
                        attendanceDetailsStep({ isLearner, student });
                    }).dom
                ];
            }
        );
        table.setAllValues(t.map(x => ({ isLearner: false, student: x }))
            .concat(l.map(x => ({ isLearner: true, student: x })))
        );
        return table.dom;
    });
}

async function attendanceDetailsStep({ isLearner, student }: { isLearner: boolean, student: Record }) {
    await simpleStepWindow(container('<span>')(
        'Attendance for ',
        (isLearner ? learners : tutors).createMarker(student.id, x => x.friendlyFullName)),
        _closeWindow => {
            const table = TableWidget(
                // Both learners and tutors are students.
                ['Date', 'Mod', 'Present?'],
                (attendanceEntry: { date: number, mod: number, minutes: number }) => {
                    return [
                        new Date(attendanceEntry.date).toISOString().substring(0, 10),
                        String(attendanceEntry.mod),
                        attendanceEntry.minutes > 0 ? `P (${attendanceEntry.minutes} minutes)` : $('<span style="color:red">ABSENT</span>')
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
            return table.dom;
        }
    );
}

/*

ROOT WIDGET

*/

export function rootWidget(): Widget {
    function PillsWidget(): Widget {
        const dom = $(pillsString);
        dom.find('a')
            .css('cursor', 'pointer')
            .click(ev => {
                const text = $(ev.target).text();
                if (text == 'Tutors') tutors.makeTiledViewAllWindow();
                if (text == 'Learners') learners.makeTiledViewAllWindow();
                if (text == 'Bookings') bookings.makeTiledViewAllWindow();
                if (text == 'Matchings') matchings.makeTiledViewAllWindow();
                if (text == 'Request submissions')
                    requestSubmissions.makeTiledViewAllWindow();
                if (text == 'Requests') requests.makeTiledViewAllWindow();
                ev.preventDefault();
                if (text == 'About')
                    showModal('About', 'Made by Suhao Jeffrey Huang', bb => [
                        bb('OK', 'primary')
                    ]);
                if (text == 'Force refresh') {
                    tutors.state.forceRefresh();
                    learners.state.forceRefresh();
                    bookings.state.forceRefresh();
                    matchings.state.forceRefresh();
                    requests.state.forceRefresh();
                    requestSubmissions.state.forceRefresh();
                    for (const window of state.tiledWindows.val) {
                        window.onLoad.trigger();
                    }
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
                    showModal('Testing mode loaded', 'The app has been disconnected from the actual database/forms and replaced with a blank test database with no data. Start by creating a tutor, learner, and request submission.', bb => [bb('OK', 'primary')]);
                }
                if (text == 'Check request submissions') {
                    checkRequestSubmissionsStep();
                }
                if (text == 'Handle requests and bookings') {
                    handleRequestsAndBookingsStep();
                }
                if (text == 'Finalize matchings') {
                    finalizeMatchingsStep();
                }
                if (text == 'Attendance') {
                    attendanceStep();
                }
            });

        return { dom };
    }

    const dom = container('<div id="app" class="layout-v"></div>')(
        container('<nav class="navbar layout-item-fit">')(
            $('<strong class="mr-4">ARC</strong>'),
            PillsWidget().dom
        ),
        container('<nav class="navbar layout-item-fit layout-v"></div>')(
            WindowsBarWidget().dom
        ),
        container('<div class="layout-item-scroll"></div>')(
            TilingWindowManagerWidget().dom
        )
    );
    return { dom };
}
