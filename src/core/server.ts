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
                rej(JSON.stringify({
                    error: true,
                    message: 'Server is not responding',
                    val: null
                })),
            5000
        );
        p.then(res);
    });
}

export function convertServerStringToAskFinished<T>(
    str: any
): AskFinished<T> {
    try {
        if (typeof str !== 'string') {
            throw new Error('server response not in correct type');
        } else {
            try {
                const response: ServerResponse<T> = JSON.parse(str);
                if (typeof response !== 'object' || typeof response.error !== 'boolean') {
                    throw new Error('server response not in correct type');
                } else if (response.error) {
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
            } catch (err) {
                throw new Error('parsing issue >> ' + stringifyError(err));
            }
        }
    } catch (err) {
        const v: AskError = {
            status: AskStatus.ERROR,
            message: 'during convert >> ' + stringifyError(err)
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
    let result: string = JSON.stringify({
        error: true,
        val: null,
        message: 'Mysterious error'
    });
    try {
        if (window['APP_DEBUG_MOCK'] !== 1) {
            console.log('[server]    args', args);
            result = await failAfterFiveSeconds(realServer(args));
            console.log('[server]  result', args, '=>', result);
        } else {
            console.log('[MOCK server]   args', args);
            result = await failAfterFiveSeconds(mockServer(args));
            console.log('[MOCK server] result', args, '=>', result);
        }
    } catch (err) {
        result = JSON.stringify({
            status: AskStatus.ERROR,
            message: 'askserver error >> ' + stringifyError(err)
        });
    }
    return convertServerStringToAskFinished(result);
}

/*
KEY CONCEPT: how data is kept in sync (BUT THIS IS 100% TODO)
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

// An ASK is a request sent to the server. Either the ASK is loading, or it is loaded successfully, or there is an error.

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

// The point of the mock server is for demos, where we don't want to link to the real spreadsheet with the real data.

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
        if (args[0] === 'retrieveAll') {
            return this.success(this.contents);
        }
        if (args[0] === 'update') {
            this.contents[String(args[1].id)] = args[1];
            onClientNotification(['update', this.resource().name, args[1]]);
            return this.success(null);
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

// You can edit this to add fake demo data, if you want.

export const mockResourceServerEndpoints = {
    tutors: new MockResourceServerEndpoint(() => tutors, {
    }),
    learners: new MockResourceServerEndpoint(() => learners, {
    }),
    bookings: new MockResourceServerEndpoint(() => bookings, {}),
    matchings: new MockResourceServerEndpoint(() => matchings, {}),
    requests: new MockResourceServerEndpoint(() => requests, {}),
    requestSubmissions: new MockResourceServerEndpoint(
        () => requestSubmissions, {}
    )
};



async function realServer(args: any[]): Promise<string> {
    function getGoogleAppsScriptEndpoint() {
        if (window['google'] === undefined || window['google'].script === undefined) {
            // This will be displayed to the user
            throw 'You should turn on testing mode. Click OTHER >> TESTING MODE.';
        }
        return window['google'].script.run;
    }
    let result: any = 'Mysterious error';
    try {
        result = await new Promise((res, rej) => {
            getGoogleAppsScriptEndpoint().withFailureHandler(rej).withSuccessHandler(res).onClientAsk(args)
        });
        // NOTE: an "error: true" response is still received by the client through withSuccessHandler().
    } catch (err) {
        result = JSON.stringify({
            error: true,
            val: null,
            message: stringifyError(err)
        });
    }
    if (typeof result !== 'string') {
        result = JSON.stringify({
            error: true,
            val: null,
            message: stringifyError('not a string: ' + String(result))
        });
    }
    return result;
}

async function mockServer(args: any[]): Promise<any> {
    let result: any = 'Mysterious error';

    // only for resources so far
    try {
        const mockArgs = JSON.parse(JSON.stringify(args));

        result = JSON.stringify(await mockResourceServerEndpoints[mockArgs[0]].replyToClientAsk(
            mockArgs.slice(1)
        ));
    } catch (err) {
        result = JSON.stringify({
            error: true,
            val: null,
            message: stringifyError(err)
        });
    }

    if (typeof result !== 'string') {
        result = JSON.stringify({
            error: true,
            val: null,
            message: stringifyError('not a string: ' + String(result))
        });
    }
    return result;
}
