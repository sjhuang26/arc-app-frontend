import {
    askServer,
    ServerResponse,
    Ask,
    AskStatus,
    AskFinished,
    AskError,
    AskLoaded
} from './server';
import {
    FormWidget,
    preprocessFormConfig,
    makeBasicStudentConfig
} from '../widgets/Form';
import { useTiledWindow } from '../widgets/Window';

import {
    StringField,
    NumberField,
    SelectField,
    LoaderWidget
} from '../widgets/ui';
import { ActionBarWidget } from '../widgets/ActionBar';

/*

ALL BASIC CLASSES AND BASIC UTILS

*/

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

export function container(newTag: string): (...children: any[]) => JQuery {
    return (...children) => $(newTag).append(...children);
}

export class KeyMaker {
    private nextKey: number = 0;
    makeKey(): number {
        const result = this.nextKey;
        this.nextKey += 1;
        return result;
    }
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
}

export class Resource {
    name: string;
    endpoint: ResourceEndpoint;
    state: ResourceObservable;
    makeFormWidget: () => FormWidget;

    constructor(name: string, makeFormWidget: () => FormWidget) {
        this.name = name;
        this.endpoint = new ResourceEndpoint(this.name);
        this.state = new ResourceObservable(this.endpoint);
        this.makeFormWidget = makeFormWidget;
    }

    createMarker(id: number, builder: (record: Record) => JQuery): JQuery {
        if (this.state.val.status === AskStatus.LOADED) {
            const record = this.state.val.val.records.filter(
                (record: Record) => record.id == id
            )[0];
            if (record === undefined || record === null)
                return $('<span>???</span>');
            return builder(record);
        } else {
            return $('<span>???</span>');
        }
    }

    makeTiledViewWindow(id: number): Widget {
        const loaderWidget = LoaderWidget();
        const { windowWidget, closeWindow } = useTiledWindow(
            $('<span>View</span>'),
            container('<div></div>')(
                container('<h1></h1>')('View'),
                loaderWidget.dom
            ),
            ActionBarWidget([
                ['Edit', () => this.makeTiledEditWindow(id)],
                ['Delete', () => this.makeTiledDeleteWindow(id)],
                ['Close', () => closeWindow]
            ]).dom,
            'View'
        );
        this.state
            .dependOnRecordCollection()
            .then(v => {
                const form = this.makeFormWidget();
                form.setAllValues(v[id]);
                loaderWidget.onLoaded(form.dom);
            })
            .catch(v => {
                loaderWidget.onError(v);
            });

        return windowWidget;
    }

    async makeTiledEditWindow(id: number): Promise<Widget> {
        const loaderWidget = LoaderWidget();
        let saveAction: () => void = () => {
            // You can't save it! It isn't loaded!
            // (do nothing)
        };

        const { windowWidget, closeWindow } = useTiledWindow(
            $('<span>Edit</span>'),
            container('<div></div>')(
                container('<h1></h1>')('Edit'),
                loaderWidget.dom
            ),
            ActionBarWidget([
                ['Save', () => saveAction],
                ['Cancel', () => closeWindow]
            ]).dom,
            'Edit'
        );

        this.state
            .dependOnRecordCollection()
            .then(v => {
                const form = this.makeFormWidget();
                form.setAllValues(v[id]);
                saveAction = () => this.endpoint.update(form.getAllValues());
                loaderWidget.onLoaded(form.dom);
            })
            .catch(v => {
                loaderWidget.onError(v);
            });

        return windowWidget;
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
                            .then(() => console.log('Deletion successful!'))
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
    page: new ObservableState('a'),
    testLoad: new ObservableState(false),
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

export function addWindow(window: Widget, key: number, title: string) {
    state.tiledWindows.val.push({
        key,
        window,
        visible: true,
        title
    });
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
}

/*

RESOURCE INSTANTIATIONS

*/

const formConfigNameMap = {
    firstName: 'First name',
    lastName: 'Last name',
    friendlyName: 'Friendly name',
    friendlyFullName: 'Friendly full name',
    grade: 'Grade',
    learner: 'Learner',
    tutor: 'Tutor',
    status: 'Status'
};
export function makeTutorForm() {
    return FormWidget(
        preprocessFormConfig({
            fields: [...makeBasicStudentConfig()],
            nameToTitle: formConfigNameMap
        })
    );
}
export function makeLearnerForm() {
    return FormWidget(
        preprocessFormConfig({
            fields: [...makeBasicStudentConfig()],
            nameToTitle: formConfigNameMap
        })
    );
}
export function makeRequestForm() {
    return FormWidget(
        preprocessFormConfig({
            fields: [
                ['learner', StringField('text')],
                [
                    'status',
                    SelectField(
                        ['unchecked', 'checked'],
                        ['Unchecked', 'Checked']
                    )
                ]
            ],
            nameToTitle: formConfigNameMap
        })
    );
}
export function makeBookingForm() {
    return FormWidget(
        preprocessFormConfig({
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
            nameToTitle: formConfigNameMap
        })
    );
}

export function makeMatchingForm() {
    return FormWidget(
        preprocessFormConfig({
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
            nameToTitle: formConfigNameMap
        })
    );
}

export function makeRequestSubmissionForm() {
    return FormWidget(
        preprocessFormConfig({
            fields: [...makeBasicStudentConfig()],
            nameToTitle: formConfigNameMap
        })
    );
}

export const tutors = new Resource('tutors', makeTutorForm);
export const requests = new Resource('requests', makeRequestForm);
export const bookings = new Resource('bookings', makeBookingForm);
export const matchings = new Resource('matchings', makeMatchingForm);
export const requestSubmissions = new Resource(
    'requestSubmissions',
    makeRequestSubmissionForm
);
