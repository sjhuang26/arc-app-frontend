import {
    MyTesting,
    Resource,
    RecordCollection,
    tutors,
    learners,
    bookings,
    matchings,
    requests,
    requestSubmissions,
    stringifyError,
    ResourceInfo,
    Record
} from './shared';

function failAfterFiveSeconds<T>(p: Promise<T>): Promise<T> {
    return new Promise((res, rej) => {
        setTimeout(
            () =>
                rej({
                    error: true,
                    message: 'Server is not responding'
                }),
            5000
        );
        p.then(res);
    });
}

export function convertServerResponseToAskFinished<T>(
    response: ServerResponse<T>
): AskFinished<T> {
    if (response.error) {
        const v: AskError = {
            status: AskStatus.ERROR,
            message: response.message
        };
        return v;
    } else {
        const v: AskLoaded<T> = {
            status: AskStatus.LOADED,
            val: response.val
        };
        return v;
    }
}
export function getResultOrFail<T>(askFinished: AskFinished<T>): T {
    if (askFinished.status == AskStatus.ERROR) {
        throw askFinished.message;
    } else {
        return askFinished.val;
    }
}
export async function askServer(args: any[]): Promise<AskFinished<any>> {
    console.log('[server] args', args);
    const result = await failAfterFiveSeconds(realServer(args));
    console.log('[server] result', result);
    return convertServerResponseToAskFinished(result);
}

/*
KEY CONCEPT: how data is kept in sync
Suppose multiple people are using the app at once. When someone sends a change to the server, onClientNotification methods for ALL OTHER clients are called, which basically tell the other clients to "make XYZ change to your local copy of the data".
*/
export async function onClientNotification(args: any[]): Promise<void> {
    console.log('[server notification]', args);
    const getResource: { [name: string]: () => Resource } = {
        tutors: () => tutors,
        learners: () => learners,
        bookings: () => bookings,
        matchings: () => matchings,
        requests: () => requests,
        requestSubmissions: () => requestSubmissions
    };
    if (args[0] === 'update') {
        getResource[args[1]]().state.onServerNotificationUpdate(
            args[2] as Record
        );
    }
    if (args[0] === 'delete') {
        getResource[args[1]]().state.onServerNotificationDelete(
            args[2] as number
        );
    }
    if (args[0] === 'create') {
        getResource[args[1]]().state.onServerNotificationCreate(
            args[2] as Record
        );
    }
}

export type ServerResponse<T> = {
    error: boolean;
    val: T;
    message: string;
};

export enum AskStatus {
    LOADING = 'LOADING',
    LOADED = 'LOADED',
    ERROR = 'ERROR'
}

export type Ask<T> = AskLoading | AskFinished<T>;

export type AskLoading = { status: AskStatus.LOADING };
export type AskFinished<T> = AskLoaded<T> | AskError;

export type AskError = {
    status: AskStatus.ERROR;
    message: string;
};

export type AskLoaded<T> = {
    status: AskStatus.LOADED;
    val: T;
};

class MockResourceServerEndpoint {
    resource: () => Resource;
    contents: RecordCollection;
    nextKey: number = 1000; // default ID is very high for testing purposes

    constructor(resource: () => Resource, contents: RecordCollection) {
        // IMPORTANT: the resource field is ":() => Resource" intentionally.
        // The general rule is that exported variables from another module
        // aren't available until runtime.

        // Making it ":Resource" directly, results in an error.

        this.resource = resource;
        this.contents = contents;
    }

    success(val: any): ServerResponse<any> {
        return {
            error: false,
            message: null,
            val
        };
    }

    error(message: string): ServerResponse<any> {
        return {
            error: true,
            message,
            val: null
        };
    }

