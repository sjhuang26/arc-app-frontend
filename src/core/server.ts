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
    return failAfterFiveSeconds(mockServer(args));
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

async function mockServer(args: any[]): Promise<ServerResponse<any>> {
    console.log(args);
    return {
        error: true,
        val: null,
        message: 'Mock server'
    };
}

export namespace serverMethods {
    export async function refreshRequestSubmissionsWithForm() {
        return askServer(['refreshRequestSubmissionsWithForm']);
    }

    export async function debug() {
        return askServer(['debug']);
    }
}
