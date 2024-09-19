import * as vscode from 'vscode';
import { Slide } from './types';

let shiki: any;
let getHighlighter: any;

async function loadShiki() {
  if (!shiki) {
    shiki = await import('shiki');
    const { createHighlighter, makeSingletonHighlighter } = shiki;

    // Create a singleton highlighter
    getHighlighter = makeSingletonHighlighter(createHighlighter);
  }
  return shiki;
}

export async function generateThumbnails(slides: Slide[]): Promise<{ name: string; image: string }[]> {
    await loadShiki();
    const highlighter = await getHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: [
            'typescript', // Add any additional languages you need here
        ],
    });

    const thumbnails: { name: string; image: string }[] = [];

    for (const slide of slides) {
        // Load the text for the tabs involved in the slide
        const tabContexts = await loadTabContexts(slide.tab_names);

        // Generate highlighted code sections for the slide
        const codeSections = await getHighlightedCodeSections(slide, tabContexts, highlighter);

        // Use highlighted HTML directly
        thumbnails.push({ name: slide.tab_names.join('-'), image: codeSections.join('<hr>') });
    }

    return thumbnails;
}

async function loadTabContexts(tabNames: string[]): Promise<{ [tabName: string]: string }> {
    const tabContexts: { [tabName: string]: string } = {};

    for (const tabName of tabNames) {
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(tabName));
        tabContexts[tabName] = document.getText();
    }

    return tabContexts;
}

async function getHighlightedCodeSections(slide: Slide, tabContexts: { [tabName: string]: string }, highlighter: any): Promise<string[]> {
    const codeSections: string[] = [];

    for (const [startLine, endLine] of slide.tab_code_sections) {
        const tabName = slide.tab_names[0]; // Assuming there's only one tab per section for simplicity
        const code = tabContexts[tabName].split('\n').slice(startLine, endLine + 1).join('\n');
        const highlighted = highlighter.codeToHtml(code, { lang: 'typescript', themes: {dark: 'github-dark', light: 'github-light'} });  // Assuming TypeScript
        codeSections.push(highlighted);
    }

    return codeSections;
}