    processClientAsk(args: any[]): ServerResponse<any> {
        console.log('[mock server] endpoint', this.resource().name, args);
        if (args[0] === 'retrieveAll') {
            return this.success(this.contents);
        }
        if (args[0] === 'update') {
            this.contents[String(args[1].id)] = args[1];
            onClientNotification(['update', this.resource().name, args[1]]);
            return this.success(null);
        }
        if (args[0] === 'retrieveDefault') {
            const result = {
                id: -1,
                date: Date.now()
            };
            for (const { name } of this.resource().info.fields) {
                if (result[name] === undefined) {
                    result[name] = '';
                }
            }
            return this.success(result);
        }
        if (args[0] === 'create') {
            if (args[1].date === -1) {
                args[1].date = Date.now();
            }
            if (args[1].id === -1) {
                args[1].id = this.nextKey;
                ++this.nextKey;
            }
            this.contents[String(args[1].id)] = args[1];
            onClientNotification(['create', this.resource().name, args[1]]);
            return this.success(this.contents[String(args[1].id)]);
        }
        if (args[0] === 'delete') {
            delete this.contents[String(args[1])];
            onClientNotification(['delete', this.resource().name, args[1]]);
            return this.success(null);
        }
        throw new Error('args not matched');
    }

    async replyToClientAsk(args: any[]): Promise<ServerResponse<any>> {
        return new Promise((res, rej) => {
            setTimeout(() => {
                try {
                    res(this.processClientAsk(args));
                } catch (v) {
                    rej(v);
                }
            }, 500); // fake a half-second delay
        });
    }
}

export const mockResourceServerEndpoints = {
    tutors: new MockResourceServerEndpoint(() => tutors, {
        '1': {
            id: 1,
            date: 1561334668346,
            firstName: 'John',
            lastName: 'Doe',
            friendlyName: 'Jo',
            friendlyFullName: 'Jo-Do',
            grade: 12,
            mods: [1, 2],
            modsPref: [1],
            subjectList: 'Geometry, Spanish'
        },
        '2': {
            id: 2,
            date: 1561335668346,
            firstName: 'Mary',
            lastName: 'Watson',
            friendlyName: 'Ma',
            friendlyFullName: 'Ma-W',
            grade: 9,
            mods: [3, 4],
            modsPref: [4],
            subjectList: 'English, French'
        }
    }),
    learners: new MockResourceServerEndpoint(() => learners, {
        '1': {
            id: 1,
            date: 1561334668346,
            firstName: 'Alex',
            lastName: 'Doe',
            friendlyName: 'Al',
            friendlyFullName: 'Al-D',
            grade: 12
        }
    }),
    bookings: new MockResourceServerEndpoint(() => bookings, {}),
    matchings: new MockResourceServerEndpoint(() => matchings, {}),
    requests: new MockResourceServerEndpoint(() => requests, {}),
    requestSubmissions: new MockResourceServerEndpoint(
        () => requestSubmissions,
        {
            '1': {
                firstName: 'a',
                lastName: 'b',
                friendlyName: 'c',
                friendlyFullName: 'd',
                grade: 1,
                mods: [1, 3, 4],
                subject: 'asdf',
                id: 1,
                date: 1561730705297
            }
        }
    )
};

async function realServer(args: any[]): Promise<ServerResponse<any>> {
    try {
        const val: ServerResponse<any> = await new Promise((res, rej) => {
            window['google'].script.run.withFailureHandler(rej).withSuccessHandler(res).onClientAsk(args)
        });
        // NOTE: an "error: true" response is still received by the client through withSuccessHandler().
        return val;
    } catch (err) {
        return {
            error: true,
            val: null,
            message: stringifyError(err)
        };
    }
}
async function mockServer(args: any[]): Promise<ServerResponse<any>> {
    // only for resources so far
    try {
        const mockArgs = JSON.parse(JSON.stringify(args));

        return await mockResourceServerEndpoints[mockArgs[0]].replyToClientAsk(
            mockArgs.slice(1)
        );
    } catch (err) {
        return {
            error: true,
            val: null,
            message: stringifyError(err)
        };
    }
}

export namespace serverMethods {
    export async function refreshRequestSubmissionsWithForm() {
        return askServer(['refreshRequestSubmissionsWithForm']);
    }

    export async function debug() {
        return askServer(['debug']);
    }
}
