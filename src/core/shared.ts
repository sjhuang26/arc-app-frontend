import {
    askServer,
    Ask,
    AskStatus,
    AskFinished,
    getResultOrFail
} from './server';
import { FormWidget } from '../widgets/Form';
import { useTiledWindow } from '../widgets/Window';

import {
    StringField,
    NumberField,
    SelectField,
    FormFieldType,
    ErrorWidget,
    ButtonWidget,
    NumberArrayField,
    createMarkerLink
} from '../widgets/ui';
import { ActionBarWidget } from '../widgets/ActionBar';
import { TableWidget } from '../widgets/Table';

export function MyTesting() {
    return 4;
}

/*

ALL BASIC CLASSES AND BASIC UTILS

*/

export function stringifyError(error: any) {
    console.error(error);
    if (error instanceof Error) {
        return JSON.stringify(error, Object.getOwnPropertyNames(error));
    }
    if (typeof error === 'object') {
        return JSON.stringify(error);
    }
    return error;
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
        if (this.val.status !== AskStatus.LOADED) {
            return this.val;
        }

        const ask = await this.endpoint.update(record);
        if (ask.status == AskStatus.LOADED) {
            // update the client to match the server (sync)
            this.val.val[String(record.id)] = record;
            this.change.trigger();
        }

        return ask;
    }

    async createRecord(record: Record): Promise<AskFinished<Record>> {
        const ask = await this.endpoint.create(record);
        if (this.val.status !== AskStatus.LOADED) {
            return this.val;
        }

        if (ask.status == AskStatus.LOADED) {
            // update the client to match the server (sync)
            this.val.val[String(ask.val.id)] = ask.val;
            this.change.trigger();
        }
        return ask;
    }

    async deleteRecord(id: number): Promise<AskFinished<void>> {
        const ask = await this.endpoint.delete(id);
        if (
            ask.status == AskStatus.LOADED &&
            this.val.status == AskStatus.LOADED
        ) {
            // update the client to match the server (sync)
            delete this.val.val[String(id)];
            this.change.trigger();
        }
        return ask;
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

    createMarker(
        id: number,
        builder: (record: Record) => string,
        onClick: () => void = () => this.makeTiledEditWindow(id)
    ): JQuery {
        return createMarkerLink(this.createLabel(id, builder), onClick);
    }

    createLabel(id: number, builder: (record: Record) => string): string {
        const record = this.state.getRecordOrFail(id);
        return builder.call(null, record);
    }

    // The edit window is kind of combined with the view window.
    async makeTiledEditWindow(id: number): Promise<void> {
        let record: Record = null;
        let errorMessage: string = '';
        let windowLabel: string = 'ERROR in: ' + this.info.title + ' #' + id;
        try {
            function capitalizeWord(w: string) {
                return w.charAt(0).toUpperCase() + w.slice(1);
            }

            await this.state.getRecordCollectionOrFail();
            record = this.state.getRecordOrFail(id);
            windowLabel =
                capitalizeWord(this.info.title) +
                ': ' +
                this.createLabel(id, this.info.makeLabel);

            const form = this.makeFormWidget();
            form.setAllValues(record);

            const { closeWindow } = useTiledWindow(
                container('<div></div>')(
                    container('<h1></h1>')(windowLabel),
                    form.dom
                ),
                ActionBarWidget([
                    ['Delete', () => this.makeTiledDeleteWindow(id)],
                    ['Save', async () => {
                        closeWindow();
                        const ask = await this.endpoint.update(form.getAllValues());
                        if (ask.status === AskStatus.ERROR) {
                            alert(stringifyError(ask.message));
                        }
                    }],
                    ['Close', () => closeWindow()]
                ]).dom,
                windowLabel
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

    async makeTiledCreateWindow(): Promise<void> {
        let errorMessage: string = '';
        let windowLabel: string = 'ERROR in: create new ' + this.info.title;
        try {
            await this.state.getRecordCollectionOrFail();
            windowLabel = 'Create new ' + this.info.title;

            const form = this.makeFormWidget();
            form.setAllValues({ id: -1, date: Date.now() });

            const { closeWindow } = useTiledWindow(
                container('<div></div>')(
                    container('<h1></h1>')(windowLabel),
                    form.dom
                ),
                ActionBarWidget([
                    [
                        'Create',
                        async () => {
                            const ask = await this.state.createRecord(
                                form.getAllValues()
                            );
                            if (ask.status === AskStatus.ERROR) {
                                alert('ERROR!\n' + stringifyError(ask.message));
                            }
                            closeWindow();
                        }
                    ],
                    ['Close', () => closeWindow()]
                ]).dom,
                windowLabel
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

    async makeTiledViewAllWindow(): Promise<void> {
        let recordCollection: RecordCollection = null;
        let errorMessage: string = '';
        let windowLabel: string = 'ERROR in: view all ' + this.info.pluralTitle;
        try {
            const onLoad = new Event();

            recordCollection = await this.state.getRecordCollectionOrFail();

            const table = TableWidget(
                this.info.tableFieldTitles.concat('View'),
                (record: Record) =>
                    this.info
                        .makeTableRowContent(record)
                        .concat(
                            ButtonWidget('View', () => {
                                closeThisWindow();
                                this.makeTiledEditWindow(record.id)
                            }).dom
                        )
            );

            onLoad.listen(() => {
                recordCollection = this.state.getLoadedOrFail();
                table.setAllValues(recordCollection);
            });

            windowLabel = 'View all ' + this.info.pluralTitle;

            const { closeWindow } = useTiledWindow(
                container('<div></div>')(
                    container('<h1></h1>')(windowLabel),
                    table.dom
                ),
                ActionBarWidget([
                    ['Create', () => this.makeTiledCreateWindow()],
                    ['Close', () => closeWindow()]
                ]).dom,
                windowLabel,
                onLoad
            );
            function closeThisWindow() {
                closeWindow();
            }
        } catch (err) {
            errorMessage = stringifyError(err);
            const { closeWindow } = useTiledWindow(
                ErrorWidget(errorMessage).dom,
                ActionBarWidget([
                    ['Create', () => this.makeTiledCreateWindow()],
                    ['Close', () => closeWindow()]
                ]).dom,
                windowLabel
            );
        }
    }

    makeTiledDeleteWindow(id: number) {
        const windowLabel =
            'Delete this ' +
            this.info.title +
            '? (' +
            this.createLabel(id, record => record.friendlyFullName) +
            ')';
        const { windowWidget, closeWindow } = useTiledWindow(
            container('<div></div>')(
                container('<h1></h1>')('Delete?'),
                container('<p></p>')('Are you sure you want to delete this?')
            ),
            ActionBarWidget([
                [
                    'Delete',
                    () =>
                        this.endpoint
                            .delete(id)
                            .then(() => alert('Deletion successful!'))
                ],
                ['Cancel', () => closeWindow]
            ]).dom,
            windowLabel
        );
        return windowWidget;
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
    let fields: ResourceFieldInfo[] = [];
    for (const [name, type] of conf.fields) {
        fields.push({
            title: conf.fieldNameMap[name],
            name,
            type
        });
    }
    fields = fields.concat([
        {
            title: 'ID',
            name: 'id',
            type: NumberField('number')
        },
        {
            title: 'Date',
            name: 'date',
            type: NumberField('datetime-local')
        }
    ]);
    return {
        fields,
        makeTableRowContent: conf.makeTableRowContent,
        title: conf.title,
        pluralTitle: conf.pluralTitle,
        tableFieldTitles: conf.tableFieldTitles,
        makeLabel: conf.makeLabel
    };
}

export type UnprocessedResourceInfo = {
    fields: [string, FormFieldType][]; // name, string/number, type
    fieldNameMap: { [name: string]: string };
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
        ['grade', NumberField('number')]
    ];
}

const fieldNameMap = {
    firstName: 'First name',
    lastName: 'Last name',
    friendlyName: 'Friendly name',
    friendlyFullName: 'Friendly full name',
    grade: 'Grade',
    learner: 'Learner',
    tutor: 'Tutor',
    status: 'Status',
    mods: 'Mods',
    mod: 'Mod',
    modsPref: 'Preferred mods',
    subjectList: 'Subjects',
    request: 'Request',
    subject: 'Subject(s)'
};
const tutorsInfo: UnprocessedResourceInfo = {
    fields: [
        ...makeBasicStudentConfig(),
        ['mods', NumberArrayField('number')],
        ['modsPref', NumberArrayField('number')],
        ['subjectList', StringField('text')]
    ],
    fieldNameMap,
    tableFieldTitles: ['Name', 'Grade', 'Mods', 'Subjects'],
    makeTableRowContent: record => [
        tutors.createMarker(record.id, x => x.friendlyFullName),
        record.grade,
        generateStringOfMods(record.mods, record.modsPref),
        record.subjectList
    ],
    title: 'tutor',
    pluralTitle: 'tutors',
    makeLabel: record => record.friendlyFullName
};
const learnersInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig()],
    fieldNameMap,
    tableFieldTitles: ['Name', 'Grade'],
    makeTableRowContent: record => [
        learners.createMarker(record.id, x => x.friendlyFullName),
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
        ['subject', StringField('text')]
    ],
    fieldNameMap,
    tableFieldTitles: ['Learner', 'Subject', 'Mods'],
    makeTableRowContent: record => [
        learners.createMarker(record.learner, x => x.friendlyFullName),
        record.subject,
        record.mods.join(', ')
    ],
    title: 'request',
    pluralTitle: 'requests',
    makeLabel: record =>
        learners.createLabel(record.id, x => x.friendlyFullName)
};

const bookingsInfo: UnprocessedResourceInfo = {
    fields: [
        ['request', NumberField('id')],
        ['tutor', NumberField('id')],
        ['mod', NumberField('number')],
        [
            'status',
            SelectField(
                [
                    'unsent',
                    'waitingForTutor',
                    'waitingForLearner',
                    'finalized',
                    'rejected',
                    'rejectedByTutor',
                    'rejectedByLearner'
                ],
                [
                    'Unsent',
                    'Waiting for tutor',
                    'Waiting for learner',
                    'Finalized',
                    'Rejected',
                    'Rejected by tutor',
                    'Rejected by learner'
                ]
            )
        ]
    ],
    fieldNameMap,
    tableFieldTitles: ['Learner', 'Tutor', 'Mod', 'Status'],
    makeTableRowContent: record => [
        learners.createMarker(
            requests.state.getRecordOrFail(record.request).learner,
            x => x.friendlyFullName
        ),
        tutors.createMarker(record.tutor, x => x.friendlyFullName),
        record.mod,
        record.status
    ],
    title: 'booking',
    pluralTitle: 'bookings',
    makeLabel: record =>
        tutors.state.getRecordOrFail(record.tutor).friendlyFullName +
        ' <> ' +
        learners.state.getRecordOrFail(record.tutor).friendlyFullName
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
        ]
    ],
    fieldNameMap,
    tableFieldTitles: ['Learner', 'Tutor', 'Mod', 'Subject', 'Status'],
    makeTableRowContent: record => [
        learners.createMarker(record.learner, x => x.friendlyFullName),
        tutors.createMarker(record.tutor, x => x.friendlyFullName),
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
        ['subject', StringField('text')]
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

window['appDebug'] = () => ({
    tutors,
    learners,
    bookings,
    matchings,
    requests,
    requestSubmissions
});
