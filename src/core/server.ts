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
    stringifyError
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

export async function askServer(args: any[]): Promise<ServerResponse<any>> {
    console.log('[server] args', args);
    const result = await failAfterFiveSeconds(mockServer(args));
    console.log('[server] result', result);
    return result;
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

    processClientAsk(args: any[]): ServerResponse<any> {
        console.log('[mock server] endpoint', this.resource().name, args);
        if (args[0] === 'retrieveAll') {
            return this.success(this.contents);
        }
        if (args[0] === 'update') {
            this.contents[String(args[1].id)] = args[1];
            return this.success(null);
        }
    }

    async replyToClientAsk(args: any[]): Promise<ServerResponse<any>> {
        return new Promise((res, rej) => {
            setTimeout(() => res(this.processClientAsk(args)), 500);
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
            grade: 12
        },
        '2': {
            id: 1,
            date: 1561335668346,
            firstName: 'Mary',
            lastName: 'Watson',
            friendlyName: 'Ma',
            friendlyFullName: 'Ma-W',
            grade: 9
        }
    }),
    learners: new MockResourceServerEndpoint(() => learners, {}),
    bookings: new MockResourceServerEndpoint(() => bookings, {}),
    matchings: new MockResourceServerEndpoint(() => matchings, {}),
    requests: new MockResourceServerEndpoint(() => requests, {}),
    requestSubmissions: new MockResourceServerEndpoint(
        () => requestSubmissions,
        {}
    )
};

async function mockServer(args: any[]): Promise<ServerResponse<any>> {
    // only for resources ;)
    try {
        return await mockResourceServerEndpoints[args[0]].replyToClientAsk(
            args.slice(1)
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
