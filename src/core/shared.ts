import {
    askServer,
    ServerResponse,
    Ask,
    AskStatus,
    AskFinished,
    AskError,
    AskLoaded
} from './server';
import { FormWidget } from '../widgets/Form';
import { useTiledWindow } from '../widgets/Window';

import {
    StringField,
    NumberField,
    SelectField,
    LoaderWidget,
    FormFieldType
} from '../widgets/ui';
import { ActionBarWidget } from '../widgets/ActionBar';

export function MyTesting() {
    return 4;
}

/*

ALL BASIC CLASSES AND BASIC UTILS

*/

export function stringifyError(error: any) {
    console.log(error);
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
        //console.log('container', newTag, children);
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
    async askEndpoint(...partialArgs: any[]): Promise<ServerResponse<any>> {
        return askServer([this.name].concat(partialArgs));
    }

    // NOTE: ALL THESE RETURN PROMISES

    retrieveAll(): Promise<ServerResponse<RecordCollection>> {
        return this.askEndpoint('retrieveAll');
    }
    retrieveDefault(): Promise<ServerResponse<Record>> {
        return this.askEndpoint('retrieveDefault');
    }
    retrieve(id: number): Promise<ServerResponse<Record>> {
        return this.askEndpoint('retrieve', id);
    }
    create(record: Record): Promise<ServerResponse<undefined>> {
        return this.askEndpoint('create', record);
    }
    delete(id: number): Promise<ServerResponse<undefined>> {
        return this.askEndpoint('delete', id);
    }
    debug(): Promise<ServerResponse<any>> {
        return this.askEndpoint('debug');
    }
    update(record: Record): Promise<ServerResponse<undefined>> {
        return this.askEndpoint('update', record);
    }
}
export class ResourceObservable extends ObservableState<Ask<RecordCollection>> {
    endpoint: ResourceEndpoint;

    constructor(endpoint: ResourceEndpoint) {
        super({
            status: AskStatus.LOADING
        });
        this.endpoint = endpoint;
    }
    getRecordOrFail(id: number) {
        if (
            this.val.status == AskStatus.ERROR ||
            this.val.status == AskStatus.LOADING ||
            this.val.val[id] === undefined
        ) {
            throw new Error('record not available');
        }
        return this.val.val[id];
    }

    async loadRecordCollection(): Promise<AskFinished<RecordCollection>> {
        // TODO: the assumption is made here that once the resource is retrieved, it never changes. The real program will (1) declare resource dependencies for each window (2) use an onEdit() event hook server-side to notify the client of any stale data, refreshing windows/widgets as necessary (3) assume that edit locking won't happen, because editing is usually a one-click operation
        if (
            this.val.status == AskStatus.ERROR ||
            this.val.status == AskStatus.LOADED
        ) {
            return this.val;
        }
        const response = await this.endpoint.retrieveAll();
        if (response.error) {
            const v: AskError = {
                status: AskStatus.ERROR,
                message: response.message
            };
            this.changeTo(v);
            return v;
        } else {
            const v: AskLoaded<RecordCollection> = {
                status: AskStatus.LOADED,
                val: response.val
            };
            this.changeTo(v);
            return v;
        }
    }
    async dependOnRecordCollection(): Promise<RecordCollection> {
        const v = await this.loadRecordCollection();
        if (v.status == AskStatus.ERROR) {
            throw v.message;
        } else {
            return v.val;
        }
    }
    async updateRecord(record: Record): Promise<AskFinished<null>> {
        if (this.val.status == AskStatus.ERROR) {
            return this.val;
        }
        if (this.val.status == AskStatus.LOADING) {
            // shouldn't happen!
            throw new Error(
                'attempted to update record before records were loaded'
            );
        }
        const response = await this.endpoint.update(record);
        if (response.error) {
            const v: AskError = {
                status: AskStatus.ERROR,
                message: response.message
            };
            return v;
        } else {
            const v: AskLoaded<null> = {
                status: AskStatus.LOADED,
                val: null
            };

            // update the client to match the server (sync)
            this.val.val[record.id] = record;
            this.change.trigger();

            return v;
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

    createMarker(id: number, builder: (record: Record) => JQuery): JQuery {
        const record = this.state.getRecordOrFail(id);
        return builder(record);
    }

    createLabel(id: number, builder: (record: Record) => string): string {
        const record = this.state.getRecordOrFail(id);
        return builder(record);
    }

    async makeTiledViewWindow(id: number): Promise<void> {
        let records: RecordCollection = null;
        try {
            records = await this.state.dependOnRecordCollection();
        } catch (err) {
            alert(stringifyError(err));
            return;
        }
        const form = this.makeFormWidget();
        form.setAllValues(records[String(id)]);
        const windowLabel =
            'View ' + this.createLabel(id, record => record.friendlyFullName);
        const { closeWindow } = useTiledWindow(
            container('<span></span>')(windowLabel),
            container('<div></div>')(
                container('<h1></h1>')(windowLabel),
                form.dom
            ),
            ActionBarWidget([
                ['Edit', () => this.makeTiledEditWindow(id)],
                ['Delete', () => this.makeTiledDeleteWindow(id)],
                ['Close', () => closeWindow()]
            ]).dom,
            windowLabel
        );
    }

    async makeTiledEditWindow(id: number): Promise<void> {
        let records: RecordCollection = null;
        try {
            records = await this.state.dependOnRecordCollection();
        } catch (err) {
            alert(stringifyError(err));
            return;
        }
        const form = this.makeFormWidget();
        form.setAllValues(records[String(id)]);
        const windowLabel =
            'Edit ' + this.createLabel(id, record => record.friendlyFullName);
        const { closeWindow } = useTiledWindow(
            container('<span></span>')(windowLabel),
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
    }

    makeTiledDeleteWindow(id: number) {
        const { windowWidget, closeWindow } = useTiledWindow(
            $('<span>Delete?</span>'),
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
            'Delete?'
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
        }[]
    >([])
};

/*

WINDOW-RELATED GLOBAL METHODS

*/

export function addWindow(window: Widget, windowKey: number, title: string) {
    state.tiledWindows.val.push({
        key: windowKey,
        window,
        visible: true,
        title
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
    return { fields };
}

export type UnprocessedResourceInfo = {
    fields: [string, FormFieldType][]; // name, string/number, type
    fieldNameMap: { [name: string]: string };
    tableFields: string[];
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
export const tutorsInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig()],
    fieldNameMap,
    tableFields: ['friendlyFullName', 'grade']
};
export const learnersInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig()],
    fieldNameMap,
    tableFields: ['friendlyFullName', 'grade']
};
export const requestsInfo: UnprocessedResourceInfo = {
    fields: [
        ['learner', NumberField('id')],
        [
            'status',
            SelectField(['unchecked', 'checked'], ['Unchecked', 'Checked'])
        ]
    ],
    fieldNameMap,
    tableFields: ['learner', 'status']
};

export const bookingsInfo: UnprocessedResourceInfo = {
    fields: [
        ['learner', StringField('text')],
        ['tutor', StringField('text')],
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
    tableFields: ['learner', 'tutor', 'status']
};

export const matchingsInfo: UnprocessedResourceInfo = {
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
    tableFields: ['learner', 'tutor', 'status']
};

export const requestSubmissionsInfo: UnprocessedResourceInfo = {
    fields: [...makeBasicStudentConfig()],
    fieldNameMap,
    tableFields: ['friendlyFullName']
};

export const tutors = new Resource('tutors', processResourceInfo(tutorsInfo));
export const learners = new Resource(
    'tutors',
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
