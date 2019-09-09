import {
    askServer,
    Ask,
    AskStatus,
    AskFinished,
    getResultOrFail
} from './server';
import { FormWidget } from '../widgets/Form';

import {
    StringField,
    NumberField,
    SelectField,
    FormFieldType,
    ErrorWidget,
    ButtonWidget,
    NumberArrayField,
    createMarkerLink,
    FormJsonInputWidget,
    JsonField,
    showModal
} from '../widgets/ui';
import { ActionBarWidget } from '../widgets/ActionBar';
import { TableWidget } from '../widgets/Table';

export function MyTesting() {
    return 4;
}

/*

ALL BASIC CLASSES AND BASIC UTILS

*/

export function arrayEqual<T>(a: T[], b: T[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
export async function alertError(err: any): Promise<void> {
    await showModal(
        'Error!',
        container('<div>')(
            $('<p><b>There was an error.</b></p>'),
            container('<p>')(stringifyError(err))
        ),
        bb => [bb('OK', 'primary')]
    );
}

// This function converts mod numbers (ie. 11) into A-B-day strings (ie. 1B).
// The function is not used often because we expect users of the app to be able to
// work with the 1-20 mod notation.
export function stringifyMod(mod: number) {
    if (1 <= mod && mod <= 10) {
        return String(mod) + 'A';
    } else if (11 <= mod && mod <= 20) {
        return String(mod - 10) + 'B';
    }
    throw new Error(`mod ${mod} isn't serializable`);
}

export function stringifyError(error: any): string {
    console.error(error);
    if (error instanceof Error) {
        return JSON.stringify(error, Object.getOwnPropertyNames(error));
    }
    try {
        return JSON.stringify(error);
    } catch (unusedError) {
        return String(error);
    }
}

export class Event {
    listeners: (() => any)[];

    constructor() {
        this.listeners = [];
    }
    trigger() {
        for (const listener of this.listeners) {
            listener();
        }
    }
    get chain() {
        return this.trigger.bind(this);
    }
    listen(cb: () => any) {
        this.listeners.push(cb);
    }
}

export function container(newTag: string) {
    return (...children: any) => {
        if (Array.isArray(children[0])) {
            return $(newTag).append(
                children[0].map((x: any) =>
                    typeof x === 'string' ? $(document.createTextNode(x)) : x
                )
            );
        }
        return $(newTag).append(
            children.map((x: any) =>
                typeof x === 'string' ? $(document.createTextNode(x)) : x
            )
        );
    };
}

export type Widget = {
    dom: JQuery;
    [others: string]: any;
};
export function DomWidget(dom: JQuery) {
    return { dom };
}

export class ObservableState<T> {
    val: T;
    change: Event;
    constructor(initialValue: T) {
        this.val = initialValue;
        this.change = new Event();

        // TODO: make sure this works
        this.change.trigger();
    }
    changeTo(val: T) {
        this.val = val;
        this.change.trigger();
    }
}

export function generateStringOfMods(
    mods: number[],
    modsPref: number[]
): string {
    return mods
        .map(mod => String(mod) + (modsPref.includes(mod) ? '*' : ''))
        .join(', ');
}

/*

RECORDS

*/
export type Record = {
    id: number;
    date: number;
    [others: string]: any;
};
export type RecordCollection = {
    [id: string]: Record;
};

/*

RESOURCES

*/

export class ResourceEndpoint {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
    async askEndpoint(...partialArgs: any[]): Promise<AskFinished<any>> {
        return askServer([this.name].concat(partialArgs));
    }

    // NOTE: ALL THESE RETURN PROMISES

    retrieveAll(): Promise<AskFinished<RecordCollection>> {
        return this.askEndpoint('retrieveAll');
    }
    create(record: Record): Promise<AskFinished<Record>> {
        return this.askEndpoint('create', record);
    }
    delete(id: number): Promise<AskFinished<void>> {
        return this.askEndpoint('delete', id);
    }
    debug(): Promise<AskFinished<any>> {
        return this.askEndpoint('debug');
    }
    update(record: Record): Promise<AskFinished<void>> {
        return this.askEndpoint('update', record);
    }
}
export class ResourceObservable extends ObservableState<
    AskFinished<RecordCollection>
> {
    endpoint: ResourceEndpoint;

    constructor(endpoint: ResourceEndpoint) {
        super({
            status: AskStatus.ERROR,
            message: 'resource was not initialized properly'
        });
        this.endpoint = endpoint;
    }
    async initialize() {
        // If this fails, there will be some cascading failure throughout the app, but only when the resource is actually used. This prevents catastrophic failure the moment a resource fails.
        const newVal: AskFinished<
            RecordCollection
        > = await this.endpoint.retrieveAll();
        this.changeTo(newVal);
        return newVal;
    }

    getRecordOrFail(id: number) {
        const val = this.getLoadedOrFail();
        if (val[String(id)] === undefined) {
            throw new Error(
                'record not available: ' + this.endpoint.name + '/#' + id
            );
        }
        return val[String(id)];
    }

    findRecordOrFail(id: number) {
        const val = this.getLoadedOrFail();
        if (val[String(id)] === undefined) {
            return null;
        }
        return val[String(id)];
    }

    getLoadedOrFail(): RecordCollection {
        if (this.val.status != AskStatus.LOADED) {
            throw new Error('resource is not loaded: ' + this.endpoint.name);
        }
        return this.val.val;
    }

    async forceRefresh(): Promise<void> {
        const newVal: AskFinished<
            RecordCollection
        > = await this.endpoint.retrieveAll();
        this.changeTo(newVal);
    }

    getRecordCollectionOrFail(): RecordCollection {
        if (this.val.status == AskStatus.ERROR) {
            throw this.val.message;
        } else {
            return this.val.val;
        }
    }
    async dependOnRecordOrFail(id: number): Promise<Record> {
        await this.getRecordCollectionOrFail();
        return this.getRecordOrFail(id);
    }

    async updateRecord(record: Record): Promise<AskFinished<void>> {
        if (this.val.status === AskStatus.ERROR) return this.val;
        this.val.val[String(record.id)] = record;
        this.change.trigger();
        return await this.endpoint.update(record);
    }

    async createRecord(record: Record): Promise<AskFinished<Record>> {
        if (this.val.status === AskStatus.ERROR) return this.val;
        const ask = await this.endpoint.create(record);
        if (ask.status !== AskStatus.ERROR) {
            this.val.val[String(ask.val.id)] = ask.val;
            this.change.trigger();
        }
        return ask;
    }

    async deleteRecord(id: number): Promise<AskFinished<void>> {
        if (this.val.status === AskStatus.ERROR) return this.val;
        delete this.val.val[String(id)];
        this.change.trigger();
        return await this.endpoint.delete(id);
    }

    onServerNotificationUpdate(record: Record) {
        if (this.val.status === AskStatus.LOADED) {
            this.val.val[String(record.id)] = record;
            this.change.trigger();
        }
    }

    onServerNotificationCreate(record: Record) {
        if (this.val.status === AskStatus.LOADED) {
            this.val.val[String(record.id)] = record;
            this.change.trigger();
        }
    }

    onServerNotificationDelete(id: number) {
        if (this.val.status === AskStatus.LOADED) {
            delete this.val.val[String(id)];
            this.change.trigger();
        }
    }
}

export class Resource {
    name: string;
    endpoint: ResourceEndpoint;
    state: ResourceObservable;
    info: ResourceInfo;

    constructor(name: string, info: ResourceInfo) {
        this.name = name;
        this.endpoint = new ResourceEndpoint(this.name);
        this.state = new ResourceObservable(this.endpoint);
        this.info = info;
    }

    makeFormWidget() {
        return FormWidget(this.info.fields);
    }

    createFriendlyMarker(
        id: number,
        builder: (record: Record) => string
    ): JQuery {
        // TODO
        return this.createDataEditorMarker(id, builder);
    }

    createDataEditorMarker(
        id: number,
        builder: (record: Record) => string,
        onClick: () => void = () => this.makeTiledEditWindow(id)
    ): JQuery {
        return createMarkerLink(this.createLabel(id, builder), onClick);
    }

    createLabel(id: number, builder: (record: Record) => string): string {
        try {
            const record = this.state.getRecordOrFail(id);
            return builder.call(null, record);
        } catch (e) {
            console.error(e);
            return `(??? UNKNOWN #${String(id)} ???)`;
        }
    }

    // The edit window is kind of combined with the view window.
    async makeTiledEditWindow(id: number): Promise<void> {
        let record: Record = null;
        let errorMessage: string = '';
        try {
            function capitalizeWord(w: string) {
                return w.charAt(0).toUpperCase() + w.slice(1);
            }

            await this.state.getRecordCollectionOrFail();
            record = this.state.getRecordOrFail(id);
            const windowLabel =
                capitalizeWord(this.info.title) +
                ': ' +
                this.createLabel(id, this.info.makeLabel);

            const form = this.makeFormWidget();
            form.setAllValues(record);

            showModal(
                windowLabel,
                container('<div></div>')(
                    container('<h1></h1>')(windowLabel),
                    form.dom
                ),
                bb => [
                    bb(
                        'Delete',
                        'danger',
                        () => this.makeTiledDeleteWindow(id, () => bb.close()),
                        false
                    ),
                    bb('Save', 'primary', async () => {
                        const ask = await this.state.updateRecord(
                            form.getAllValues()
                        );
                        if (ask.status === AskStatus.ERROR) {
                            alertError(ask.message);
                        }
                    }),
                    bb('Close', 'secondary')
                ]
            );
        } catch (err) {
            const windowLabel = 'ERROR in: ' + this.info.title + ' #' + id;
            errorMessage = stringifyError(err);
            showModal(windowLabel, ErrorWidget(errorMessage).dom, bb => [
                bb('Close', 'primary')
            ]);
        }
    }

    async makeTiledCreateWindow(): Promise<void> {
        let errorMessage: string = '';
        try {
            await this.state.getRecordCollectionOrFail();
            const windowLabel = 'Create new ' + this.info.title;

            const form = this.makeFormWidget();
            form.setAllValues({ id: -1, date: Date.now() });

            showModal(
                windowLabel,
                container('<div></div>')(
                    container('<h1></h1>')(windowLabel),
                    form.dom
                ),
                bb => [
                    bb('Create', 'primary', async () => {
                        try {
                            getResultOrFail(
                                await this.state.createRecord(
                                    form.getAllValues()
                                )
                            );
                        } catch (err) {
                            alertError(err);
                        }
                    }),
                    bb('Cancel', 'secondary')
                ]
            );
        } catch (err) {
            const windowLabel = 'ERROR in: create new ' + this.info.title;
            errorMessage = stringifyError(err);
            showModal(windowLabel, ErrorWidget(errorMessage).dom, bb => [
                bb('Close', 'primary')
            ]);
        }
    }

    async makeTiledViewAllWindow(): Promise<void> {
        let recordCollection: RecordCollection = null;
        let errorMessage: string = '';
        try {
            recordCollection = await this.state.getRecordCollectionOrFail();

            const table = TableWidget(
                this.info.tableFieldTitles.concat('View & edit'),
                (record: Record) =>
                    this.info.makeTableRowContent(record).concat(
                        ButtonWidget('View & edit', () => {
                            this.makeTiledEditWindow(record.id);
                        }).dom
                    )
            );
            table.setAllValues(recordCollection);

            const windowLabel = 'View all ' + this.info.pluralTitle;

            showModal(
                windowLabel,
                container('<div></div>')(
                    container('<h1></h1>')(windowLabel),
                    table.dom
                ),
                bb => [
                    bb(
                        'Create',
                        'secondary',
                        () => this.makeTiledCreateWindow(),
                        true
                    ),
                    bb('Close', 'primary')
                ]
            );
        } catch (err) {
            errorMessage = stringifyError(err);
            const windowLabel = 'ERROR in: view all ' + this.info.pluralTitle;
            showModal(windowLabel, ErrorWidget(errorMessage).dom, bb => [
                bb('Close', 'primary')
            ]);
        }
    }

    makeTiledDeleteWindow(id: number, closeParentWindow: () => void): void {
        const windowLabel =
            'Delete this ' +
            this.info.title +
            '? (' +
            this.createLabel(id, record => record.friendlyFullName) +
            ')';
        showModal(
            windowLabel,
            container('<div></div>')(
                container('<h1></h1>')('Delete?'),
                container('<p></p>')('Are you sure you want to delete this?')
            ),
            bb => [
                bb('Delete', 'danger', () =>
                    this.state
                        .deleteRecord(id)
                        .then(() => closeParentWindow())
                        .catch(err => alertError(err))
                ),
                bb('Cancel', 'primary')
            ]
        );
    }
}

/*

IMPORTANT GLOBALS

*/

export const state = {
    tiledWindows: new ObservableState<
        {
            key: number;
            window: Widget;
            visible: boolean;
            title: string;
            onLoad: Event;
        }[]
    >([])
};

/*

WINDOW-RELATED GLOBAL METHODS

*/

export function addWindow(
    window: Widget,
    windowKey: number,
    title: string,
    onLoad: Event
) {
    // The onLoad event is triggered BEFORE the window is added. If the first onLoad call fails, no window will be created.
    onLoad.trigger();

    state.tiledWindows.val.push({
        key: windowKey,
        window,
        visible: true,
        title,
        onLoad
    });
    for (const window of state.tiledWindows.val) {
        if (window.key === windowKey) {
            window.visible = true;
        } else {
            // you can't have two visible windows at once
            // so, hide all other windows
            window.visible = false;
        }
    }
    state.tiledWindows.change.trigger();
}

export function removeWindow(windowKey: number) {
    // MEMORY LEAK PREVENTION: explicitly null out the onLoad event when the whole window is deleted
    for (const window of state.tiledWindows.val) {
        if (window.key === windowKey) {
            window.onLoad = null;
        }
    }

    state.tiledWindows.val = state.tiledWindows.val.filter(
        ({ key }) => key !== windowKey
    );
    state.tiledWindows.change.trigger();
}

export function hideWindow(windowKey: number) {
    for (const window of state.tiledWindows.val) {
        if (window.key === windowKey) {
            window.visible = false;
        }
    }
    state.tiledWindows.change.trigger();
}

export function showWindow(windowKey: number) {
    for (const window of state.tiledWindows.val) {
        if (window.key === windowKey) {
            window.visible = true;
        } else {
            // you can't have two visible windows at once
            // so, hide all other windows
            window.visible = false;
        }
    }
    state.tiledWindows.change.trigger();

    // trigger the onload event
    // TODO: removed the event for now, and might add back in later
    /*for (const window of state.tiledWindows.val) {
        if (window.key === windowKey) {
            window.onLoad.trigger();
        }
    }*/
}

/*

RESOURCE INFO

*/

export type ResourceFieldInfo = {
    title: string;
    name: string;
    type: FormFieldType;
    info?: string;
};

export type ResourceInfo = {
    fields: ResourceFieldInfo[];
    tableFieldTitles: string[];
    makeTableRowContent: (record: Record) => (JQuery | string)[];
    title: string;
    pluralTitle: string;
    makeLabel: (record: Record) => string;
};

export function processResourceInfo(
    conf: UnprocessedResourceInfo
): ResourceInfo {
    conf.fields.push(
        ['id', NumberField('number')],
        ['date', NumberField('datetime-local')]
    );
    let fields: ResourceFieldInfo[] = [];
    for (const [name, type] of conf.fields) {
        const x = conf.fieldNameMap[name];
        fields.push({
            title: typeof x === 'string' ? x : x[0],
            ...(Array.isArray(x) && { info: x[1] }),
            name,
            type
        });
    }
    return {
        fields,
        makeTableRowContent: conf.makeTableRowContent,
        title: conf.title,
        pluralTitle: conf.pluralTitle,
        tableFieldTitles: conf.tableFieldTitles,
        makeLabel: conf.makeLabel
    };
}

export type FieldNameMap = { [name: string]: string | [string, string] };

export type UnprocessedResourceInfo = {
    fields: [string, FormFieldType][]; // name, string/number, type
    fieldNameMap: FieldNameMap; // name | [name, info?]
    tableFieldTitles: string[];
    makeTableRowContent: (record: Record) => (JQuery | string)[];
    title: string;
    pluralTitle: string;
    makeLabel: (record: Record) => string;
};

export function makeBasicStudentConfig(): [string, FormFieldType][] {
    return [
        ['firstName', StringField('text')],
        ['lastName', StringField('text')],
        ['friendlyName', StringField('text')],
        ['friendlyFullName', StringField('text')],
        ['grade', NumberField('number')],
        ['studentId', NumberField('number')],
        ['email', StringField('email')],
        ['phone', StringField('string')],
        [
            'contactPref',
            SelectField(
                ['email', 'phone', 'either'],
                ['Email', 'Phone', 'Either']
            )
        ]
    ];
}

// This maps field names to the words that show up in the UI.
const fieldNameMap: FieldNameMap = {
    firstName: 'First name',
    lastName: 'Last name',
    friendlyName: 'Friendly name',
    friendlyFullName: 'Friendly full name',
    grade: ['Grade', 'A number from 9-12'],
    learner: [
        'Learner',
        'This is an ID. You usually will not need to edit this by hand.'
    ],
    tutor: [
        'Tutor',
        'This is an ID. You usually will not need to edit this by hand.'
    ],
    attendance: ['Attendance data', 'Do not edit this by hand.'],
    status: 'Status',
    mods: [
        'Mods',
        'A comma-separated list of numbers from 1-20, corresponding to 1A-10B'
    ],
    dropInMods: [
        'Drop-in mods',
        'A comma-separated list of numbers from 1-20, corresponding to 1A-10B'
    ],
    mod: ['Mod', 'A number from 1-20, corresponding to 1A-10B'],
    modsPref: [
        'Preferred mods',
        'A comma-separated list of numbers from 1-20, corresponding to 1A-10B'
    ],
    subjectList: 'Subjects',
    request: [
        'Request',
        'This is an ID. You usually will not need to edit this by hand.'
    ],
    subject: 'Subject(s)',
    studentId: 'Student ID',
    email: 'Email',
    phone: 'Phone',
    contactPref: 'Contact preference',
    specialRoom: [
        'Special tutoring room',
        `Leave blank if the student isn't in special tutoring`
    ],
    id: ['ID', `Do not modify unless you really know what you're doing!`],
    date: ['Date', 'Date of creation -- do not change']
};

/*

DECLARE INFO FOR EACH RESOURCE

*/

const tutorsInfo: UnprocessedResourceInfo = {
    fields: [
        ...makeBasicStudentConfig(),
        ['mods', NumberArrayField('number')],
        ['modsPref', NumberArrayField('number')],
        ['subjectList', StringField('text')],
        ['attendance', JsonField({})],
        ['dropInMods', NumberArrayField('number')]
    ],
    fieldNameMap,
    tableFieldTitles: ['Name', 'Grade', 'Mods', 'Subjects'],
    makeTableRowContent: record => [
        tutors.createDataEditorMarker(record.id, x => x.friendlyFullName),
        record.grade,
        generateStringOfMods(record.mods, record.modsPref),
        record.subjectList
    ],
    title: 'tutor',
    pluralTitle: 'tutors',
    makeLabel: record => record.friendlyFullName
};
const learnersInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig(), ['attendance', JsonField({})]],
    fieldNameMap,
    tableFieldTitles: ['Name', 'Grade'],
    makeTableRowContent: record => [
        learners.createDataEditorMarker(record.id, x => x.friendlyFullName),
        record.grade
    ],
    title: 'learner',
    pluralTitle: 'learners',
    makeLabel: record => record.friendlyFullName
};
const requestsInfo: UnprocessedResourceInfo = {
    fields: [
        ['learner', NumberField('id')],
        ['mods', NumberArrayField('number')],
        ['subject', StringField('text')],
        ['specialRoom', StringField('text')]
    ],
    fieldNameMap,
    tableFieldTitles: ['Learner', 'Subject', 'Mods'],
    makeTableRowContent: record => [
        learners.createDataEditorMarker(
            record.learner,
            x => x.friendlyFullName
        ),
        record.subject,
        record.mods.join(', ')
    ],
    title: 'request',
    pluralTitle: 'requests',
    makeLabel: record =>
        learners.createLabel(record.learner, x => x.friendlyFullName)
};

