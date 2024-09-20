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

export interface SlideDTO {
    tab_names: string[];
    tab_paths: string[];
    tab_full_codes: string[];
    tab_code_sections: [number, number][];
	slide_talking_points: string[]
}

export interface ProcessedSlideDTO {
    tab_names: string[];
    tab_paths: string[];
    code_snippets: string[];  // Pre-calculated code snippets to display
    talking_points: string[]; // Pre-calculated talking points
    starting_line: number;    // The starting line of the code snippet for navigation
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
