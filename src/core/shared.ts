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
    ButtonWidget
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
        onMount.listen(this.change.chain);
    }
    changeTo(val: T) {
        this.val = val;
        this.change.trigger();
    }
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
    retrieveDefault(): Promise<AskFinished<Record>> {
        return this.askEndpoint('retrieveDefault');
    }
    retrieve(id: number): Promise<AskFinished<Record>> {
        return this.askEndpoint('retrieve', id);
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
            throw new Error('record not available');
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
            throw new Error('resource is not loaded');
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

    createMarker(id: number, builder: (record: Record) => string): JQuery {
        const dom = container('<a style="cursor: pointer"></a>')(
            `??? ${this.info.title} (LOADING)`
        );
        this.state
            .dependOnRecordOrFail(id)
            .then(record => {
                dom.empty();
                dom.text(builder(record)).click(() =>
                    this.makeTiledEditWindow(id)
                );
            })
            .catch(err => {
                console.error(err);
                dom.text(`??? ${this.info.title} (ERROR)`);
            });
        return dom;
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
                    ['Save', () => this.endpoint.update(form.getAllValues())],
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
                this.info.tableFields.concat('View'),
                record =>
                    this.info
                        .makeTableRowContent(record)
                        .concat(
                            ButtonWidget('View', () =>
                                this.makeTiledEditWindow(record.id)
                            ).dom
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

export const onReady = new Event();
export const onMount = new Event();

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
    onLoad.trigger();
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
    tableFields: string[];
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
    let tableFieldTitles: string[] = [];
    for (const name of conf.tableFields) {
        tableFieldTitles.push(conf.fieldNameMap[name]);
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
        tableFields: conf.tableFields,
        makeTableRowContent: conf.makeTableRowContent,
        title: conf.title,
        pluralTitle: conf.pluralTitle,
        tableFieldTitles,
        makeLabel: conf.makeLabel
    };
}

export type UnprocessedResourceInfo = {
    fields: [string, FormFieldType][]; // name, string/number, type
    fieldNameMap: { [name: string]: string };
    tableFields: string[];
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
    status: 'Status'
};
const tutorsInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig()],
    fieldNameMap,
    tableFields: ['friendlyFullName', 'grade'],
    makeTableRowContent: record => [
        tutors.createMarker(record.id, x => x.friendlyFullName),
        record.grade
    ],
    title: 'tutor',
    pluralTitle: 'tutors',
    makeLabel: record => record.friendlyFullName
};
const learnersInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig()],
    fieldNameMap,
    tableFields: ['friendlyFullName', 'grade'],
    makeTableRowContent: record => [
        learners.createMarker(record.id, x => x.friendlyFullName),
        record.grade
    ],
    title: 'learner',
    pluralTitle: 'learners',
    makeLabel: record => record.friendlyFullName
};
const requestsInfo: UnprocessedResourceInfo = {
    fields: [['learner', NumberField('id')]],
    fieldNameMap,
    tableFields: ['learner'],
    makeTableRowContent: record => [
        learners.createMarker(record.learner, x => x.friendlyFullName)
    ],
    title: 'request',
    pluralTitle: 'requests',
    makeLabel: record =>
        learners.createLabel(record.id, x => x.friendlyFullName)
};

const bookingsInfo: UnprocessedResourceInfo = {
    fields: [
        ['learner', NumberField('id')],
        ['tutor', NumberField('id')],
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
    tableFields: ['learner', 'tutor', 'status'],
    makeTableRowContent: record => [
        learners.createMarker(record.learner, x => x.friendlyFullName),
        tutors.createMarker(record.tutor, x => x.friendlyFullName),
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
        [
            'status',
            SelectField(
                ['unwritten', 'unsent', 'finalized'],
                ['Unwritten', 'Unsent', 'Finalized']
            )
        ]
    ],
    fieldNameMap,
    tableFields: ['learner', 'tutor', 'status'],
    makeTableRowContent: record => [
        learners.createMarker(record.learner, x => x.friendlyFullName),
        tutors.createMarker(record.tutor, x => x.friendlyFullName),
        record.status
    ],
    title: 'matching',
    pluralTitle: 'matchings',
    makeLabel: record =>
        tutors.state.getRecordOrFail(record.tutor).friendlyFullName +
        ' <> ' +
        learners.state.getRecordOrFail(record.tutor).friendlyFullName
};

const requestSubmissionsInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig()],
    fieldNameMap,
    tableFields: ['friendlyFullName'],
    makeTableRowContent: record => [
        requestSubmissions.createMarker(record.id, x => x.friendlyFullName)
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