const bookingsInfo: UnprocessedResourceInfo = {
    fields: [
        ['request', NumberField('id')],
        ['tutor', NumberField('id')],
        ['mod', NumberField('number')],
        [
            'status',
            SelectField(
                ['unsent', 'waitingForTutor', 'rejected'],
                ['Unsent', 'Waiting', 'Rejected']
            )
        ]
    ],
    fieldNameMap,
    tableFieldTitles: ['Learner', 'Tutor', 'Mod', 'Status'],
    makeTableRowContent: record => [
        learners.createDataEditorMarker(
            requests.state.getRecordOrFail(record.request).learner,
            x => x.friendlyFullName
        ),
        tutors.createDataEditorMarker(record.tutor, x => x.friendlyFullName),
        record.mod,
        record.status
    ],
    title: 'booking',
    pluralTitle: 'bookings',
    makeLabel: record =>
        tutors.state.getRecordOrFail(record.tutor).friendlyFullName +
        ' <> ' +
        learners.state.getRecordOrFail(
            requests.state.getRecordOrFail(record.request).learner
        ).friendlyFullName
};

const matchingsInfo: UnprocessedResourceInfo = {
    fields: [
        ['learner', StringField('text')],
        ['tutor', StringField('text')],
        ['subject', StringField('text')],
        ['mod', NumberField('number')],
        [
            'status',
            SelectField(
                ['unwritten', 'unsent', 'finalized'],
                ['Unwritten', 'Unsent', 'Finalized']
            )
        ],
        ['specialRoom', StringField('text')]
    ],
    fieldNameMap,
    tableFieldTitles: ['Learner', 'Tutor', 'Mod', 'Subject', 'Status'],
    makeTableRowContent: record => [
        learners.createDataEditorMarker(
            record.learner,
            x => x.friendlyFullName
        ),
        tutors.createDataEditorMarker(record.tutor, x => x.friendlyFullName),
        record.mod,
        record.subject,
        record.status
    ],
    title: 'matching',
    pluralTitle: 'matchings',
    makeLabel: record =>
        tutors.state.getRecordOrFail(record.tutor).friendlyFullName +
        ' <> ' +
        learners.state.getRecordOrFail(record.learner).friendlyFullName
};

