import { askServer, ServerResponse, Ask, AskStatus } from './server';
import { LookupAddress } from 'dns';
import {
    FormWidget,
    preprocessFormConfig,
    makeBasicStudentConfig
} from '../widgets/Form';
import { StringField, NumberField, SelectField } from '../widgets/ui';

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

/*

RESOURCES

*/

export class ResourceEndpoint {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
    async askEndpoint(...partialArgs: any[]): Promise<ServerResponse> {
        return askServer([this.name].concat(partialArgs));
    }

    // NOTE: ALL THESE RETURN PROMISES

    retrieveAll() {
        return this.askEndpoint('retrieveAll');
    }
    retrieveDefault() {
        return this.askEndpoint('retrieveDefault');
    }
    retrieve(id: number) {
        return this.askEndpoint('retrieve', id);
    }
    create(record: object) {
        return this.askEndpoint('create', record);
    }
    delete(id: number) {
        return this.askEndpoint('delete', id);
    }
    debug() {
        return this.askEndpoint('debug');
    }
    update(record: object) {
        return this.askEndpoint('update', record);
    }
}
export class ResourceObservable extends ObservableState<Ask> {
    endpoint: ResourceEndpoint;

    constructor(endpoint: ResourceEndpoint) {
        super({
            status: AskStatus.LOADING
        });
        this.endpoint = endpoint;
    }
    async load() {
        const response = await this.endpoint.retrieveAll();
        if (response.error) {
            this.changeTo({
                status: AskStatus.ERROR,
                message: response.message
            });
        } else {
            this.changeTo({
                status: AskStatus.LOADED,
                val: response.val as Record[]
            });
        }
    }
}

export class Resource {
    name: string;
    endpoint: ResourceEndpoint;
    state: ResourceObservable;
    makeFormWidget: () => Widget;

    constructor(name: string, makeFormWidget: () => Widget) {
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

    createViewWindow() {
        return;
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
