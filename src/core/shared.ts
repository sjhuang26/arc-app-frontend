import { askServer } from './server';

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
};
export function FunctionalWidget(dom: JQuery) {
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

RESOURCES

*/

export class ResourceEndpoint {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
    askEndpoint(...partialArgs: any[]): object {
        return askServer([this.name].concat(partialArgs));
    }

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
export class ResourceObservable extends ObservableState<object> {
    endpoint: ResourceEndpoint;

    constructor(endpoint: ResourceEndpoint) {
        super({
            loaded: false,
            error: false
        });
        this.endpoint = endpoint;
    }
    async load(): Promise<object> {
        const response = await this.endpoint.retrieveAll();
        this.changeTo({
            ...response,
            loaded: true
        });
        return response;
    }
}
export class Resource {
    name: string;
    endpoint: ResourceEndpoint;
    state: ResourceObservable;
    constructor(name: string) {
        this.name = name;
        this.endpoint = new ResourceEndpoint(this.name);
        this.state = new ResourceObservable(this.endpoint);
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
    tiledWindows: new ObservableState<JQuery[]>([])
};

export const tutors = new Resource('tutors');
export const requests = new Resource('requests');
export const bookings = new Resource('bookings');
export const matchings = new Resource('matchings');
export const requestSubmissions = new Resource('requestSubmissions');