const requestSubmissionsInfo: UnprocessedResourceInfo = {
    fields: [
        ...makeBasicStudentConfig(),
        ['mods', NumberArrayField('number')],
        ['subject', StringField('text')],
        ['specialRoom', StringField('text')],
        [
            'status',
            SelectField(['unchecked', 'checked'], ['Unchecked', 'Checked'])
        ]
    ],
    fieldNameMap,
    tableFieldTitles: ['Name', 'Mods', 'Subject'],
    makeTableRowContent: record => [
        record.friendlyFullName,
        record.mods.join(', '),
        record.subject
    ],
    title: 'request submission',
    pluralTitle: 'request submissions',
    makeLabel: record => record.friendlyFullName
};

/*

LET'S PULL IT ALL TOGETHER

*/

export const tutors = new Resource('tutors', processResourceInfo(tutorsInfo));
export const learners = new Resource(
    'learners',
    processResourceInfo(learnersInfo)
);
export const requests = new Resource(
    'requests',
    processResourceInfo(requestsInfo)
);
export const bookings = new Resource(
    'bookings',
    processResourceInfo(bookingsInfo)
);
export const matchings = new Resource(
    'matchings',
    processResourceInfo(matchingsInfo)
);
export const requestSubmissions = new Resource(
    'requestSubmissions',
    processResourceInfo(requestSubmissionsInfo)
);

export async function initializeResources(): Promise<void> {
    await tutors.state.initialize();
    await learners.state.initialize();
    await bookings.state.initialize();
    await matchings.state.initialize();
    await requests.state.initialize();
    await requestSubmissions.state.initialize();
}

/*

VERY USEFUL FOR DEBUG

*/

window['appDebug'] = () => ({
    tutors,
    learners,
    bookings,
    matchings,
    requests,
    requestSubmissions
});
