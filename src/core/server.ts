export async function askServer(args: any[]): Promise<ServerResponse> {
    return mockServer(args);
}
export type ServerResponse = {
    error: boolean;
    val: any;
    message: string;
};

export enum AskStatus {
    LOADING = 'LOADING',
    LOADED = 'LOADED',
    ERROR = 'ERROR'
}

export type Ask =
    | {
          status: AskStatus.LOADING;
      }
    | {
          status: AskStatus.LOADED;
          val: any;
      }
    | {
          status: AskStatus.ERROR;
          message: string;
      };

async function mockServer(args: any[]): Promise<ServerResponse> {
    return Promise.resolve({
        error: false,
        val: {
            foobar: args,
            foobar2: 5
        },
        message: ''
    });
}

export namespace serverMethods {
    export async function refreshRequestSubmissionsWithForm() {
        return askServer(['refreshRequestSubmissionsWithForm']);
    }

    export async function debug() {
        return askServer(['debug']);
    }
}
