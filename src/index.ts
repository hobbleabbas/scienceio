const axios = require("axios");

const config = {
    API_URL: 'https://api.aws.science.io/v2',
    HELP_EMAIL: 'api_support@science.io',
    SETTINGS_DIR: 'settings',
    SETTINGS_FILE: 'settings.json',
    DEFAULT_TIMEOUT: 1200,
    MAX_POLL_DURATION_SEC: 300,
    POLL_SLEEP_DURATION_SEC: 2,
    MAX_CHARACTERS: 10000
}

enum scienceio_inference_status {
    SUBMITTED = "SUBMITTED",
    COMPLETED = "COMPLETED",
    ERRORED = "ERRORED",
}

enum scienceio_model_type {
    STRUCTURE = "structure",
    ANNOTATE = "annotate",
}

export interface ScienceIOResponse {
    request_id: string,
    text: string | null,
    inference_status: scienceio_inference_status,
    message?: string | null,
    spans?: any | null,
    model_type: scienceio_model_type
}

class ScienceIOError extends Error {
    // Base class for all exceptions that are raised by the ScienceIO SDK.
    constructor(message?: string) {
        super(message ? message : "Error in request to ScienceIO API")
        this.name = 'ScienceIOError'
    }
}

class HTTPError extends ScienceIOError {
    // Exception raised when the ScienceIO API returns an HTTP error.
    status_code: number

    constructor(status_code: number, message?: string) {
        super(message ? message : "HTTP Error in request to ScienceIO API")
        this.name = 'HTTPError'
        this.status_code = status_code
    }
}

class TimeoutError extends ScienceIOError {
    // Exception raised when the ScienceIO API times out.
    constructor(message?: string) {
        super(message ? message : "Timeout in request to ScienceIO API")
        this.name = 'TimeoutError'
    }
}

enum ResponseFormat {
    JSON = 'application/json'
}

interface HeaderFormat {
    "Content-Type": "application/json"
    "x-api-id": string | null
    "x-api-secret": string | null
}

export class ScienceIO {

    timeout: number
    headers: HeaderFormat
    axios_instance: any

    constructor(
        scienceio_api_id: string,
        scienceio_api_secret: string,
        response_format: ResponseFormat = ResponseFormat.JSON,
        timeout: number = config.DEFAULT_TIMEOUT
    ) {
        this.headers = { "Content-Type": "application/json", "x-api-id": scienceio_api_id, "x-api-secret": scienceio_api_secret }
        this.timeout = timeout
        this.axios_instance = axios.create()

        // Set the defaults for the axios instance
        this.axios_instance.defaults.baseURL = config.API_URL;
        this.axios_instance.defaults.headers.common["Content-type"] = response_format;

        this.axios_instance.defaults.headers.common["x-api-id"] = this.headers["x-api-id"];
        this.axios_instance.defaults.headers.common["x-api-secret"] = this.headers["x-api-secret"];
    }

    _construct_poll_url(request_id: string) : string {
        return `${config.API_URL}/structure/${request_id}`
    }

    _construct_structure_url() : string {
        return `${config.API_URL}/structure`
    }

    async send_initial_request(text: string) {
        /**
         * Send initial request to ScienceIO API

            Args:
                url: URL to send request to
                text: Text to annotate
                headers: Headers for request

            Returns:
                ScienceIOResponse object - contains request_id
         */

        const response = await this.axios_instance.post("structure", { text: text })

        if (200 < response.status && response.status < 300) {
            return response.data.request_id
        } else {
            _response_handler(response)
        }
    }

    async _poll_attempt(request_id: string) {
        /**
         * Get response from ScienceIO API

            Args:
                url: URL to send request to
                headers: Headers for request

            Returns:
                ScienceIOResponse object
         */

        const response = await this.axios_instance.get(this._construct_poll_url(request_id))

        if (199 < response.status && response.status < 300) {
            return _poll_payload_handler(response.data)
        } else {
            _response_handler(response)
        }
    }

    async annotate(text: string) {
        /**
         * Process text into MAX_CHARACTER segments, and then request those
         */
        if (text.length < 1) { return new ScienceIOError("Must pass at least one character to the API"); }
        
        let chunks = []
        
        while (text.length > 0) {
            let spliced_text = text.slice(0, config.MAX_CHARACTERS)
            let last_char = spliced_text[spliced_text.length - 1]
            let next_char = text[spliced_text.length]
            
            if (last_char != " " && next_char != " " && next_char != undefined) {
                // If the last character was a character, and so is the next, you're in the middle of a word
                // We also make sure to check that next_char is not undefined, so that we dont accidentally trunucate the end of the input
                
                // In this case, find the last whitespace, and stop the chunk there
                spliced_text = spliced_text.slice(0, spliced_text.lastIndexOf(' ') + 1)
                chunks.push(spliced_text)
                text = text.slice(spliced_text.length);
            } else {
                chunks.push(spliced_text)
                text = text.slice(config.MAX_CHARACTERS);
            }
            
        }

        let requests = []

        for (const chunk of chunks) {
            requests.push(this._annotate_request(chunk))
        }

        const responses = await Promise.all(requests)

        return responses
    }

    private async _annotate_request(text: string) {
        /**
         * Annotate text
         * Args:
         *    text: Text to annotate    
         * Returns:
         *   ScienceIOResponse object
         * Raises:
         *  ScienceIOError: If the ScienceIO API returns an error
         *  HTTPError: If the ScienceIO API returns an HTTP error
         **/

        // Make initial request
        const request_id = await this.send_initial_request(text)
        const time_start = new Date().getTime()

        // Poll for response
        let response: any = null;

        while (response == null && (new Date().getTime() - time_start) < config.MAX_POLL_DURATION_SEC * 1000) {
            response = await this._poll_attempt(request_id)
            setTimeout(() => { }, config.POLL_SLEEP_DURATION_SEC * 1000)
        }

        if (response == null) {
            throw new TimeoutError()
        } 

        // Create ScienceIO response object
        const scienceio_response: ScienceIOResponse = {
            request_id: request_id,
            text: response.text,
            inference_status: scienceio_inference_status.COMPLETED,
            spans: response.spans,
            model_type: scienceio_model_type.STRUCTURE
        }
        
        return scienceio_response
    }

}

function _response_handler(raw_response: any) {
    const status_code: number = raw_response.status

    if (status_code < 200 || status_code > 299) {
        throw new HTTPError(status_code, raw_response.data.message)
    }
}

function _poll_payload_handler(payload: any) : any | null {
    /**
     * Returns the payload for the poll request
     */
    switch (payload.inference_status) {
        case scienceio_inference_status.SUBMITTED:
            return null
        case scienceio_inference_status.COMPLETED:
            return payload.inference_result
        case scienceio_inference_status.ERRORED:
            throw new ScienceIOError(payload.message)
        default:
            throw new ScienceIOError("Unknown status")
    }
}