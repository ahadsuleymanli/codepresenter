import * as vscode from 'vscode';
import { Slide, TabContext } from './types';
import { getOpenTabsContexts } from './openTabs'; // Ensure you import this function

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

    // Retrieve tab contexts
    const tabContexts = await getOpenTabsContexts();

    const thumbnails: { name: string; image: string }[] = [];

    for (const slide of slides) {
        // Create a map for fast access
        const tabContentMap = new Map<string, string>();
        for (const tabContext of tabContexts) {
            tabContentMap.set(tabContext.name, tabContext.full_code?? "");
        }

        // Generate highlighted code sections for the slide
        const codeSections = await getHighlightedCodeSections(slide, tabContentMap, highlighter);

        // Use highlighted HTML directly
        thumbnails.push({ name: slide.tab_names.join('-'), image: codeSections.join('<hr>') });
    }

    console.log(slides);
    console.log(thumbnails);
    return thumbnails;
}

async function getHighlightedCodeSections(slide: Slide, tabContentMap: Map<string, string>, highlighter: any): Promise<string[]> {
    const codeSections: string[] = [];

    for (const [startLine, endLine] of slide.tab_code_sections) {
        const tabName = slide.tab_names[0]; // Assuming there's only one tab per section for simplicity
        const fullText = tabContentMap.get(tabName);
        console.log("\nfullText:");
        console.log(fullText);
        if (fullText) {
            const code = fullText.split('\n').slice(startLine, endLine + 1).join('\n');
            const highlighted = highlighter.codeToHtml(code, { lang: 'typescript', themes: {dark: 'github-dark', light: 'github-light'} });  // Assuming TypeScript
            codeSections.push(highlighted);
        }
    }

    return codeSections;
}
