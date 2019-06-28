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
    Event,
    RecordCollection,
    stringifyError,
    Record
} from './shared';
import {
    ButtonWidget,
    showModal,
    ErrorWidget,
    FormSelectWidget
} from '../widgets/ui';
import { TilingWindowManagerWidget } from '../widgets/TilingWindowManager';
import { WindowsBarWidget } from '../widgets/WindowsBar';
import { useTiledWindow } from '../widgets/Window';
import { TableWidget } from '../widgets/Table';
import { ActionBarWidget } from '../widgets/ActionBar';
import { AskStatus, getResultOrFail } from './server';

async function isOperationConfirmedByUser(args: {
    thisOpDoes: string[];
    makeSureThat: string[];
}) {
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
    <li class="nav-item">
        <a class="nav-link">Tutors</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Learners</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Requests</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Request submissions</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Bookings</a>
    </li>
    <li class="nav-item">
        <a class="nav-link">Matchings</a>
    </li>
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Other</a>
        <div class="dropdown-menu">
            <a class="dropdown-item">Step 1: create request submission</a>
            <a class="dropdown-item">Step 2: check request submissions</a>
            <a class="dropdown-item">Step 3: book tutors</a>
            <a class="dropdown-item">Step 4: send/receive messages for bookings</a>
            <a class="dropdown-item">Step 5: finalize bookings</a>
            <a class="dropdown-item">Step 6: write matchings</a>
            <a class="dropdown-item">Step 7: send/receive messages for matchings</a>
            <a class="dropdown-item">Step 8: finalize matchings</a>
        </div>
    </li>
    <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" data-toggle="dropdown">Other</a>
        <div class="dropdown-menu">
            <a class="dropdown-item">About</a>
            <a class="dropdown-item">Force refresh</a>
        </div>
    </li>
</ul>`;

async function simpleStepWindow(
    stepNum: number,
    logicOrFail: (onLoad: Event) => Promise<JQuery>
): Promise<void> {
    let errorMessage: string = '';
    let windowLabel: string = 'ERROR in: step ' + stepNum;
    try {
        const onLoad = new Event();
        const contentDom = await logicOrFail(onLoad);
        windowLabel = 'Step ' + stepNum;
        const { closeWindow } = useTiledWindow(
            container('<div></div>')(
                container('<h1></h1>')(windowLabel),
                contentDom
            ),
            ActionBarWidget([['Close', () => closeWindow()]]).dom,
            windowLabel,
            onLoad
        );
    } catch (err) {
        errorMessage = stringifyError(err);
        const { closeWindow } = useTiledWindow(
            ErrorWidget(errorMessage).dom,
            ActionBarWidget([['Close', () => closeWindow()]]).dom,
            windowLabel
        );
    }
}

async function step2() {
    await simpleStepWindow(2, async (onLoad: Event) => {
        const recordCollection = requestSubmissions.state.getRecordCollectionOrFail();
        const table = TableWidget(['Name', 'Convert into request'], record => {
            async function attemptConversion() {
                // STEP 1: create learner if he/she doesn't already exist
                const learnerRecords: Record[] = Object.values(
                    learners.state.getRecordCollectionOrFail()
                ).filter(
                    x =>
                        x.firstName == record.firstName &&
                        x.lastName == record.lastName
                );
                let learnerRecord: Record;
                if (learnerRecords.length > 1) {
                    // duplicate learner names??
                    // this should be validated in the database
                    throw new Error(
                        'duplicate learner names: ' +
                            String(record.firstName) +
                            '/' +
                            String(record.lastName)
                    );
                } else if (learnerRecords.length == 0) {
                    // create new learner
                    learnerRecord = getResultOrFail(
                        await learners.state.createRecord({
                            firstName: record.firstName,
                            lastName: record.lastName,
                            friendlyName: record.friendlyName,
                            friendlyFullName: record.friendlyFullname,
                            grade: record.grade,
                            id: -1,
                            date: -1
                        })
                    );
                } else {
                    // learner already exists
                    learnerRecord = learners[0];
                }
                // STEP 2: create request
                getResultOrFail(
                    await requests.state.createRecord({
                        learner: learnerRecord.id,
                        id: -1,
                        date: -1
                    })
                );
                // STEP 3: delete request submission
                // NOTE: this is only done if steps 1 and 2 succeed
                getResultOrFail(
                    await requestSubmissions.state.deleteRecord(record.id)
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
                            await attemptConversion();
                        } catch (err) {
                            alert(stringifyError(err));
                        }
                    }
                }).dom
            ];
        });
        onLoad.listen(() => {
            // Because request submissions are deleted as soon as they are processed into requests, there is no need to distinguish between "unfinalized" and "finalized" request submissions.
            // Thus, there is no filter for this step.
            table.setAllValues(recordCollection);
        });
        return table.dom;
    });
}

async function step3() {
    // TODO: add full logic
    await simpleStepWindow(3, async (onLoad: Event) => {
        const learnerRecords = await matchings.state.getRecordCollectionOrFail();
        const bookingRecords = await bookings.state.getRecordCollectionOrFail();
        const matchingRecords = await matchings.state.getRecordCollectionOrFail();

        const table = TableWidget(['Learner'], record => [
            learners.createMarker(record.id, x => x.friendlyFullName)
        ]);

        onLoad.listen(() => {
            // INDEX: learners --> has nonrejected booking or a matching?
            const indexLearners2NeedsBooking: { [id: string]: boolean } = {};
            for (const learner of Object.values(learnerRecords)) {
                indexLearners2NeedsBooking[String(learner.id)] = true;
            }
            for (const matching of Object.values(matchingRecords)) {
                indexLearners2NeedsBooking[matching.learner] = false;
            }
            for (const booking of Object.values(bookingRecords)) {
                if (!booking.status.startsWith('rejected')) {
                    indexLearners2NeedsBooking[booking.learner] = false;
                }
            }

            const filtered = Object.values(learnerRecords).filter(
                x => indexLearners2NeedsBooking[x.id]
            );
            table.setAllValues(filtered);
        });
        return table.dom;
    });
}

async function step4() {
    await simpleStepWindow(4, async (onLoad: Event) => {
        const bookingRecords = await bookings.state.getRecordCollectionOrFail();
        const tutorRecords = await tutors.state.getRecordCollectionOrFail();
        const learnerRecords = await learners.state.getRecordCollectionOrFail();

        const table = TableWidget(
            ['Unsent booking message', 'Mark as...', 'Finalize'],
            record => {
                const formSelectWidget = FormSelectWidget(
                    [
                        'unsent',
                        'waitingForLearner',
                        'waitingForTutor',
                        'rejected',
                        'rejectedByLearner',
                        'rejectedByTutor'
                    ],
                    [
                        'Unsent',
                        'Waiting for learner',
                        'Waiting for tutor',
                        'Rejected by learner',
                        'Rejected by tutor',
                        'Rejected for other reason'
                    ]
                );
                formSelectWidget.setValue(record.status);
                formSelectWidget.onChange(async newVal => {
                    record.status = newVal;
                    const response = await bookings.state.updateRecord(record);
                    if (response.status === AskStatus.ERROR) {
                        alert('ERROR!\n' + response.message);
                    }
                });
                const content = [
                    container('<a style="cursor: pointer"></a>')(
                        'Message: ' +
                            tutorRecords[record.tutor].friendlyFullName +
                            ' <> ' +
                            learnerRecords[record.learner].friendlyFullName
                    ).click(() => {
                        showModal(
                            'Message',
                            'You can use the following script to write your message: <TODO: message scripts are in progress>',
                            bb => [bb('OK', 'primary')]
                        );
                    }),
                    formSelectWidget.dom,
                    ButtonWidget('Finalize', async () => {
                        const ask = await matchings.state.createRecord({
                            id: -1,
                            date: Date.now(),
                            learner: record.learner,
                            tutor: record.tutor,
                            status: 'unwritten'
                        });
                        if (ask.status === AskStatus.ERROR) {
                            alert('ERROR!\n' + stringifyError(ask.message));
                        }
                    }).dom
                ];
                return content;
            }
        );
        onLoad.listen(() => {
            const filtered = Object.values(bookingRecords).filter(
                x => x.status === 'unsent'
            );
            table.setAllValues(filtered);
        });
        return table.dom;
    });
}

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
                if (text.startsWith('Step 1')) {
                    showModal(
                        'Note',
                        `Typically, requests are submitted through the Google Form. You should only create a request submission manually if the form isn't working right.`,
                        bb => [
                            bb(
                                'Create submission anyway',
                                'outline-secondary',
                                () => requestSubmissions.makeTiledCreateWindow()
                            ),
                            bb('Go back', 'primary')
                        ]
                    );
                }
                if (text.startsWith('Step 2')) {
                    step2();
                }
                if (text.startsWith('Step 3')) {
                    step3();
                }
                if (text.startsWith('Step 4')) {
                    step4();
                }
                if (text.startsWith('Step 5')) {
                }
                if (text.startsWith('Step 6')) {
                }
                if (text.startsWith('Step 7')) {
                }
                if (text.startsWith('Step 8')) {
                }
            });

        return { dom };
    }

    const dom = container('<div id="app" class="layout-v"></div>')(
        container('<nav class="navbar layout-item-fit">')(PillsWidget().dom),
        container('<nav class="navbar layout-item-fit layout-v"></div>')(
            WindowsBarWidget().dom
        ),
        container('<div class="layout-item-scroll"></div>')(
            TilingWindowManagerWidget().dom
        )
    );
    return { dom };
}
