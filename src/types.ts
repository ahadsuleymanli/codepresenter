export interface CodeSection{
	section_signature: string;
	span: { start: number; end: number };
}

export interface TabContext {
	name: string;
	full_code?: string;
	code_sections: CodeSection[];
}

export interface Slide {
    tab_names: string[];
    tab_code_sections: [number, number][];
	slide_talking_points: string[]
}

export interface OpenAIResponseObj {
    slides: Slide[];
    ai_notes: string;
}

export interface OpenAIChoice {
    message: {
        role: string;
        content: string;
    };
}

export interface OpenAIResponse {
    choices: OpenAIChoice[];
}
